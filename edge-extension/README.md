# XTerminator

Projeto independente, **não oficial**, sem vínculo ou endosso do X Corp., da
Microsoft ou do serviço tweetdelete.net. O nome XTerminator é do projeto e não
indica parceria; "X" é marca dos respectivos titulares e políticas de loja podem
exigir outro título na listagem pública.

Use apenas para apagar **seu próprio conteúdo**, por sua conta e risco. Exclusões
são permanentes. Faça backup e confira a prévia antes de confirmar.
As [regras de automação do X](https://help.x.com/en/rules-and-policies/x-automation)
proíbem automação do site fora da API e alertam para suspensão permanente. Esta
extensão usa a interface do site; não promete conformidade nem ausência de bloqueios.
Respeite os limites do serviço. Código distribuído sem garantias, sob [MIT](LICENSE).

Extensão local para limpar posts, respostas e reposts da conta conectada ao X.
Inclui prévia, filtros de data e texto, limite por execução e intervalo configurável.

## Instalar no Edge

1. Baixe esta pasta (ela contém `manifest.json`).
2. Abra `edge://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta.
4. Para atualizar uma instalação existente, clique em **Recarregar** no cartão da
   extensão e atualize as abas do X antes de iniciar uma nova execução.

## Usar

Abra a extensão em qualquer página. Escolha conteúdo, quantidade e intervalo entre
as ações. Clique em **Ver prévia** ou **Preparar remoção**. Se a aba atual já estiver
no X, a extensão usa essa aba; em outros sites, abre uma nova aba do X. Ela encontra
o link **Profile/Perfil** na barra lateral, identifica a conta e abre seu perfil
antes de mostrar a confirmação. Se necessário,
faça login no próprio X. A extensão não pede senha nem copia cookies.

A prévia mostra os itens encontrados sem alterá-los. Na remoção, confira o usuário
exibido e os filtros, digite **APAGAR** e confirme. Posts excluídos não podem ser
recuperados. Desfazer um repost preserva o post original. **Parar** impede novas
ações; uma operação enviada pode terminar.

A inicialização não depende do carregamento completo de imagens e outros recursos.
Uma aba que já tenha um painel da extensão não recebe uma segunda execução:
pare e feche esse painel antes de iniciar outra.

- **Posts próprios:** exclui posts próprios na aba principal.
- **Posts e respostas:** usa a aba Replies, que pode incluir posts e respostas.
- **Só reposts:** seleciona Reposts quando disponível e desfaz reposts ativos.
- **Posts próprios e reposts:** processa ambos na aba principal; não percorre
  automaticamente todas as abas.

O limite (1 a 1000) é compartilhado entre todas as ações da execução. O intervalo
aceita decimais, entre 0,1 e 86400 segundos (padrão: 1,5). A espera começa após a
confirmação da operação pelo X. O tempo real inclui o carregamento e as verificações.
O botão Parar funciona durante a espera. Intervalos curtos podem atingir rate limits;
nenhum intervalo garante evitá-los.

## Filtros

Campos opcionais vazios não restringem a busca. Todos os filtros se combinam. Datas
incluem os dias inicial e final no fuso local. Em reposts, usamos a data e o texto
do post original. Palavra ou frase é procurada literalmente, sem diferenciar
maiúsculas de minúsculas, preservando acentos. Não pesquisamos texto em imagens,
destinos de links ou texto de posts citados.

A execução usa uma cópia fixa das opções. A remoção percorre a página novamente:
a prévia não congela IDs caso novos conteúdos apareçam. Só a própria conta confirmada
pode ter posts excluídos. Uma troca de conta ou saída do perfil interrompe a execução.

## Carregamento e recargas

A busca depende dos itens que o X disponibiliza no perfil, não de um arquivo completo.
Durante a remoção, oito rolagens sem progresso provocam uma recarga após três segundos.
Filtros, conta, contagem e IDs já processados são preservados. A retomada não pede nova
confirmação, pois continua a mesma execução autorizada.

O processo para após duas recargas seguidas sem ações confirmadas ou dez no total.
Erros visíveis e falhas de confirmação interrompem as ações. O código não monitora
HTTP 429 diretamente nem garante detectar todo rate limit. A simulação não recarrega.
A contagem depende da atualização da interface do X, sem verificação independente
no servidor. Não existe garantia de encontrar todo o histórico.

## Privacidade e distribuição

Leia [PRIVACY.md](PRIVACY.md). O acesso solicitado limita-se a `https://x.com/*`,
necessário para abrir o X a partir de qualquer página e iniciar a execução nessa aba.
As preferências ficam no navegador; estados temporários são separados por aba.

Esta pasta pode ser compartilhada como código de extensão. Para publicar numa loja,
ainda são necessários cadastro de desenvolvedor, ícones e materiais de listagem,
política de privacidade hospedada e revisão da loja. Este projeto não foi publicado
nem aprovado por uma loja. Compartilhe apenas a pasta da extensão, nunca perfis de
navegador, pastas de sessão ou cookies.
