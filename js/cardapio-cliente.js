// ===================== CARDÁPIO CLIENTE – PREMIUM =====================

/* ── Estado ─────────────────────────────────────────────────────────── */
let cart = [];
let currentProduct = null;
let currentQty = 1;
let selectedAdicionais = {};
let paymentMethod = 'pix';
let couponDiscount = 0;
let currentCategory = '';
let entregaTipo = 'tele-entrega';   // 'tele-entrega' | 'retirada'
let favs = JSON.parse(localStorage.getItem('nb_favs') || '[]');

const TAXA_ENTREGA = 7.00;   // R$7 para delivery

function getTaxaEntrega() {
  return entregaTipo === 'tele-entrega' ? TAXA_ENTREGA : 0;
}

/* ── Mapeamento visual ───────────────────────────────────────────────── */
const CAT_ICON = {
  'Cervejas':       'fa-beer-mug-empty',
  'Petiscos':       'fa-drumstick-bite',
  'Drinks':         'fa-wine-glass',
  'Não Alcoólicos': 'fa-glass-water',
  'Sobremesas':     'fa-ice-cream',
  'Porções':        'fa-utensils',
  'Lanches':        'fa-burger',
  'Pizzas':         'fa-pizza-slice',
  'Combos':         'fa-box-open',
};
const CAT_EMOJI = {
  'Cervejas':       '🍺',
  'Petiscos':       '🍗',
  'Drinks':         '🍹',
  'Não Alcoólicos': '🥤',
  'Sobremesas':     '🍮',
  'Porções':        '🍟',
  'Lanches':        '🍔',
  'Pizzas':         '🍕',
  'Combos':         '🎁',
};
const FEATURED_IDS = ['c3','p1','p4','d3']; // Colorado Appia, Frango, Porcão, Long Island

/* ── Adicionais por categoria ────────────────────────────────────────── */
const ADICIONAIS = {
  'Cervejas': [
    { grupo: 'Acompanhamentos', obrigatorio: false, itens: [
      { id:'cer_copo',  nome:'Copo extra',       preco: 1.00 },
      { id:'cer_gelo',  nome:'Baldinho de gelo',  preco: 2.00 },
      { id:'cer_limao', nome:'Limão cortado',     preco: 1.50 },
    ]},
  ],
  'Petiscos': [
    { grupo: 'Molhos extras', obrigatorio: false, itens: [
      { id:'mol_ketch',  nome:'Ketchup',          preco: 0    },
      { id:'mol_maio',   nome:'Maionese',          preco: 0    },
      { id:'mol_bbq',    nome:'Molho barbecue',    preco: 0    },
      { id:'mol_chip',   nome:'Molho chipotle',    preco: 2.00 },
      { id:'mol_srira',  nome:'Sriracha',          preco: 1.50 },
    ]},
    { grupo: 'Tamanho', obrigatorio: false, itens: [
      { id:'tam_normal', nome:'Porção normal',     preco: 0    },
      { id:'tam_dupla',  nome:'Porção dupla',      preco:12.00 },
    ]},
  ],
  'Drinks': [
    { grupo: 'Preferências', obrigatorio: false, itens: [
      { id:'dr_sg',   nome:'Sem gelo',            preco: 0    },
      { id:'dr_mg',   nome:'Muito gelo',           preco: 0    },
      { id:'dr_ml',   nome:'Mais limão',           preco: 0    },
      { id:'dr_pa',   nome:'Pouco açúcar',         preco: 0    },
      { id:'dr_ma',   nome:'Mais açúcar',          preco: 0    },
    ]},
    { grupo: 'Dose', obrigatorio: false, itens: [
      { id:'dose_1', nome:'Dose simples',          preco: 0    },
      { id:'dose_2', nome:'Dose dupla',            preco: 8.00 },
    ]},
  ],
  'Não Alcoólicos': [
    { grupo: 'Preferências', obrigatorio: false, itens: [
      { id:'na_sg',  nome:'Sem gelo',              preco: 0 },
      { id:'na_cg',  nome:'Bastante gelo',          preco: 0 },
      { id:'na_ld',  nome:'Menos doce',             preco: 0 },
    ]},
  ],
  'Lanches': [
    { grupo: 'Adicionais', obrigatorio: false, itens: [
      { id:'lan_qj',  nome:'Queijo extra',         preco: 3.00 },
      { id:'lan_bac', nome:'Bacon crocante',        preco: 4.00 },
      { id:'lan_ovo', nome:'Ovo frito',             preco: 2.50 },
    ]},
    { grupo: 'Remover', obrigatorio: false, itens: [
      { id:'lan_sc',  nome:'Sem cebola',           preco: 0 },
      { id:'lan_sp',  nome:'Sem picles',           preco: 0 },
      { id:'lan_st',  nome:'Sem tomate',           preco: 0 },
    ]},
  ],
};

/* ── Init ────────────────────────────────────────────────────────────── */
function init() {
  checkStoreStatus();
  popularMesaSelect();
  popularCategorias();
  renderProducts();
  renderFeatured();
}

function checkStoreStatus() {
  const h = new Date().getHours();
  const open = h >= 11 && h < 23;
  document.getElementById('statusDot').className = 'status-dot' + (open ? '' : ' closed');
  document.getElementById('statusText').textContent = open ? 'Aberto agora' : 'Fechado';
}

function popularMesaSelect() {
  const sel = document.getElementById('ckMesa');
  if (!sel) return; // Elemento não existe na tela do cliente
  sel.innerHTML = '<option value="">Selecione a mesa…</option>';
  DB.getMesas().forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = `${m.nome} (${m.salao})`;
    sel.appendChild(o);
  });
}

function popularCategorias() {
  const scroll = document.getElementById('categoriesScroll');
  scroll.innerHTML = `<button class="cat-chip active" data-cat="" onclick="filterCategory(this,'')"><i class="fas fa-th-large"></i> Todos</button>`;
  DB.getCategorias().forEach(cat => {
    const icon = CAT_ICON[cat] || 'fa-utensils';
    const btn = document.createElement('button');
    btn.className = 'cat-chip';
    btn.dataset.cat = cat;
    btn.innerHTML = `<i class="fas ${icon}"></i> ${cat}`;
    btn.onclick = () => filterCategory(btn, cat);
    scroll.appendChild(btn);
  });
}

/* ── Filtros ─────────────────────────────────────────────────────────── */
function filterCategory(el, cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderProducts();
}

let searchTimer;
function handleSearch(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderProducts(val), 280);
}

/* ── Render produtos ─────────────────────────────────────────────────── */
function renderProducts(busca = '') {
  const lista = DB.getCardapio().filter(i => {
    const matchCat  = !currentCategory || i.categoria === currentCategory;
    const matchBusc = !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || (i.descricao||'').toLowerCase().includes(busca.toLowerCase());
    return matchCat && matchBusc;
  });

  const grid = document.getElementById('productsGrid');
  if (!lista.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:2.5rem;opacity:0.2;display:block;margin-bottom:14px"></i>Nenhum item encontrado.</div>`;
    return;
  }

  grid.innerHTML = lista.map(item => {
    const isFav  = favs.includes(item.id);
    const isFeat = FEATURED_IDS.includes(item.id);
    const emoji  = CAT_EMOJI[item.categoria] || '🍽️';
    const estoque = item.estoque ?? 999;
    const esgotado = estoque === 0;
    const baixo    = !esgotado && estoque <= (item.estoqueMin ?? 5);
    const preco    = precoEfetivo(item);
    const imgHtml  = item.imagem
      ? `<img src="${item.imagem}" alt="${item.nome}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`
      : `<div class="product-img-placeholder">${emoji}</div>`;

    return `
    <div class="product-card${esgotado ? ' esgotado' : ''}" onclick="${esgotado ? '' : `openProductModal('${item.id}')`}" style="${esgotado ? 'opacity:0.5;cursor:not-allowed' : ''}">
      <div class="product-img">
        ${imgHtml}
        ${esgotado  ? '<div class="product-badge" style="background:#555">Esgotado</div>' :
          isFeat    ? '<div class="product-badge gold">🔥 Destaque</div>' :
          baixo     ? `<div class="product-badge" style="background:#b45309">⚠️ Últimas ${estoque}</div>` : ''}
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation();toggleFav('${item.id}',this)">
          <i class="fas fa-heart"></i>
        </button>
      </div>
      <div class="product-info">
        <div class="product-category">${item.categoria}</div>
        <div class="product-name">${item.nome}</div>
        <div class="product-desc">${item.descricao || ''}</div>
        <div class="product-footer">
          <div class="product-price"><span class="price-current">${formatarMoeda(preco)}</span></div>
          ${esgotado
            ? '<span style="font-size:11px;color:#555;font-weight:600">Indisponível</span>'
            : `<button class="add-btn" onclick="event.stopPropagation();quickAdd('${item.id}')"><i class="fas fa-plus"></i></button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderFeatured() {
  const todos = DB.getCardapio();
  const featured = FEATURED_IDS.map(id => todos.find(i => i.id === id)).filter(Boolean);
  if (!featured.length) { document.getElementById('featuredSection').style.display = 'none'; return; }

  document.getElementById('featuredGrid').innerHTML = featured.slice(0,3).map(item => `
    <div class="featured-card" onclick="openProductModal('${item.id}')">
      <div class="featured-card-overlay"></div>
      <div class="featured-card-emoji">${CAT_EMOJI[item.categoria] || '🍽️'}</div>
      <div class="featured-info">
        <h3>${item.nome}</h3>
        <p>${(item.descricao || '').substring(0,70)}…</p>
        <div class="featured-price">${formatarMoeda(item.preco)}</div>
      </div>
    </div>`).join('');
}

/* ── Modal produto ───────────────────────────────────────────────────── */
function precoEfetivo(item) {
  return entregaTipo === 'tele-entrega' && item.precoDelivery ? item.precoDelivery : item.preco;
}

function openProductModal(itemId) {
  const item = DB.getCardapio().find(i => i.id === itemId);
  if (!item) return;
  currentProduct = item;
  currentQty = 1;
  selectedAdicionais = {};

  const emoji = CAT_EMOJI[item.categoria] || '🍽️';
  document.getElementById('modalImg').innerHTML = `
    <button class="modal-close" onclick="closeModal('productModal')"><i class="fas fa-times"></i></button>
    <div style="font-size:7rem;display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,var(--dark3),var(--dark2))">${emoji}</div>`;
  document.getElementById('modalCategory').textContent = item.categoria;
  document.getElementById('modalName').textContent = item.nome;
  document.getElementById('modalDesc').textContent = item.descricao || '';
  const preco = precoEfetivo(item);
  const temDiferenca = entregaTipo === 'tele-entrega' && item.precoDelivery && item.precoDelivery !== item.preco;
  document.getElementById('modalPriceOld').style.display = temDiferenca ? '' : 'none';
  if (temDiferenca) document.getElementById('modalPriceOld').textContent = formatarMoeda(item.preco) + ' (mesa)';
  document.getElementById('modalPrice').textContent = formatarMoeda(preco);
  document.getElementById('modalQty').textContent = '1';
  document.getElementById('modalObs').value = '';

  // Exibir disponibilidade em estoque
  const estoqueDisp = item.estoque ?? 999;
  const stockLabel = estoqueDisp === 0
    ? '<span style="color:#ef4444;font-size:12px;font-weight:700">⚠️ Esgotado</span>'
    : estoqueDisp <= (item.estoqueMin ?? 5)
      ? `<span style="color:#f59e0b;font-size:12px;font-weight:700">⚠️ Últimas ${estoqueDisp} unidades</span>`
      : `<span style="color:#4ade80;font-size:12px">✅ Disponível (${estoqueDisp})</span>`;
  const stockEl = document.getElementById('modalStockInfo');
  if (stockEl) stockEl.innerHTML = stockLabel;

  // Renderizar adicionais
  const gruposCategoria = ADICIONAIS[item.categoria] || [];
  const adDiv = document.getElementById('modalAdicionais');
  if (gruposCategoria.length) {
    adDiv.innerHTML = gruposCategoria.map(g => `
      <div class="adicionais-group">
        <div class="adicionais-group-title">
          <i class="fas fa-plus-circle" style="color:var(--accent)"></i>
          ${g.grupo}
          <span class="badge-opt">${g.obrigatorio ? 'Obrigatório' : 'Opcional'}</span>
        </div>
        ${g.itens.map(it => `
          <div class="adicional-item" id="ad_${it.id}" onclick="toggleAdicional('${g.grupo}','${it.id}','${it.nome.replace(/'/g,"\\'")}',${it.preco})">
            <div class="adicional-label">
              <div class="adicional-check"></div>
              <span>${it.nome}</span>
            </div>
            <span class="adicional-price">${it.preco > 0 ? '+ ' + formatarMoeda(it.preco) : 'Grátis'}</span>
          </div>`).join('')}
      </div>`).join('');
  } else {
    adDiv.innerHTML = '';
  }

  atualizarModalTotal();
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function toggleAdicional(grupo, id, nome, preco) {
  if (!selectedAdicionais[grupo]) selectedAdicionais[grupo] = [];
  const idx = selectedAdicionais[grupo].findIndex(x => x.id === id);
  const el = document.getElementById('ad_' + id);
  if (idx >= 0) {
    selectedAdicionais[grupo].splice(idx, 1);
    el?.classList.remove('selected');
  } else {
    selectedAdicionais[grupo].push({ id, nome, preco });
    el?.classList.add('selected');
  }
  atualizarModalTotal();
}

function changeModalQty(delta) {
  const maxEst = currentProduct?.estoque ?? 999;
  currentQty = Math.min(maxEst, Math.max(1, currentQty + delta));
  document.getElementById('modalQty').textContent = currentQty;
  atualizarModalTotal();
}

function atualizarModalTotal() {
  if (!currentProduct) return;
  const base   = precoEfetivo(currentProduct);
  const extras = Object.values(selectedAdicionais).flat().reduce((s, x) => s + x.preco, 0);
  document.getElementById('modalTotalPrice').textContent = formatarMoeda((base + extras) * currentQty);
}

function addToCartFromModal() {
  if (!currentProduct) return;
  const adicionais = Object.values(selectedAdicionais).flat();
  const obs = document.getElementById('modalObs').value.trim();
  addToCart(currentProduct, currentQty, adicionais, obs, precoEfetivo(currentProduct));
  closeModal('productModal');
}

function quickAdd(itemId) {
  const item = DB.getCardapio().find(i => i.id === itemId);
  if (item) addToCart(item, 1, [], '', precoEfetivo(item));
}

/* ── Carrinho ────────────────────────────────────────────────────────── */
function addToCart(item, qty, adicionais, obs, precoOverride) {
  const preco = precoOverride ?? precoEfetivo(item);
  const key = item.id + '|' + adicionais.map(a => a.id).sort().join(',') + '|' + obs;
  const existing = cart.find(c => c.key === key);
  if (existing) {
    existing.quantidade += qty;
  } else {
    cart.push({ key, itemId: item.id, nome: item.nome, preco, quantidade: qty, adicionais, obs });
  }
  atualizarCarrinho();
  showToast('success', 'Adicionado!', item.nome + ' no carrinho 🛒');

  // Pulsar badge
  const cnt = document.getElementById('cartCount');
  cnt.style.transform = 'scale(1.6)';
  setTimeout(() => { cnt.style.transform = ''; }, 180);
}

function removeFromCart(key) {
  cart = cart.filter(c => c.key !== key);
  atualizarCarrinho();
}

function changeQty(key, delta) {
  const item = cart.find(c => c.key === key);
  if (!item) return;
  item.quantidade = Math.max(0, item.quantidade + delta);
  if (item.quantidade === 0) cart = cart.filter(c => c.key !== key);
  atualizarCarrinho();
}

function getCartTotal() {
  return cart.reduce((s, i) => s + (i.preco + i.adicionais.reduce((a, x) => a + x.preco, 0)) * i.quantidade, 0);
}

function getCartCount() {
  return cart.reduce((s, i) => s + i.quantidade, 0);
}

function atualizarCarrinho() {
  const total = getCartTotal();
  const count = getCartCount();
  const net   = total - couponDiscount;

  // Navbar cart btn
  document.getElementById('cartBtnTotal').textContent = formatarMoeda(net);
  const badge = document.getElementById('cartCount');
  badge.textContent = count;
  badge.className = 'cart-count' + (count > 0 ? ' show' : '');

  // Bottom bar (mobile)
  const bar = document.getElementById('bottomBar');
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('bottomBarCount').textContent = count === 1 ? '1 item' : `${count} itens`;
    document.getElementById('bottomBarTotal').textContent = formatarMoeda(net);
  } else {
    bar.style.display = 'none';
  }

  // Cart body
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');

  if (cart.length === 0) {
    body.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-bag"></i><p>Carrinho vazio</p><small style="font-size:0.8rem;color:var(--text-muted)">Adicione produtos do cardápio</small></div>`;
    footer.style.display = 'none';
    return;
  }

  body.innerHTML = cart.map(c => {
    const emoji = CAT_EMOJI[DB.getCardapio().find(i => i.id === c.itemId)?.categoria] || '🍽️';
    const itemTotal = (c.preco + c.adicionais.reduce((s, x) => s + x.preco, 0)) * c.quantidade;
    const extras = c.adicionais.map(a => a.nome).join(', ');
    return `
    <div class="cart-item">
      <div class="cart-item-img">${emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${c.nome}</div>
        <div class="cart-item-extras">${[extras, c.obs].filter(Boolean).join(' • ')}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty('${c.key}',-1)"><i class="fas fa-minus"></i></button>
          <span class="qty-num">${c.quantidade}</span>
          <button class="qty-btn" onclick="changeQty('${c.key}',1)"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <div class="cart-item-right">
        <div class="cart-item-price">${formatarMoeda(itemTotal)}</div>
        <button class="cart-item-remove" onclick="removeFromCart('${c.key}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('cartSubtotal').textContent = formatarMoeda(total);
  document.getElementById('cartGrand').textContent    = formatarMoeda(net);
  const discRow = document.getElementById('discountRow');
  if (couponDiscount > 0) {
    discRow.style.display = 'flex';
    document.getElementById('cartDiscount').textContent = '- ' + formatarMoeda(couponDiscount);
  } else {
    discRow.style.display = 'none';
  }
  footer.style.display = 'block';
}

function toggleCart() {
  document.getElementById('cartOverlay').classList.toggle('open');
  document.getElementById('cartSidebar').classList.toggle('open');
  const open = document.getElementById('cartSidebar').classList.contains('open');
  document.body.style.overflow = open ? 'hidden' : '';
}

/* ── Cupom ───────────────────────────────────────────────────────────── */
function applyCoupon() {
  const code = document.getElementById('couponInput').value.trim().toUpperCase();
  const total = getCartTotal();
  const cupons = { 'BEER30': 0.30, 'NAVARROS10': 0.10, 'PRIMEIROORDER': 0.15 };
  if (cupons[code]) {
    couponDiscount = total * cupons[code];
    atualizarCarrinho();
    showToast('success', 'Cupom aplicado!', `${(cupons[code]*100).toFixed(0)}% de desconto aplicado`);
  } else {
    showToast('error', 'Cupom inválido', 'Verifique o código e tente novamente');
  }
}

function copyCode(code) {
  navigator.clipboard?.writeText(code).catch(() => {});
  showToast('success', 'Código copiado!', `Use ${code} no carrinho`);
}

/* ── Checkout ────────────────────────────────────────────────────────── */
function openCheckout() {
  if (cart.length === 0) {
    showToast('error', 'Carrinho vazio', 'Adicione produtos antes de finalizar');
    return;
  }
  if (document.getElementById('cartSidebar').classList.contains('open')) toggleCart();
  // Reset para delivery por padrão
  setEntregaTipo('tele-entrega', document.getElementById('btnEntregaDelivery'));
  buildCheckoutSummary();
  document.getElementById('checkoutModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function setEntregaTipo(tipo, btn) {
  entregaTipo = tipo;
  document.querySelectorAll('.entrega-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const endEl = document.getElementById('enderecoFields');
  if (endEl) endEl.style.display = tipo === 'tele-entrega' ? '' : 'none';
  buildCheckoutSummary();
}

function buildCheckoutSummary() {
  const subtotal = getCartTotal() - couponDiscount;
  const taxa     = getTaxaEntrega();
  const total    = subtotal + taxa;

  const itensHtml = cart.map(c => {
    const itemTotal = (c.preco + c.adicionais.reduce((s,x) => s + x.preco, 0)) * c.quantidade;
    const desc = [c.adicionais.map(a=>a.nome).join(', '), c.obs].filter(Boolean).join(' • ');
    return `<div class="checkout-summary-item">
      <span>${c.quantidade}× ${c.nome}${desc ? '<br><small style="color:var(--text-muted);font-size:0.73rem">'+desc+'</small>' : ''}</span>
      <span class="price">${formatarMoeda(itemTotal)}</span>
    </div>`;
  }).join('');

  document.getElementById('checkoutSummary').innerHTML = `
    <div class="checkout-summary-title"><i class="fas fa-list"></i> Resumo</div>
    ${itensHtml}
    ${couponDiscount > 0 ? `<div class="checkout-summary-item"><span>Desconto</span><span class="price" style="color:#4ade80">- ${formatarMoeda(couponDiscount)}</span></div>` : ''}
    ${taxa > 0 ? `<div class="checkout-summary-item"><span>🛵 Taxa de entrega</span><span class="price">${formatarMoeda(taxa)}</span></div>` : ''}
    <div class="checkout-summary-total"><span>Total</span><span class="price">${formatarMoeda(total)}</span></div>`;
}

function selectPayment(el, method) {
  paymentMethod = method;
  document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

/* ── Enviar via WhatsApp (única forma de finalizar) ──────────────────── */
function enviarViaWhatsApp() {
  if (cart.length === 0) { showToast('error','Carrinho vazio','Adicione itens primeiro'); return; }

  const nome = document.getElementById('ckNome').value.trim();
  const tel  = document.getElementById('ckTel').value.trim();
  if (!nome) { showToast('error','Atenção','Digite seu nome!'); return; }
  if (!tel)  { showToast('error','Atenção','Digite seu WhatsApp!'); return; }

  let rua='', num='', bairro='', comp='';
  if (entregaTipo === 'tele-entrega') {
    rua    = document.getElementById('ckRua').value.trim();
    num    = document.getElementById('ckNum').value.trim();
    bairro = document.getElementById('ckBairro').value.trim();
    comp   = document.getElementById('ckComp').value.trim();
    if (!rua)    { showToast('error','Atenção','Digite o endereço!'); return; }
    if (!num)    { showToast('error','Atenção','Digite o número!'); return; }
    if (!bairro) { showToast('error','Atenção','Digite o bairro!'); return; }
  }

  const taxa     = getTaxaEntrega();
  const subtotal = getCartTotal() - couponDiscount;
  const total    = subtotal + taxa;
  const payLabel = { pix:'PIX', credito:'Cartão Crédito', debito:'Cartão Débito', dinheiro:'Dinheiro' }[paymentMethod] || paymentMethod;
  const tipoLabel = entregaTipo === 'tele-entrega' ? '🛵 Delivery' : '🏪 Retirada no balcão';

  // Montar mensagem WhatsApp
  let msg = `🍺 *NAVARROS.BEER – NOVO PEDIDO*\n\n`;
  msg += `👤 *Nome:* ${nome}\n`;
  msg += `📞 *WhatsApp:* ${tel}\n`;
  msg += `📦 *Tipo:* ${tipoLabel}\n`;
  msg += `💳 *Pagamento:* ${payLabel}\n`;
  if (entregaTipo === 'tele-entrega') {
    msg += `📍 *Endereço:* ${rua}, ${num} – ${bairro}${comp ? ` (${comp})` : ''}\n`;
  }
  msg += `\n*🛒 Itens:*\n`;
  cart.forEach(c => {
    const preco = (c.preco + c.adicionais.reduce((s,x) => s+x.preco,0)) * c.quantidade;
    msg += `• ${c.quantidade}× ${c.nome} — ${formatarMoeda(preco)}\n`;
    if (c.adicionais.length) msg += `  _+ ${c.adicionais.map(a=>a.nome).join(', ')}_\n`;
    if (c.obs) msg += `  _💬 ${c.obs}_\n`;
  });
  msg += `\n💵 *Subtotal:* ${formatarMoeda(subtotal)}`;
  if (taxa > 0) msg += `\n🛵 *Taxa de entrega:* ${formatarMoeda(taxa)}`;
  msg += `\n💰 *TOTAL: ${formatarMoeda(total)}*\n\n_Pedido feito pelo cardápio digital_`;

  // Salvar no DB (admin vê o pedido)
  const pedido = {
    id: DB.gerarIdPedido(),
    tipo: entregaTipo,
    cliente: nome,
    telefone: tel,
    ...(entregaTipo === 'tele-entrega' ? { endereco: { rua, numero: num, bairro, complemento: comp } } : {}),
    itens: cart.map(c => ({
      id: Date.now() + Math.random(),
      itemId: c.itemId,
      nome: c.nome,
      preco: c.preco + c.adicionais.reduce((s,x) => s+x.preco, 0),
      quantidade: c.quantidade,
      obs: [c.adicionais.map(a=>a.nome).join(', '), c.obs].filter(Boolean).join(' • '),
    })),
    taxa,
    pagamento: paymentMethod,
    statusAprovacao: 'aguardando',
    criadoEm: Date.now(),
  };
  DB.adicionarPedidoExterno(pedido);

  // Deduzir estoque
  deduzirEstoque(cart);

  // Impressão automática (se configurado)
  const config = DB.getConfig();
  if (config.autoImprimirEntrega) {
    imprimirInteligente(gerarCupomPedidoExterno(pedido), pedido.itens);
  }

  // Limpar carrinho ANTES de redirecionar
  cart = [];
  couponDiscount = 0;
  atualizarCarrinho();
  closeModal('checkoutModal');
  marcarAtualizado();

  // Abrir WhatsApp — window.location.href funciona no celular sem ser bloqueado
  const numero = (DB.getConfig().whatsapp || '5511999999999').replace(/\D/g,'');
  const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
  window.location.href = whatsappUrl;
}

/* ── Deduzir estoque ao finalizar pedido ────────────────────────────── */
function deduzirEstoque(cartItems) {
  cartItems.forEach(c => {
    const prod = DB.getTodosProdutos().find(p => p.id === c.itemId);
    if (!prod || prod.estoque == null) return;
    const novo = Math.max(0, (prod.estoque || 0) - c.quantidade);
    DB.updateProduto(prod.id, { estoque: novo });
  });
}

/* ── Success overlay ─────────────────────────────────────────────────── */
function showOrderSuccess(title, sub) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center';
  div.innerHTML = `
    <div style="font-size:4rem">✅</div>
    <h2 style="font-family:Bebas Neue,sans-serif;font-size:2.2rem;letter-spacing:2px;color:#fff">${title}</h2>
    <p style="color:#888;font-size:0.95rem;max-width:320px;line-height:1.6">${sub}</p>
    <button onclick="this.parentElement.remove()" style="margin-top:8px;background:#fff;color:#000;border:none;padding:13px 36px;border-radius:8px;font-family:Bebas Neue,sans-serif;font-size:1.2rem;letter-spacing:1px;cursor:pointer">OK</button>`;
  document.body.appendChild(div);
}

/* ── Favoritos ───────────────────────────────────────────────────────── */
function toggleFav(id, btn) {
  const idx = favs.indexOf(id);
  if (idx >= 0) { favs.splice(idx,1); btn.classList.remove('active'); }
  else { favs.push(id); btn.classList.add('active'); showToast('success','Favorito adicionado!',''); }
  localStorage.setItem('nb_favs', JSON.stringify(favs));
}

/* ── Modal helpers ───────────────────────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function handleModalOverlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

/* ── Máscara telefone ────────────────────────────────────────────────── */
function mascaraTel(input) {
  let v = input.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/,'($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})$/,'($1) $2');
  else if (v.length > 0) v = '(' + v;
  input.value = v;
}

/* ── Toast ───────────────────────────────────────────────────────────── */
function showToast(type, title, msg) {
  const icons = { success:'fas fa-check-circle', error:'fas fa-exclamation-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="${icons[type]||'fas fa-info-circle'}"></i><div class="toast-content"><div class="toast-title">${title}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ''}</div>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => { t.style.transition='opacity 0.3s,transform 0.3s'; t.style.opacity='0'; t.style.transform='translateX(100%)'; setTimeout(()=>t.remove(),320); }, 3200);
}

// Substituir o toast do app.js para compatibilidade
function toast(msg, tipo='') {
  const map = { success:'success', error:'error' };
  showToast(map[tipo]||'success', msg, '');
}

/* ── Scroll to menu ──────────────────────────────────────────────────── */
function scrollToMenu() {
  document.getElementById('menuSection').scrollIntoView({ behavior:'smooth' });
}

/* ── ESC para fechar modais ──────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('productModal');
    closeModal('checkoutModal');
    if (document.getElementById('cartSidebar').classList.contains('open')) toggleCart();
  }
});

// Init
init();
