const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireDono } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/configuracoes
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT chave, valor FROM configuracoes');
    const config = {};
    for (const r of rows) {
      try { config[r.chave] = JSON.parse(r.valor); } catch { config[r.chave] = r.valor; }
    }
    res.json(config);
  } catch (err) { next(err); }
});

// PUT /api/configuracoes — salvar configurações (somente dono)
router.put('/', requireDono, async (req, res, next) => {
  try {
    const config = req.body;
    if (typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ erro: 'Payload inválido' });
    }

    const CHAVES_PERMITIDAS = new Set([
      'impressoraCozinha', 'impressoraCaixa', 'autoImprimirSalao', 'autoImprimirEntrega',
      'corLivre', 'corOcupada', 'corAguardando', 'nomeEstabelecimento',
      'whatsapp', 'taxaEntrega', 'tempoEntregaMin', 'tempoEntregaMax',
    ]);

    for (const [chave, valor] of Object.entries(config)) {
      if (!CHAVES_PERMITIDAS.has(chave)) continue; // ignora chaves desconhecidas
      await query(
        'INSERT INTO configuracoes (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO UPDATE SET valor=$2',
        [chave, JSON.stringify(valor)]
      );
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
