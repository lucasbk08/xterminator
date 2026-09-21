"""Integração offline com extensão real, service worker e recarga de aba."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'edge-extension'


class ReloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        extension = Path(self.temp.name) / 'extension'
        shutil.copytree(ROOT, extension)
        manifest = json.loads((extension / 'manifest.json').read_text())
        # Todo acesso a x.com é interceptado e servido por páginas fictícias.
        manifest['host_permissions'] = ['https://x.com/*']
        (extension / 'manifest.json').write_text(json.dumps(manifest))
        deletion = extension / 'delete.js'
        deletion.write_text(deletion.read_text().replace("mode: 'closed'", "mode: 'open'").replace('setTimeout(resolve, ms)', 'setTimeout(resolve, Math.min(ms, 1))'))
        simulation = extension / 'simulate.js'
        simulation.write_text(simulation.read_text().replace("mode: 'closed'", "mode: 'open'").replace('setTimeout(resolve, 1500)', 'setTimeout(resolve, 1)'))
        self.playwright = sync_playwright().start()
        self.addCleanup(self.playwright.stop)
        self.context = self.playwright.chromium.launch_persistent_context(
            str(Path(self.temp.name) / 'browser'), headless=True, channel='chromium',
            args=[f'--disable-extensions-except={extension}', f'--load-extension={extension}'],
        )
        self.addCleanup(self.context.close)
        self.held_routes = []
        self.addCleanup(self.release_routes)
        self.worker = self.context.service_workers[0] if self.context.service_workers else self.context.wait_for_event('serviceworker')
        self.loads = 0
        self.sent = []
        self.context.expose_function('recordRemoval', lambda id: self.sent.append(id))
        self.page = self.context.pages[0]

    def release_routes(self):
        for route in self.held_routes:
            try:
                route.abort()
            except Exception:
                pass

    def fixture(self, pages, wrong_account_after=False, username='conta_demo', sidebar=False, hold_load=False, empty_state=False):
        def route(request):
            if request.request.url.startswith('chrome-extension://'):
                request.continue_()
                return
            if hold_load and request.request.url.endswith('/keep-loading'):
                self.held_routes.append(request)
                return
            if request.request.resource_type != 'document':
                request.abort()
                return
            index = min(self.loads, len(pages) - 1)
            self.loads += 1
            account = 'outra_conta' if wrong_account_after and self.loads > 1 else username
            body = f'<header><nav><a href="/explore">Explore</a><a href="/{account}"><div><span>Profile</span></div></a></nav></header>' if sidebar else f'<a data-testid="AppTabBar_Profile_Link" href="/{account}">Perfil</a>'
            if hold_load:
                body += '<img src="https://x.com/keep-loading">'
            if empty_state:
                body += '<div data-testid="emptyState">You haven\'t posted yet</div>'
            for id in pages[index]:
                body += f'<article data-testid="tweet"><a href="/{username}/status/{id}"><time datetime="2023-01-02T12:00:00Z">Hoje</time></a><div data-testid="tweetText">futebol</div><button data-testid="caret">Menu</button></article>'
            body += '''<script>
              document.querySelectorAll('[data-testid="caret"]').forEach(button => {
                button.onclick=() => {
                  const article=button.closest('article');
                  const menu=document.createElement('div');menu.setAttribute('role','menu');
                  menu.innerHTML='<button role="menuitem">Excluir</button>';
                  menu.firstChild.onclick=() => {
                    menu.remove();
                    const confirm=document.createElement('button');confirm.dataset.testid='confirmationSheetConfirm';confirm.textContent='Excluir';
                    confirm.onclick=() => {
                      recordRemoval(article.querySelector('a').getAttribute('href').split('/').pop());
                      article.remove();confirm.remove();
                    };
                    document.body.append(confirm);
                  };
                  document.body.append(menu);
                };
              });
            </script>'''
            request.fulfill(body=f'<html><body>{body}</body></html>', content_type='text/html')
        self.context.route('**/*', route)
        self.page.goto(f'https://x.com/{username}', wait_until='domcontentloaded')

    def start(self, limit=2, mode='posts'):
        self.worker.evaluate('''async ({limit,mode}) => {
          const [tab]=await chrome.tabs.query({url:'https://x.com/conta_demo*'});
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['filters.js']});
          await chrome.scripting.executeScript({target:{tabId:tab.id},func:options => {globalThis.XTerminatorOptions=options;},args:[{limit,mode,keyword:'futebol'}]});
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['delete.js']});
        }''', {'limit': limit, 'mode': mode})
        self.page.locator('#xterminator-deletion input').fill('APAGAR')
        self.page.locator('#start').click()

    def wait_finished(self):
        self.page.locator('#stop').filter(has_text='Fechar').wait_for(timeout=15000)

    def test_reload_preserves_count_filters_and_completed_ids(self):
        self.fixture([['1'], ['1', '2', '3']])
        self.start(limit=2)
        self.wait_finished()
        self.assertEqual(self.loads, 2)
        self.assertEqual(self.sent, ['1', '2'])
        self.assertIn('2 posts excluídos', self.page.locator('[role=status]').inner_text())
        self.assertIn('futebol', self.page.locator('#summary').inner_text())
        self.page.reload()
        self.page.wait_for_timeout(100)
        self.assertEqual(self.page.locator('#xterminator-deletion').count(), 0)

    def test_empty_pages_stop_after_two_reloads(self):
        self.fixture([[]])
        self.start()
        self.wait_finished()
        self.assertEqual(self.loads, 3)
        self.assertEqual(self.sent, [])
        self.assertEqual(self.worker.evaluate('chrome.storage.session.get(null)'), {})

    def test_changed_account_stops_after_reload(self):
        self.fixture([['1'], ['2']], wrong_account_after=True)
        self.start()
        self.wait_finished()
        self.assertEqual(self.loads, 2)
        self.assertEqual(self.sent, ['1'])
        self.assertIn('não foi identificada', self.page.locator('[role=status]').inner_text())

    def test_replies_resume_after_reload(self):
        self.fixture([['1'], ['2']])
        self.page.evaluate("history.pushState({},'', '/conta_demo/with_replies')")
        self.start(mode='replies')
        self.wait_finished()
        self.assertEqual(self.sent, ['1', '2'])
        self.assertEqual(self.loads, 2)
        self.assertTrue(self.page.url.endswith('/with_replies'))

    def test_stop_prevents_reload(self):
        self.fixture([[]])
        # Para assim que a execução inicia, antes da checagem de lista vazia.
        self.worker.evaluate('''async () => {
          const [tab]=await chrome.tabs.query({url:'https://x.com/conta_demo'});
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['filters.js']});
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['delete.js']});
        }''')
        self.page.evaluate('''() => {
          const root=document.querySelector('#xterminator-deletion').shadowRoot;
          root.querySelector('input').value='APAGAR';
          root.querySelector('#start').disabled=false;
          root.querySelector('#start').click();
          root.querySelector('#stop').click();
        }''')
        self.wait_finished()
        self.assertEqual(self.loads, 1)
        self.assertEqual(self.sent, [])
        self.assertEqual(self.worker.evaluate('chrome.storage.session.get(null)'), {})

    def test_popup_launches_x_for_another_account_and_saves_interval(self):
        self.fixture([['10']], username='nova_conta')
        self.page.close()
        popup = self.context.new_page()
        extension_id = self.worker.url.split('/')[2]
        popup.goto(f'chrome-extension://{extension_id}/popup.html')
        popup.locator('#interval').fill('2.75')
        popup.locator('#limit').fill('1')
        with self.context.expect_page() as created:
            popup.locator('#delete').click()
        target = created.value
        target.wait_for_url('https://x.com/nova_conta')
        target.locator('#xterminator-deletion input').wait_for()
        self.assertIn('@nova_conta', target.locator('#title').inner_text())
        self.assertIn('2.75 s', target.locator('#summary').inner_text())
        self.assertEqual(self.sent, [])
        self.assertTrue(target.locator('#start').is_disabled())
        target.locator('input').fill('APAGAR')
        target.locator('#start').click()
        target.locator('#stop').filter(has_text='Fechar').wait_for()
        self.assertEqual(self.sent, ['10'])
        popup.reload()
        self.assertEqual(popup.locator('#interval').input_value(), '2.75')

    def inject_delete(self, **options):
        self.worker.evaluate("""async options => {
          const [tab] = await chrome.tabs.query({url:'https://x.com/conta_demo*'});
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['filters.js']});
          await chrome.scripting.executeScript({target:{tabId:tab.id},func:o => {globalThis.XTerminatorOptions=o;},args:[options]});
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['delete.js']});
        }""", options)
        self.page.locator('#xterminator-deletion input').fill('APAGAR')
        self.page.locator('#start').click()

    def test_empty_state_stops_without_reloading(self):
        self.fixture([[]], empty_state=True)
        self.start()
        self.wait_finished()
        # Sem o aviso do X seriam três carregamentos: duas recargas inúteis.
        self.assertEqual(self.loads, 1)
        self.assertEqual(self.sent, [])
        self.assertIn('A aba não tem mais itens', self.page.locator('[role=status]').inner_text())

    def test_window_quota_persists_between_runs(self):
        self.fixture([['1', '2']])
        self.inject_delete(limit=1, interval=0.1, windowLimit=1, windowSeconds=30, keyword='futebol')
        self.wait_finished()
        self.assertEqual(self.sent, ['1'])
        # A segunda execução começa do zero, mas herda a cota já gasta pela primeira.
        self.page.evaluate("() => document.getElementById('xterminator-deletion').remove()")
        self.inject_delete(limit=1, interval=0.1, windowLimit=1, windowSeconds=30, keyword='futebol')
        self.page.locator('#xterminator-deletion [role=status]').filter(has_text='Cota de').wait_for(timeout=15000)
        self.assertEqual(self.sent, ['1'])

    def test_limit_sensor_reports_429_from_the_page(self):
        self.fixture([['30']], username='conta_sensor')
        # Rota mais recente tem prioridade sobre a genérica do fixture.
        self.context.route('**/limite-429', lambda route: route.fulfill(status=429, body=''))
        self.page.close()
        popup = self.context.new_page()
        popup.goto(f"chrome-extension://{self.worker.url.split('/')[2]}/popup.html")
        popup.locator('#limit').fill('1')
        with self.context.expect_page() as created:
            popup.locator('#delete').click()
        target = created.value
        target.wait_for_url('https://x.com/conta_sensor')
        target.locator('#xterminator-deletion input').wait_for()
        target.wait_for_function('window.__xterminatorLimitSensor === true')
        fired = target.evaluate("""() => new Promise(resolve => {
          document.addEventListener('xterminator-http-limit', () => resolve(true), { once: true });
          setTimeout(() => resolve(false), 5000);
          fetch('/limite-429');
        })""")
        self.assertTrue(fired)
        # O sensor só observa: nada foi excluído sem confirmação.
        self.assertEqual(self.sent, [])

    def test_popup_launches_preview_without_confirmation_or_deletion(self):
        self.fixture([['11']], username='perfil_teste')
        self.page.close()
        popup = self.context.new_page()
        popup.goto(f"chrome-extension://{self.worker.url.split('/')[2]}/popup.html")
        popup.locator('#limit').fill('1')
        with self.context.expect_page() as created:
            popup.locator('#run').click()
        target = created.value
        target.wait_for_url('https://x.com/perfil_teste')
        target.locator('#xterminator-simulation button').filter(has_text='Fechar').wait_for()
        self.assertEqual(target.locator('#xterminator-simulation li').count(), 1)
        self.assertEqual(self.sent, [])

    def test_sidebar_profile_launches_before_full_page_load(self):
        self.fixture([['20']], username='conta_sidebar', sidebar=True, hold_load=True)
        self.page.close()
        popup = self.context.new_page()
        popup.goto(f"chrome-extension://{self.worker.url.split('/')[2]}/popup.html")
        popup.locator('#limit').fill('1')
        with self.context.expect_page() as created:
            popup.locator('#delete').click()
        target = created.value
        target.wait_for_url('https://x.com/conta_sidebar', wait_until='domcontentloaded')
        target.locator('#xterminator-deletion input').wait_for(timeout=10000)
        self.assertIn('@conta_sidebar', target.locator('#title').inner_text())
        self.assertEqual(self.sent, [])
        target.locator('input').fill('APAGAR')
        target.locator('#start').click()
        target.locator('#stop').filter(has_text='Fechar').wait_for()
        self.assertEqual(self.sent, ['20'])

    def test_start_on_home_reuses_tab_and_opens_profile(self):
        self.fixture([['21']], username='conta_home', sidebar=True)
        self.page.goto('https://x.com/home')
        popup = self.context.new_page()
        popup.goto(f"chrome-extension://{self.worker.url.split('/')[2]}/popup.html")
        await_active = '''async () => {
          const [tab]=await chrome.tabs.query({url:'https://x.com/home'});
          await chrome.tabs.update(tab.id,{active:true});
        }'''
        self.worker.evaluate(await_active)
        count = len(self.context.pages)
        result = popup.evaluate("chrome.runtime.sendMessage({type:'launch', file:'delete.js', options:{limit:1}})")
        self.assertTrue(result['ok'])
        self.page.wait_for_url('https://x.com/conta_home')
        self.page.locator('#xterminator-deletion input').wait_for()
        self.assertEqual(len(self.context.pages), count)
        self.assertIn('@conta_home', self.page.locator('#title').inner_text())
        self.assertEqual(self.sent, [])

    def test_stale_navigation_does_not_consume_launch(self):
        self.fixture([['30']], username='conta_home', sidebar=True)
        self.page.goto('https://x.com/home')
        pending = self.worker.evaluate('''async () => {
          const [tab]=await chrome.tabs.query({url:'https://x.com/home'});
          const key=launchKey(tab.id);
          await chrome.storage.session.set({[key]:{stage:'profile',file:'delete.js',options:{limit:1,username:'conta_home'},savedAt:Date.now()}});
          await advanceLaunch(tab.id,'https://x.com/conta_home');
          return !!(await chrome.storage.session.get(key))[key];
        }''')
        self.assertTrue(pending)
        self.assertEqual(self.page.locator('#xterminator-deletion').count(), 0)
        self.page.goto('https://x.com/conta_home')
        self.page.locator('#xterminator-deletion input').wait_for()
        self.assertEqual(self.sent, [])

    def test_initial_tab_without_visible_url_keeps_launch_pending(self):
        pending = self.worker.evaluate('''async () => {
          const tab=await chrome.tabs.create({url:'about:blank',active:false});
          const key=launchKey(tab.id);
          await chrome.storage.session.set({[key]:{stage:'account',file:'delete.js',options:{limit:1},savedAt:Date.now()}});
          await advanceLaunch(tab.id,undefined);
          const exists=!!(await chrome.storage.session.get(key))[key];
          await chrome.tabs.remove(tab.id);
          return exists;
        }''')
        self.assertTrue(pending)


if __name__ == '__main__':
    unittest.main()
