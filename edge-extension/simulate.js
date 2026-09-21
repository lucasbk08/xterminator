(async () => {
  const filters = globalThis.XTerminatorFilters;
  const options = filters.validate(globalThis.XTerminatorOptions);
  if (document.getElementById('xterminator-deletion')) return;
  if (document.getElementById('xterminator-simulation')) return;
  const host = document.createElement('div');
  host.id = 'xterminator-simulation';
  host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    section { width:340px; max-height:70vh; overflow:auto; padding:18px; background:#fff; color:#17212b;
      border:2px solid #1573ce; border-radius:12px; font:14px system-ui;
      box-shadow:0 4px 24px #0004; }
    button { padding:8px 14px; cursor:pointer; }
  </style><section><strong>XTerminator — Simulação</strong>
  <p id="summary"></p><p role="status">Aguardando os posts carregarem…</p><button>Parar</button><ol></ol></section>`;
  const theme = document.createElement('style');
  theme.textContent = filters.panelStyle;
  shadow.append(theme);
  document.body.append(host);
  shadow.querySelector('#summary').textContent = filters.describe(options);
  const status = shadow.querySelector('[role="status"]');
  const button = shadow.querySelector('button');
  let stopped = false;
  let finished = false;
  button.onclick = () => { if (finished) host.remove(); else stopped = true; };
  const pause = () => new Promise(resolve => setTimeout(resolve, 1500));
  let profilePath = location.pathname;
  try {
    const username = options.username || filters.profileUsername();
    const until = Date.now() + 30000;
    while (!stopped && !filters.accountLink() && Date.now() < until) await pause();
    const account = filters.accountLink();
    if (!account || new URL(account.href, location.href).pathname.replace(/\/$/, '').toLowerCase() !== `/${username}`) {
      status.textContent = 'Login não detectado. Entre na sua conta e tente novamente.';
      return;
    }
    const seen = new Set();
    const selected = new Set();
    let unchanged = 0;
    await filters.selectTimeline(options, () => stopped);
    profilePath = location.pathname;
    window.scrollTo(0, 0);
    await pause();
    for (let step = 0; step < 1000 && unchanged < 8 && !stopped && selected.size < options.limit; step++) {
      if (location.pathname !== profilePath) { stopped = true; break; }
      const previous = seen.size;
      document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
        const post = filters.read(article);
        if (!post) return;
        seen.add(post.id);
        if (selected.size >= options.limit || selected.has(post.id) || !filters.matches(post, options)) return;
        selected.add(post.id);
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `https://x.com/${post.author}/status/${post.id}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${post.repost ? 'Desfazer repost' : 'Excluir post'} · ${Number.isFinite(post.timestamp) ? new Date(post.timestamp).toLocaleString() : 'Sem data'} — ${post.text.slice(0, 240) || '(sem texto)'}`;
        item.append(link);
        shadow.querySelector('ol').append(item);
      });
      unchanged = seen.size === previous ? unchanged + 1 : 0;
      status.textContent = `${selected.size}/${options.limit} correspondências · ${seen.size} posts examinados. Nada será excluído.`;
      if (selected.size >= options.limit) break;
      window.scrollBy(0, Math.max(400, window.innerHeight * 0.8));
      await pause();
    }
    status.textContent = `${stopped ? 'Interrompido' : 'Concluído'}: ${selected.size} posts atendem aos filtros, de ${seen.size} examinados. Prévia limitada a ${options.limit} posts; pode haver outros no histórico. Nada foi excluído.`;
  } catch (error) {
    status.textContent = `Simulação interrompida: ${error.message}`;
  } finally {
    finished = true;
    button.textContent = 'Fechar';
  }
})();
