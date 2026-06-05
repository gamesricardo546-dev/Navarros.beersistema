-- ============================================================
-- NAVARROS.BEER — Schema PostgreSQL
-- Segurança: RLS, constraints, índices, triggers, auditoria
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid, crypt
CREATE EXTENSION IF NOT EXISTS citext;    -- e-mail case-insensitive

-- ─── Tabelas ──────────────────────────────────────────────────

-- Usuários (senhas armazenadas com bcrypt, nunca em texto puro)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           CITEXT NOT NULL UNIQUE,
    senha_hash      TEXT   NOT NULL,
    nome            TEXT   NOT NULL,
    role            TEXT   NOT NULL CHECK (role IN ('dono', 'garcom')),
    avatar          TEXT   DEFAULT '',
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMPTZ DEFAULT NOW(),
    ultimo_acesso   TIMESTAMPTZ
);

-- Refresh tokens (armazenados hasheados; revogáveis)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expira_em   TIMESTAMPTZ NOT NULL,
    revogado    BOOLEAN DEFAULT FALSE,
    ip          INET,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Salões
CREATE TABLE IF NOT EXISTS saloes (
    id      SERIAL PRIMARY KEY,
    nome    TEXT NOT NULL UNIQUE
);

-- Mesas
CREATE TABLE IF NOT EXISTS mesas (
    id      SERIAL PRIMARY KEY,
    nome    TEXT NOT NULL,
    salao   TEXT NOT NULL,
    ativo   BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_salao FOREIGN KEY (salao) REFERENCES saloes(nome) ON UPDATE CASCADE
);

-- Estado atual de cada mesa (1-1 com mesas)
CREATE TABLE IF NOT EXISTS estado_mesas (
    mesa_id     INTEGER PRIMARY KEY REFERENCES mesas(id) ON DELETE CASCADE,
    status      TEXT DEFAULT 'livre' CHECK (status IN ('livre', 'ocupada', 'aguardando')),
    aberta_em   TIMESTAMPTZ
);

-- Itens de pedido em mesa
CREATE TABLE IF NOT EXISTS pedidos_mesa (
    id          SERIAL PRIMARY KEY,
    mesa_id     INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    item_id     TEXT,
    nome        TEXT NOT NULL,
    quantidade  INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    preco       NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
    obs         TEXT DEFAULT '',
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Produtos do cardápio
CREATE TABLE IF NOT EXISTS produtos (
    id              TEXT PRIMARY KEY,
    categoria       TEXT NOT NULL,
    nome            TEXT NOT NULL,
    descricao       TEXT DEFAULT '',
    preco           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
    preco_delivery  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (preco_delivery >= 0),
    imagem          TEXT DEFAULT '',
    estoque         INTEGER DEFAULT 0 CHECK (estoque >= 0),
    estoque_min     INTEGER DEFAULT 5 CHECK (estoque_min >= 0),
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos externos (delivery / retirada)
CREATE TABLE IF NOT EXISTS pedidos_externos (
    id                  TEXT PRIMARY KEY,
    cliente             TEXT NOT NULL,
    telefone            TEXT,
    tipo                TEXT NOT NULL CHECK (tipo IN ('tele-entrega', 'retirada')),
    status_aprovacao    TEXT NOT NULL DEFAULT 'aguardando'
                            CHECK (status_aprovacao IN ('aguardando', 'aprovado', 'recusado')),
    obs                 TEXT DEFAULT '',
    endereco            JSONB,
    total               NUMERIC(10,2) DEFAULT 0 CHECK (total >= 0),
    criado_em           TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- Itens dos pedidos externos
CREATE TABLE IF NOT EXISTS pedidos_externos_itens (
    id          SERIAL PRIMARY KEY,
    pedido_id   TEXT NOT NULL REFERENCES pedidos_externos(id) ON DELETE CASCADE,
    item_id     TEXT,
    nome        TEXT NOT NULL,
    quantidade  INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    preco       NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
    obs         TEXT DEFAULT ''
);

-- Histórico de pedidos fechados
CREATE TABLE IF NOT EXISTS historico (
    id          SERIAL PRIMARY KEY,
    tipo        TEXT,
    referencia  TEXT,
    total       NUMERIC(10,2),
    dados       JSONB,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Movimentos de estoque
CREATE TABLE IF NOT EXISTS movimentos_estoque (
    id          SERIAL PRIMARY KEY,
    produto_id  TEXT REFERENCES produtos(id) ON DELETE SET NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
    quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
    motivo      TEXT DEFAULT '',
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações do sistema (chave/valor tipado como JSONB)
CREATE TABLE IF NOT EXISTS configuracoes (
    chave   TEXT PRIMARY KEY,
    valor   JSONB
);

-- Log de auditoria de todas as ações sensíveis
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acao        TEXT NOT NULL,
    tabela      TEXT,
    registro_id TEXT,
    dados       JSONB,
    ip          INET,
    criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_mesa     ON pedidos_mesa(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_ext_status    ON pedidos_externos(status_aprovacao);
CREATE INDEX IF NOT EXISTS idx_pedidos_ext_criado    ON pedidos_externos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto   ON movimentos_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_historico_criado      ON historico(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user            ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_criado          ON audit_log(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_user          ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria    ON produtos(categoria) WHERE ativo = TRUE;

-- ─── Triggers ─────────────────────────────────────────────────

-- Atualiza campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produtos_atualizado ON produtos;
CREATE TRIGGER trg_produtos_atualizado
    BEFORE UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

DROP TRIGGER IF EXISTS trg_pedidos_externos_atualizado ON pedidos_externos;
CREATE TRIGGER trg_pedidos_externos_atualizado
    BEFORE UPDATE ON pedidos_externos
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- ─── Row Level Security ───────────────────────────────────────
-- (Ativado para tabelas sensíveis — app usa usuário com role 'app_user')

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;

-- A aplicação conecta como 'app_user': permite apenas leitura/escrita de registros
-- O superuser (postgres) ignora RLS, usado só para migrations
CREATE ROLE app_user LOGIN PASSWORD 'TROQUE_ESTA_SENHA' NOINHERIT;
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- app_user pode ler/escrever users mas não ler senha_hash diretamente via SELECT *
-- (a aplicação faz SELECT específico quando necessário para auth)

-- Policy: app_user pode ver/editar todos os registros das tabelas de negócio
CREATE POLICY pol_app_users_all ON users
    FOR ALL TO app_user USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY pol_app_refresh_all ON refresh_tokens
    FOR ALL TO app_user USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY pol_app_audit_insert ON audit_log
    FOR INSERT TO app_user WITH CHECK (TRUE);

CREATE POLICY pol_app_audit_select ON audit_log
    FOR SELECT TO app_user USING (TRUE);

-- ─── Configurações padrão ─────────────────────────────────────

INSERT INTO configuracoes (chave, valor) VALUES
    ('impressoraCozinha',   '""'),
    ('impressoraCaixa',     '""'),
    ('autoImprimirSalao',   'true'),
    ('autoImprimirEntrega', 'true'),
    ('corLivre',            '"#22c55e"'),
    ('corOcupada',          '"#ef4444"'),
    ('corAguardando',       '"#f59e0b"'),
    ('nomeEstabelecimento', '"NAVARROS.BEER"'),
    ('whatsapp',            '"5511999999999"'),
    ('taxaEntrega',         '0'),
    ('tempoEntregaMin',     '40'),
    ('tempoEntregaMax',     '60')
ON CONFLICT (chave) DO NOTHING;
