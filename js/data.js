// ===================== DATA STORE (API) =====================
// Cache em memória com escrita assíncrona para o PostgreSQL via API REST.
// Leituras são síncronas (do cache), escritas disparam chamadas à API em background.
// Na inicialização, o cache é populado com dados frescos do servidor.

const DB = {
  // ─── Cache em memória ──────────────────────────────────────
  _cache: {
    mesas: [],
    saloes: [],
    cardapio: [],
    estadoMesas: {},
    pedidosExternos: [],
    historico: [],
    movimentosEstoque: [],
    configuracoes: {},
  },

  _readyCallbacks: [],
  _initialized: false,

  // Registra callback a ser chamado quando o cache estiver pronto
  onReady(fn) {
    if (this._initialized) fn();
    else this._readyCallbacks.push(fn);
  },

  _markReady() {
    this._initialized = true;
    this._readyCallbacks.forEach(fn => { try { fn(); } catch {} });
    this._readyCallbacks = [];
  },

  // ─── Inicialização: carrega tudo do servidor ───────────────
  async init() {
    try {
      const [mesasData, cardapio, pedidos, historico, config] = await Promise.all([
        API.get('/api/mesas'),
        API.get('/api/cardapio'),
        API.get('/api/pedidos'),
        API.get('/api/historico'),
        API.get('/api/configuracoes'),
      ]);

      this._cache.mesas         = mesasData.mesas         || [];
      this._cache.saloes        = mesasData.saloes        || [];
      this._cache.estadoMesas   = mesasData.estadoMesas   || {};
      this._cache.cardapio      = cardapio                || [];
      this._cache.pedidosExternos = pedidos               || [];
      this._cache.historico     = historico               || [];
      this._cache.configuracoes = config                  || {};

      this._markReady();
    } catch (err) {
      console.error('[DB] Falha ao carregar dados:', err.message);
      // Avisar mas não bloquear — a página renderiza com cache vazio
      if (typeof toast === 'function') {
        toast('Sem conexão com o servidor. Dados podem estar desatualizados.', 'error');
      }
      this._markReady();
    }
  },

  // Escreve no servidor em background; mostra toast de erro se falhar
  _sync(fn, errorMsg) {
    fn().catch(err => {
      console.error('[DB sync]', err.message);
      if (typeof toast === 'function') toast(errorMsg || 'Erro ao salvar. Tente novamente.', 'error');
    });
  },

  // ─── Mesas ────────────────────────────────────────────────
  getMesas()   { return this._cache.mesas || []; },
  getSaloes()  { return this._cache.saloes || []; },

  setSaloes(v) {
    this._cache.saloes = v;
    // Salões são atualizados individualmente via addSalao/removeSalao
  },

  getEstadoMesas()  { return this._cache.estadoMesas || {}; },
  getEstadoMesa(id) {
    const all = this._cache.estadoMesas || {};
    return all[id] || { status: 'livre', pedidos: [], abertaEm: null };
  },

  setEstadoMesa(id, estado) {
    if (!this._cache.estadoMesas) this._cache.estadoMesas = {};
    this._cache.estadoMesas[id] = estado;
    // Sincronizar com o servidor em background
    this._sync(
      () => API.put(`/api/mesas/${id}/estado`, estado),
      'Erro ao salvar estado da mesa'
    );
  },

  // ─── Cardápio ─────────────────────────────────────────────
  getCardapio()    { return (this._cache.cardapio || []).filter(p => p.ativo !== false); },
  getTodosProdutos() { return this._cache.cardapio || []; },
  setCardapio(v)   { this._cache.cardapio = v; },
  getCategorias()  { return [...new Set(this.getCardapio().map(i => i.categoria))]; },
  getTodasCategorias() { return [...new Set(this.getTodosProdutos().map(i => i.categoria))]; },

  async addProduto(produto) {
    const novo = await API.post('/api/cardapio', produto);
    this._cache.cardapio.push(novo);
    return novo;
  },

  async updateProduto(id, campos) {
    const atualizado = await API.put(`/api/cardapio/${id}`, campos);
    this._cache.cardapio = this._cache.cardapio.map(p => p.id === id ? { ...p, ...atualizado } : p);
    return atualizado;
  },

  async deleteProduto(id) {
    await API.delete(`/api/cardapio/${id}`);
    this._cache.cardapio = this._cache.cardapio.map(p =>
      p.id === id ? { ...p, ativo: false } : p
    );
  },

  // ─── Estoque ──────────────────────────────────────────────
  getMovimentosEstoque() { return this._cache.movimentosEstoque || []; },

  addMovimentoEstoque(mov) {
    // Atualizar cache local imediatamente
    const delta = mov.tipo === 'entrada' ? mov.quantidade : mov.tipo === 'saida' ? -mov.quantidade : mov.quantidade;
    this._cache.cardapio = this._cache.cardapio.map(p => {
      if (p.id !== mov.produtoId) return p;
      return { ...p, estoque: Math.max(0, (p.estoque || 0) + delta) };
    });
    // Persistir no servidor
    this._sync(
      () => API.post('/api/estoque/movimentos', mov),
      'Erro ao registrar movimento de estoque'
    );
  },

  // ─── Pedidos Externos ─────────────────────────────────────
  getPedidosExternos()  { return this._cache.pedidosExternos || []; },

  async adicionarPedidoExterno(pedido) {
    const novo = await API.post('/api/pedidos', pedido);
    this._cache.pedidosExternos.push(novo);
    return novo;
  },

  atualizarPedidoExterno(id, campos) {
    this._cache.pedidosExternos = this._cache.pedidosExternos.map(p =>
      p.id === id ? { ...p, ...campos } : p
    );
    const { statusAprovacao } = campos;
    if (statusAprovacao) {
      this._sync(
        () => API.patch(`/api/pedidos/${id}/status`, { statusAprovacao }),
        'Erro ao atualizar status do pedido'
      );
    }
  },

  // ─── Histórico ────────────────────────────────────────────
  getHistorico() { return this._cache.historico || []; },

  addHistorico(item) {
    this._cache.historico.unshift(item);
    this._sync(
      () => API.post('/api/historico', item),
      'Erro ao salvar histórico'
    );
  },

  // ─── Configurações ────────────────────────────────────────
  getConfig() {
    const defaults = {
      impressoraCozinha: '', impressoraCaixa: '',
      autoImprimirSalao: true, autoImprimirEntrega: true,
      corLivre: '#22c55e', corOcupada: '#ef4444', corAguardando: '#f59e0b',
      nomeEstabelecimento: 'NAVARROS.BEER', whatsapp: '5511999999999',
      taxaEntrega: 0, tempoEntregaMin: 40, tempoEntregaMax: 60,
    };
    return { ...defaults, ...(this._cache.configuracoes || {}) };
  },

  setConfig(v) {
    this._cache.configuracoes = v;
    this._sync(
      () => API.put('/api/configuracoes', v),
      'Erro ao salvar configurações'
    );
  },

  // ─── Helpers ──────────────────────────────────────────────
  gerarIdPedido() {
    const n = (this._cache.pedidosExternos || []).length + 1;
    return 'PED' + String(n).padStart(3, '0');
  },

  calcularTotalMesa(id) {
    const estado = this.getEstadoMesa(id);
    return (estado.pedidos || []).reduce((s, p) => s + p.preco * p.quantidade, 0);
  },

  contarItensMesa(id) {
    const estado = this.getEstadoMesa(id);
    return (estado.pedidos || []).reduce((s, p) => s + p.quantidade, 0);
  },
};

// ─── Iniciar e sincronizar a cada 10s ─────────────────────────────────────────
DB.init();

// Polling leve para manter estado das mesas atualizado entre dispositivos
setInterval(async () => {
  try {
    const data = await API.get('/api/mesas');
    DB._cache.mesas       = data.mesas       || DB._cache.mesas;
    DB._cache.saloes      = data.saloes      || DB._cache.saloes;
    DB._cache.estadoMesas = data.estadoMesas || DB._cache.estadoMesas;
    // Disparar re-render se a função global existir
    if (typeof renderMesas === 'function') renderMesas();
    if (typeof renderMesasGarcom === 'function') renderMesasGarcom();
  } catch {}
}, 10_000);
