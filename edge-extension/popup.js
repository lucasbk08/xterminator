const fields = ['limit', 'interval', 'restEvery', 'restSeconds', 'from', 'to', 'keyword', 'mode'];
const status = document.querySelector('#status');
function updatePace() {
  const seconds = Number(document.querySelector('#interval').value);
  const every = Number(document.querySelector('#restEvery').value);
  const rest = Number(document.querySelector('#restSeconds').value);
  const pace = Number.isFinite(seconds) && seconds > 0
    ? `Uma ação a cada ${seconds.toLocaleString('pt-BR')} segundos, após a confirmação do X.` : 'Escolha o intervalo entre as ações.';
  const pause = Number.isInteger(every) && every > 0 && Number.isFinite(rest) && rest > 0
    ? ` A cada ${every} itens, uma pausa de ${rest.toLocaleString('pt-BR')} segundos.` : ' Sem pausas periódicas (0 desliga).';
  document.querySelector('#pace').textContent = pace + pause;
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
for (const id of ['interval', 'restEvery', 'restSeconds']) document.getElementById(id).addEventListener('input', updatePace);
try {
  // Campos ausentes no que foi salvo mantêm o padrão do formulário, e não o da validação.
  const raw = JSON.parse(localStorage.getItem('filters') || '{}');
  const saved = XTerminatorFilters.validate(raw);
  for (const key of fields) if (key in raw) document.getElementById(key).value = saved[key];
} catch { localStorage.removeItem('filters'); }
updatePace();
