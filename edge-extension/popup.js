const fields = ['limit', 'interval', 'from', 'to', 'keyword', 'mode'];
const status = document.querySelector('#status');
function updatePace() {
  const seconds = Number(document.querySelector('#interval').value);
  document.querySelector('#pace').textContent = Number.isFinite(seconds) && seconds > 0
    ? `Uma ação a cada ${seconds.toLocaleString('pt-BR')} segundos, após a confirmação do X.` : 'Escolha o intervalo entre as ações.';
}
async function start(file) {
  try {
    if (!document.querySelector('#filters').reportValidity()) return;
    const options = XTerminatorFilters.validate(Object.fromEntries(fields.map(key => [key, document.getElementById(key).value])));
    localStorage.setItem('filters', JSON.stringify(options));
    document.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const access = { origins: ['https://x.com/*'] };
    if (!await chrome.permissions.contains(access) && !await chrome.permissions.request(access)) {
      throw new Error('Permita o acesso a x.com para abrir o painel de remoção.');
    }
    status.textContent = 'Abrindo o X e identificando a conta conectada…';
    const result = await chrome.runtime.sendMessage({ type: 'launch', file, options });
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível abrir o X.');
    status.textContent = file === 'delete.js'
      ? 'No perfil do X, digite APAGAR no painel e clique em Começar remoção.'
      : 'Acompanhe a prévia no painel da aba do X.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}
document.querySelector('#run').addEventListener('click', () => start('simulate.js'));
document.querySelector('#delete').addEventListener('click', () => start('delete.js'));
document.querySelector('#interval').addEventListener('input', updatePace);
try {
  const saved = XTerminatorFilters.validate(JSON.parse(localStorage.getItem('filters') || '{}'));
  for (const key of fields) document.getElementById(key).value = saved[key];
} catch { localStorage.removeItem('filters'); }
updatePace();
