const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { requireAuth, requireDono, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireDono);

// GET /api/estoque/movimentos — últimos 500 movimentos
router.get('/movimentos', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT me.id, me.produto_id, me.tipo, me.quantidade, me.motivo,
             EXTRACT(EPOCH FROM me.criado_em) * 1000 AS criado_em,
             p.nome AS produto_nome
      FROM movimentos_estoque me
      LEFT JOIN produtos p ON p.id = me.produto_id
      ORDER BY me.criado_em DESC
      LIMIT 500
    `);
    res.json(rows.map(r => ({
      id: r.id,
      produtoId: r.produto_id,
      produtoNome: r.produto_nome,
      tipo: r.tipo,
      quantidade: r.quantidade,
      motivo: r.motivo,
      criadoEm: parseInt(r.criado_em),
    })));
  } catch (err) { next(err); }
});

// POST /api/estoque/movimentos — registrar entrada, saída ou ajuste
router.post('/movimentos',
  body('produtoId').notEmpty().isString(),
  body('tipo').isIn(['entrada', 'saida', 'ajuste']),
  body('quantidade').isInt({ min: 1, max: 10000 }),
  body('motivo').optional().isString().isLength({ max: 200 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos' });

    try {
      const { produtoId, tipo, quantidade, motivo } = req.body;

      await transaction(async (client) => {
        await client.query(
          'INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, motivo) VALUES ($1,$2,$3,$4)',
          [produtoId, tipo, parseInt(quantidade), motivo || '']
        );

        const delta = tipo === 'entrada' ? quantidade : tipo === 'saida' ? -quantidade : quantidade;
        await client.query(
          'UPDATE produtos SET estoque = GREATEST(0, estoque + $1) WHERE id = $2',
          [delta, produtoId]
        );
      });

      await auditLog(req.user.id, 'MOVIMENTO_ESTOQUE', 'movimentos_estoque', produtoId, { tipo, quantidade }, req.ip);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;
