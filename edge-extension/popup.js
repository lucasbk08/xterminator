const fields = ['limit', 'interval', 'windowLimit', 'windowSeconds', 'from', 'to', 'keyword', 'mode'];
const status = document.querySelector('#status');
function updatePace() {
  const seconds = Number(document.querySelector('#interval').value);
  const cap = Number(document.querySelector('#windowLimit').value);
  const span = Number(document.querySelector('#windowSeconds').value);
  const pace = Number.isFinite(seconds) && seconds > 0
    ? `Uma ação a cada ${seconds.toLocaleString('pt-BR')} segundos, após a confirmação do X.` : 'Escolha o intervalo entre as ações.';
  const quota = Number.isInteger(cap) && cap > 0 && Number.isFinite(span) && span > 0
    ? ` No máximo ${cap} remoções a cada ${Math.round(span / 60)} min, contando execuções anteriores.` : ' Sem cota por janela (0 desliga).';
  document.querySelector('#pace').textContent = pace + quota;
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
for (const id of ['interval', 'windowLimit', 'windowSeconds']) document.getElementById(id).addEventListener('input', updatePace);
try {
  // Campos ausentes no que foi salvo mantêm o padrão do formulário, e não o da validação.
  const raw = JSON.parse(localStorage.getItem('filters') || '{}');
  const saved = XTerminatorFilters.validate(raw);
  for (const key of fields) {
    if (!(key in raw)) continue;
    const field = document.getElementById(key);
    field.value = saved[key];
    // Um modo salvo que saiu do formulário volta para a primeira opção.
    if (field.tagName === 'SELECT' && !field.value) field.selectedIndex = 0;
  }
} catch { localStorage.removeItem('filters'); }
updatePace();
