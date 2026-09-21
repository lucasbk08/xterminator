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
Inclui prévia, filtros de data e texto, limite por execução, intervalo configurável
e descanso periódico entre lotes.

## Instalar no Edge

1. Baixe esta pasta (ela contém `manifest.json`).
2. Abra `edge://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta.
4. Para atualizar uma instalação existente, clique em **Recarregar** no cartão da
   extensão e atualize as abas do X antes de iniciar uma nova execução.

## Usar

Abra a extensão em qualquer página. Escolha conteúdo, quantidade, intervalo entre
as ações e o descanso periódico. Clique em **Ver prévia** ou **Preparar remoção**. Se a aba atual já estiver
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

- **Tudo: posts, respostas e reposts:** limpa a conta inteira. É o padrão.
- **Só posts próprios:** não toca em reposts nem na aba de respostas.
- **Só reposts:** apenas desfaz reposts ativos; não exclui nada.

O perfil pode ter uma aba **All**, que reúne posts, respostas e reposts numa lista
só, no endereço `x.com/usuario/all`. Quando ela existe, o modo Tudo usa essa aba e
não precisa percorrer as outras — a aba Reposts nem sempre traz tudo.

Essa opção fica dentro do menu da aba **Posts**, e não aparece a partir de Replies,
Reposts ou Media. Se a execução começar em outra aba, a extensão ativa Posts antes,
abre o menu e escolhe All.

O X tem outras formas de organizar o perfil, e a extensão lida com elas. Na
interface com **menu suspenso** (All / Posts / Highlights), ela escolhe *All* para
limpar tudo, ou *Posts* no modo Só posts próprios, e os filtros separam o resto. Na
interface com **abas** (Posts / Replies / Reposts), o modo Tudo varre a aba Replies
e, ao esgotá-la, passa sozinha para a aba Reposts na mesma execução. As abas são
reconhecidas pelo endereço, pelo rótulo acessível ou pelo texto, então funcionam
mesmo quando o X as desenha apenas como ícones, sem texto visível.

Quando o X mostra o aviso de lista vazia, a extensão encerra na hora, sem recarregar
a página para conferir.

O limite (1 a 1000) é compartilhado entre todas as ações da execução. O intervalo
aceita decimais, entre 0,1 e 86400 segundos (padrão: 1,5). A espera começa após a
confirmação da operação pelo X. O tempo real inclui o carregamento e as verificações.
O botão Parar funciona durante a espera.

**Limite observado do X:** em testes nesta extensão, a conta aceitou cerca de
**200 remoções** e passou a recusar as seguintes por aproximadamente **10 minutos**,
independentemente do intervalo entre elas — 0,5 s e 2 s deram o mesmo resultado. O
consumo é acumulado entre execuções: fechar o painel e recomeçar não zera a contagem.
Esse número não é publicado pelo X, veio de medições limitadas e pode mudar ou variar
por conta. Diminuir o intervalo não aumenta o total permitido, só o alcança mais cedo.

**Recuo automático:** se o X responder **429** (limite de requisições), mostrar um
aviso de limite ou não confirmar a operação, a extensão não encerra: ela fecha o que
estiver aberto, espera **10 minutos** e tenta o mesmo item de novo, até quatro vezes.
A espera é fixa porque o limite do X parece se restabelecer nesse intervalo. Depois de
quatro recuos sem sucesso, a execução para com a mensagem do erro. O botão Parar continua ativo durante o recuo. Um sensor injetado na página
observa o status HTTP das respostas do X; ele não altera, lê nem envia o conteúdo
das requisições.

**Cota por janela:** a extensão limita quantas **exclusões** acontecem num período,
contando também o que foi excluído em execuções anteriores. Desfazer repost não é
exclusão e não entra nessa conta: o X parece tratar as duas ações com limites
separados, e desfazer reposts costuma esbarrar bem mais tarde. Se ainda assim vier
um limite, o recuo automático cuida do caso. Configure em **Máximo por
janela** (1 a 10000, ou 0 para desligar) e **Janela em segundos** (1 a 86400). O padrão
é **200 remoções a cada 600 s**, seguindo o limite observado acima. Ao atingir a cota,
o painel mostra quanto falta e retoma sozinho assim que a remoção mais antiga sai da
janela; o botão Parar continua ativo nessa espera.

Para isso, a extensão guarda apenas os **horários** das remoções recentes em
`chrome.storage.local`, nunca ids ou textos. Tudo que é mais antigo que a janela é
descartado a cada gravação, então a lista não passa do tamanho da própria cota.

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
