# 🍺 NAVARROS.BEER — Sistema de Gestão

Sistema completo de gerenciamento de mesas, pedidos e cardápio para bares e restaurantes.

## 📁 Estrutura de Arquivos

```
navarros-beer/
├── index.html          → Painel de Mesas (admin)
├── pedidos.html        → Gerenciar Pedidos externos (admin)
├── configuracoes.html  → Configurações do sistema (admin)
├── cardapio.html       → 🌟 Cardápio para CLIENTES fazerem pedidos
├── css/
│   ├── style.css       → Estilos do painel admin
│   └── cardapio.css    → Estilos do cardápio cliente
└── js/
    ├── data.js         → Banco de dados local (localStorage)
    ├── app.js          → Utilitários compartilhados + impressão
    ├── mesas.js        → Lógica do painel de mesas
    ├── pedidos.js      → Lógica dos pedidos externos
    ├── configuracoes.js → Lógica das configurações
    └── cardapio-cliente.js → Lógica do cardápio do cliente
```

## 🚀 Como Usar

### Opção 1 — Abrir direto no navegador
Abra o arquivo `index.html` no navegador (Chrome recomendado).
> **Atenção:** Para impressão automática em impressoras de rede, use um servidor local (opção 2).

### Opção 2 — Servidor local (recomendado)
```bash
# Com Python (já instalado na maioria dos sistemas):
cd navarros-beer
python3 -m http.server 8080

# Depois acesse:
# http://localhost:8080          → Painel Admin
# http://localhost:8080/cardapio.html → Cardápio do cliente
```

---

## 📱 Páginas do Sistema

### Para a EQUIPE (admin):
| Página | URL | Descrição |
|--------|-----|-----------|
| Painel de Mesas | `index.html` | Visualizar e gerenciar todas as mesas |
| Pedidos | `pedidos.html` | Aprovar/recusar pedidos externos |
| Configurações | `configuracoes.html` | Impressoras, cardápio, mesas, salões |

### Para CLIENTES:
| Página | URL | Descrição |
|--------|-----|-----------|
| Cardápio | `cardapio.html` | Cliente escolhe itens e envia pedido |

---

## 🖨️ Configuração de Impressoras

1. Acesse **Configurações**
2. Em **Impressoras**, digite o endereço de rede da impressora
   - Ex: `192.168.1.50` ou `COZINHA-PRINTER`
3. Marque as opções de impressão automática
4. Ao confirmar pedidos, o sistema abre automaticamente a janela de impressão

> **Como funciona:** O sistema abre uma janela de impressão formatada em 80mm (padrão para impressoras térmicas). Permita popups no navegador.

---

## 🔄 Fluxo de Pedido (Mesa)

1. **Cliente** acessa `cardapio.html` no celular/tablet da mesa
2. Seleciona a mesa, escolhe os itens, clica em **Enviar Pedido**
3. O pedido aparece automaticamente no **Painel de Mesas** (admin)
4. A impressora da **Cozinha** e do **Caixa** recebem o cupom automaticamente
5. Ao encerrar, clique em **Fechar Conta** para imprimir o cupom final

## 🔄 Fluxo de Pedido (Retirada/Tele-entrega)

1. **Cliente** acessa `cardapio.html`, seleciona o tipo (Retirada ou Tele-entrega)
2. Digita o nome e envia o pedido
3. O pedido aparece em **Pedidos** → coluna **Aguardando Aprovação**
4. A equipe clica em **Aprovar** → pedido vai para **Aprovados** e imprime automaticamente

---

## 💾 Dados

Todos os dados são salvos no **localStorage** do navegador. Isso significa:
- ✅ Funciona sem internet
- ✅ Os dados persistem ao fechar o navegador
- ⚠️ Os dados ficam no navegador local (não sincronizam entre computadores diferentes automaticamente)
- ⚠️ Limpar dados do navegador apaga tudo

### Para usar em rede local (múltiplos dispositivos):
Use a **Opção 2** (servidor local) e acesse pelo IP da máquina:
- Ex: `http://192.168.1.100:8080` em qualquer dispositivo da rede

---

## ⚙️ Personalização

### Adicionar itens ao cardápio:
→ Configurações → Cardápio → preencha e clique em Adicionar

### Adicionar mesas:
→ Configurações → Mesas → preencha e clique em Adicionar Mesa

### Adicionar salões/áreas:
→ Configurações → Áreas/Salões → + Adicionar Salão

---

## 🎯 Funcionalidades

- ✅ Painel de mesas com status em tempo real
- ✅ Abertura e fechamento de mesas
- ✅ Adição de itens do cardápio à mesa
- ✅ Divisão de conta
- ✅ Histórico de contas fechadas
- ✅ Pedidos externos (retirada e tele-entrega)
- ✅ Aprovação/recusa de pedidos
- ✅ Cardápio digital para clientes
- ✅ Carrinho de compras
- ✅ Impressão automática na cozinha e caixa (80mm)
- ✅ Filtro por salão/área
- ✅ Configuração de impressoras
- ✅ Gestão de cardápio e mesas pelo painel
- ✅ Sincronização entre abas do mesmo navegador
- ✅ Responsivo para tablets e celulares
# Navarros.beersistema
