const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { requireAuth, requireDono, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/mesas — retorna mesas + salões + estado atual de cada mesa
router.get('/', async (req, res, next) => {
  try {
    const [{ rows: mesas }, { rows: saloes }, { rows: estados }] = await Promise.all([
      query('SELECT id, nome, salao FROM mesas WHERE ativo = TRUE ORDER BY id'),
      query('SELECT nome FROM saloes ORDER BY id'),
      query(`
        SELECT
          em.mesa_id,
          em.status,
          em.aberta_em,
          COALESCE(
            json_agg(
              json_build_object(
                'id', pm.id, 'itemId', pm.item_id, 'nome', pm.nome,
                'quantidade', pm.quantidade, 'preco', pm.preco::float,
                'obs', pm.obs, 'adicionadoEm', EXTRACT(EPOCH FROM pm.criado_em) * 1000
              ) ORDER BY pm.criado_em
            ) FILTER (WHERE pm.id IS NOT NULL),
            '[]'
          ) AS pedidos
        FROM estado_mesas em
        LEFT JOIN pedidos_mesa pm ON pm.mesa_id = em.mesa_id
        GROUP BY em.mesa_id, em.status, em.aberta_em
      `),
    ]);

    const estadoMesas = {};
    for (const e of estados) {
      estadoMesas[e.mesa_id] = {
        status: e.status,
        abertaEm: e.aberta_em ? new Date(e.aberta_em).getTime() : null,
        pedidos: e.pedidos,
      };
    }

    res.json({ mesas, saloes: saloes.map(s => s.nome), estadoMesas });
  } catch (err) { next(err); }
});

// PUT /api/mesas/:id/estado — atualiza estado da mesa (status + pedidos)
router.put('/:id/estado',
  param('id').isInt({ min: 1 }),
  body('status').isIn(['livre', 'ocupada', 'aguardando']),
  body('pedidos').isArray(),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });

    try {
      const mesaId = parseInt(req.params.id);
      const { status, pedidos, abertaEm } = req.body;

      await transaction(async (client) => {
        // Upsert no estado da mesa
        await client.query(
          `INSERT INTO estado_mesas (mesa_id, status, aberta_em)
           VALUES ($1, $2, $3)
           ON CONFLICT (mesa_id) DO UPDATE SET status = $2, aberta_em = $3`,
          [mesaId, status, abertaEm ? new Date(abertaEm) : null]
        );

        // Reconstruir itens da mesa de forma atômica
        await client.query('DELETE FROM pedidos_mesa WHERE mesa_id = $1', [mesaId]);

        for (const p of pedidos) {
          if (!p.nome || p.quantidade < 1 || p.preco < 0) continue;
          await client.query(
            `INSERT INTO pedidos_mesa (mesa_id, item_id, nome, quantidade, preco, obs, criado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              mesaId,
              p.itemId || p.item_id || null,
              String(p.nome).substring(0, 100),
              parseInt(p.quantidade),
              parseFloat(p.preco),
              String(p.obs || '').substring(0, 200),
              p.adicionadoEm ? new Date(p.adicionadoEm) : new Date(),
            ]
          );
        }
      });

      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

// POST /api/mesas — criar nova mesa (somente dono)
router.post('/', requireDono,
  body('nome').trim().isLength({ min: 1, max: 50 }),
  body('salao').trim().isLength({ min: 1, max: 50 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos' });
    try {
      const { nome, salao } = req.body;
      const { rows } = await query(
        'INSERT INTO mesas (nome, salao) VALUES ($1,$2) RETURNING id, nome, salao',
        [nome, salao]
      );
      await query(
        'INSERT INTO estado_mesas (mesa_id, status) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [rows[0].id, 'livre']
      );
      await auditLog(req.user.id, 'CRIAR_MESA', 'mesas', rows[0].id, { nome, salao }, req.ip);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/mesas/:id — desativar mesa (somente dono)
router.delete('/:id', requireDono,
  param('id').isInt({ min: 1 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'ID inválido' });
    try {
      await query('UPDATE mesas SET ativo = FALSE WHERE id = $1', [req.params.id]);
      await auditLog(req.user.id, 'REMOVER_MESA', 'mesas', req.params.id, null, req.ip);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

// GET /api/mesas/saloes
router.get('/saloes', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT nome FROM saloes ORDER BY id');
    res.json(rows.map(r => r.nome));
  } catch (err) { next(err); }
});

// POST /api/mesas/saloes (somente dono)
router.post('/saloes', requireDono,
  body('nome').trim().isLength({ min: 1, max: 50 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos' });
    try {
      await query('INSERT INTO saloes (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING', [req.body.nome]);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  }
);

// DELETE /api/mesas/saloes/:nome (somente dono)
router.delete('/saloes/:nome', requireDono, async (req, res, next) => {
  try {
    await query('DELETE FROM saloes WHERE nome = $1', [decodeURIComponent(req.params.nome)]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
