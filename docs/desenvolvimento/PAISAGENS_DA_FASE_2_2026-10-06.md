# Paisagens completas da fase 2, perseguição e casas

## Intenção e limites

Depois da aprovação da amostra, a ambientação da fase 2 foi estendida à campanha inteira. A cidade já aprovada mantém sua composição; a mata agora possui 14 regiões autoradas: orla, brejo, desfiladeiro, ruínas, lago, acampamento, casarios, roças, riacho, praça, oficinas, pomares, trilha do rio e santuário. Os morros secretos e o templo conservam suas entradas, física e desafios. Água, fossos e Atlântida continuam com seus próprios sistemas.

Cada região combina paleta, espaçamento, espécies e elementos próprios. Primitivas de árvores são reutilizadas, mas os agrupamentos usam sementes distintas por região e camada. Não se promete um asset diferente para cada árvore: a variedade é de composição, silhueta, escala e profundidade.

## Profundidade e desenho

`jungleLandscape.ts` desenha três planos atrás do mundo e uma faixa baixa à frente, com velocidades de paralaxe diferentes. Árvores inteiras, copas, raízes, palmeiras e ramificações substituem a repetição de troncos cortados. O brejo concentra mangues, cipós, canais e névoa para sugerir uma extensão maior que a faixa caminhável. Lagos, penhascos, ruínas, plantações e construções distantes dão identidade aos demais trechos.

O vento transforma as imagens preparadas mantendo a base das árvores apoiada. A faixa frontal permanece baixa para conservar a leitura do personagem. `forestTrail.ts` acompanha o relevo existente em toda a terra firme, sem pintar água ou fossos. A pedra do templo fora da clareira conserva seu tratamento anterior. A transição de cor usa a posição mundial em pequenas colunas durante a preparação, evitando emendas entre patches.

As imagens de paisagem têm 160 pixels de margem transparente para que copas que atravessam a borda não terminem num corte vertical. O cache mantém até 48 imagens, incluindo a convivência de duas regiões numa transição, e prepara no máximo duas por passagem de desenho. O cache do chão mantém 16 patches. Não se prepara a fase inteira de uma vez. Gradientes, silhuetas e texturas são criados nos bakes, mantendo a suavização `low` do canvas principal.

## Rebobinar e mostrar o roubo

A rebobinagem ainda chamava o renderer de tiles da perseguição antiga. Agora utiliza o mesmo `BranchCanopy` e o mesmo desenho de percurso da corrida atual, incluindo folhas e luz, antes de aplicar a fita VHS. O registro de posições e a simulação determinística não foram alterados.

O roubo antes mudava a posse da carta sem uma aterrissagem visível. A linha do tempo agora distingue aproximação pelo cipó, salto, apoio na cabeça, alcance da carta e fuga. O macaco fica apoiado na cabeça antes de a carta passar ao estado roubado; a animação usa a altura atual dos pés do Karimbo como referência. O teste verifica essa ordem explicitamente.

## Casas e interiores

Os conflitos externos vinham de decorações posicionadas pelo centro da casa e de janelas desenhadas sem considerar a porta. `houseFootprint` considera largura, profundidade lateral, escala e orientação da fachada. `settleHouseYards` mantém raízes de árvores fora desse volume e encaixa conjuntos de vasos no espaço real entre fachadas. As janelas só aparecem quando suas folhas não atravessam a porta. IDs e pontos de interação das casas são preservados.

Nos interiores, a mesa genérica ocupava 2 × 1 células, mas seu painter desenhava 2 × 2; o baú de 1 × 1 era desenhado como 1 × 2. A grade permitia passagem enquanto a imagem atravessava outros móveis. Os painters agora recebem as dimensões do móvel e ajustam a superfície, os pés, o tecido e os detalhes. As versões de 2 × 2 e 1 × 2 da casa da Benedita mantêm suas dimensões originais. As mesas comunitárias ficam fora do corredor de entrada e da escada.

O segundo andar usa `stairsDown`: abertura escura, degraus em altura negativa, corrimão e indicação de descida. A ligação entre pisos e seus IDs permanece igual; a imagem deixa de sugerir um terceiro andar.

## Evidência e prevenção

Os testes verificam a ordem do salto e roubo, o uso do cenário vivo durante a rebobinagem, a faixa completa de terra firme, as 14 regiões, o espaço entre fachadas e as plantas comunitárias. Todos os móveis sólidos são comparados por volume e todos os pontos de interação mantêm acesso. Um teste de desenho converte o tampo da mesa e o corpo do baú para coordenadas da grade e confirma que cabem nas dimensões declaradas, detectando o erro visual mesmo quando a navegação passa.

A inspeção no Chrome local percorreu as 14 regiões e capturou a aterrissagem do macaco, a rebobinagem e cinco interiores. Após aquecimento, 120 desenhos da paisagem não criaram canvas nem gradientes. Os viewports de 844 e 360 pixels não apresentaram overflow; não houve erros de console no ensaio. As capturas isolam a composição removendo inimigos nessa ferramenta, portanto não demonstram balanceamento de combate. Tampouco demonstram fluidez de GPU em aparelho físico.

A ferramenta `tools/ambientacao.html` usa um perfil separado e inclui atalhos para as regiões, como `?trecho=243` para o pântano. A validação completa passou: `npm run typecheck`, 875 testes em 97 arquivos com `npm test -- --maxWorkers=2 --testTimeout=40000` e `npm run build`. O limite de 40 segundos permite o teste existente que simula 400 segundos do lago; suas asserções não foram reduzidas. O build conserva os avisos de import dinâmico ineficaz dos módulos de áudio e música, que também possuem importações estáticas.
