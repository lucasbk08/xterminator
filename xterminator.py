#!/usr/bin/env python3
"""
apaga_tweets_navegador.py
Apaga em massa os tweets da SUA PRÓPRIA conta no X, de graça, automatizando
o navegador logado (mesmo caminho que uma extensão usa) — SEM a API paga.

Como funciona:
  - Abre o Microsoft Edge com uma sessão própria salva localmente.
  - Na PRIMEIRA vez, você faz login manualmente uma vez só.
  - Depois, o script entra no seu perfil e clica em "Excluir" no tweet do topo,
    repetindo até acabar (ou até o limite que você definir).

ATENÇÃO:
  - A exclusão é PERMANENTE. Baixe antes o arquivo dos seus dados, se quiser backup.
  - Automatizar o site tecnicamente esbarra nos Termos de Uso do X. Vá devagar
    (o DELAY existe pra isso) para reduzir risco de bloqueio temporário.
  - Se o X mudar o layout, pode ser preciso ajustar os seletores.

Instalação:
    No Windows: execute .\rodar-edge.ps1 no PowerShell.
"""

import re
import sys
import time
import random
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ----------------------------------------------------------------------
# CONFIGURAÇÃO
# ----------------------------------------------------------------------

# Seu @ SEM o arroba (ex.: "joaosilva").
USERNAME = os.environ.get("XTERMINATOR_USERNAME", "SEU_USUARIO_AQUI").lstrip("@")

# Pasta onde a sessão do navegador fica salva (login persistente).
USER_DATA_DIR = str(
    Path(os.environ["LOCALAPPDATA"]) / "XTerminator" / "sessao_edge"
    if sys.platform == "win32"
    else Path(__file__).resolve().parent / "sessao_edge"
)

# True = só simula: conta quantos tweets carregam, NÃO apaga nada.
DRY_RUN = True

# Máximo de tweets a apagar nesta execução (use um número pequeno pra testar).
MAX_DELECOES = 50

# Pausa entre exclusões, em segundos (mínimo/máximo — sorteia no intervalo).
DELAY_MIN = 2.5
DELAY_MAX = 5.0

# Textos dos botões, em PT e EN (o X mostra conforme o idioma da conta).
RE_DELETE = re.compile(r"Delete|Excluir", re.I)
RE_UNDO   = re.compile(r"Undo (repost|retweet)|Desfazer (repost|Retweetar)", re.I)

# ----------------------------------------------------------------------


def esperar_login(page):
    """Abre o perfil diretamente e pede login apenas se a sessão não estiver ativa."""
    page.goto(f"https://x.com/{USERNAME}", wait_until="domcontentloaded")
    try:
        page.get_by_test_id("AppTabBar_Profile_Link").wait_for(
            state="visible", timeout=15000
        )
        return
    except PWTimeout:
        pass
    print(f"\n>>> Esta janela usa uma sessão própria, salva em {USER_DATA_DIR}.")
    while True:
        input(
            f">>> Faça login como @{USERNAME} na janela aberta. "
            "Quando sua timeline aparecer, aperte ENTER aqui...\n"
        )
        try:
            page.get_by_test_id("AppTabBar_Profile_Link").wait_for(
                state="visible", timeout=15000
            )
            page.goto(f"https://x.com/{USERNAME}", wait_until="domcontentloaded")
            return
        except PWTimeout:
            print(">>> Não consegui confirmar o login. Confira a janela e tente novamente.")


def apagar_primeiro_tweet(page):
    """
    Tenta apagar o tweet do topo do perfil.
    Retorna: 'apagado', 'repost_desfeito', 'pulado' ou 'vazio'.
    """
    artigos = page.locator('article[data-testid="tweet"]')
    if artigos.count() == 0:
        return "vazio"

    artigo = artigos.first
    try:
        artigo.scroll_into_view_if_needed(timeout=5000)
        artigo.get_by_test_id("caret").first.click(timeout=5000)
    except PWTimeout:
        return "pulado"

    # Espera o menu aparecer.
    try:
        page.locator('[role="menu"]').first.wait_for(state="visible", timeout=5000)
    except PWTimeout:
        page.keyboard.press("Escape")
        return "pulado"

    item_delete = page.get_by_role("menuitem", name=RE_DELETE)
    item_undo   = page.get_by_role("menuitem", name=RE_UNDO)

    if item_delete.count() > 0:
        item_delete.first.click()
        try:
            page.get_by_test_id("confirmationSheetConfirm").click(timeout=5000)
        except PWTimeout:
            pass
        return "apagado"

    if item_undo.count() > 0:
        item_undo.first.click()
        # "Desfazer repost" às vezes tem confirmação, às vezes não.
        try:
            page.get_by_test_id("confirmationSheetConfirm").click(timeout=3000)
        except PWTimeout:
            pass
        return "repost_desfeito"

    # Não achou opção de apagar (ex.: tweet fixado sem menu esperado) — fecha e pula.
    page.keyboard.press("Escape")
    return "pulado"


def modo_simulacao(page):
    """Só rola o perfil e conta quantos tweets carregam, sem apagar."""
    print("MODO SIMULAÇÃO — nada será apagado.")
    vistos = 0
    sem_novos = 0
    while sem_novos < 3:
        atual = page.locator('article[data-testid="tweet"]').count()
        if atual > vistos:
            vistos = atual
            sem_novos = 0
        else:
            sem_novos += 1
        page.mouse.wheel(0, 3000)
        time.sleep(1.5)
    print(f"Tweets carregados na tela até agora: ~{vistos}")
    print("(O X carrega aos poucos; no modo real ele apaga do topo e vai renovando.)")


def modo_real(page):
    print("MODO REAL — vou apagar do topo do seu perfil.")
    resp = input("Digite APAGAR (maiúsculas) para confirmar: ")
    if resp.strip() != "APAGAR":
        sys.exit("Cancelado.")

    apagados = 0
    skips_seguidos = 0
    while apagados < MAX_DELECOES:
        resultado = apagar_primeiro_tweet(page)

        if resultado == "vazio":
            page.mouse.wheel(0, 3000)
            time.sleep(2.5)
            if page.locator('article[data-testid="tweet"]').count() == 0:
                print("Nenhum tweet restante. Fim.")
                break
            continue

        if resultado in ("apagado", "repost_desfeito"):
            apagados += 1
            skips_seguidos = 0
            print(f"[{apagados}/{MAX_DELECOES}] {resultado}")
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        else:  # pulado
            skips_seguidos += 1
            page.mouse.wheel(0, 1500)
            time.sleep(1.5)
            if skips_seguidos > 15:
                print("Muitos tweets seguidos sem opção de apagar. Parando por segurança.")
                break

    print("-" * 55)
    print(f"Concluído. Apagados nesta execução: {apagados}")


def main():
    if USERNAME == "SEU_USUARIO_AQUI" or not re.fullmatch(r"[A-Za-z0-9_]{1,15}", USERNAME):
        sys.exit("Defina XTERMINATOR_USERNAME no ambiente com seu usuário (sem arroba).")

    with sync_playwright() as p:
        endpoint = os.environ.get("XTERMINATOR_CDP_URL")
        if endpoint:
            browser = p.chromium.connect_over_cdp(endpoint)
            contexto = browser.contexts[0]
            page = contexto.new_page()
            print("Conectado ao Edge existente.")
        else:
            contexto = p.chromium.launch_persistent_context(
                USER_DATA_DIR,
                channel="msedge",
                headless=False,
                viewport={"width": 1280, "height": 900},
            )
            page = contexto.pages[0] if contexto.pages else contexto.new_page()

        esperar_login(page)

        time.sleep(4)

        if DRY_RUN:
            modo_simulacao(page)
        else:
            modo_real(page)

        if not endpoint:
            contexto.close()


if __name__ == "__main__":
    main()
