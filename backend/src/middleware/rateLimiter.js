const rateLimit = require('express-rate-limit');

// Login: máximo 5 tentativas em 15 minutos (proteção contra força-bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
  skipSuccessfulRequests: true,  // não conta logins bem-sucedidos
});

// API geral: 300 requisições por minuto por IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Limite de requisições atingido. Aguarde um momento.' },
});

module.exports = { loginLimiter, apiLimiter };
