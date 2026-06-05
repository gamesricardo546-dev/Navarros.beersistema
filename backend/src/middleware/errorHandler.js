const isProd = process.env.NODE_ENV === 'production';

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // CORS bloqueado pelo próprio CORS middleware
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ erro: 'Origem não permitida' });
  }

  // Erros do PostgreSQL — nunca vazar detalhes em produção
  if (err.code && err.code.startsWith('2') || err.code?.startsWith('4')) {
    console.error(`[DB ERROR] ${err.code}: ${err.message}`);
    return res.status(500).json({ erro: 'Erro de banco de dados' });
  }

  const status = err.status || err.statusCode || 500;

  // Em desenvolvimento mostramos a mensagem; em produção mensagem genérica
  const mensagem = isProd ? 'Erro interno do servidor' : (err.message || 'Erro desconhecido');

  if (status >= 500) {
    console.error(`[ERRO ${status}] ${req.method} ${req.path}: ${err.message}`);
  }

  res.status(status).json({ erro: mensagem });
}

module.exports = errorHandler;
