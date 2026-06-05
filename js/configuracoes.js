// ===================== CONFIGURAÇÕES PAGE =====================

function initConfiguracoes() {
  const config = DB.getConfig();

  // Impressoras
  document.getElementById('impressoraCozinha').value = config.impressoraCozinha || '';
  document.getElementById('impressoraCaixa').value = config.impressoraCaixa || '';
  document.getElementById('autoImprimirSalao').checked = config.autoImprimirSalao !== false;
  document.getElementById('autoImprimirEntrega').checked = config.autoImprimirEntrega !== false;

  // WhatsApp
  const wp = config.whatsapp || '';
  document.getElementById('whatsappNumero').value = wp;
  atualizarPreviewWhatsapp(wp);

  // Cores
  setCorInput('corLivre', 'previewLivre', config.corLivre || '#22c55e');
  setCorInput('corOcupada', 'previewOcupada', config.corOcupada || '#ef4444');
  setCorInput('corAguardando', 'previewAguardando', config.corAguardando || '#f59e0b');

  // Data atual
  document.getElementById('dataAtual').textContent = new Date().toISOString().split('T')[0];

  // Salões
  renderSaloes();

  // Cardápio
  renderCardapioConfig();
  popularCategoriaSelect();

  // Mesas
  renderMesasConfig();
  popularSalaoMesaSelect();
}

function setCorInput(colorId, textId, val) {
  document.getElementById(colorId).value = val;
  document.getElementById(textId).value = val;
}

function atualizarCorPreview(colorId, textId) {
  document.getElementById(textId).value = document.getElementById(colorId).value;
}

function syncColorInput(textId, colorId) {
  const val = document.getElementById(textId).value;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    document.getElementById(colorId).value = val;
  }
}

// --- Salões ---
function renderSaloes() {
  const saloes = DB.getSaloes();
  const lista = document.getElementById('saloesList');
  lista.innerHTML = saloes.map((s, i) => `
    <div class="salao-item">
      <span>${s}</span>
      <button class="btn btn-sm btn-secondary" onclick="removerSalao(${i})">Remover</button>
    </div>`).join('');
}

function adicionarSalao() {
  const nome = prompt('Nome do novo salão:');
  if (!nome || !nome.trim()) return;
  const saloes = DB.getSaloes();
  if (saloes.includes(nome.trim())) { toast('Salão já existe!', 'error'); return; }
  saloes.push(nome.trim());
  DB.setSaloes(saloes);
  renderSaloes();
  popularSalaoMesaSelect();
  toast('Salão adicionado!', 'success');
}

function removerSalao(i) {
  if (!confirm('Remover este salão?')) return;
  const saloes = DB.getSaloes();
  saloes.splice(i, 1);
  DB.setSaloes(saloes);
  renderSaloes();
  popularSalaoMesaSelect();
  toast('Salão removido', 'success');
}

// --- Cardápio ---
function popularCategoriaSelect() {
  const cats = DB.getCategorias();
  const sel = document.getElementById('novaCategoria');
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecione categoria...</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    if (c === current) o.selected = true;
    sel.appendChild(o);
  });
}

function adicionarCategoria() {
  const nome = document.getElementById('novaCategoriaNome').value.trim();
  if (!nome) { toast('Digite o nome da categoria', 'error'); return; }
  const cats = DB.getCategorias();
  if (cats.includes(nome)) { toast('Categoria já existe!', 'error'); return; }
  // Adicionar categoria criando item placeholder removível
  const cardapio = DB.getCardapio();
  cardapio.push({ id: 'cat_' + Date.now(), categoria: nome, nome: '(edite o nome)', preco: 0, descricao: '' });
  DB.setCardapio(cardapio);
  document.getElementById('novaCategoriaNome').value = '';
  popularCategoriaSelect();
  renderCardapioConfig();
  toast('Categoria adicionada!', 'success');
}

function adicionarItemCardapio() {
  const categoria = document.getElementById('novaCategoria').value;
  const nome = document.getElementById('nomeItem').value.trim();
  const preco = parseFloat(document.getElementById('precoItem').value);
  const descricao = document.getElementById('descItem').value.trim();

  if (!categoria) { toast('Selecione uma categoria', 'error'); return; }
  if (!nome) { toast('Digite o nome do item', 'error'); return; }
  if (isNaN(preco) || preco < 0) { toast('Preço inválido', 'error'); return; }

  const cardapio = DB.getCardapio();
  cardapio.push({ id: 'item_' + Date.now(), categoria, nome, preco, descricao });
  DB.setCardapio(cardapio);

  document.getElementById('nomeItem').value = '';
  document.getElementById('precoItem').value = '';
  document.getElementById('descItem').value = '';

  renderCardapioConfig();
  popularCategoriaSelect();
  toast('Item adicionado!', 'success');
}

function removerItemCardapio(id) {
  if (!confirm('Remover este item?')) return;
  DB.setCardapio(DB.getCardapio().filter(i => i.id !== id));
  renderCardapioConfig();
  popularCategoriaSelect();
  toast('Item removido', 'success');
}

function renderCardapioConfig() {
  const cardapio = DB.getCardapio();
  const tbody = document.getElementById('cardapioBody');
  tbody.innerHTML = cardapio.map(i => `
    <tr>
      <td>${i.categoria}</td>
      <td>${i.nome}</td>
      <td>${formatarMoeda(i.preco)}</td>
      <td>${i.descricao || '—'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="removerItemCardapio('${i.id}')">Remover</button></td>
    </tr>`).join('');
}

// --- Mesas ---
function popularSalaoMesaSelect() {
  const saloes = DB.getSaloes();
  const sel = document.getElementById('salaoMesa');
  const current = sel.value;
  sel.innerHTML = '';
  saloes.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === current) o.selected = true;
    sel.appendChild(o);
  });
}

function adicionarMesa() {
  const nome = document.getElementById('nomeMesa').value.trim();
  const salao = document.getElementById('salaoMesa').value;
  if (!nome) { toast('Digite o nome da mesa', 'error'); return; }
  if (!salao) { toast('Selecione um salão', 'error'); return; }

  const mesas = DB.getMesas();
  const newId = Math.max(0, ...mesas.map(m => m.id)) + 1;
  mesas.push({ id: newId, nome, salao });
  DB.setMesas(mesas);

  document.getElementById('nomeMesa').value = '';
  renderMesasConfig();
  toast('Mesa adicionada!', 'success');
}

function removerMesa(id) {
  if (!confirm('Remover esta mesa?')) return;
  DB.setMesas(DB.getMesas().filter(m => m.id !== id));
  renderMesasConfig();
  toast('Mesa removida', 'success');
}

function renderMesasConfig() {
  const mesas = DB.getMesas();
  const tbody = document.getElementById('mesasBody');
  tbody.innerHTML = mesas.map(m => `
    <tr>
      <td>${m.nome}</td>
      <td>${m.salao}</td>
      <td><button class="btn btn-sm btn-danger" onclick="removerMesa(${m.id})">Remover</button></td>
    </tr>`).join('');
}

// --- WhatsApp helpers ---
function formatarWhatsapp(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 15);
  atualizarPreviewWhatsapp(input.value);
}

function atualizarPreviewWhatsapp(numero) {
  const preview = document.getElementById('whatsappPreview');
  const link    = document.getElementById('whatsappLink');
  if (numero && numero.length >= 10) {
    const url = `https://wa.me/${numero}`;
    preview.style.display = 'block';
    link.href = url;
    link.textContent = url;
  } else {
    preview.style.display = 'none';
  }
}

// --- Salvar ---
function salvarConfiguracoes() {
  const config = {
    impressoraCozinha:   document.getElementById('impressoraCozinha').value.trim(),
    impressoraCaixa:     document.getElementById('impressoraCaixa').value.trim(),
    autoImprimirSalao:   document.getElementById('autoImprimirSalao').checked,
    autoImprimirEntrega: document.getElementById('autoImprimirEntrega').checked,
    corLivre:     document.getElementById('previewLivre').value,
    corOcupada:   document.getElementById('previewOcupada').value,
    corAguardando:document.getElementById('previewAguardando').value,
    whatsapp:     document.getElementById('whatsappNumero').value.replace(/\D/g,''),
  };
  DB.setConfig(config);
  toast('Configurações salvas!', 'success');
}

function sincronizarDados() {
  marcarAtualizado();
  toast('Dados sincronizados!', 'success');
}

DB.onReady(() => initConfiguracoes());
