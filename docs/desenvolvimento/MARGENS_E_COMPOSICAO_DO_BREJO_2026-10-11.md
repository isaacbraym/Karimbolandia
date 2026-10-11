# Margens e composição do brejo

## Sintomas e causa demonstrada

As quatro capturas do usuário mostraram cortes na entrada dos pântanos e nas ilhas secas, água com limites retos, cores lavadas no vilarejo e mudanças de cor das árvores. A revisão anterior corrigiu a troca de exemplares no paralaxe, mas ampliar o recuo da água para 84 px não integrou a sua geometria ao terreno.

`ForestTrail` só pintava colunas secas. `drawSurfacePlane` pintava um paralelogramo sobre o vazio deixado pelo terreno. O fundo desse plano era uma linha horizontal; suas laterais terminavam em diagonais retas. Além disso, os tiles de lama e de terra abaixo da água ainda desenhavam um bloco independente. Faixas contínuas de lentilhas e reflexos destacavam outra linha reta na frente.

Havia também dois tratamentos de sombra para a mesma copa: `ForestLight` aplicava sombra local no mundo, enquanto `JungleBackground` somava a cobertura sobre o jogador ao crepúsculo de todas as camadas. Uma árvore podia, portanto, mudar a cor de toda a floresta. A névoa rasteira era aplicada depois dos personagens; a gradação quente/fria do quadro reforçava o aspecto lavado.

## Implementação e forma de desenvolver

- A topologia visual passa a reconhecer os leitos rasos em `Level.scenicWetlands`. A trilha pinta solo contínuo sob as três zonas de pântano. Só a representação dos tiles de terra/lama dentro dessa faixa é substituída; seus valores físicos permanecem sólidos. Plataformas de madeira, lagos, abismos e interiores mantêm seus tratamentos.
- O solo é composto antes da água, e a água permanece antes do fundo dos interiores. Isso conserva a composição de Atlântida. O alcance traseiro do solo cresce suavemente na vizinhança dos brejos, sustentando também a margem distante.
- `swampShore.ts` calcula enseadas que se fecham nas pontas, uma margem distante ondulada e a projeção das plantas. Água turva, ondulações e uma faixa macia de terra úmida são preparadas uma vez por zona. A face frontal se dissolve lateralmente e no leito. Ondulações pequenas, vitórias-régias e grupos de lentilhas continuam animados.
- O solo usa a mesma função espacial de paleta das paisagens. As transições agora percorrem 900 px, com curva suave, em vez de 350 px. As 14 regiões e suas árvores opacas continuam presentes.
- A copa controla os fachos locais e a sombra local, sem alterar o crepúsculo de todas as árvores. A névoa rasteira é composta no fundo, antes do mundo; o tratamento submerso continua sem essa névoa. Sol e pólen mudam de tonalidade continuamente. A gradação da fase 2 conserva seu efeito com menos dominantes amarelas e turquesas.

O princípio reutilizável é compartilhar o suporte do terreno e a geometria das margens antes de ajustar cores ou alfa. Recuo vertical, tons, amplitudes e distâncias são decisões desta arte; não são constantes universais.

## Evidência e regressões

No Chrome headless local, foi comparada a composição de solo e água com os módulos da revisão anterior, posicionando a câmera em cada zona. A diferença média absoluta dos canais RGB entre duas colunas vizinhas, durante 74 px de altura na saída física de cada pântano, passou de **55,38 / 15,55 / 24,42** para **1,14 / 0,63 / 1,05**. Esse ensaio mede a eliminação da emenda vertical; não é uma nota estética da cena inteira.

No mesmo fundo, mudar apenas `canopy` de 0 para 1 alterava 2.039.713 componentes de pixels. Agora altera zero. Após aquecimento, 120 desenhos completos no primeiro pântano criaram zero canvases e zero gradientes. As zonas físicas permaneceram idênticas.

`swampShore.test.ts` protege o solo nas margens/leitos, a exclusão dos lagos, a conservação das colisões e das plataformas e as enseadas onduladas. `sceneryRenderCost.test.ts` protege a invariância do fundo sob a copa e a ordem da névoa. Os testes existentes de projeção e de paleta foram atualizados para os novos limites visuais.

Validação: typecheck sem erros; 891 testes em 100 arquivos, com `--maxWorkers=2 --testTimeout=40000`. A primeira execução padrão atingiu o timeout do teste preexistente que simula o peixe gigante; a nova execução preservou suas asserções e passou.

O build final passou, conservando os avisos preexistentes sobre imports de áudio/música. Foram reproduzidas 13 cenas completas: entradas, ilhas e saídas do brejo, desfiladeiro, lago, vilarejo, riacho, oficinas e dois trechos da cidade. Não houve erros de execução. Em 360 callbacks de animação com o jogo em execução no brejo, após aquecimento, o Chrome headless registrou P95 de 8,5 ms, P99 de 16,6 ms, máximo de 25,1 ms e 0,56% acima de 20,8 ms. A medição é local, não uma promessa de desempenho em telas físicas.

As capturas de composição ficam apenas em `tools/_work/`, sem envio pelo túnel nem versionamento. Ensaios automatizados em Chrome headless e medições de pixels não substituem a avaliação estética humana nem demonstram fluidez em aparelho físico. O filtro `low`, `drawSprShrunk`, `DRS_MIN` e a separação entre cadência bruta e física não foram alterados.
