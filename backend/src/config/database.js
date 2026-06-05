require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('[DB] DATABASE_URL não configurada no .env');
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // SSL obrigatório em produção; opcional em dev com DB_SSL=true
  ssl: isProduction
    ? { rejectUnauthorized: true }
    : process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,

  max: 10,                         // máximo de conexões simultâneas
  min: 2,                          // mínimo de conexões abertas
  idleTimeoutMillis: 30_000,       // fecha conexão ociosa após 30s
  connectionTimeoutMillis: 5_000,  // timeout para adquirir conexão
  statement_timeout: 10_000,       // mata query que demora >10s
  application_name: 'navarros-beer-api',
});

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool de conexões:', err.message);
});

async function connectDB() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT NOW() AS agora, current_database() AS bd');
    console.log(`[DB] Conectado ao PostgreSQL — banco: ${rows[0].bd} — ${rows[0].agora}`);
  } finally {
    client.release();
  }
}

// Executa query parametrizada (proteção contra SQL Injection)
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const ms = Date.now() - start;
    if (ms > 1000) console.warn(`[DB] Query lenta (${ms}ms): ${text.substring(0, 80)}...`);
    return res;
  } catch (err) {
    // Não vazar detalhes internos do banco nos logs de produção
    console.error('[DB] Erro na query:', isProduction ? err.code : err.message);
    throw err;
  }
}

// Executa múltiplas queries de forma atômica (ACID)
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction, connectDB };
