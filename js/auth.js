// ===================== AUTH NAVARROS.BEER =====================
// Autenticação via JWT em cookie httpOnly (o servidor gerencia o token)
// O localStorage armazena APENAS dados de exibição (nome, role, avatar)
// — nunca a senha ou o JWT.

async function authLogin(email, senha) {
  try {
    const data = await API.post('/api/auth/login', { email, senha });
    if (data?.usuario) {
      // Armazenar apenas informações de exibição (não sensíveis)
      localStorage.setItem('nb_auth', JSON.stringify(data.usuario));
      return data;
    }
    return null;
  } catch (err) {
    throw err; // propagar mensagem de erro para a página de login
  }
}

async function authLogout() {
  try {
    await API.post('/api/auth/logout');
  } catch {
    // mesmo com erro no servidor, limpar estado local
  }
  localStorage.removeItem('nb_auth');
  window.location.replace('/login.html');
}

function authGetUser() {
  try {
    return JSON.parse(localStorage.getItem('nb_auth'));
  } catch {
    return null;
  }
}

// Verifica permissão e redireciona se não autorizado
// (verificação rápida local; a verificação real é no servidor via JWT)
function authRequire(allowedRoles) {
  const user = authGetUser();
  if (!user) {
    window.location.replace('/login.html');
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.replace(user.role === 'garcom' ? '/garcom.html' : '/index.html');
    return null;
  }
  return user;
}

// Injeta nav baseada no papel do usuário (mantida igual ao original)
function authRenderNav() {
  const user = authGetUser();
  if (!user) return;
  const links = document.querySelector('.nav-links');
  if (!links) return;

  const logoutIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

  if (user.role === 'garcom') {
    links.innerHTML = `
      <a href="/garcom.html" class="active">🍺 Atendimento</a>
      <a href="javascript:void(0)" class="nav-logout" onclick="authLogout()">${logoutIcon} Sair</a>`;
    return;
  }

  const currentPage = location.pathname.split('/').pop() || 'index.html';
  const ownerLinks = [
    { href: '/dashboard.html', label: '📊 Dashboard' },
    { href: '/produtos.html',  label: '📦 Produtos'  },
  ];
  ownerLinks.forEach(item => {
    if (!links.querySelector(`[href="${item.href}"]`)) {
      const a = document.createElement('a');
      a.href = item.href;
      a.innerHTML = item.label;
      if (currentPage === item.href.slice(1)) a.classList.add('active');
      links.insertBefore(a, links.firstChild);
    }
  });

  links.insertAdjacentHTML('beforeend',
    `<a href="javascript:void(0)" class="nav-logout" onclick="authLogout()">${logoutIcon} Sair</a>`
  );
}
