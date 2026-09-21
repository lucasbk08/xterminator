# Sessões e publicação

Os diretórios `sessao_x/` e `sessao_edge/` podem conter login, cookies e dados do
navegador. O lançador Windows também salva perfil e venv em `%LOCALAPPDATA%/XTerminator`.
Não distribua esses diretórios. A extensão usa a sessão do navegador de quem instala;
essa sessão não deve ser exportada junto com o código.

O `.gitignore` cobre sessões, venv, caches, logs, credenciais comuns, chaves privadas,
HARs, relatórios e capturas. Arquivos com outros nomes também podem conter segredos:
ignorar padrões não substitui revisar o conteúdo. Não use `git add -f` nesses arquivos.

Antes do primeiro commit, confira:

```sh
git status --short --untracked-files=all
git add --dry-run .
git diff --cached --stat
git diff --cached
```

Esses comandos exigem um repositório Git inicializado. Revise a saída localmente;
não copie diffs com segredos para issues, chats ou comentários. Confira também os
arquivos rastreados com `git ls-files`: `.gitignore` não remove arquivos já adicionados.

Para empacotar a extensão, use `python3 scripts/package_extension.py`. O pacote usa
uma lista explícita de arquivos permitidos, recusa links simbólicos e inclui a MIT.
Não compacte a pasta inteira do projeto nem reutilize ZIPs antigos para publicar.
O nome do projeto passou a ser XTerminator; veja em PUBLICATION_REVIEW.md a ressalva
sobre usar a marca X no título de uma listagem de loja.

Se cookies ou credenciais já foram compartilhados, invalide as sessões/credenciais
afetadas no serviço de origem. Apagar um arquivo ou criar `.gitignore` depois não
invalida um cookie nem remove cópias, commits anteriores, forks ou downloads.
HARs e capturas do painel de rede também podem expor cookies e cabeçalhos de acesso.

O Git pode incluir nome e e-mail do autor nos commits, independentemente dos arquivos.
Confira localmente `git var GIT_AUTHOR_IDENT` e as configurações `user.name`/`user.email`;
se desejar, configure um nome público e um endereço de privacidade antes de commitar.
