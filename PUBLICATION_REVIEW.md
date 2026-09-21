# Revisão para publicação

Revisão local realizada em 21/09/2026. Não houve commit, push, publicação ou acesso
à conta real durante esta revisão.

## Dados pessoais e credenciais

- Removido o usuário real do script antigo, do lançador PowerShell e dos testes.
  O script agora usa `TWEETDELETE_USERNAME`; os testes usam contas fictícias.
- Nenhuma credencial embutida ou referência pessoal conhecida foi encontrada nos
  arquivos públicos examinados por busca de padrões. Isso não é uma garantia
  absoluta de ausência de segredos.
- `sessao_x/` e `sessao_edge/` continuam existindo localmente e devem ser tratadas
  como privadas. A revisão não exportou, apagou ou exibiu seus cookies.
- O `.gitignore` foi ampliado. Uma verificação com metadados Git temporários
  confirmou que 16 caminhos sensíveis representativos são ignorados, incluindo
  sessões, cookies, logs, HAR, chaves, configurações locais e arquivos de distribuição.
  Também foi inspecionada a lista de arquivos que um novo repositório consideraria
  para inclusão. Essa simulação não cria commits nem altera o índice do projeto.
- ZIPs existentes foram inspecionados quanto a padrões de credenciais e referências
  pessoais conhecidas, sem achados. O ZIP atual foi regenerado com lista explícita
  de arquivos públicos e licença. Prefira regenerá-lo com o script de empacotamento.

## Limites da verificação

O diretório atual não foi reconhecido como repositório Git válido, mesmo na checagem
fora da visão restrita. Portanto, não há histórico local auditável nesta pasta.
Isso não comprova ausência de versões publicadas anteriormente em outro local.
O `.gitignore` não protege arquivos já rastreados e não retira dados do histórico.

Existem nome e e-mail de autor configurados no Git do ambiente. Seus valores não
foram incluídos neste relatório. Confira-os localmente antes de criar commits;
metadados de commit podem identificar você mesmo quando o código está anonimizado.

A revisão cobre o código e os pacotes desta pasta, não todo o disco, perfis do Edge
no Windows, arquivos externos, conversas, capturas já compartilhadas ou repositórios
remotos. Cookies expostos anteriormente devem ser invalidados no serviço de origem.

## Uso, licença e identidade

- Incluída licença MIT, atribuída genericamente aos contribuidores do projeto,
  sem acrescentar nome civil ou e-mail ao pacote. Preserve a atribuição e o texto
  da licença em redistribuições.
- README informa uso somente na própria conta, exclusão permanente, ausência de
  garantias, riscos e independência do X e da Microsoft.
- As [regras oficiais de automação do X](https://help.x.com/en/rules-and-policies/x-automation)
  consultadas proíbem automação do site fora da API e mencionam suspensão permanente.
  O README registra essa limitação sem prometer aprovação ou ausência de bloqueios.
- A interface usa um símbolo genérico de seta, sem logotipo do X. Os links e menções
  ao X descrevem o serviço em que a extensão atua; não representam parceria.

## Renomeação para XTerminator

Em 21/09/2026 o projeto passou de `TweetDelete` para **XTerminator**, evitando a
confusão com o serviço [tweetdelete.net](https://tweetdelete.net/) e com a
[extensão homônima](https://chromewebstore.google.com/detail/tweetdelete-%E2%80%93-delete-twee/aifggeijadkgmindifghoaefhgjjklkh).
Foram atualizados: `manifest.json`, títulos e textos da interface, identificadores
globais (`XTerminatorFilters`, `XTerminatorOptions`, `XTerminatorResume`), ids de DOM
(`xterminator-*`), variáveis de ambiente (`XTERMINATOR_USERNAME`, `XTERMINATOR_CDP_URL`),
o diretório `%LOCALAPPDATA%/XTerminator`, o script `xterminator.py`, os lançadores
PowerShell, os testes e o nome do pacote em `dist/`.

## Pendências antes da divulgação

**Marca no nome:** "XTerminator" contém "X", marca do X Corp. As políticas da
Microsoft Edge Add-ons e da Chrome Web Store restringem usar marca de terceiros no
título ou nos materiais de listagem quando isso sugere afiliação. O nome pode ser
recusado ou exigir alteração na submissão. Esta observação não é análise jurídica
de marca nem verificação de disponibilidade de registro; considere um título de
listagem sem a marca, mantendo XTerminator apenas como nome interno do projeto.

**ZIPs antigos:** `dist/` ainda contém pacotes gerados com o nome anterior. Não os
distribua; gere o pacote atual com `python3 scripts/package_extension.py`.

**Loja:** cadastro, materiais de listagem, ícones, endereço público da política de
privacidade e avaliação das regras da loja ainda fazem parte de uma publicação
futura. A presença de licença e política de privacidade não garante aprovação.
