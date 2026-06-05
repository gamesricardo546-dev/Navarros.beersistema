const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/historico — últimos 200 fechamentos
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT dados, EXTRACT(EPOCH FROM criado_em) * 1000 AS fechado_em FROM historico ORDER BY criado_em DESC LIMIT 200'
    );
    res.json(rows.map(r => ({
      ...r.dados,
      fechadoEm: parseInt(r.fechado_em),
    })));
  } catch (err) { next(err); }
});

// POST /api/historico — registrar fechamento de mesa/pedido
router.post('/',
  body('total').isFloat({ min: 0 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos' });
    try {
      const item = req.body;
      await query(
        'INSERT INTO historico (tipo, referencia, total, dados) VALUES ($1,$2,$3,$4)',
        ['mesa', item.mesaNome || '', parseFloat(item.total), JSON.stringify(item)]
      );
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;
