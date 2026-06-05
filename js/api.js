// ===================== API CLIENT =====================
// Cliente HTTP que usa cookies httpOnly (JWT nunca exposto ao JS)
// Faz refresh automático quando o access token expira (401 + expirada: true)

const API = (() => {
  let _refreshPromise = null; // garante que só uma renovação rode por vez

  async function request(method, path, body) {
    const opts = {
      method,
      credentials: 'include', // envia cookies httpOnly automaticamente
      headers: {},
    };

    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(path, opts);

    // Access token expirado — tentar renovar uma vez
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));

      if (data.expirada && !path.includes('/api/auth/')) {
        // Evitar múltiplos refreshes simultâneos
        if (!_refreshPromise) {
          _refreshPromise = fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          }).finally(() => { _refreshPromise = null; });
        }

        const refreshRes = await _refreshPromise;
        if (refreshRes && refreshRes.ok) {
          // Repetir a requisição original com o novo token (no cookie)
          return request(method, path, body);
        }
      }

      // Refresh falhou ou outro 401 → redirecionar para login
      localStorage.removeItem('nb_auth');
      window.location.replace('/login.html');
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.erro || `Erro ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  return {
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    put:    (path, body)  => request('PUT',    path, body),
    patch:  (path, body)  => request('PATCH',  path, body),
    delete: (path)        => request('DELETE', path),
  };
})();
