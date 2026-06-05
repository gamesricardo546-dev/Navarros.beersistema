require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
const path    = require('path');

const { connectDB } = require('./config/database');
const { loginLimiter, apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const authRoutes    = require('./routes/auth');
const mesasRoutes   = require('./routes/mesas');
const cardapioRoutes = require('./routes/cardapio');
const pedidosRoutes = require('./routes/pedidos');
const estoqueRoutes = require('./routes/estoque');
const historicoRoutes = require('./routes/historico');
const configRoutes  = require('./routes/configuracoes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Segurança: Headers HTTP ──────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  hsts: {
    maxAge: 31_536_000,     // 1 ano em segundos
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const origens = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');
app.use(cors({
  origin(origin, cb) {
    if (!origin || origens.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origem '${origin}' não permitida`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

// ─── Frontend estático ────────────────────────────────────────────────────────
const frontendPath = path.resolve(__dirname, '../../');
app.use(express.static(frontendPath, {
  index: false,   // não servir index.html automaticamente (rotas abaixo controlam isso)
  setHeaders(res, filePath) {
    // Cache estático para assets com hash no nome
    if (/\.(css|js|woff2?|ttf|png|jpg|svg)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// ─── Rotas da API ─────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/mesas',         mesasRoutes);
app.use('/api/cardapio',      cardapioRoutes);
app.use('/api/pedidos',       pedidosRoutes);
app.use('/api/estoque',       estoqueRoutes);
app.use('/api/historico',     historicoRoutes);
app.use('/api/configuracoes', configRoutes);

// Health check (para Render, Railway, Docker healthcheck, etc.)
app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// ─── SPA Fallback — páginas do frontend ──────────────────────────────────────
const pages = ['login', 'index', 'garcom', 'dashboard', 'produtos', 'pedidos', 'cardapio', 'configuracoes'];
pages.forEach(p => {
  app.get(`/${p === 'index' ? '' : p + '.html'}`, (_, res) => {
    res.sendFile(path.join(frontendPath, `${p === 'index' ? 'index' : p}.html`));
  });
});
app.get('*.html', (req, res) => res.sendFile(path.join(frontendPath, req.path.slice(1))));

// ─── Error Handler (deve vir por último) ─────────────────────────────────────
app.use(errorHandler);

// ─── Inicializar ─────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n  🍺 NAVARROS.BEER API rodando em http://localhost:${PORT}`);
      console.log(`  Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('[STARTUP] Falha ao iniciar:', err.message);
    process.exit(1);
  }
}

start();
