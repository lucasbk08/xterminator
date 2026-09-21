(() => {
  const filters = globalThis.XTerminatorFilters;
  const options = filters.validate(globalThis.XTerminatorOptions);
  const USERNAME = options.username || filters.profileUsername();
  const MAX = options.limit;
  if (document.getElementById('xterminator-deletion')) return;
  const resume = globalThis.XTerminatorResume;
  delete globalThis.XTerminatorResume;
  const simulation = document.getElementById('xterminator-simulation');
  if (simulation) {
    alert('Feche o painel da simulação antes de iniciar a exclusão.');
    return;
  }
  const host = document.createElement('div');
  host.id = 'xterminator-deletion';
  host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    section { width:310px; padding:18px; background:white; color:#17212b;
      border:2px solid #b42318; border-radius:12px; font:14px system-ui; box-shadow:0 4px 24px #0004; }
    button,input { padding:8px; margin-top:8px; box-sizing:border-box; }
    input { width:100%; } button { cursor:pointer; } #start { background:#b42318;color:white;border:0; }
  </style><section><strong id="title"></strong>
  <p id="summary"></p><p>Posts próprios são excluídos permanentemente. Reposts selecionados serão desfeitos; o post original continua existindo.</p>
  <label>Digite APAGAR para confirmar:<input aria-label="Confirmação" autocomplete="off"></label>
  <button id="start" disabled>Começar remoção</button> <button id="stop">Cancelar</button>
  <p role="status">Aguardando sua confirmação. Nada foi excluído.</p></section>`;
  const theme = document.createElement('style');
  theme.textContent = filters.panelStyle;
  shadow.append(theme);
  document.body.append(host);
  shadow.querySelector('#title').textContent = `Remover itens de @${USERNAME}`;
  shadow.querySelector('#summary').textContent = filters.describe(options);
  const input = shadow.querySelector('input');
  const start = shadow.querySelector('#start');
  const stop = shadow.querySelector('#stop');
  const status = shadow.querySelector('[role="status"]');
  let stopped = false;
  let running = false;
  let deleted = resume?.deleted || 0;
  let undone = resume?.undone || 0;
  let reloads = resume?.reloads || 0;
  let emptyReloads = resume?.emptyReloads || 0;
  const completed = new Set(resume?.completed || []);
  let reloading = false;
  const totals = () => `${deleted - undone} posts excluídos e ${undone} reposts desfeitos`;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el && el.getClientRects().length > 0;
  const currentProfile = () => filters.isProfile(location.href, USERNAME);
  function check() {
    if (stopped) throw new Error('Parado pelo usuário.');
    if (!currentProfile()) throw new Error('Você saiu do perfil.');
    const link = filters.accountLink();
    if (!link || new URL(link.href, location.href).pathname.replace(/\/$/, '').toLowerCase() !== `/${USERNAME}`) {
      throw new Error(`A conta logada não foi identificada como @${USERNAME}.`);
    }
  }
  async function waitFor(fn, timeout = 12000, cancellable = true) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (cancellable) check();
      const value = fn();
      if (value) return value;
      await pause(200);
    }
    throw new Error('O X não confirmou a operação. Parei para você conferir a página.');
  }
  function post(article) {
    const link = article.querySelector('time')?.closest('a');
    return link?.getAttribute('href')?.match(/^\/([^/]+)\/status\/(\d+)(?:[/?]|$)/);
  }
  input.oninput = () => { start.disabled = input.value !== 'APAGAR'; };
  stop.onclick = () => {
    if (!running) { host.remove(); return; }
    stopped = true;
    if (globalThis.chrome?.runtime?.id) void chrome.runtime.sendMessage({ type: 'cancel-reload' }).catch(() => {});
    status.textContent = 'Parando… Uma exclusão já enviada pode terminar.';
  };
  start.onclick = async () => {
    if (running || input.value !== 'APAGAR') return;
    running = true;
    start.disabled = true;
    input.disabled = true;
    stop.textContent = 'Parar';
    const skipped = new Set(completed);
    const seen = new Set();
    let emptyRounds = 0;
    let scans = 0;
    let menuOpen = false;
    let confirmation = null;
    let exhausted = false;
    try {
      if (resume) {
        status.textContent = `Página recarregada. Conferindo login e lista… ${totals()}.`;
        await waitFor(() => {
          if (stopped) throw new Error('Parado pelo usuário.');
          if (!currentProfile()) throw new Error('Você saiu do perfil.');
          return filters.accountLink();
        }, 30000, false);
      }
      check();
      await filters.selectTimeline(options, () => stopped);
      check();
      window.scrollTo(0, 0);
      await pause(1800);
      while (deleted < MAX && scans++ < 1000) {
        check();
        const previous = seen.size;
        let candidate;
        for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
          const match = post(article);
          if (!match || skipped.has(match[2])) continue;
          seen.add(match[2]);
          if (!filters.matches(filters.read(article), options)) {
            skipped.add(match[2]);
            continue;
          }
          candidate = { article, id: match[2] };
          break;
        }
        if (!candidate) {
          emptyRounds = seen.size === previous ? emptyRounds + 1 : 0;
          if (emptyRounds >= 8) { exhausted = true; break; }
          status.textContent = `${deleted}/${MAX} itens removidos. Procurando correspondências… ${seen.size} examinados.`;
          window.scrollBy(0, Math.max(400, innerHeight * 0.8));
          await pause(1800);
          continue;
        }
        emptyRounds = 0;
        const { article, id } = candidate;
        article.scrollIntoView({ block: 'center' });
        check();
        if (!article.isConnected || post(article)?.[2] !== id || !filters.matches(filters.read(article), options)) continue;
        const isRepost = filters.read(article).repost;
        const caret = isRepost ? filters.undoButton(article) : article.querySelector('[data-testid="caret"]');
        if (!caret) throw new Error('Botão da ação selecionada não encontrado.');
        // Não interage com menus ou diálogos que já estavam abertos pelo usuário.
        if ([...document.querySelectorAll('[role="menu"], [role="dialog"]')].some(visible)) {
          throw new Error('Feche o menu ou diálogo aberto antes de tentar novamente.');
        }
        caret.click();
        menuOpen = true;
        const actionName = isRepost ? filters.undoName : /^(Delete|Excluir|Apagar)$/i;
        const item = await waitFor(() => {
          if (isRepost) {
            const direct = document.querySelector('[data-testid="unretweetConfirm"]');
            if (visible(direct)) return direct;
          }
          const menus = [...document.querySelectorAll('[role="menu"], [role="dialog"]')].filter(visible);
          return menus.flatMap(menu => [...menu.querySelectorAll('[role="menuitem"], button, [role="button"]')])
            .find(el => visible(el) && actionName.test(el.textContent.trim()));
        });
        check();
        if (!article.isConnected || post(article)?.[2] !== id || !filters.matches(filters.read(article), options)) throw new Error('O item mudou antes da ação.');
        item.click();
        menuOpen = false;
        if (!isRepost) {
        confirmation = await waitFor(() => {
          const el = document.querySelector('[data-testid="confirmationSheetConfirm"]');
          return visible(el) && /^(Delete|Excluir|Apagar)$/i.test(el.textContent.trim()) ? el : null;
        });
        check();
        if (!article.isConnected || post(article)?.[2] !== id || !filters.matches(filters.read(article), options)) throw new Error('O post mudou antes da confirmação.');
        confirmation.click();
        confirmation = null;
        }
        status.textContent = `Aguardando confirmação do X… ${deleted}/${MAX} itens removidos.`;
        // Depois do envio, aguarda o resultado mesmo se Parar for clicado.
        await waitFor(() => {
          if (!currentProfile()) throw new Error('A página mudou; não foi possível confirmar a última exclusão.');
          const error = [...document.querySelectorAll('[role="alert"]')].find(el => visible(el) && /error|erro|try again|tente novamente|limit/i.test(el.textContent));
          if (error) throw new Error('O X mostrou um erro ou limite. Confira a página antes de continuar.');
          if (isRepost) {
            const sheet = document.querySelector('[data-testid="confirmationSheetConfirm"]');
            if (visible(sheet)) {
              confirmation = sheet;
              check();
              if (!actionName.test(sheet.textContent.trim())) throw new Error('Confirmação de repost não reconhecida.');
              if (!article.isConnected || post(article)?.[2] !== id || !filters.matches(filters.read(article), options)) throw new Error('O repost mudou antes da confirmação.');
              sheet.click();
              confirmation = null;
              return false;
            }
          }
          const remaining = [...document.querySelectorAll('article[data-testid="tweet"]')].filter(el => post(el)?.[2] === id);
          const removed = remaining.length === 0 || (isRepost && remaining.every(el => !filters.undoButton(el) && el.querySelector('[data-testid="retweet"]')));
          return removed && !visible(document.querySelector('[data-testid="confirmationSheetConfirm"]'));
        }, 12000, false);
        deleted++;
        if (isRepost) undone++;
        completed.add(id);
        emptyReloads = 0;
        skipped.add(id);
        status.textContent = `${deleted}/${MAX} itens removidos: ${totals()}.`;
        if (stopped || deleted >= MAX) break;
        // A cada restEvery itens, espera restSeconds em vez do intervalo normal.
        const resting = options.restEvery > 0 && deleted % options.restEvery === 0;
        const nextAction = Date.now() + (resting ? options.restSeconds : options.interval) * 1000;
        while (Date.now() < nextAction && !stopped) {
          const seconds = Math.ceil((nextAction - Date.now()) / 1000);
          status.textContent = resting
            ? `${totals()}. Descanso de ${options.restSeconds} s a cada ${options.restEvery} itens. Retomando em ${seconds} s.`
            : `${totals()}. Próxima ação em ${seconds} s.`;
          await pause(Math.min(250, nextAction - Date.now()));
        }
      }
      if (exhausted && !stopped && deleted < MAX && emptyReloads < 2 && reloads < 10) {
        check();
        const error = [...document.querySelectorAll('[role="alert"]')].find(el => visible(el) && /error|erro|try again|tente novamente|limit/i.test(el.textContent));
        if (error) throw new Error('O X mostrou um erro ou limite. A execução foi encerrada sem recarregar.');
        if (globalThis.chrome?.runtime?.id) {
          status.textContent = `A lista parou. Vou recarregar e conferir novamente em 3 segundos… ${totals()}.`;
          await pause(3000);
          check();
          reloading = true;
          const response = await chrome.runtime.sendMessage({ type: 'reload-deletion', state: {
            options, deleted, undone, completed: [...completed], reloads: reloads + 1, emptyReloads: emptyReloads + 1,
          } });
          if (!response?.ok) { reloading = false; throw new Error(response?.error || 'Não foi possível recarregar.'); }
          return;
        }
      }
      const reason = emptyReloads >= 2 ? 'Duas recargas seguidas sem progresso.' : reloads >= 10 ? 'Limite de 10 recargas atingido.' : 'Busca encerrada nos trechos carregados.';
      status.textContent = `${stopped ? 'Interrompido' : 'Concluído'}: ${totals()}. ${deleted < MAX && !stopped ? `${reason} Pode haver outros itens no histórico.` : ''}`;
    } catch (error) {
      status.textContent = `${totals()}. ${error.message}`;
    } finally {
      if (confirmation) document.querySelector('[data-testid="confirmationSheetCancel"]')?.click();
      if (menuOpen) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      if (!reloading) {
        if (globalThis.chrome?.runtime?.id) void chrome.runtime.sendMessage({ type: 'cancel-reload' }).catch(() => {});
        running = false;
        stop.textContent = 'Fechar';
      }
    }
  };
  if (resume) {
    input.value = 'APAGAR';
    void start.onclick();
  }
})();
