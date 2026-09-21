"""Testes offline: .venv/bin/python -m unittest discover -s tests -v"""
from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / "edge-extension"


class ExtensionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(timezone_id="America/Sao_Paulo")
        self.page = self.context.new_page()
        self.page.route("**/*", lambda route: route.fulfill(body="<html><body></body></html>", content_type="text/html"))
        self.page.goto("https://x.com/conta_demo")
        self.page.evaluate("""() => {
          const attach = Element.prototype.attachShadow;
          Element.prototype.attachShadow = function(options) { return attach.call(this, {...options, mode:'open'}); };
          const timer = window.setTimeout;
          window.setTimeout = (fn, ms) => timer(fn, Math.min(ms, 1));
          window.sent = [];
          document.body.innerHTML = '<a data-testid="AppTabBar_Profile_Link" href="/conta_demo">Perfil</a>';
          window.addPost = (id, text, date, author='conta_demo', quote='') => {
            const article = document.createElement('article'); article.dataset.testid='tweet';
            article.innerHTML = `<a href="/${author}/status/${id}"><time></time></a><div data-testid="tweetText"></div><div role="link"><div data-testid="tweetText"></div></div><button data-testid="caret">Menu</button>`;
            article.querySelector('time').setAttribute('datetime',date);
            article.querySelector('[data-testid="tweetText"]').textContent = text;
            article.querySelector('[role="link"] div').textContent = quote;
            article.querySelector('button').onclick = () => {
              const menu = document.createElement('div'); menu.setAttribute('role','menu');
              menu.innerHTML = '<button role="menuitem">Excluir</button>';
              menu.firstChild.onclick = () => {
                menu.remove();
                const confirm = document.createElement('button'); confirm.dataset.testid='confirmationSheetConfirm'; confirm.textContent='Excluir';
                confirm.onclick = () => { window.sent.push(id); article.remove(); confirm.remove(); };
                document.body.append(confirm);
              };
              document.body.append(menu);
            };
            document.body.append(article);
          };
        }""")
        self.page.evaluate((ROOT / "filters.js").read_text())

    def tearDown(self):
        self.context.close()

    def post(self, id, text="Futebol", date="2023-01-02T12:00:00Z", author="conta_demo", quote=""):
        self.page.evaluate("args => addPost(...args)", [id, text, date, author, quote])

    def options(self, **options):
        self.page.evaluate("options => { window.XTerminatorOptions = options; }", options)

    def repost(self, id, confirm=False, active=True):
        self.post(id, author="autor_original")
        self.page.locator('article').last.evaluate("""(article, opts) => {
          const context = document.createElement('span'); context.dataset.testid='socialContext';
          context.textContent='Você repostou'; article.append(context);
          const button = document.createElement('button'); button.dataset.testid=opts.active ? 'unretweet' : 'retweet';
          button.textContent='Repost'; article.append(button);
          button.onclick = () => {
            const menu = document.createElement('div'); menu.setAttribute('role','menu');
            menu.innerHTML='<button role="menuitem" data-testid="unretweetConfirm">Desfazer repost</button>';
            const undo = () => { window.undone=(window.undone || 0)+1; button.dataset.testid='retweet'; };
            menu.firstChild.onclick = () => {
              menu.remove();
              if(!opts.confirm) { undo(); return; }
              const sheet=document.createElement('button'); sheet.dataset.testid='confirmationSheetConfirm';
              sheet.textContent='Desfazer repost'; sheet.onclick=() => { undo(); sheet.remove(); };
              document.body.append(sheet);
            };
            document.body.append(menu);
          };
        }""", {"confirm": confirm, "active": active})

    def run_delete(self):
        self.page.evaluate((ROOT / "delete.js").read_text())
        self.assertEqual(self.page.evaluate("sent"), [])
        self.assertTrue(self.page.locator("#start").is_disabled())
        self.page.locator("#xterminator-deletion input").fill("APAGAR")
        self.page.locator("#start").click()
        self.page.wait_for_function("document.querySelector('#xterminator-deletion').shadowRoot.querySelector('#stop').textContent === 'Fechar'")
        return self.page.evaluate("sent")

    def test_validation(self):
        for options in [{"interval": 0}, {"interval": -1}, {"interval": "abc"}, {"interval": 86401}, {"username": "a/b"}, {"limit": 0}, {"limit": 1.5}, {"limit": 1001}, {"from": "2023-02-30"}, {"from": "2023-02-02", "to": "2023-01-01"}, {"windowLimit": -1}, {"windowLimit": 1.5}, {"windowLimit": 10001}, {"windowLimit": 2, "windowSeconds": 0}, {"windowLimit": 2, "windowSeconds": 86401}]:
            with self.subTest(options=options):
                result = self.page.evaluate("options => { try { XTerminatorFilters.validate(options); return false; } catch { return true; } }", options)
                self.assertTrue(result)

    def test_inclusive_local_dates_and_keyword(self):
        self.options(limit=10, **{"from": "2023-01-02", "to": "2023-01-02", "keyword": "futebol"})
        self.post("1", date="2023-01-02T02:59:59Z")  # previous local day
        self.post("2", date="2023-01-02T03:00:00Z")
        self.post("3", text="FUTEBOL!", date="2023-01-03T02:59:59.999Z")
        self.post("4", date="2023-01-03T03:00:00Z")  # next local day
        self.post("5", text="Outro assunto", quote="futebol")
        self.post("6", date="invalid")
        self.post("7", author="outra_conta")
        self.assertEqual(self.run_delete(), ["2", "3"])

    def test_limit_and_preview_agree(self):
        self.options(limit=2, keyword="futebol")
        for i in range(4):
            self.post(str(i))
        self.page.evaluate((ROOT / "simulate.js").read_text())
        self.page.wait_for_function("document.querySelector('#xterminator-simulation').shadowRoot.querySelector('button').textContent === 'Fechar'")
        self.assertEqual(self.page.locator('#xterminator-simulation li').count(), 2)
        self.assertEqual(self.page.evaluate('sent'), [])
        self.page.locator('#xterminator-simulation button').click()
        self.assertEqual(self.run_delete(), ['0', '1'])

    def test_scan_continues_past_nonmatching_posts(self):
        self.options(limit=1, keyword="futebol")
        self.post("0", text="outro")
        self.page.evaluate("""() => {
          let scrolls = 0;
          window.scrollBy = () => {
            scrolls++;
            if(scrolls <= 12) {
              document.querySelectorAll('article').forEach(el => el.remove());
              addPost(String(scrolls), scrolls === 12 ? 'futebol' : 'outro', '2023-01-02T12:00:00Z');
            }
          };
        }""")
        self.assertEqual(self.run_delete(), ['12'])

    def test_wrong_account_and_repost(self):
        self.options(limit=1)
        self.post("1")
        self.page.locator('article').evaluate("el => { const s=document.createElement('span'); s.dataset.testid='socialContext'; s.textContent='Você repostou'; el.append(s); }")
        self.assertEqual(self.run_delete(), [])
        self.page.locator('#stop').click()
        self.page.locator('[data-testid="AppTabBar_Profile_Link"]').evaluate("el => el.href='/outra_conta'")
        self.assertEqual(self.run_delete(), [])

    def test_reposts_only_with_and_without_confirmation(self):
        self.options(limit=5, mode='reposts', keyword='futebol')
        self.post('1')
        self.repost('2')
        self.repost('3', confirm=True)
        self.repost('4', active=False)
        self.assertEqual(self.run_delete(), [])
        self.assertEqual(self.page.evaluate('window.undone'), 2)
        self.assertIn('0 posts excluídos e 2 reposts desfeitos', self.page.locator('#xterminator-deletion [role=status]').inner_text())

    def test_combined_limit(self):
        self.options(limit=2, mode='both')
        self.post('1')
        self.repost('2')
        self.post('3')
        self.assertEqual(self.run_delete(), ['1'])
        self.assertEqual(self.page.evaluate('window.undone'), 1)

    def test_repost_preview_and_original_date(self):
        self.options(limit=2, mode='reposts', **{'from': '2023-01-02', 'to': '2023-01-02'})
        self.repost('2')
        self.page.evaluate((ROOT / 'simulate.js').read_text())
        self.page.wait_for_function("document.querySelector('#xterminator-simulation').shadowRoot.querySelector('button').textContent === 'Fechar'")
        link = self.page.locator('#xterminator-simulation li a')
        self.assertEqual(link.get_attribute('href'), 'https://x.com/autor_original/status/2')
        self.assertIn('Desfazer repost', link.inner_text())
        self.page.locator('#xterminator-simulation button').click()
        self.options(limit=2, mode='reposts', **{'from': '2024-01-01'})
        self.assertEqual(self.run_delete(), [])
        self.assertEqual(self.page.evaluate('window.undone || 0'), 0)

    def test_repost_without_social_label_or_menu_role(self):
        self.options(limit=1, mode='reposts')
        self.repost('8')
        self.page.locator('[data-testid="socialContext"]').evaluate('el => el.remove()')
        self.page.evaluate("""() => {
          new MutationObserver(() => {
            document.querySelectorAll('[role="menu"]').forEach(el => el.removeAttribute('role'));
            document.querySelectorAll('[role="menuitem"]').forEach(el => el.removeAttribute('role'));
          }).observe(document.body,{childList:true,subtree:true});
        }""")
        self.assertEqual(self.run_delete(), [])
        self.assertEqual(self.page.evaluate('window.undone'), 1)

    def test_reposts_tab_is_selected(self):
        self.options(limit=1, mode='reposts')
        self.repost('9')
        self.page.evaluate("""() => {
          const tab=document.createElement('a');tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');
          tab.href='/conta_demo/reposts';tab.textContent='Reposts';
          tab.onclick=event => { event.preventDefault();history.pushState({},'',tab.href);tab.setAttribute('aria-selected','true'); };
          document.body.append(tab);
        }""")
        self.assertEqual(self.run_delete(), [])
        self.assertTrue(self.page.url.endswith('/reposts'))
        self.assertEqual(self.page.evaluate('window.undone'), 1)

    def test_undo_button_accessible_label(self):
        self.options(limit=1, mode='reposts')
        self.repost('10')
        self.page.locator('[data-testid="unretweet"]').evaluate("""el => {
          el.removeAttribute('data-testid');el.setAttribute('aria-label','Undo repost');
          new MutationObserver(() => {
            if(el.dataset.testid==='retweet') el.removeAttribute('aria-label');
          }).observe(el,{attributes:true,attributeFilter:['data-testid']});
        }""")
        self.assertEqual(self.run_delete(), [])
        self.assertEqual(self.page.evaluate('window.undone'), 1)

    def test_replies_tab_only_removes_own_posts(self):
        self.options(limit=5, mode='replies')
        self.post('1', author='outro_usuario')
        self.post('2', text='Minha resposta')
        self.repost('3')
        self.page.evaluate("""() => {
          const tab=document.createElement('a'); tab.setAttribute('role','tab');
          tab.href='/conta_demo/with_replies'; tab.textContent='Replies';
          tab.onclick=event => {event.preventDefault(); history.pushState({},'',tab.href); tab.setAttribute('aria-selected','true');};
          document.body.append(tab);
        }""")
        self.assertEqual(self.run_delete(), ['2'])
        self.assertTrue(self.page.url.endswith('/with_replies'))
        self.assertEqual(self.page.evaluate('window.undone || 0'), 0)

    def test_replies_preview_on_open_tab(self):
        self.options(limit=5, mode='replies', keyword='resposta')
        self.page.evaluate("history.pushState({},'', '/conta_demo/with_replies')")
        self.post('1', text='Minha resposta')
        self.post('2', text='Outro assunto')
        self.page.evaluate((ROOT / 'simulate.js').read_text())
        self.page.wait_for_function("document.querySelector('#xterminator-simulation').shadowRoot.querySelector('button').textContent === 'Fechar'")
        self.assertEqual(self.page.locator('#xterminator-simulation li').count(), 1)
        self.assertIn('/status/1', self.page.locator('#xterminator-simulation li a').get_attribute('href'))
        self.assertEqual(self.page.evaluate('sent'), [])

    def test_configured_interval_is_respected(self):
        self.options(limit=2, interval=0.2)
        self.post('1')
        self.post('2')
        self.page.evaluate("""() => {
          window.actionTimes=[];
          document.addEventListener('click', event => {
            if(event.target.dataset.testid==='confirmationSheetConfirm') actionTimes.push(performance.now());
          },true);
        }""")
        self.assertEqual(self.run_delete(), ['1','2'])
        times = self.page.evaluate('actionTimes')
        self.assertGreaterEqual(times[1] - times[0], 195)

    def test_window_quota_waits_before_exceeding_the_cap(self):
        self.options(limit=3, interval=0.1, windowLimit=2, windowSeconds=2)
        for id in ['1', '2', '3']:
            self.post(id)
        self.page.evaluate("""() => {
          window.actionTimes=[];
          document.addEventListener('click', event => {
            if(event.target.dataset.testid==='confirmationSheetConfirm') actionTimes.push(performance.now());
          },true);
        }""")
        self.assertEqual(self.run_delete(), ['1', '2', '3'])
        times = self.page.evaluate('actionTimes')
        # Os dois primeiros cabem na cota; o terceiro espera a janela abrir.
        self.assertLess(times[1] - times[0], 500)
        self.assertGreaterEqual(times[2] - times[0], 2000)

    def test_window_quota_disabled_by_default(self):
        self.options(limit=2, interval=0.1)
        self.post('1')
        self.post('2')
        self.page.evaluate("""() => {
          window.actionTimes=[];
          document.addEventListener('click', event => {
            if(event.target.dataset.testid==='confirmationSheetConfirm') actionTimes.push(performance.now());
          },true);
        }""")
        self.assertEqual(self.run_delete(), ['1', '2'])
        times = self.page.evaluate('actionTimes')
        self.assertLess(times[1] - times[0], 500)
        self.assertNotIn('remoções a cada', self.page.evaluate("XTerminatorFilters.describe(XTerminatorFilters.validate({}))"))

    def test_all_mode_moves_from_replies_to_reposts(self):
        self.options(limit=5, interval=0.1, mode='all')
        self.post('1')
        self.repost('2')
        self.page.evaluate("""() => {
          const tabs = document.createElement('div');
          tabs.innerHTML = '<div role="tab" aria-selected="true">Replies</div><div role="tab" aria-selected="false">Reposts</div>';
          tabs.lastChild.onclick = () => {
            tabs.firstChild.setAttribute('aria-selected', 'false');
            tabs.lastChild.setAttribute('aria-selected', 'true');
          };
          document.body.prepend(tabs);
        }""")
        self.assertEqual(self.run_delete(), ['1'])
        self.assertEqual(self.page.evaluate('undone'), 1)
        self.assertEqual(self.page.evaluate("document.querySelectorAll('[role=tab][aria-selected=true]')[0].textContent"), 'Reposts')

    def test_empty_tab_finishes_without_reloading(self):
        self.options(limit=5, interval=0.1)
        self.page.evaluate("""() => {
          const empty = document.createElement('div');
          empty.dataset.testid = 'emptyState';
          empty.textContent = "You haven't posted yet";
          document.body.append(empty);
        }""")
        self.assertEqual(self.run_delete(), [])
        self.assertIn('A aba não tem mais itens', self.page.locator('#xterminator-deletion [role=status]').inner_text())
        self.assertNotIn('Pode haver outros itens', self.page.locator('#xterminator-deletion [role=status]').inner_text())

    def test_backoff_retries_after_the_x_refuses_to_confirm(self):
        self.options(limit=1, interval=0.1)
        self.post('1')
        # A primeira confirmação não remove o post, como acontece sob 429.
        self.page.evaluate("""() => {
          window.attempts = 0;
          const article = document.querySelector('article');
          const id = article.querySelector('a').getAttribute('href').split('/').pop();
          article.querySelector('[data-testid=caret]').onclick = () => {
            const menu = document.createElement('div'); menu.setAttribute('role','menu');
            menu.innerHTML = '<button role="menuitem">Excluir</button>';
            menu.firstChild.onclick = () => {
              menu.remove();
              const confirm = document.createElement('button');
              confirm.dataset.testid = 'confirmationSheetConfirm'; confirm.textContent = 'Excluir';
              confirm.onclick = () => {
                confirm.remove();
                if (++window.attempts >= 2) { window.sent.push(id); article.remove(); }
              };
              document.body.append(confirm);
            };
            document.body.append(menu);
          };
        }""")
        source = (ROOT / 'delete.js').read_text().replace('[600, 600, 600, 600]', '[1, 1, 1, 1]').replace('}, 12000, false);', '}, 400, false);')
        self.page.evaluate(source)
        self.page.locator('#xterminator-deletion input').fill('APAGAR')
        self.page.locator('#start').click()
        self.page.wait_for_function("document.querySelector('#xterminator-deletion').shadowRoot.querySelector('#stop').textContent === 'Fechar'", timeout=30000)
        self.assertEqual(self.page.evaluate('attempts'), 2)
        self.assertEqual(self.page.evaluate('sent'), ['1'])
        self.assertIn('1 posts excluídos', self.page.locator('#xterminator-deletion [role=status]').inner_text())

    def test_backoff_gives_up_after_the_configured_attempts(self):
        self.options(limit=1, interval=0.1)
        self.post('1')
        self.page.evaluate("""() => {
          window.attempts = 0;
          const article = document.querySelector('article');
          article.querySelector('[data-testid=caret]').onclick = () => {
            const menu = document.createElement('div'); menu.setAttribute('role','menu');
            menu.innerHTML = '<button role="menuitem">Excluir</button>';
            menu.firstChild.onclick = () => {
              menu.remove();
              const confirm = document.createElement('button');
              confirm.dataset.testid = 'confirmationSheetConfirm'; confirm.textContent = 'Excluir';
              confirm.onclick = () => { window.attempts++; confirm.remove(); };
              document.body.append(confirm);
            };
            document.body.append(menu);
          };
        }""")
        source = (ROOT / 'delete.js').read_text().replace('[600, 600, 600, 600]', '[1, 1]').replace('}, 12000, false);', '}, 300, false);')
        self.page.evaluate(source)
        self.page.locator('#xterminator-deletion input').fill('APAGAR')
        self.page.locator('#start').click()
        self.page.wait_for_function("document.querySelector('#xterminator-deletion').shadowRoot.querySelector('#stop').textContent === 'Fechar'", timeout=30000)
        # Duas esperas e a tentativa final: três envios, nenhuma exclusão confirmada.
        self.assertEqual(self.page.evaluate('attempts'), 3)
        self.assertEqual(self.page.evaluate('sent'), [])
        self.assertIn('não confirmou a operação', self.page.locator('#xterminator-deletion [role=status]').inner_text())

    def test_stop_during_long_interval(self):
        self.options(limit=2, interval=86400)
        self.post('1')
        self.post('2')
        self.page.evaluate((ROOT / 'delete.js').read_text())
        self.page.locator('#xterminator-deletion input').fill('APAGAR')
        self.page.locator('#start').click()
        self.page.wait_for_function('sent.length===1')
        self.page.locator('#stop').click()
        self.page.wait_for_function("document.querySelector('#xterminator-deletion').shadowRoot.querySelector('#stop').textContent==='Fechar'")
        self.assertEqual(self.page.evaluate('sent'), ['1'])


if __name__ == '__main__':
    unittest.main()
