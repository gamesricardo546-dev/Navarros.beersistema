// ===================== PEDIDOS PAGE =====================

function renderPedidos() {
  const todos = DB.getPedidosExternos();
  const aguardando = todos.filter(p => p.statusAprovacao === 'aguardando');
  const aprovados  = todos.filter(p => p.statusAprovacao === 'aprovado');

  renderColuna('pedidosAguardando', aguardando, true);
  renderColuna('pedidosAprovados', aprovados, false);
}

function renderColuna(containerId, pedidos, isAguardando) {
  const el = document.getElementById(containerId);
  if (pedidos.length === 0) {
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:24px;font-size:13px">Nenhum pedido</p>';
    return;
  }
  el.innerHTML = pedidos.map(p => criarCardPedido(p, isAguardando)).join('');
}

function criarCardPedido(p, isAguardando) {
  const total = (p.itens || []).reduce((s, i) => s + i.preco * i.quantidade, 0);
  const nItens = (p.itens || []).reduce((s, i) => s + i.quantidade, 0);
  const tipoLabel = p.tipo === 'tele-entrega' ? 'Tele-entrega' : 'Retirada';
  const tipoClass = p.tipo === 'tele-entrega' ? 'tele-entrega' : 'retirada';

  let actionsHTML = '';
  if (isAguardando) {
    actionsHTML = `
      <div class="pedido-status-bar">
        <div class="status-badge aguardando">Aguardando</div>
        <div class="status-badge pendente" style="text-align:right">Pendente</div>
      </div>
      <div class="pedido-card-actions">
        <button class="btn btn-primary" onclick="aprovarPedido('${p.id}')">✓ Aprovar</button>
        <button class="btn btn-danger" onclick="recusarPedido('${p.id}')">✕ Recusar</button>
      </div>`;
  } else {
    actionsHTML = `
      <div class="pedido-status-bar">
        <div class="status-badge aprovado" style="grid-column:1/-1">Aprovado</div>
      </div>
      <div class="pedido-card-actions-cozinha">
        <button class="btn btn-secondary btn-sm" onclick="imprimirPedido('${p.id}','Cozinha')">🖨️ Cozinha</button>
        <button class="btn btn-secondary btn-sm" onclick="imprimirPedido('${p.id}','Caixa')">🖨️ Caixa</button>
      </div>`;
  }

  return `
    <div class="pedido-card">
      <div class="pedido-card-header">
        <span class="pedido-id">${p.id}</span>
        <span class="pedido-tipo ${tipoClass}">👤 ${tipoLabel}</span>
      </div>
      <div class="pedido-cliente">${p.cliente}</div>
      <div class="pedido-stats">
        <div class="pedido-stat"><small>Itens</small><strong>${nItens}</strong></div>
        <div class="pedido-stat"><small>Total</small><strong>${formatarMoeda(total)}</strong></div>
      </div>
      <div class="pedido-data">${formatarData(p.criadoEm)}</div>
      ${actionsHTML}
      <button class="btn btn-outline btn-sm" onclick="verDetalhesPedido('${p.id}')" style="margin-top:8px;width:100%">Ver Itens</button>
    </div>`;
}

function aprovarPedido(id) {
  DB.atualizarPedidoExterno(id, { statusAprovacao: 'aprovado', aprovadoEm: Date.now() });

  // Imprimir automático se configurado
  const config = DB.getConfig();
  if (config.autoImprimirEntrega) {
    const p = DB.getPedidosExternos().find(x => x.id === id);
    if (p) {
      const cupom = gerarCupomPedidoExterno(p);
      imprimirInteligente(cupom, p.itens || []);
    }
  }

  toast('Pedido aprovado!', 'success');
  marcarAtualizado();
  renderPedidos();
}

function recusarPedido(id) {
  if (!confirm('Recusar este pedido?')) return;
  DB.atualizarPedidoExterno(id, { statusAprovacao: 'recusado' });
  toast('Pedido recusado', 'error');
  marcarAtualizado();
  renderPedidos();
}

function imprimirPedido(id, destino) {
  const p = DB.getPedidosExternos().find(x => x.id === id);
  if (!p) return;
  const cupom = gerarCupomPedidoExterno(p);
  imprimirCupom(cupom, destino);
  toast(`Enviando para ${destino}...`, 'success');
}

function verDetalhesPedido(id) {
  const p = DB.getPedidosExternos().find(x => x.id === id);
  if (!p) return;
  document.getElementById('detalhesPedidoId').textContent = p.id;
  const total = (p.itens || []).reduce((s, i) => s + i.preco * i.quantidade, 0);
  document.getElementById('detalhesPedidoConteudo').innerHTML = `
    <div style="margin-bottom:8px"><strong>Cliente:</strong> ${p.cliente}</div>
    <div style="margin-bottom:8px"><strong>Tipo:</strong> ${p.tipo}</div>
    <div style="margin-bottom:8px"><strong>Data:</strong> ${formatarData(p.criadoEm)}</div>
    ${p.obs ? `<div style="margin-bottom:8px"><strong>Obs:</strong> ${p.obs}</div>` : ''}
    <hr style="margin:12px 0">
    ${(p.itens || []).map(i => `
      <div class="pedido-item-linha">
        <div class="pedido-item-nome">${i.nome}${i.obs ? `<span class="pedido-item-obs">${i.obs}</span>` : ''}</div>
        <span class="pedido-item-qtd">${i.quantidade}x</span>
        <span class="pedido-item-preco">${formatarMoeda(i.preco * i.quantidade)}</span>
      </div>`).join('')}
    <div class="pedido-total"><strong>Total: ${formatarMoeda(total)}</strong></div>
  `;
  abrirModal('modalDetalhesPedido');
}

DB.onReady(() => renderPedidos());
