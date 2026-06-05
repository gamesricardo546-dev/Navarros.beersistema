// ===================== MESAS PAGE =====================

let mesaAtiva = null; // id da mesa sendo manipulada
let itemSelecionadoCardapio = null;

// --- Render principal ---
function renderMesas() {
  const mesas = DB.getMesas();
  const saloes = DB.getSaloes();
  const filtro = document.getElementById('filtroSalao').value;

  // Popula select salões
  const sel = document.getElementById('filtroSalao');
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="todos">Todos os Salões</option>';
  saloes.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === valorAtual) o.selected = true;
    sel.appendChild(o);
  });

  const grid = document.getElementById('mesasGrid');
  grid.innerHTML = '';

  const mesasFiltradas = mesas.filter(m => filtro === 'todos' || m.salao === filtro);

  mesasFiltradas.forEach(mesa => {
    const estado = DB.getEstadoMesa(mesa.id);
    const card = criarCardMesa(mesa, estado);
    grid.appendChild(card);
  });
}

function filtrarMesas() { renderMesas(); }

function criarCardMesa(mesa, estado) {
  const div = document.createElement('div');
  div.className = 'mesa-card';

  const total = DB.calcularTotalMesa(mesa.id);
  const nItens = DB.contarItensMesa(mesa.id);
  const status = estado.status || 'livre';

  let infoHTML = '';
  if (status === 'livre') {
    infoHTML = `<div class="mesa-info"><div class="disponivel">Disponível</div></div>`;
  } else {
    infoHTML = `<div class="mesa-info">
      <div class="pedidos-count">Pedidos: ${nItens}</div>
      <div class="pedidos-total">${formatarMoeda(total)}</div>
    </div>`;
  }

  let actionsHTML = '';
  if (status === 'livre') {
    actionsHTML = `
      <div class="mesa-actions-row">
        <button class="btn btn-primary" onclick="abrirMesa(${mesa.id})">Abrir</button>
        <button class="btn btn-secondary" onclick="verHistorico(${mesa.id})">Histórico</button>
      </div>`;
  } else {
    actionsHTML = `
      <div class="mesa-actions-row">
        <button class="btn btn-primary" onclick="verPedidoMesa(${mesa.id})">Pedido</button>
        <button class="btn btn-secondary" onclick="abrirModalAddItem(${mesa.id})">+ Item</button>
      </div>
      <div class="mesa-actions-row">
        <button class="btn btn-secondary" onclick="abrirModalDivisao(${mesa.id})">Divisão</button>
        <button class="btn btn-danger" onclick="fecharContaMesa(${mesa.id})">Fechar Conta</button>
      </div>`;
  }

  div.innerHTML = `
    <div class="mesa-card-header">
      <h3>${mesa.nome}</h3>
      <span class="mesa-status ${status}">
        <span class="dot ${status}"></span> ${capitalize(status)}
      </span>
    </div>
    <div class="mesa-salao">${mesa.salao}</div>
    ${infoHTML}
    <div class="mesa-actions">${actionsHTML}</div>
  `;
  return div;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Abrir mesa ---
function abrirMesa(id) {
  mesaAtiva = id;
  const mesa = DB.getMesas().find(m => m.id === id);
  document.getElementById('modalAbrirTitulo').textContent = `Abrir ${mesa.nome}`;
  abrirModal('modalAbrirMesa');
}

function confirmarAbrirMesa() {
  if (!mesaAtiva) return;
  DB.setEstadoMesa(mesaAtiva, { status: 'ocupada', pedidos: [], abertaEm: Date.now() });
  fecharModal('modalAbrirMesa');
  toast('Mesa aberta!', 'success');
  marcarAtualizado();
  renderMesas();
}

// --- Adicionar item ---
function abrirModalAddItem(id) {
  mesaAtiva = id;
  const mesa = DB.getMesas().find(m => m.id === id);
  document.getElementById('addItemMesaNome').textContent = mesa.nome;
  document.getElementById('itemObs').value = '';
  itemSelecionadoCardapio = null;
  document.getElementById('itemSelecionado').style.display = 'none';

  // Popula categorias
  const cats = ['todos', ...DB.getCategorias()];
  const sel = document.getElementById('itemCategoria');
  sel.innerHTML = '';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c === 'todos' ? 'Todas' : c;
    sel.appendChild(o);
  });

  renderCardapioModal('todos');
  abrirModal('modalAddItem');
}

function filtrarCardapio() {
  renderCardapioModal(document.getElementById('itemCategoria').value);
}

function renderCardapioModal(cat) {
  const lista = document.getElementById('cardapioLista');
  const cardapio = DB.getCardapio().filter(i => cat === 'todos' || i.categoria === cat);
  lista.innerHTML = '';
  cardapio.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cardapio-item-selecao' + (itemSelecionadoCardapio && itemSelecionadoCardapio.id === item.id ? ' selected' : '');
    div.innerHTML = `<span class="cardapio-item-nome">${item.nome}</span><span class="cardapio-item-preco">${formatarMoeda(item.preco)}</span>`;
    div.onclick = () => selecionarItemCardapio(item, div);
    lista.appendChild(div);
  });
}

function selecionarItemCardapio(item, el) {
  document.querySelectorAll('.cardapio-item-selecao').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  itemSelecionadoCardapio = item;
  const info = document.getElementById('itemSelecionado');
  info.style.display = 'block';
  info.textContent = `Selecionado: ${item.nome} — ${formatarMoeda(item.preco)}`;
}

function confirmarAddItem() {
  if (!itemSelecionadoCardapio) { toast('Selecione um item!', 'error'); return; }
  const obs = document.getElementById('itemObs').value.trim();
  const estado = DB.getEstadoMesa(mesaAtiva);
  const pedidos = estado.pedidos || [];

  // Verificar se já existe o mesmo item+obs
  const existente = pedidos.find(p => p.itemId === itemSelecionadoCardapio.id && p.obs === obs);
  if (existente) {
    existente.quantidade++;
  } else {
    pedidos.push({
      id: Date.now(),
      itemId: itemSelecionadoCardapio.id,
      nome: itemSelecionadoCardapio.nome,
      preco: itemSelecionadoCardapio.preco,
      quantidade: 1,
      obs: obs,
      adicionadoEm: Date.now(),
    });
  }

  const novoStatus = estado.status === 'livre' ? 'ocupada' : estado.status;
  DB.setEstadoMesa(mesaAtiva, { ...estado, pedidos, status: novoStatus });

  // Imprimir automaticamente
  const config = DB.getConfig();
  if (config.autoImprimirSalao) {
    const mesa = DB.getMesas().find(m => m.id === mesaAtiva);
    const estadoAtualizado = DB.getEstadoMesa(mesaAtiva);
    const cupom = gerarCupomMesa(mesa, estadoAtualizado);
    imprimirInteligente(cupom, estadoAtualizado.pedidos || []);
  }

  fecharModal('modalAddItem');
  toast(`${itemSelecionadoCardapio.nome} adicionado!`, 'success');
  marcarAtualizado();
  renderMesas();
}

// --- Ver pedido da mesa ---
function verPedidoMesa(id) {
  mesaAtiva = id;
  const mesa = DB.getMesas().find(m => m.id === id);
  const estado = DB.getEstadoMesa(id);
  const pedidos = estado.pedidos || [];
  const total = pedidos.reduce((s, p) => s + p.preco * p.quantidade, 0);

  document.getElementById('pedidoMesaNome').textContent = mesa.nome;
  document.getElementById('pedidoMesaTotal').textContent = formatarMoeda(total);

  const lista = document.getElementById('pedidoMesaLista');
  if (pedidos.length === 0) {
    lista.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Nenhum item ainda</p>';
  } else {
    lista.innerHTML = pedidos.map(p => `
      <div class="pedido-item-linha">
        <div class="pedido-item-nome">
          ${p.nome}
          ${p.obs ? `<span class="pedido-item-obs">${p.obs}</span>` : ''}
        </div>
        <span class="pedido-item-qtd">${p.quantidade}x</span>
        <span class="pedido-item-preco">${formatarMoeda(p.preco * p.quantidade)}</span>
        <button class="btn btn-sm btn-secondary" onclick="removerItemMesa(${id}, ${p.id})" style="margin-left:8px">✕</button>
      </div>
    `).join('');
  }

  abrirModal('modalPedidoMesa');
}

function removerItemMesa(mesaId, itemId) {
  const estado = DB.getEstadoMesa(mesaId);
  estado.pedidos = estado.pedidos.filter(p => p.id !== itemId);
  if (estado.pedidos.length === 0) estado.status = 'livre';
  DB.setEstadoMesa(mesaId, estado);
  fecharModal('modalPedidoMesa');
  toast('Item removido', 'success');
  marcarAtualizado();
  renderMesas();
}

function fecharConta() {
  fecharContaMesa(mesaAtiva);
  fecharModal('modalPedidoMesa');
}

function fecharContaMesa(id) {
  const mesa = DB.getMesas().find(m => m.id === id);
  const estado = DB.getEstadoMesa(id);
  const total = DB.calcularTotalMesa(id);

  // Salvar no histórico
  DB.addHistorico({
    mesaId: id,
    mesaNome: mesa.nome,
    salao: mesa.salao,
    pedidos: estado.pedidos,
    total,
    fechadoEm: Date.now(),
  });

  // Imprimir cupom final
  const cupom = gerarCupomMesa(mesa, estado);
  imprimirCupom(cupom, 'Caixa');

  // Liberar mesa
  DB.setEstadoMesa(id, { status: 'livre', pedidos: [], abertaEm: null });
  toast(`Conta fechada! Total: ${formatarMoeda(total)}`, 'success');
  marcarAtualizado();
  renderMesas();
}

// --- Divisão ---
function abrirModalDivisao(id) {
  mesaAtiva = id;
  const mesa = DB.getMesas().find(m => m.id === id);
  document.getElementById('divisaoMesaNome').textContent = mesa.nome;
  document.getElementById('divisaoPessoas').value = 2;
  calcularDivisao();
  abrirModal('modalDivisao');
}

function calcularDivisao() {
  const pessoas = parseInt(document.getElementById('divisaoPessoas').value) || 2;
  const total = DB.calcularTotalMesa(mesaAtiva);
  const porPessoa = total / pessoas;
  document.getElementById('divisaoResultado').innerHTML =
    `<strong>Total: ${formatarMoeda(total)}</strong><br><br>
     ${pessoas} pessoas → <strong>${formatarMoeda(porPessoa)}</strong> por pessoa`;
}

// --- Histórico ---
function verHistorico(id) {
  const mesa = DB.getMesas().find(m => m.id === id);
  document.getElementById('historicoMesaNome').textContent = mesa.nome;

  const historico = DB.getHistorico().filter(h => h.mesaId === id);
  const lista = document.getElementById('historicoLista');

  if (historico.length === 0) {
    lista.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Sem histórico</p>';
  } else {
    lista.innerHTML = historico.map(h => `
      <div class="historico-item">
        <div class="historico-item-header">
          <span>${formatarData(h.fechadoEm)}</span>
          <strong>${formatarMoeda(h.total)}</strong>
        </div>
        ${(h.pedidos || []).map(p => `<div style="font-size:13px">${p.quantidade}x ${p.nome}</div>`).join('')}
      </div>
    `).join('');
  }

  abrirModal('modalHistorico');
}

// --- Init: aguarda dados carregarem do servidor ---
DB.onReady(() => renderMesas());
