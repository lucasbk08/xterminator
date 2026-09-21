importScripts('filters.js');
// Apenas recargas solicitadas por uma execução já confirmada podem retomá-la.
const keyFor = tabId => `reload:${tabId}`;
const launchKey = tabId => `launch:${tabId}`;
const isProfile = url => { try { return XTerminatorFilters.isProfile(url); } catch { return false; } };
const resuming = new Set();
const launching = new Set();
const launchAgain = new Set();

async function advanceLaunch(tabId, url) {
  if (launching.has(tabId)) { launchAgain.add(tabId); return; }
  launching.add(tabId);
  try {
    const key = launchKey(tabId);
    const state = (await chrome.storage.session.get(key))[key];
    // Sem permissão para abas internas, o navegador pode omitir a URL da aba
    // vazia inicial. Isso não significa que o usuário saiu do X.
    if (!state || !url || url === 'about:blank') return;
    if (Date.now() - state.savedAt > 600000 || !url?.startsWith('https://x.com/')) {
      await chrome.storage.session.remove(key);
      return;
    }
    if (state.stage === 'account') {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['filters.js', 'bootstrap.js'] });
    } else if (XTerminatorFilters.isProfile(url, state.options.username)) {
      if (await injectRun(tabId, state)) await chrome.storage.session.remove(key);
    }
  } finally {
    launching.delete(tabId);
    if (launchAgain.delete(tabId)) {
      const current = await chrome.tabs.get(tabId);
      await advanceLaunch(tabId, current.url);
    }
  }
}

async function injectRun(tabId, state) {
  const [document] = await chrome.scripting.executeScript({ target: { tabId }, files: ['filters.js'] });
  const target = { tabId, documentIds: [document.documentId] };
  const [prepared] = await chrome.scripting.executeScript({ target, func: options => {
    if (!globalThis.XTerminatorFilters.isProfile(location.href, options.username)) return false;
    globalThis.XTerminatorOptions = options;
    return true;
  }, args: [state.options] });
  if (!prepared.result) return false;
  await chrome.scripting.executeScript({ target, files: [state.file] });
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'launch-state' && sender.tab && sender.frameId === 0 && sender.url?.startsWith('https://x.com/')) {
    chrome.storage.session.get(launchKey(sender.tab.id)).then(data => reply({ state: data[launchKey(sender.tab.id)] || null }));
    return true;
  }
  if (message.type === 'profile-loaded' && sender.tab && sender.frameId === 0 && sender.url?.startsWith('https://x.com/')) {
    advanceLaunch(sender.tab.id, sender.url).then(() => reply({ ok: true }), error => reply({ ok: false, error: error.message }));
    return true;
  }
  // Observa respostas 429 do X no mundo da página, sem alterar o que é enviado.
  if (message.type === 'watch-limits' && sender.tab && sender.frameId === 0 && isProfile(sender.url)) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, documentIds: [sender.documentId] }, world: 'MAIN', func: () => {
        if (globalThis.__xterminatorLimitSensor) return;
        globalThis.__xterminatorLimitSensor = true;
        const notify = status => {
          if (status === 429) document.dispatchEvent(new CustomEvent('xterminator-http-limit'));
        };
        const original = globalThis.fetch;
        globalThis.fetch = function (...args) {
          return original.apply(this, args).then(response => { notify(response.status); return response; });
        };
        const open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args) {
          this.addEventListener('load', () => notify(this.status));
          return open.apply(this, args);
        };
      },
    }).then(() => reply({ ok: true }), error => reply({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'cancel-launch' && sender.tab && sender.frameId === 0) {
    chrome.storage.session.remove(launchKey(sender.tab.id)).then(() => reply({ ok: true }));
    return true;
  }
  if (message.type === 'launch' && sender.url === chrome.runtime.getURL('popup.html')) {
    (async () => {
      try {
        if (!['delete.js', 'simulate.js'].includes(message.file)) throw new Error('Ação inválida.');
        if (!await chrome.permissions.contains({ origins: ['https://x.com/*'] })) throw new Error('A extensão precisa de acesso a x.com. Ative esse acesso nas configurações da extensão.');
        const options = XTerminatorFilters.validate({ ...message.options, username: '' });
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        let tab;
        if (active?.url?.startsWith('https://x.com/')) {
          const [result] = await chrome.scripting.executeScript({ target: { tabId: active.id }, func: () => !!document.querySelector('#xterminator-deletion, #xterminator-simulation, #xterminator-launch') });
          if (result.result) throw new Error('Já existe um painel nessa aba. Pare a execução e feche o painel antes de iniciar outra.');
          tab = active;
        } else {
          tab = await chrome.tabs.create({ url: 'about:blank', active: false });
        }
        await chrome.storage.session.set({ [launchKey(tab.id)]: { options, file: message.file, stage: 'account', savedAt: Date.now() } });
        if (tab.url?.startsWith('https://x.com/')) await advanceLaunch(tab.id, tab.url);
        else await chrome.tabs.update(tab.id, { url: 'https://x.com/home', active: true });
        reply({ ok: true });
      } catch (error) { reply({ ok: false, error: error.message }); }
    })();
    return true;
  }
  if (message.type === 'account-ready' && sender.tab && sender.frameId === 0 && sender.url?.startsWith('https://x.com/')) {
    (async () => {
      try {
        const key = launchKey(sender.tab.id);
        const state = (await chrome.storage.session.get(key))[key];
        if (!state || state.stage !== 'account' || Date.now() - state.savedAt > 600000) throw new Error('Abra a extensão para iniciar novamente.');
        const options = XTerminatorFilters.validate({ ...state.options, username: message.username });
        if (!options.username) throw new Error('Conta não identificada.');
        const suffix = options.mode === 'replies' ? '/with_replies' : '';
        await chrome.storage.session.set({ [key]: { ...state, options, stage: 'profile' } });
        const destination = `https://x.com/${options.username}${suffix}`;
        if (new URL(sender.url).pathname.replace(/\/$/, '') === new URL(destination).pathname) {
          // Já no perfil: não depende de um novo evento de carregamento.
          await chrome.scripting.executeScript({ target: { tabId: sender.tab.id }, func: () => document.getElementById('xterminator-launch')?.remove() });
          await advanceLaunch(sender.tab.id, sender.url);
        } else {
          await chrome.tabs.update(sender.tab.id, { url: destination });
        }
        reply({ ok: true });
      } catch (error) { reply({ ok: false, error: error.message }); }
    })();
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== 'complete') return;
  advanceLaunch(tabId, tab.url).catch(error => console.error('Falha ao iniciar:', error));
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return;
  const tabId = sender.tab.id;
  if (message.type === 'cancel-reload') {
    chrome.storage.session.remove(keyFor(tabId)).then(() => reply({ ok: true }));
    return true;
  }
  if (message.type !== 'reload-deletion' || !isProfile(sender.url)) return;
  (async () => {
    try {
      const state = message.state;
      if (!state || !Number.isInteger(state.deleted) || state.deleted < 0 ||
          !Number.isInteger(state.undone) || state.undone < 0 || state.undone > state.deleted ||
          !Number.isInteger(state.reloads) || state.reloads < 1 || state.reloads > 10 ||
          !Number.isInteger(state.emptyReloads) || state.emptyReloads < 0 || state.emptyReloads > 2 ||
          !Array.isArray(state.completed) || state.completed.length !== state.deleted ||
          new Set(state.completed).size !== state.completed.length ||
          state.completed.some(id => !/^\d+$/.test(id)) ||
          state.deleted >= state.options?.limit) throw new Error('Estado de retomada inválido.');
      const options = XTerminatorFilters.validate({ ...state.options, username: state.options.username || XTerminatorFilters.profileUsername(sender.url) });
      if (!XTerminatorFilters.isProfile(sender.url, options.username)) throw new Error('Perfil diferente da execução.');
      await chrome.storage.session.set({ [keyFor(tabId)]: { ...state, options, savedAt: Date.now() } });
      await chrome.tabs.reload(tabId);
      reply({ ok: true });
    } catch (error) {
      await chrome.storage.session.remove(keyFor(tabId));
      reply({ ok: false, error: error.message });
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url && !isProfile(change.url)) {
    void chrome.storage.session.remove(keyFor(tabId));
    return;
  }
  if (change.status !== 'complete' || resuming.has(tabId)) return;
  resuming.add(tabId);
  (async () => {
    try {
      const key = keyFor(tabId);
      const state = (await chrome.storage.session.get(key))[key];
      if (!state) return;
      // Consumo único: outra atualização ou uma recarga manual não repete a retomada.
      await chrome.storage.session.remove(key);
      if (!XTerminatorFilters.isProfile(tab.url, state.options.username) || Date.now() - state.savedAt > 120000) return;
      await chrome.scripting.executeScript({ target: { tabId }, files: ['filters.js'] });
      await chrome.scripting.executeScript({ target: { tabId }, func: state => {
        globalThis.XTerminatorOptions = state.options;
        globalThis.XTerminatorResume = state;
      }, args: [state] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['delete.js'] });
    } catch (error) {
      console.error('Não foi possível retomar a execução:', error);
    } finally {
      resuming.delete(tabId);
    }
  })();
});
chrome.tabs.onRemoved.addListener(tabId => { void chrome.storage.session.remove([keyFor(tabId), launchKey(tabId)]); });
