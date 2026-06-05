// ===================== APP UTILITIES =====================

// --- Modais ---
function abrirModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function fecharModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}
// Fechar modal clicando fora
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('open');
  }
});

// --- Toast ---
function toast(msg, tipo = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// --- Formatar moeda ---
function formatarMoeda(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

// --- Formatar data ---
function formatarData(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// --- Categorias que vão para a cozinha (itens que precisam ser preparados) ---
const CATS_COZINHA = new Set([
  'Petiscos','Lanches','Pizzas','Sobremesas','Porções','Porcões','Combos','Pratos','Entradas',
]);

// Verifica se a lista de itens contém pelo menos um item de comida
function itensTemComida(itens) {
  if (!itens || !itens.length) return false;
  const todos = (typeof DB !== 'undefined' && DB.getTodosProdutos) ? DB.getTodosProdutos() : [];
  return itens.some(item => {
    const id   = item.itemId || item.id;
    const prod = todos.find(p => p.id === id);
    if (prod) return CATS_COZINHA.has(prod.categoria);
    // Fallback por nome quando o produto não está no catálogo
    const n = (item.nome || '').toLowerCase();
    return /frango|batata|calabresa|por[cç][aã]o|porcao|lanche|pizza|mista|hambur|sanduí?che|prato/.test(n);
  });
}

// Impressão inteligente:
//   • Caixa  → sempre (toda e qualquer ordem)
//   • Cozinha → somente se houver itens de comida
function imprimirInteligente(cupom, itens) {
  imprimirCupom(cupom, 'Caixa');
  if (itensTemComida(itens)) {
    imprimirCupom(cupom, 'Cozinha');
  }
}

// --- Impressão ---
function imprimirCupom(conteudo, destino = 'Cozinha') {
  const config = DB.getConfig();
  const impressora = destino === 'Cozinha' ? config.impressoraCozinha : config.impressoraCaixa;

  // Cria janela de impressão
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) { toast('Permita popups para imprimir', 'error'); return; }

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cupom ${destino}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 8px; }
  h2 { font-size: 14px; text-align: center; margin: 0 0 6px; }
  .destino { text-align: center; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 4px; margin-bottom: 8px; }
  .linha { border-top: 1px dashed #000; margin: 6px 0; }
  .item { display: flex; justify-content: space-between; margin: 3px 0; }
  .total { font-weight: bold; font-size: 14px; }
  .obs { font-style: italic; color: #444; font-size: 11px; }
  .rodape { text-align: center; margin-top: 10px; font-size: 11px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>${conteudo}</body>
</html>`);

  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);

  if (impressora) {
    console.log(`[IMPRESSORA] Enviando para ${impressora} (${destino}):`, conteudo);
  }
}

function gerarCupomMesa(mesa, estado) {
  const agora = new Date();
  const itens = estado.pedidos || [];
  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  let linhasItens = '';
  itens.forEach(item => {
    linhasItens += `<div class="item"><span>${item.quantidade}x ${item.nome}</span><span>${formatarMoeda(item.preco * item.quantidade)}</span></div>`;
    if (item.obs) linhasItens += `<div class="obs">↳ ${item.obs}</div>`;
  });

  return `
    <h2>🍺 NAVARROS.BEER</h2>
    <div class="linha"></div>
    <div>${mesa.nome} — ${mesa.salao}</div>
    <div>${agora.toLocaleString('pt-BR')}</div>
    <div class="linha"></div>
    ${linhasItens}
    <div class="linha"></div>
    <div class="item total"><span>TOTAL</span><span>${formatarMoeda(total)}</span></div>
    <div class="rodape">Obrigado pela visita!</div>
  `;
}

function gerarCupomPedidoExterno(pedido) {
  const itens = pedido.itens || [];
  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  let linhasItens = '';
  itens.forEach(item => {
    linhasItens += `<div class="item"><span>${item.quantidade}x ${item.nome}</span><span>${formatarMoeda(item.preco * item.quantidade)}</span></div>`;
    if (item.obs) linhasItens += `<div class="obs">↳ ${item.obs}</div>`;
  });

  const tipo = pedido.tipo === 'tele-entrega' ? 'TELE-ENTREGA' : 'RETIRADA';

  let enderecoLine = '';
  if (pedido.tipo === 'tele-entrega' && pedido.endereco) {
    const e = pedido.endereco;
    enderecoLine = `
      <div>${e.rua}, ${e.numero}${e.complemento ? ' — ' + e.complemento : ''}</div>
      <div>Bairro: ${e.bairro}</div>`;
  }
  const telefoneLine = pedido.telefone ? `<div>Tel: ${pedido.telefone}</div>` : '';

  return `
    <h2>🍺 NAVARROS.BEER</h2>
    <div class="destino">${tipo}</div>
    <div>${pedido.id} — ${pedido.cliente}</div>
    ${telefoneLine}
    ${enderecoLine}
    <div>${new Date(pedido.criadoEm).toLocaleString('pt-BR')}</div>
    <div class="linha"></div>
    ${linhasItens}
    <div class="linha"></div>
    <div class="item total"><span>TOTAL</span><span>${formatarMoeda(total)}</span></div>
    ${pedido.obs ? `<div class="obs">Obs: ${pedido.obs}</div>` : ''}
    <div class="rodape">Obrigado pela visita!</div>
  `;
}

// --- Auto-refresh (polling simples para sincronizar abas) ---
let _lastUpdate = Date.now();
function marcarAtualizado() {
  _lastUpdate = Date.now();
  localStorage.setItem('nb_lastUpdate', _lastUpdate);
}
