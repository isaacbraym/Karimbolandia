# Clareira integrada e vilarejo com telhados caminháveis

## Sintoma e escopo

A referência enviada pelo usuário, de Rayman Legends, mostra um personagem em uma floresta que tem piso largo, sobreposição de volumes e vegetação em planos distintos. No Karimbolandia, a superfície projetada de 34/22 px ainda parecia uma passarela elevada: juntas diagonais contínuas, uma linha frontal de capim e a face de terra repetida separavam o personagem do fundo. Acrescentar mais paralaxe não corrigia essa separação.

Esta é uma amostra para avaliação local, não a extensão da direção artística à campanha inteira. Ela cobre da coluna 150 até `playerStart.x + RUN * 30`: 4800–10824 px na fase 2. O limite depende da distância à velocidade normal (196 px/s), não do cronômetro: parar, combater ou voltar não desliga a arte. Somente chão seco de terra recebe a clareira. Água, abismos, plataformas e o templo continuam legíveis com seus próprios renderizadores. A fase 1 não recebe a clareira.

## Mecanismo e implementação

`Level.scenicTrail` é configurado **após** a expansão da comunidade: `insertColumns` troca a instância de `Level`. Configurá-lo antes dessa troca descartava a amostra. Um teste protege a presença e o limite no mapa finalmente montado.

`art/forestTrail.ts` pinta uma clareira em que o contato físico fica dentro de um piso largo. A margem de trás sobe em colinas contínuas; a trilha de terra acompanha a superfície real. Pinceladas, manchas de musgo, raízes afiladas e samambaias substituem o padrão de ladrilhos. O piso nasce antes das decorações, preservando troncos, pedras, arbustos e luzes existentes. Samambaias próximas têm um passe depois do personagem, com margem suficiente para manter corpo e mira visíveis. A paralaxe de primeiro plano existente é preservada.

`art/tiles.ts` omite apenas a imagem dos sólidos de terra e sua borda na região seca da amostra. O chão sólido e as plataformas permanecem no mapa; os dois montes da abertura usam relevo contínuo caminhável, conforme a revisão abaixo. O passe de água continua anterior ao cenário e a máscara da clareira exclui seus poços.

O cache pertence ao mundo e é limitado pela extensão da amostra: cerca de 13 patches, cada um com dois canvases de 512×520 unidades a 1,5×. No máximo dois patches são preparados por desenho; um preenchimento provisório mantém o chão visível em viewports largos. Gradientes e textura são preparados no bake; o desenho estável reutiliza `drawImage`. Sementes dependem de células globais do mundo, incluindo vizinhos, para que manchas e raízes não terminem em linhas de cache. O cache é descartado com o mundo e invalidado por `Level.rev`. Se futuramente houver edição dinâmica desse chão, sua invalidação precisa acompanhar essa edição.

## Casas, lajes e compatibilidade

As mesmas 30 casas, com suas variantes e interiores, formam núcleos com intervalos de 6,5–11 tiles e quintais maiores entre os núcleos. A praça fica livre; o corredor da colheita do pomar também. Identidades históricas ficam em `DecoSpawn.identityX`: o ID da visita continua derivando da porta antiga, enquanto a interação usa a porta nova. Assim, reagrupar fachadas não apaga visitas, presentes ou travessuras de um save.

`level/roofRoutes.ts` deriva a largura e a altura das superfícies do estilo e da escala efetivos da casa. O mesmo registro em `Level.roofs` define a plataforma de mão única e a imagem da laje frontal/telhado; não há uma tábua independente desenhada em outra altura. Casas altas têm uma marquise com suportes junto à fachada, como degrau. A rua e as portas ficam abertas. Há 30 telhados e 16 marquises.

As moedas antigas das rotas altas são reposicionadas sem renumerar seus IDs. Moedas adicionais só são anexadas depois de montar Atlântida, preservando os IDs de relíquias e pérolas; as 12 pérolas continuam 372–383. O teste anterior que exigia pérolas depois de **qualquer** item foi substituído pela verificação desses IDs históricos e da ordem dos tesouros, permitindo acrescentar moedas novas sem migrar saves.

## Problemas demonstrados durante a revisão

- Um núcleo inicialmente ocupava o corredor do pomar. `orchardChallenge` procura chão em uma faixa vertical; uma marquise nesse intervalo era interpretada como piso e invalidava a colheita. Os núcleos foram reposicionados antes/depois do corredor. Os testes anteriores de colheita permanecem intactos.
- A leitura de `Player.y` como altura dos pés produzia uma diferença de 28 px nos testes. A posição do corpo é o centro; validação de contato usa `feetY`, assentamento real e tolerância inferior a 1 px.
- Um teste de salto iniciado imediatamente após `reset` podia começar antes de o personagem assentar no relevo. A prova começa com queda/assentamento físico, mantém o pulo normal e depois libera o botão entre os degraus.

## Evidência e reprodução

Inicie `npm run dev -- --port 5255` e abra `http://localhost:5255/tools/ambientacao.html`. A página usa um perfil separado de amostra, abre a fase 2 e oferece **Floresta: início**, **Vilarejo**, **Jogar** e **Ocultar botões**. O jogo normal também recebe as alterações ao iniciar a fase 2. A página de amostra é uma ferramenta de desenvolvimento servida pelo Vite, não uma entrada do build publicado.

`tests/artDirection.test.ts` verifica o limite da amostra, exclusão do brejo/abismo, ausência na fase 1, distribuição das casas, IDs de visita e moedas indicadoras. Usa a física real para cair sobre todas as 46 superfícies e para subir a todos os 30 telhados desde a rua, usando as marquises quando necessário. `communityInteriors.test.ts` mantém a prova das 33 portas e interiores, e `orchardChallenge.test.ts` mantém a colheita por caminhada e saltos.

QA em Chrome desktop sem janela, 1440×900, 844×390 e 360×640: sem erros JavaScript nem overflow nos dois formatos menores; o controle D moveu Karimbo no estado `playing`, vivo. Após aquecer a câmera inicial, 120 pares de passes de clareira criaram **zero canvases e zero gradientes**, com quatro `drawImage` por par. Isso prova reutilização do cache nessa cena, não o custo total da GPU.

O harness local alternou chão antigo/clareira em quatro rodadas de 4 s com 1 s de aquecimento, coletando intervalos apenas em `playing`. P95 da clareira: 18,3/19,5 ms; P99: 24,8/25,4 ms; máximos: 25,1/46,8 ms. Controles: P95 17,8/19,5 ms, P99 41,6/25,8 ms, máximos 83,7/27,1 ms. Havia validação concorrente na máquina. A variação e a janela curta impedem inferir ganho de desempenho; este resultado é uma conferência local do mecanismo, não prova de apresentação física ou fluidez móvel. Capturas, relatório e harness ficam em `tools/_work/art-*`, `forest-*` e `village-*`, fora do Git.

Typecheck, suíte completa e build devem passar antes do commit. A suíte contém 91 arquivos e 848 testes após a nova prova de salto. O build conserva os avisos existentes de importações dinâmicas ineficazes de áudio/música. Permanecem `low` no canvas principal, `drawSprShrunk`, `DRS_MIN = 0.75` e os tempos separados de física/desenho.

## Revisão dos montes e da trilha após avaliação do usuário

O usuário encontrou um bloqueio logo na abertura: os antigos `b.block(168, G - 1, 6, 1)` e `b.block(198, G - 1, 4, 1)` ainda formavam paredes sólidas de 32 px. A clareira ocultava o desenho desses tiles, mas preservava a colisão. O teste de caminhada sem pulo reproduziu o primeiro bloqueio, parando 332 px antes do destino. O problema era a geometria desses dois montes, não a necessidade de alterar a física global.

Os blocos elevados foram substituídos por colinas em `Level.relief`, com alturas máximas de 32 e 26 px e entrada/saída graduais. A física existente acompanha esse relevo nos dois sentidos. O chão base continua sólido; plataformas, água e abismos mantêm suas colisões. A colocação de decorações e inimigos acompanha as novas alturas durante a montagem do mapa.

A antiga trilha seguia a superfície descontínua dos blocos usando faixas de largura constante, produzindo quinas. `trailProfile` interpola o relevo por uma curva cúbica e varia a largura com coordenadas globais. O bake desenha faixas preenchidas e margens curvas; tanto a trilha quanto a borda distante atravessam os patches sem reiniciar o perfil. Essa preparação continua restrita ao cache, sem acrescentar cálculos de perfil por quadro estável.

Proteção contra regressão: `artDirection.test.ts` percorre os dois montes nos dois sentidos com a física real, sem pulo e sem colisão lateral, e confere continuidade e variação de largura da trilha, inclusive nas bordas do cache. O teste de caminhada falhava antes da correção e passa depois.

No Chrome desktop, as quatro travessias com teclas D/A chegaram aos destinos, sem pulo, sem parede no destino e sem erros JavaScript. Para isolar o terreno, o harness remove inimigos e marca a cena opcional da carta como concluída somente no mundo de teste: ela normalmente assume os controles a partir da coluna 205. Capturas da abertura, do segundo monte e da borda de cache foram conferidas; os artefatos ficam em `tools/_work/trail-fix-*`, fora do Git. Typecheck, 850 testes em 91 arquivos e build passaram. Esta conferência não mede apresentação física ou desempenho móvel.

## Limites de aplicação

A física continua lateral 2D. O jogador não se move livremente em profundidade; o piso integra visualmente a linha de contato e usa o relevo já caminhável. A referência orienta a composição, não reproduz os assets ou o acabamento de Rayman. Extensão para outras regiões depende da avaliação do usuário; arte móvel, apresentação física e desempenho em aparelhos reais não foram validados nesta tarefa. Não houve push nem deploy.
