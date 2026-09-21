(() => {
  const undoName = /(?:undo\s+(?:repost|retweet)|(?:desfazer|remover)\s+(?:o\s+)?(?:repost|retweet|republicação|retweetar))/i;
  function undoButton(article) {
    return article.querySelector('[data-testid="unretweet"]') ||
      [...article.querySelectorAll('button, [role="button"]')].find(el => undoName.test(el.getAttribute('aria-label') || ''));
  }
  function accountLink() {
    const direct = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    const directLink = direct?.closest('a') || direct?.querySelector('a');
    if (directLink && profileUsername(directLink.href)) return directLink;
    return [...document.querySelectorAll('header nav a, header [role="navigation"] a, [role="banner"] a, [role="navigation"] a')]
      .find(link => {
        const labels = [link.getAttribute('aria-label'), link.textContent].filter(Boolean);
        return labels.some(label => /^(profile|perfil)$/i.test(label.trim())) && !!profileUsername(link.href);
      });
  }
  function profileUsername(url = location.href) {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/([a-z0-9_]{1,15})(?:\/(?:all|reposts|retweets|with_replies))?\/?$/i);
    return parsed.origin === 'https://x.com' && match && !['home', 'explore', 'notifications', 'messages', 'settings', 'i', 'login', 'search'].includes(match[1].toLowerCase()) ? match[1].toLowerCase() : '';
  }
  function isProfile(url = location.href, username = '') {
    const parsed = new URL(url);
    const found = profileUsername(parsed.href);
    return !!found && (!username || found === username.toLowerCase());
  }
  const shown = el => el && el.getClientRects().length > 0;
  const ALL_NAME = /^(all|tudo|todos)$/i;
  const POSTS_NAME = /^(posts|publicações)$/i;
  // Interface nova do X: um menu suspenso (All / Posts / Highlights) no lugar das abas.
  function timelineTrigger() {
    return [...document.querySelectorAll('button, [role="button"]')].find(el => shown(el)
      && (ALL_NAME.test(el.textContent.trim()) || POSTS_NAME.test(el.textContent.trim()) || /^(highlights|destaques)$/i.test(el.textContent.trim()))
      && (el.getAttribute('aria-haspopup') === 'menu' || el.hasAttribute('aria-expanded')));
  }
  async function waitUntil(condition, ms, cancelled) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (cancelled()) throw new Error('Parado pelo usuário.');
      if (condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  }
  function tabHref(el) {
    const anchor = el.matches('a') ? el : el.closest('a') || el.querySelector('a');
    try { return anchor ? new URL(anchor.getAttribute('href'), location.href).pathname : ''; } catch { return ''; }
  }
  // Itens da barra de abas do perfil, localizada pela aba que aponta para Replies,
  // Reposts ou All. Evita confundir com a navegação lateral do site.
  function profileTabItems() {
    const anchors = [...document.querySelectorAll('[role="tab"], nav a, [role="tablist"] a')];
    const sibling = /^(replies|respostas|reposts|retweets|republicações|all|tudo|todos)$/i;
    const marker = anchors.find(el => /\/(with_replies|reposts|retweets|all)\/?$/i.test(tabHref(el))
      || sibling.test((el.textContent || '').trim()));
    const scope = marker && (marker.closest('[role="tablist"]') || marker.closest('nav'));
    return scope ? [...scope.querySelectorAll('[role="tab"], a')].filter(shown) : [];
  }
  const ON_ALL = () => /\/all\/?$/i.test(location.pathname);
  // A opção All vive no menu da aba Posts: sem ela ativa, o menu não oferece All.
  async function selectAllTimeline(options, cancelled) {
    const items = profileTabItems();
    if (!items.length) return await selectFromDropdown(ALL_NAME, cancelled);
    const named = el => (el.textContent || '').trim();
    const isAll = el => ALL_NAME.test(named(el)) || /\/all\/?$/i.test(tabHref(el));
    const user = (options.username || profileUsername() || '').toLowerCase();
    const root = new RegExp(`^/${user || '[a-z0-9_]{1,15}'}/?$`, 'i');
    // Quando a barra marca a aba ativa, ela manda; sem isso, resta o endereço.
    const marked = items.some(el => el.hasAttribute('aria-selected'));
    const active = el => marked ? el.getAttribute('aria-selected') === 'true' : root.test(location.pathname);
    if (ON_ALL() || items.some(el => isAll(el) && active(el))) return true;
    const allTab = items.find(isAll);
    if (allTab) {
      allTab.click();
      if (!await waitUntil(() => ON_ALL() || active(allTab), 15000, cancelled)) return false;
      await new Promise(resolve => setTimeout(resolve, 1800));
      return true;
    }
    const postsTab = items.find(el => root.test(tabHref(el))) || items.find(el => POSTS_NAME.test(named(el)));
    if (!postsTab) return await selectFromDropdown(ALL_NAME, cancelled);
    if (!active(postsTab)) {
      postsTab.click();
      if (!await waitUntil(() => active(postsTab), 15000, cancelled)) return false;
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    return await selectFromDropdown(ALL_NAME, cancelled, postsTab);
  }
  async function selectFromDropdown(wanted, cancelled, explicit = null) {
    const trigger = explicit && shown(explicit) ? explicit : timelineTrigger();
    if (!trigger) return false;
    if (wanted.test(trigger.textContent.trim())) return true;
    trigger.click();
    const end = Date.now() + 8000;
    let item = null;
    while (Date.now() < end && !item) {
      if (cancelled()) throw new Error('Parado pelo usuário.');
      // Só age no menu do filtro da linha do tempo, reconhecido por listar Posts.
      const menu = [...document.querySelectorAll('[role="menu"]')].filter(shown)
        .find(el => [...el.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].some(option => POSTS_NAME.test(option.textContent.trim())));
      item = menu && [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].find(option => wanted.test(option.textContent.trim()));
      if (!item) await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!item) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return false;
    }
    item.click();
    await new Promise(resolve => setTimeout(resolve, 1800));
    return true;
  }
  // A aba All lista posts e reposts juntos; a aba Reposts nem sempre traz tudo.
  const TARGETS = {
    replies: { name: /^(replies|respostas|posts e respostas)$/i, path: /\/with_replies\/?$/i, label: 'Replies / Respostas' },
    reposts: { name: /^(reposts|retweets|republicações)$/i, path: /\/(reposts|retweets)\/?$/i, label: 'Reposts' },
  };
  async function selectTimeline(options, target = options.mode, cancelled = () => false) {
    if (cancelled()) throw new Error('Parado pelo usuário.');
    if (target === 'all') return await selectAllTimeline(options, cancelled) ? 'all' : 'none';
    const wanted = TARGETS[target];
    // Sem aba própria (modo 'posts'): resta o menu suspenso da interface nova.
    if (!wanted) return await selectFromDropdown(POSTS_NAME, cancelled) ? 'all' : 'none';
    const { name, path, label } = wanted;
    // A aba pode vir só com ícone, sem texto: o endereço identifica melhor que o rótulo.
    const identifies = el => [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')]
      .some(text => text && name.test(text.trim())) || (!!path && path.test(tabHref(el)));
    const tab = [...document.querySelectorAll('[role="tab"], nav a, [role="tablist"] a')].find(identifies);
    if (!tab) {
      // A lista antiga pode misturar reposts nos posts; só troca quando existe a aba.
      if (await selectFromDropdown(ALL_NAME, cancelled)) return 'all';
      if (target === 'replies' && !path.test(location.pathname)) throw new Error('Abra a aba Replies / Respostas do perfil e tente novamente.');
      return 'none';
    }
    const done = () => target === 'all' ? 'all' : 'tab';
    const selected = () => tab.getAttribute('aria-selected') === 'true'
      || [...document.querySelectorAll('[aria-selected="true"]')].some(identifies);
    if (selected()) return done();
    const link = tab.matches('a') ? tab : tab.closest('a') || tab.querySelector('a');
    if (link && !isProfile(link.href, options.username || profileUsername())) throw new Error(`Endereço da aba ${label} não reconhecido.`);
    tab.click();
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (cancelled()) throw new Error('Parado pelo usuário.');
      if (!isProfile()) throw new Error('Você saiu do perfil.');
      if (selected() || (path && path.test(location.pathname))) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        return done();
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Não consegui abrir a aba ${label}. Abra essa aba manualmente e tente novamente.`);
  }
  const numberOr = (value, fallback) => value === undefined || value === null || value === '' ? fallback : Number(value);
  function validate(raw = {}) {
    const limit = Number(raw.limit ?? 50);
    const interval = Number(raw.interval ?? 1.5);
    // Cota por janela deslizante: 0 desliga. Conta remoções de execuções anteriores.
    const windowLimit = numberOr(raw.windowLimit, 0);
    const windowSeconds = numberOr(raw.windowSeconds, 600);
    if (!Number.isFinite(interval) || interval < 0.1 || interval > 86400) throw new Error('Use um intervalo entre 0,1 e 86400 segundos.');
    if (!Number.isInteger(windowLimit) || windowLimit < 0 || windowLimit > 10000) throw new Error('Use uma cota de 1 a 10000 remoções por janela, ou 0 para desligar.');
    if (!Number.isFinite(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) throw new Error('Use uma janela entre 1 e 86400 segundos.');
    const username = String(raw.username || '').replace(/^@/, '').toLowerCase();
    if (username && !/^[a-z0-9_]{1,15}$/.test(username)) throw new Error('Usuário inválido.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Escolha uma quantidade inteira entre 1 e 1000.');
    const dates = {};
    for (const key of ['from', 'to']) {
      const value = raw[key] || '';
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida.');
      const date = value ? new Date(`${value}T00:00:00`) : null;
      if (date && (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(value.slice(0, 4)) || date.getMonth() + 1 !== Number(value.slice(5, 7)) || date.getDate() !== Number(value.slice(8, 10)))) throw new Error('Data inválida.');
      dates[key] = value;
    }
    if (dates.from && dates.to && dates.from > dates.to) throw new Error('A data inicial deve ser anterior ou igual à final.');
    const keyword = String(raw.keyword || '').trim();
    const mode = raw.mode || 'posts';
    if (!['posts', 'reposts', 'both', 'replies', 'all'].includes(mode)) throw new Error('Tipo de remoção inválido.');
    if (keyword.length > 200) throw new Error('Use até 200 caracteres na palavra-chave.');
    return Object.freeze({ limit, ...dates, keyword, mode, interval, windowLimit, windowSeconds, username });
  }
  function read(article) {
    const time = article.querySelector('time');
    const match = time?.closest('a')?.getAttribute('href')?.match(/^\/([^/]+)\/status\/(\d+)(?:[/?]|$)/);
    if (!match) return null;
    const text = [...article.querySelectorAll('[data-testid="tweetText"]')]
      .filter(el => el.closest('article') === article && !el.closest('[role="link"]'))
      .map(el => el.textContent).join('\n');
    return { id: match[2], author: match[1].toLowerCase(), text,
      timestamp: Date.parse(time.getAttribute('datetime') || ''),
      canUndo: !!undoButton(article),
      repost: !!undoButton(article) || /repost|retweet|republic/i.test(article.querySelector('[data-testid="socialContext"]')?.textContent || '') };
  }
  function matches(post, options) {
    if (!post) return false;
    if (post.repost) {
      if (!['reposts', 'both', 'all'].includes(options.mode) || !post.canUndo) return false;
    } else if (options.mode === 'reposts' || post.author !== (options.username || profileUsername())) return false;
    if (options.from || options.to) {
      if (!Number.isFinite(post.timestamp)) return false;
      if (options.from && post.timestamp < new Date(`${options.from}T00:00:00`).getTime()) return false;
      if (options.to) {
        const end = new Date(`${options.to}T00:00:00`);
        end.setDate(end.getDate() + 1);
        if (post.timestamp >= end.getTime()) return false;
      }
    }
    return !options.keyword || post.text.toLocaleLowerCase('pt-BR').includes(options.keyword.toLocaleLowerCase('pt-BR'));
  }
  function describe(options) {
    const type = { posts: 'posts próprios', reposts: 'reposts', both: 'posts próprios e reposts', replies: 'posts próprios e respostas na aba Replies', all: 'posts próprios, respostas e reposts' }[options.mode];
    const rest = options.windowLimit ? ` · no máximo ${options.windowLimit} exclusões a cada ${options.windowSeconds} s (reposts não contam)` : '';
    return `Até ${options.limit} itens · ${type} · intervalo de ${options.interval} s${rest} · ${options.from || 'sem data inicial'} até ${options.to || 'sem data final'} (datas locais, inclusive; reposts usam a data do post original) · ${options.keyword ? `texto contendo “${options.keyword}”` : 'qualquer texto'}`;
  }
  const panelStyle = `section{background:#101318!important;color:#edf0f6!important;border:1px solid #65774b!important;border-radius:14px!important;box-shadow:0 12px 40px #0006!important;max-height:75vh;overflow:auto;font:13px system-ui!important;padding:22px!important}strong{display:block;font-size:16px;letter-spacing:-.3px}p{line-height:1.65}#summary{color:#b6c0cc;font-size:12px;padding-bottom:12px;border-bottom:1px solid #303843}input{background:#1b2028;color:#edf0f6;border:1px solid #4a5564;border-radius:7px;padding:10px!important}button{border:1px solid #46515f;border-radius:7px;background:#222a35;color:#edf0f6;font:12px system-ui;padding:10px 14px!important}#start{background:#d7ff83!important;color:#17250a!important}button:disabled{opacity:.45;cursor:not-allowed}a{color:#d7ff83}li{margin:12px 0;font-size:12px;line-height:1.6}[role=status]{padding:12px;background:#1b222b;border-radius:8px;color:#d7ff83}`;
  globalThis.XTerminatorFilters = { validate, read, matches, describe, undoButton, undoName, isProfile, profileUsername, selectTimeline, panelStyle, accountLink };
})();
