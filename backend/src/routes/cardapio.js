const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { requireAuth, requireDono, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/cardapio — lista todos os produtos
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM produtos ORDER BY categoria, nome');
    res.json(rows.map(normalizeProduto));
  } catch (err) { next(err); }
});

// POST /api/cardapio — criar produto (somente dono)
router.post('/', requireDono,
  body('nome').trim().isLength({ min: 1, max: 100 }),
  body('categoria').trim().isLength({ min: 1, max: 50 }),
  body('preco').isFloat({ min: 0 }),
  body('precoDelivery').optional().isFloat({ min: 0 }),
  body('descricao').optional().isString().isLength({ max: 300 }),
  body('estoque').optional().isInt({ min: 0 }),
  body('estoqueMin').optional().isInt({ min: 0 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });

    try {
      const { nome, categoria, preco, precoDelivery, descricao, imagem, estoque, estoqueMin } = req.body;
      const id = 'prod_' + Date.now();

      const { rows } = await query(
        `INSERT INTO produtos (id, nome, categoria, preco, preco_delivery, descricao, imagem, estoque, estoque_min)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          id, nome, categoria,
          parseFloat(preco),
          parseFloat(precoDelivery ?? preco),
          (descricao || '').substring(0, 300),
          (imagem || '').substring(0, 500),
          parseInt(estoque ?? 0),
          parseInt(estoqueMin ?? 5),
        ]
      );

      await auditLog(req.user.id, 'CRIAR_PRODUTO', 'produtos', id, { nome }, req.ip);
      res.status(201).json(normalizeProduto(rows[0]));
    } catch (err) { next(err); }
  }
);

// PUT /api/cardapio/:id — atualizar produto (somente dono)
router.put('/:id', requireDono,
  body('preco').optional().isFloat({ min: 0 }),
  body('precoDelivery').optional().isFloat({ min: 0 }),
  body('estoque').optional().isInt({ min: 0 }),
  body('estoqueMin').optional().isInt({ min: 0 }),
  body('nome').optional().trim().isLength({ min: 1, max: 100 }),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos' });

    try {
      const { id } = req.params;
      const { nome, categoria, preco, precoDelivery, descricao, imagem, estoque, estoqueMin, ativo } = req.body;

      const { rows } = await query(
        `UPDATE produtos SET
           nome          = COALESCE($1, nome),
           categoria     = COALESCE($2, categoria),
           preco         = COALESCE($3, preco),
           preco_delivery= COALESCE($4, preco_delivery),
           descricao     = COALESCE($5, descricao),
           imagem        = COALESCE($6, imagem),
           estoque       = COALESCE($7, estoque),
           estoque_min   = COALESCE($8, estoque_min),
           ativo         = COALESCE($9, ativo)
         WHERE id = $10 RETURNING *`,
        [nome, categoria, preco, precoDelivery, descricao, imagem, estoque, estoqueMin, ativo, id]
      );

      if (!rows.length) return res.status(404).json({ erro: 'Produto não encontrado' });
      await auditLog(req.user.id, 'ATUALIZAR_PRODUTO', 'produtos', id, req.body, req.ip);
      res.json(normalizeProduto(rows[0]));
    } catch (err) { next(err); }
  }
);

// DELETE /api/cardapio/:id — desativar produto (somente dono)
router.delete('/:id', requireDono, async (req, res, next) => {
  try {
    await query('UPDATE produtos SET ativo = FALSE WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'REMOVER_PRODUTO', 'produtos', req.params.id, null, req.ip);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function normalizeProduto(p) {
  return {
    id: p.id,
    categoria: p.categoria,
    nome: p.nome,
    descricao: p.descricao,
    preco: parseFloat(p.preco),
    precoDelivery: parseFloat(p.preco_delivery),
    imagem: p.imagem || '',
    estoque: p.estoque,
    estoqueMin: p.estoque_min,
    ativo: p.ativo,
  };
}

module.exports = router;
