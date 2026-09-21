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
    const match = parsed.pathname.match(/^\/([a-z0-9_]{1,15})(?:\/(?:reposts|retweets|with_replies))?\/?$/i);
    return parsed.origin === 'https://x.com' && match && !['home', 'explore', 'notifications', 'messages', 'settings', 'i', 'login', 'search'].includes(match[1].toLowerCase()) ? match[1].toLowerCase() : '';
  }
  function isProfile(url = location.href, username = '') {
    const parsed = new URL(url);
    const found = profileUsername(parsed.href);
    return !!found && (!username || found === username.toLowerCase());
  }
  async function selectTimeline(options, cancelled = () => false) {
    if (!['reposts', 'replies'].includes(options.mode)) return;
    const replies = options.mode === 'replies';
    const name = replies ? /^(replies|respostas|posts e respostas)$/i : /^(reposts|retweets|republicações)$/i;
    const path = replies ? /\/with_replies\/?$/i : /\/(reposts|retweets)\/?$/i;
    const label = replies ? 'Replies / Respostas' : 'Reposts';
    if (cancelled()) throw new Error('Parado pelo usuário.');
    const tab = [...document.querySelectorAll('[role="tab"], nav a')].find(el => name.test(el.textContent.trim()));
    // A lista antiga pode misturar reposts nos posts; só troca quando existe a aba.
    if (!tab) {
      if (replies && !path.test(location.pathname)) throw new Error('Abra a aba Replies / Respostas do perfil e tente novamente.');
      return;
    }
    if (tab.getAttribute('aria-selected') === 'true') return;
    const link = tab.matches('a') ? tab : tab.closest('a') || tab.querySelector('a');
    if (link && !isProfile(link.href, options.username || profileUsername())) throw new Error(`Endereço da aba ${label} não reconhecido.`);
    tab.click();
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (cancelled()) throw new Error('Parado pelo usuário.');
      if (!isProfile()) throw new Error('Você saiu do perfil.');
      const selected = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some(el => name.test(el.textContent.trim()));
      if (selected || path.test(location.pathname)) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Não consegui abrir a aba ${label}. Abra essa aba manualmente e tente novamente.`);
  }
  function validate(raw = {}) {
    const limit = Number(raw.limit ?? 50);
    const interval = Number(raw.interval ?? 1.5);
    if (!Number.isFinite(interval) || interval < 0.1 || interval > 86400) throw new Error('Use um intervalo entre 0,1 e 86400 segundos.');
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
    if (!['posts', 'reposts', 'both', 'replies'].includes(mode)) throw new Error('Tipo de remoção inválido.');
    if (keyword.length > 200) throw new Error('Use até 200 caracteres na palavra-chave.');
    return Object.freeze({ limit, ...dates, keyword, mode, interval, username });
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
      if (!['reposts', 'both'].includes(options.mode) || !post.canUndo) return false;
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
    const type = { posts: 'posts próprios', reposts: 'reposts', both: 'posts próprios e reposts', replies: 'posts próprios e respostas na aba Replies' }[options.mode];
    return `Até ${options.limit} itens · ${type} · intervalo de ${options.interval} s · ${options.from || 'sem data inicial'} até ${options.to || 'sem data final'} (datas locais, inclusive; reposts usam a data do post original) · ${options.keyword ? `texto contendo “${options.keyword}”` : 'qualquer texto'}`;
  }
  const panelStyle = `section{background:#101318!important;color:#edf0f6!important;border:1px solid #65774b!important;border-radius:14px!important;box-shadow:0 12px 40px #0006!important;max-height:75vh;overflow:auto;font:13px system-ui!important;padding:22px!important}strong{display:block;font-size:16px;letter-spacing:-.3px}p{line-height:1.65}#summary{color:#b6c0cc;font-size:12px;padding-bottom:12px;border-bottom:1px solid #303843}input{background:#1b2028;color:#edf0f6;border:1px solid #4a5564;border-radius:7px;padding:10px!important}button{border:1px solid #46515f;border-radius:7px;background:#222a35;color:#edf0f6;font:12px system-ui;padding:10px 14px!important}#start{background:#d7ff83!important;color:#17250a!important}button:disabled{opacity:.45;cursor:not-allowed}a{color:#d7ff83}li{margin:12px 0;font-size:12px;line-height:1.6}[role=status]{padding:12px;background:#1b222b;border-radius:8px;color:#d7ff83}`;
  globalThis.XTerminatorFilters = { validate, read, matches, describe, undoButton, undoName, isProfile, profileUsername, selectTimeline, panelStyle, accountLink };
})();
