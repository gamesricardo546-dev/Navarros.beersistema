const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { requireAuth, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/pedidos — listar pedidos externos (exceto recusados)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        pe.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pei.id, 'itemId', pei.item_id, 'nome', pei.nome,
              'quantidade', pei.quantidade, 'preco', pei.preco::float, 'obs', pei.obs
            ) ORDER BY pei.id
          ) FILTER (WHERE pei.id IS NOT NULL),
          '[]'
        ) AS itens
      FROM pedidos_externos pe
      LEFT JOIN pedidos_externos_itens pei ON pei.pedido_id = pe.id
      WHERE pe.status_aprovacao != 'recusado'
      GROUP BY pe.id
      ORDER BY pe.criado_em DESC
    `);
    res.json(rows.map(normalizePedido));
  } catch (err) { next(err); }
});

// POST /api/pedidos — criar pedido externo
router.post('/',
  body('cliente').trim().isLength({ min: 1, max: 100 }),
  body('tipo').isIn(['tele-entrega', 'retirada']),
  body('itens').isArray({ min: 1 }),
  body('itens.*.nome').notEmpty(),
  body('itens.*.quantidade').isInt({ min: 1 }),
  body('itens.*.preco').isFloat({ min: 0 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });

    try {
      const { cliente, tipo, itens, telefone, obs, endereco } = req.body;

      const { rows: countRows } = await query('SELECT COUNT(*) FROM pedidos_externos');
      const id = 'PED' + String(parseInt(countRows[0].count) + 1).padStart(3, '0');

      const total = itens.reduce((s, i) => s + parseFloat(i.preco) * parseInt(i.quantidade), 0);

      await transaction(async (client) => {
        await client.query(
          `INSERT INTO pedidos_externos (id, cliente, telefone, tipo, obs, endereco, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            id,
            String(cliente).substring(0, 100),
            telefone ? String(telefone).substring(0, 20) : null,
            tipo,
            (obs || '').substring(0, 300),
            endereco ? JSON.stringify(endereco) : null,
            total,
          ]
        );

        for (const item of itens) {
          await client.query(
            `INSERT INTO pedidos_externos_itens (pedido_id, item_id, nome, quantidade, preco, obs)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              id,
              item.itemId || item.item_id || null,
              String(item.nome).substring(0, 100),
              parseInt(item.quantidade),
              parseFloat(item.preco),
              (item.obs || '').substring(0, 200),
            ]
          );
        }
      });

      await auditLog(req.user.id, 'CRIAR_PEDIDO', 'pedidos_externos', id, { cliente, tipo, total }, req.ip);

      const { rows } = await query(`
        SELECT pe.*, COALESCE(json_agg(json_build_object(
          'id', pei.id, 'itemId', pei.item_id, 'nome', pei.nome,
          'quantidade', pei.quantidade, 'preco', pei.preco::float, 'obs', pei.obs
        ) ORDER BY pei.id) FILTER (WHERE pei.id IS NOT NULL), '[]') AS itens
        FROM pedidos_externos pe
        LEFT JOIN pedidos_externos_itens pei ON pei.pedido_id = pe.id
        WHERE pe.id = $1 GROUP BY pe.id
      `, [id]);

      res.status(201).json(normalizePedido(rows[0]));
    } catch (err) { next(err); }
  }
);

// PATCH /api/pedidos/:id/status — aprovar ou recusar pedido
router.patch('/:id/status',
  body('statusAprovacao').isIn(['aguardando', 'aprovado', 'recusado']),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Status inválido' });

    try {
      const { rows } = await query(
        'UPDATE pedidos_externos SET status_aprovacao = $1 WHERE id = $2 RETURNING id',
        [req.body.statusAprovacao, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ erro: 'Pedido não encontrado' });
      await auditLog(req.user.id, 'ATUALIZAR_STATUS_PEDIDO', 'pedidos_externos', req.params.id, req.body, req.ip);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

function normalizePedido(p) {
  return {
    id: p.id,
    cliente: p.cliente,
    telefone: p.telefone,
    tipo: p.tipo,
    statusAprovacao: p.status_aprovacao,
    obs: p.obs,
    endereco: p.endereco,
    total: parseFloat(p.total),
    criadoEm: new Date(p.criado_em).getTime(),
    itens: Array.isArray(p.itens) ? p.itens : [],
  };
}

module.exports = router;
