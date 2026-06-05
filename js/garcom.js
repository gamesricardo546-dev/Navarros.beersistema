// ===================== GARÇOM / ATENDIMENTO =====================

let mesaSelecionada = null;   // objeto mesa { id, nome, salao }
let catAtiva = 'todos';
let carrinho = [];            // [{ itemId, nome, preco, obs, quantidade }]

// ─── STEP 1 – Seleção de Mesa ────────────────────────────────────────────────

function renderMesasGarcom() {
  const mesas = DB.getMesas();
  const saloes = DB.getSaloes();
  const filtro = document.getElementById('filtroSalaoGarcom').value;

  // Popula select salões (apenas na primeira vez)
  const sel = document.getElementById('filtroSalaoGarcom');
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="todos">Todos os Salões</option>';
  saloes.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === valorAtual) o.selected = true;
    sel.appendChild(o);
  });

  const grid = document.getElementById('mesasGridGarcom');
  grid.innerHTML = '';

  const filtradas = mesas.filter(m => filtro === 'todos' || m.salao === filtro);

  filtradas.forEach(mesa => {
    const estado = DB.getEstadoMesa(mesa.id);
    const status = estado.status || 'livre';
    const nItens = DB.contarItensMesa(mesa.id);
    const total  = DB.calcularTotalMesa(mesa.id);

    const card = document.createElement('div');
    card.className = `mesa-card-select ${status}`;
    card.onclick = () => selecionarMesa(mesa.id);

    const extraInfo = status !== 'livre'
      ? `<div class="mesa-itens-tag">🛒 ${nItens} iten${nItens !== 1 ? 's' : ''} · ${formatarMoeda(total)}</div>`
      : '';

    card.innerHTML = `
      <div class="mesa-nome">${mesa.nome}</div>
      <div class="mesa-salao-tag">${mesa.salao}</div>
      <span class="mesa-badge ${status}">
        <span class="dot ${status}"></span>
        ${capitalize(status)}
      </span>
      ${extraInfo}
    `;
    grid.appendChild(card);
  });
}

// ─── Avançar para Step 2 ─────────────────────────────────────────────────────

function selecionarMesa(id) {
  mesaSelecionada = DB.getMesas().find(m => m.id === id);
  carrinho = [];

  // Atualizar header
  document.getElementById('mesaChipNome').textContent   = mesaSelecionada.nome;
  document.getElementById('mesaChipSalao').textContent  = mesaSelecionada.salao;

  const estado = DB.getEstadoMesa(id);
  const status = estado.status || 'livre';
  const statusLabel = { livre: '✅ Livre', ocupada: '🔴 Ocupada', aguardando: '🟡 Aguardando' };
  document.getElementById('mesaChipStatus').textContent = statusLabel[status] || status;

  // Mostrar itens já na mesa (se existirem)
  const pedidos = estado.pedidos || [];
  const itensMesaWrap = document.getElementById('itensMesaWrap');
  if (pedidos.length > 0) {
    const totalMesa = DB.calcularTotalMesa(id);
    document.getElementById('itensMesaTotal').textContent = `· ${formatarMoeda(totalMesa)}`;
    const lista = document.getElementById('itensMesaLista');
    lista.innerHTML = pedidos.map(p => `
      <div class="existing-row">
        <span>${p.quantidade}x ${p.nome}${p.obs ? ` <em style="color:#aaa">(${p.obs})</em>` : ''}</span>
        <span style="color:#ef4444;font-weight:600">${formatarMoeda(p.preco * p.quantidade)}</span>
      </div>
    `).join('');
    itensMesaWrap.style.display = '';
  } else {
    itensMesaWrap.style.display = 'none';
  }

  // Montar cardápio
  renderCats();
  renderCardapioGrid('todos');
  renderCarrinho();

  // Navegar para step 2
  irStep2();
}

function voltarStep1() {
  document.getElementById('step1Panel').classList.add('visible');
  document.getElementById('step1Panel').style.display = '';
  document.getElementById('step2Panel').classList.remove('visible');
  document.getElementById('step2Panel').style.display = 'none';

  document.getElementById('step1Indicator').classList.add('active');
  document.getElementById('step1Indicator').classList.remove('done');
  document.getElementById('step2Indicator').classList.remove('active', 'done');
  document.getElementById('stepDivider').classList.remove('done');

  mesaSelecionada = null;
  carrinho = [];
  renderMesasGarcom();
}

function irStep2() {
  document.getElementById('step1Panel').classList.remove('visible');
  document.getElementById('step1Panel').style.display = 'none';
  document.getElementById('step2Panel').classList.add('visible');
  document.getElementById('step2Panel').style.display = '';

  document.getElementById('step1Indicator').classList.remove('active');
  document.getElementById('step1Indicator').classList.add('done');
  document.getElementById('step2Indicator').classList.add('active');
  document.getElementById('stepDivider').classList.add('done');
}

// ─── Cardápio ────────────────────────────────────────────────────────────────

function renderCats() {
  const cats = ['todos', ...DB.getCategorias()];
  const bar = document.getElementById('catsBar');
  bar.innerHTML = '';
  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (c === catAtiva ? ' active' : '');
    btn.textContent = c === 'todos' ? 'Todas' : c;
    btn.onclick = () => {
      catAtiva = c;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCardapioGrid(c);
    };
    bar.appendChild(btn);
  });
}

function renderCardapioGrid(cat) {
  const grid = document.getElementById('cardapioGrid');
  const items = DB.getCardapio().filter(i => cat === 'todos' || i.categoria === cat);
  grid.innerHTML = '';

  items.forEach(item => {
    const wrapper = document.createElement('div');

    const btn = document.createElement('button');
    btn.className = 'item-btn';
    btn.innerHTML = `
      <div class="item-info">
        <strong>${item.nome}</strong>
        <span>${item.descricao || item.categoria}</span>
      </div>
      <span class="item-preco">${formatarMoeda(item.preco)}</span>
      <div class="item-add-icon">+</div>
    `;
    btn.onclick = () => adicionarAoCarrinho(item, obsInput.value.trim());

    const obsContainer = document.createElement('div');
    obsContainer.className = 'obs-inline';
    const obsInput = document.createElement('input');
    obsInput.type = 'text';
    obsInput.placeholder = 'Observação (opcional) — pressione + para adicionar';
    obsInput.setAttribute('aria-label', `Observação para ${item.nome}`);
    obsInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { adicionarAoCarrinho(item, obsInput.value.trim()); obsInput.value = ''; }
    });

    // Expandir/recolher obs ao clicar na área de nome
    btn.querySelector('.item-info').addEventListener('click', e => {
      e.stopPropagation();
      obsContainer.classList.toggle('show');
      if (obsContainer.classList.contains('show')) obsInput.focus();
    });

    obsContainer.appendChild(obsInput);
    wrapper.appendChild(btn);
    wrapper.appendChild(obsContainer);
    grid.appendChild(wrapper);
  });
}

// ─── Carrinho ────────────────────────────────────────────────────────────────

function adicionarAoCarrinho(item, obs = '') {
  const existente = carrinho.find(c => c.itemId === item.id && c.obs === obs);
  if (existente) {
    existente.quantidade++;
  } else {
    carrinho.push({
      itemId: item.id,
      nome: item.nome,
      preco: item.preco,
      obs,
      quantidade: 1,
    });
  }
  renderCarrinho();
  toast(`${item.nome} adicionado!`, 'success');
}

function alterarQtdCarrinho(index, delta) {
  carrinho[index].quantidade += delta;
  if (carrinho[index].quantidade <= 0) carrinho.splice(index, 1);
  renderCarrinho();
}

function limparCarrinho() {
  carrinho = [];
  renderCarrinho();
}

function renderCarrinho() {
  const lista = document.getElementById('carrinhoLista');
  const vazio = document.getElementById('carrinhoVazio');
  const totalEl = document.getElementById('carrinhoTotal');
  const totalValEl = document.getElementById('carrinhoTotalVal');
  const countEl = document.getElementById('carrinhoCount');
  const btnConfirmar = document.getElementById('btnConfirmarPedido');
  const btnLimpar = document.getElementById('btnLimparCarrinho');

  const totalQtd = carrinho.reduce((s, c) => s + c.quantidade, 0);
  const totalVal = carrinho.reduce((s, c) => s + c.preco * c.quantidade, 0);

  countEl.textContent = totalQtd;

  if (carrinho.length === 0) {
    vazio.style.display = '';
    lista.style.display = 'none';
    totalEl.style.display = 'none';
    btnConfirmar.disabled = true;
    btnLimpar.style.display = 'none';
    return;
  }

  vazio.style.display = 'none';
  lista.style.display = '';
  totalEl.style.display = '';
  btnConfirmar.disabled = false;
  btnLimpar.style.display = '';

  totalValEl.textContent = formatarMoeda(totalVal);

  lista.innerHTML = '';
  carrinho.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'carrinho-item';
    row.innerHTML = `
      <div class="carrinho-item-nome">
        ${c.nome}
        ${c.obs ? `<small>↳ ${c.obs}</small>` : ''}
      </div>
      <div class="carrinho-item-ctrl">
        <button class="ctrl-btn remove" onclick="alterarQtdCarrinho(${idx}, -1)" title="Remover">−</button>
        <span class="carrinho-item-qtd">${c.quantidade}</span>
        <button class="ctrl-btn" onclick="alterarQtdCarrinho(${idx}, 1)" title="Adicionar">+</button>
      </div>
      <span class="carrinho-item-preco">${formatarMoeda(c.preco * c.quantidade)}</span>
    `;
    lista.appendChild(row);
  });
}

// ─── Confirmar Pedido ────────────────────────────────────────────────────────

function confirmarPedido() {
  if (!mesaSelecionada || carrinho.length === 0) return;

  const estado = DB.getEstadoMesa(mesaSelecionada.id);
  const pedidosExistentes = estado.pedidos || [];

  // Mesclar itens do carrinho com pedidos existentes
  carrinho.forEach(novo => {
    const existente = pedidosExistentes.find(p => p.itemId === novo.itemId && p.obs === novo.obs);
    if (existente) {
      existente.quantidade += novo.quantidade;
    } else {
      pedidosExistentes.push({
        id: Date.now() + Math.random(),
        itemId: novo.itemId,
        nome: novo.nome,
        preco: novo.preco,
        quantidade: novo.quantidade,
        obs: novo.obs,
        adicionadoEm: Date.now(),
      });
    }
  });

  // Garante que a mesa fica ocupada
  const novoStatus = (estado.status === 'livre') ? 'ocupada' : estado.status;
  const abertaEm = estado.abertaEm || Date.now();
  DB.setEstadoMesa(mesaSelecionada.id, { ...estado, pedidos: pedidosExistentes, status: novoStatus, abertaEm });

  // Impressão automática
  const config = DB.getConfig();
  if (config.autoImprimirSalao) {
    const estadoAtualizado = DB.getEstadoMesa(mesaSelecionada.id);
    const cupom = gerarCupomMesa(mesaSelecionada, estadoAtualizado);
    imprimirInteligente(cupom, carrinho);
  }

  const nItens = carrinho.reduce((s, c) => s + c.quantidade, 0);
  toast(`✅ Pedido lançado! ${nItens} iten${nItens !== 1 ? 's' : ''} na ${mesaSelecionada.nome}`, 'success');

  marcarAtualizado();
  carrinho = [];

  // Volta para step 1 com mesas atualizadas
  voltarStep1();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Init: aguarda dados do servidor ─────────────────────────────────────────
DB.onReady(() => renderMesasGarcom());
