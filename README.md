# XTerminator

Projeto independente e **não oficial**, sem vínculo ou endosso do X Corp., da
Microsoft ou do serviço de terceiros em tweetdelete.net. O nome XTerminator é do
projeto e não indica parceria; "X" é marca dos respectivos titulares.

## Uso e responsabilidade

Use apenas para remover **seu próprio conteúdo**, na conta que você controla.
**Use por sua conta e risco.** Exclusões são permanentes: confira a prévia e faça
backup dos seus dados antes de confirmar. O projeto é fornecido sem garantias.

As [regras de automação do X](https://help.x.com/en/rules-and-policies/x-automation)
proíbem automação do site fora da API e mencionam a possibilidade de suspensão
permanente. Esta extensão automatiza a interface do site; não há garantia de
conformidade, disponibilidade ou aprovação em lojas. Respeite os limites do X;
não tente contorná-los.

## Instalação

A versão de uso geral está em [edge-extension](edge-extension/README.md).
Ela funciona com a conta conectada ao X no navegador de quem instalar, sem
configurar um nome de usuário no código. Abra a extensão, escolha filtros e
intervalo, e use **Ver prévia** ou **Preparar remoção** para abrir o X.

O script `xterminator.py` e os lançadores PowerShell são a implementação anterior,
com configuração própria. Não são necessários para usar a extensão.
No script antigo, informe seu usuário pela variável de ambiente
`XTERMINATOR_USERNAME`; não grave dados pessoais no código para publicar.

Para distribuir, compartilhe apenas os arquivos de `edge-extension`. Os diretórios
de ambiente virtual e sessões do navegador estão excluídos pelo `.gitignore`.
Veja [SECURITY.md](SECURITY.md) antes do primeiro commit e
[PUBLICATION_REVIEW.md](PUBLICATION_REVIEW.md) para os resultados desta revisão.

## Licença e identidade

Código sob [licença MIT](LICENSE). Preserve o aviso de licença nas redistribuições.
O nome e o logotipo do X pertencem aos respectivos titulares. A interface deste
projeto não utiliza o logotipo do X nem apresenta afiliação oficial. Não use ícones,
capturas ou textos de listagem que insinuem aprovação ou parceria.

## Testes locais

Com Playwright instalado na venv e seu Chromium disponível:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Os testes interceptam o acesso ao X e usam páginas fictícias. Os testes de recarga
e abertura usam a extensão real em um perfil temporário isolado.
