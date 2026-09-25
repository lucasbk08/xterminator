void (async () => {
  let state;
  try { state = (await chrome.runtime.sendMessage({ type: 'launch-state' }))?.state; } catch { return; }
  if (!state || Date.now() - state.savedAt > 600000) return;
  if (state.stage === 'profile') {
    const result = await chrome.runtime.sendMessage({ type: 'profile-loaded' });
    if (result?.ok) return;
  }
  if (document.getElementById('xterminator-launch')) return;
  const panel = document.createElement('div');
  panel.id = 'xterminator-launch';
  panel.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;max-width:330px;padding:20px;background:#05070b;color:#edf0f6;border:1px solid #2e8bff;border-radius:12px;font:14px system-ui;box-shadow:0 8px 32px #0005';
  const text = document.createElement('p');
  text.textContent = 'XTerminator · Identificando sua conta. Se necessário, faça login no X para continuar.';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancelar';
  let stopped = false;
  cancel.onclick = () => {
    stopped = true;
    void chrome.runtime.sendMessage({ type: 'cancel-launch' }).catch(() => {});
    panel.remove();
  };
  panel.append(text, cancel);
  document.body.append(panel);
  const end = Date.now() + 600000;
  while (!stopped && Date.now() < end) {
    const href = globalThis.XTerminatorFilters.accountLink()?.getAttribute('href');
    const match = href && new URL(href, location.href).pathname.match(/^\/([a-z0-9_]{1,15})\/?$/i);
    if (match) {
      text.textContent = `Abrindo o perfil @${match[1]}…`;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'account-ready', username: match[1] });
        if (!result?.ok) text.textContent = result?.error || 'Não foi possível continuar. Abra a extensão novamente.';
      } catch { text.textContent = 'Abra a extensão para iniciar novamente.'; }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!stopped) text.textContent = 'Tempo de espera encerrado. Faça login e abra a extensão novamente.';
})();
