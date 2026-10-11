# Continuidade do paralaxe e profundidade dos pântanos

## Sintomas e causas demonstradas

Na fase 2, chegar ao primeiro pântano expunha bordas retangulares, trocas de árvores e árvores translúcidas. A região da paisagem era escolhida por `cam.x + cam.w / 2`. Ao atravessar uma fronteira, o renderer misturava duas composições com sementes diferentes, usando alfa para a paisagem inteira. Mover ou redimensionar a câmera mudava os exemplares e sua opacidade, embora o lugar observado continuasse sendo o mesmo.

Cada patch também desenhava retângulos de água e bruma, uma margem cujo segundo seno reiniciava em coordenadas locais e vegetação com transbordamento. O cisalhamento do vento era aplicado a tudo, inclusive à margem. Os patches seguintes podiam cobrir raízes já desenhadas na margem anterior.

Os fundos das fases 1 e 2 aplicavam o clima preenchendo um retângulo entre o topo do bake e o fim da tela. Esse retângulo também escurecia o céu transparente entre as silhuetas. Seu início ficava visível como uma borda horizontal e o efeito se acumulava em camadas.

O plano superior do pântano usava os 22 px do topo dos tiles tradicionais, apesar de a clareira ter uma faixa traseira muito mais larga. A água física permanecia rasa, com 25 px, e seu tratamento frontal não dava profundidade à superfície atrás do personagem.

## Implementação e prevenção

`JungleLandscape` mantém a semente por célula e camada. Cada elemento recebe espécie e paleta a partir de uma coordenada fixa no mapa da camada; o paralaxe só altera sua projeção. `junglePalette` mistura cores com uma curva suave nos 350 px após cada fronteira, mantendo as árvores opacas. A distância continua representada pela escala, paleta e separação dos planos.

Cada patch separa margem e vegetação em dois canvases. Margens usam coordenadas globais, são desenhadas apenas em seu núcleo e todas precedem as raízes daquela camada. Árvores e plantas possuem 224 px de margem de transbordamento; apenas elas recebem vento. Rochas, construções e sulcos permanecem firmes. Água e névoa são preparadas em pequenas colunas com variação espacial contínua, sem duplicar retângulos nas bordas.

O cache conserva até 24 patches, com dois canvases por patch, e prepara até dois patches por passe. Os 14 ambientes permanecem presentes. O preparo inicial continua limitado e incremental: não se promete que um teletransporte para uma região fria esteja completamente aquecido no primeiro desenho.

`layerTint` prepara uma máscara colorida usando o alfa da silhueta (`source-in`). O clima altera apenas os pixels do cenário; nenhuma camada pinta o céu dentro do retângulo transparente do bake. As máscaras são preparadas na construção dos fundos, sem canvas ou gradiente por quadro.

`SWAMP_DEPTH` usa 34 px de deslocamento lateral e 84 px de recuo vertical, compatível com a largura nominal da clareira. Ondas e vitórias-régias acompanham esse plano; plantas mais distantes ficam menores. O lago conserva a projeção de 34 × 22 px, e câmaras profundas não ganham uma segunda superfície. Esses valores são locais desta arte, não regras universais. Os limites físicos das zonas e os saves não mudam.

Permanecem a suavização `low`, `drawSprShrunk`, o piso de DRS e a separação entre intervalo bruto de desenho e física protegida.

## Evidência local e reprodução

No mesmo Chrome local, comparar a área esquerda de 800 × 650 px enquanto a largura lógica da câmera muda de 800 para 1100 px, junto à fronteira orla/brejo:

- Renderer anterior: 777.127 componentes RGBA alterados na área compartilhada.
- Renderer corrigido: zero componentes alterados.
- Uma máscara de clima conserva `[0, 0, 0, 0]` fora da silhueta e retorna `[6, 4, 30, 255]` dentro dela, usando a cor de teste `#06041e`.
- No primeiro pântano, a superfície visual cobre `y=947..1031`, com amostra opaca 60 px atrás da linha frontal. A zona física continua em `y=1031`, com altura de 25 px.

A comparação de 2 px de movimento de câmera inclui deslocamento e antialiasing nas bordas; não deve ser usada como medida isolada de troca de paleta. O teste de largura fixa a posição e mede exatamente os mesmos pixels, separando esse mecanismo.

Os testes protegem a identidade dos exemplares na ida e na volta sobre a fronteira, opacidade, continuidade nos extremos das transições, ausência de novos bakes após aquecimento e projeção visual separada da zona física. `npm run typecheck`, `npm test -- --maxWorkers=2 --testTimeout=40000` (877 testes, 97 arquivos) e `npm run build` passaram. O build conserva os avisos conhecidos de import dinâmico ineficaz de áudio/música.

A varredura do jogo real visitou 10 trechos da cidade e 19 da selva, com 120 desenhos por trecho após aquecimento. Não criou novos canvases nem apresentou erros de página. Os viewports 844 × 390 e 360 × 640 não apresentaram overflow nas duas fases. Na cidade e no início da selva ainda foram observados gradientes em `paintDeco` e no cache distante de `Background.paintFar`; a ausência de novos gradientes do módulo de paisagem não significa ausência de gradientes no jogo inteiro.

Cadência em uma página nova do Chrome headless 155 no Windows, viewport 1440 × 900, primeiro pântano, após 120 intervalos de aquecimento: 360 intervalos de `requestAnimationFrame` em 3.149,5 ms, P95 8,6 ms, P99 16,7 ms, máximo 33,3 ms, 0,83% acima de 20,8 ms. Isso mede a entrega de callbacks desse navegador local, não os quadros fisicamente apresentados nem a fluidez de um celular. A varredura anterior, que recriava mundos sucessivamente, apresentou máximo de 391,7 ms; não foi promovida a benchmark limpo nem omitida. Não há comparação física antes/depois que sustente alegação de ganho de FPS.

Para reproduzir, abrir `tools/ambientacao.html?trecho=243`, visitar as fronteiras e voltar, variar o tamanho da janela e usar `?cidade` para a fase 1. Comparar o mesmo lugar e horário, e deixar o cache aquecer antes de medir desenho estável. Verificar câmera alta/baixa, margens secas, água rasa e Atlântida separadamente.

## Segundo ciclo: faixa periódica e efeitos da cidade

A revisão das faixas repetidas encontrou copas, raízes, cipós e samambaias de `JungleBackground.trunks` cortados nas extremidades do bake. Agora os mesmos exemplares, com a mesma semente e geometria, são continuados por cópias deslocadas uma largura de faixa. Comparando a primeira e última coluna das duas faixas de troncos, a diferença média por componente caiu de 15,32 para 2,35 e de 5,65 para 2,53. Essas colunas são amostras vizinhas, portanto não precisam ser idênticas; o importante é conservar o objeto que atravessa a emenda. A identidade das árvores e os detalhes de casca permanecem determinísticos.

Na cidade, cada atualização do cache distante recriava o mesmo gradiente do céu, mesmo que apenas as estrelas e o planeta tivessem mudado de posição. O gradiente agora é reutilizado e invalidado por clima, altura lógica ou escala. Seis comparações aquecidas de câmera, altura, clima e densidade apresentaram zero componentes RGBA alterados em relação ao renderer anterior. O aquecimento inclui leitura de pixels: uma primeira leitura pode modificar o caminho gráfico do canvas e contaminar uma comparação fria.

Hologramas e letreiros também recriavam gradientes de cores fixas. Agora preparam apenas o painel e continuam animando brilho, texto, varredura e bordas ao vivo. A borda do holograma tem margem de amostragem e recorte geométrico, evitando que o filtro leia transparência fora da imagem. As texturas pequenas usam densidade 4; não alteram a suavização do canvas principal.

Comparando os dois painéis em três instantes sobre um fundo opaco de 640 × 640 px, a diferença média por componente foi inferior a 0,005 na escala de 0 a 255. O letreiro teve diferença máxima de 2; o holograma teve até 42 componentes acima de 8 nos instantes com maior brilho, concentrados no contorno. Há pequenas diferenças de rasterização ao substituir preenchimento vetorial por cópia de imagem; não se alega igualdade absoluta nesses painéis.

No trecho 250 da cidade, 120 desenhos aquecidos antes criavam 390 gradientes: 240 de hologramas, 120 de letreiros e 30 do céu. Após o segundo ciclo, o mesmo ensaio registrou zero. `sceneryRenderCost.test.ts` protege a reutilização e a invalidação do clima. A suíte final passou com 879 testes em 98 arquivos, além de typecheck e build. A medição posterior do pântano, ainda em Chrome headless local, registrou P95 8,5 ms, P99 16,8 ms, máximo 50,1 ms e 0,83% acima de 20,8 ms em 360 callbacks: não demonstra ganho de FPS físico.

As ferramentas e capturas deste ensaio ficam em `tools/_work/scenery-*`, fora do Git. Nenhuma captura foi transmitida pelo túnel. Os resultados de pixels, cache e navegador não constituem aprovação visual manual nem prova de fluidez em celular físico.
