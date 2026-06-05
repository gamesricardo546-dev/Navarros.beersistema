const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const {
  requireAuth, signAccessToken, signRefreshToken,
  verifyRefreshToken, COOKIE_OPTIONS, auditLog,
} = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('senha').isLength({ min: 6, max: 72 }).withMessage('Senha deve ter entre 6 e 72 caracteres'),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Dados inválidos' });

    try {
      const { email, senha } = req.body;

      const { rows } = await query(
        'SELECT id, email, nome, role, avatar, senha_hash FROM users WHERE email = $1 AND ativo = TRUE',
        [email]
      );
      const user = rows[0];

      // Sempre computar bcrypt mesmo se o usuário não existe
      // (evita timing attack que revela quais e-mails existem)
      const hashFalso = '$2b$12$invalido.hash.para.timing.XXXXXXXXXXXXXXXXXXXXXa';
      const senhaValida = user
        ? await bcrypt.compare(senha, user.senha_hash)
        : await bcrypt.compare(senha, hashFalso);

      if (!user || !senhaValida) {
        await auditLog(null, 'LOGIN_FALHOU', 'users', null, { email }, req.ip);
        return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
      }

      const accessToken  = signAccessToken({ sub: user.id, role: user.role });
      const refreshToken = signRefreshToken({ sub: user.id });

      // Armazenar hash do refresh token (nunca o token em texto puro)
      const refreshHash = await bcrypt.hash(refreshToken, 8);
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expira_em, ip) VALUES ($1,$2,$3,$4::inet)',
        [user.id, refreshHash, expiraEm, req.ip]
      );

      await query('UPDATE users SET ultimo_acesso = NOW() WHERE id = $1', [user.id]);
      await auditLog(user.id, 'LOGIN_OK', 'users', user.id, null, req.ip);

      // Cookies httpOnly — JavaScript do frontend não consegue acessá-los
      res.cookie('nb_token',   accessToken,  { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
      res.cookie('nb_refresh', refreshToken, COOKIE_OPTIONS);

      res.json({
        usuario: { email: user.email, nome: user.nome, role: user.role, avatar: user.avatar },
        redirect: user.role === 'garcom' ? '/garcom.html' : '/index.html',
      });
    } catch (err) { next(err); }
  }
);

// POST /api/auth/refresh — renova o access token via refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.nb_refresh;
    if (!refreshToken) return res.status(401).json({ erro: 'Sem refresh token' });

    const payload = verifyRefreshToken(refreshToken);

    // Buscar tokens válidos deste usuário no banco
    const { rows } = await query(
      `SELECT rt.*, u.role, u.ativo
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.user_id = $1 AND rt.revogado = FALSE AND rt.expira_em > NOW()
       ORDER BY rt.criado_em DESC LIMIT 10`,
      [payload.sub]
    );

    let tokenValido = null;
    for (const row of rows) {
      if (await bcrypt.compare(refreshToken, row.token_hash)) {
        tokenValido = row;
        break;
      }
    }

    if (!tokenValido || !tokenValido.ativo) {
      return res.status(401).json({ erro: 'Refresh token inválido ou revogado' });
    }

    const novoToken = signAccessToken({ sub: tokenValido.user_id, role: tokenValido.role });
    res.cookie('nb_token', novoToken, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Refresh token expirado. Faça login novamente.' });
    }
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    // Revogar TODOS os refresh tokens do usuário (logout em todos os dispositivos)
    await query('UPDATE refresh_tokens SET revogado = TRUE WHERE user_id = $1', [req.user.id]);
    await auditLog(req.user.id, 'LOGOUT', 'users', req.user.id, null, req.ip);
    res.clearCookie('nb_token');
    res.clearCookie('nb_refresh');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/auth/me — retorna dados do usuário logado
router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

// POST /api/auth/alterar-senha — troca a senha do usuário logado
router.post('/alterar-senha', requireAuth,
  body('senhaAtual').isLength({ min: 6, max: 72 }),
  body('novaSenha').isLength({ min: 8, max: 72 })
    .matches(/[A-Z]/).withMessage('Precisa de ao menos uma letra maiúscula')
    .matches(/[0-9]/).withMessage('Precisa de ao menos um número'),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erro: 'Senha fraca', detalhes: erros.array() });

    try {
      const { rows } = await query('SELECT senha_hash FROM users WHERE id = $1', [req.user.id]);
      const valida = await bcrypt.compare(req.body.senhaAtual, rows[0].senha_hash);
      if (!valida) return res.status(401).json({ erro: 'Senha atual incorreta' });

      const novoHash = await bcrypt.hash(req.body.novaSenha, 12);
      await query('UPDATE users SET senha_hash = $1 WHERE id = $2', [novoHash, req.user.id]);

      // Revogar todos os tokens após troca de senha
      await query('UPDATE refresh_tokens SET revogado = TRUE WHERE user_id = $1', [req.user.id]);
      await auditLog(req.user.id, 'ALTERAR_SENHA', 'users', req.user.id, null, req.ip);

      res.clearCookie('nb_token');
      res.clearCookie('nb_refresh');
      res.json({ ok: true, mensagem: 'Senha alterada. Faça login novamente.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
