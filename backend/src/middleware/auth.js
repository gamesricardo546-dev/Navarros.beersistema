const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Validação em startup — garante que a chave secreta seja forte o suficiente
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('[AUTH] JWT_SECRET deve ter pelo menos 32 caracteres. Configure no .env');
}

const COOKIE_OPTIONS = {
  httpOnly: true,                                          // JavaScript não consegue ler
  secure: process.env.NODE_ENV === 'production',           // HTTPS obrigatório em prod
  sameSite: 'strict',                                      // bloqueia CSRF
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,                        // 7 dias
};

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET + '_refresh', {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_SECRET + '_refresh', { algorithms: ['HS256'] });
}

// ─── Middleware de autenticação ───────────────────────────────────────────────

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.nb_token || _extractBearer(req);
    if (!token) return res.status(401).json({ erro: 'Não autenticado' });

    const payload = verifyAccessToken(token);

    // Sempre reconfirmar no banco (detecta usuário desativado ou removido)
    const { rows } = await query(
      'SELECT id, email, nome, role FROM users WHERE id = $1 AND ativo = TRUE',
      [payload.sub]
    );
    if (!rows.length) return res.status(401).json({ erro: 'Usuário inativo' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Sessão expirada', expirada: true });
    }
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

// Restringe rota para o papel 'dono'
function requireDono(req, res, next) {
  if (!req.user || req.user.role !== 'dono') {
    return res.status(403).json({ erro: 'Acesso restrito ao dono do estabelecimento' });
  }
  next();
}

// Extrai Bearer token do header Authorization
function _extractBearer(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ─── Auditoria ────────────────────────────────────────────────────────────────

async function auditLog(userId, acao, tabela, registroId, dados, ip) {
  try {
    await query(
      'INSERT INTO audit_log (user_id, acao, tabela, registro_id, dados, ip) VALUES ($1,$2,$3,$4,$5,$6::inet)',
      [userId, acao, tabela, String(registroId ?? ''), dados ? JSON.stringify(dados) : null, ip]
    );
  } catch {
    // Falha na auditoria nunca deve interromper o fluxo principal
  }
}

module.exports = {
  requireAuth,
  requireDono,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  COOKIE_OPTIONS,
  auditLog,
};
