# Estudo de caso: interiores isométricos no Karimbolândia

> Objetivo: transformar "entrar numa casa" de um modal de cliques num **modo de jogo próprio**, 2.5D isométrico em grade (estilo Habbo), em que explorar uma casa seja tão divertido quanto correr e atirar lá fora.
> Escopo da primeira entrega: **a primeira construção dos mercenários** (Palafita do vigia, fase 2) e **a primeira casa do vilarejo** (Comunidade da trilha, fase 2). O motor tem de servir para todas as casas futuras.

---

## 1. Diagnóstico do que existe hoje

| Peça | Onde | Como funciona | Limite |
| --- | --- | --- | --- |
| Pontos de exploração | `src/game/exploration.ts` | `Exploration` cria um `ExplorationSpot` por `jHut` (3 cabanas mercenárias) e 3 pistas da aldeia. `nearest()`/`safe()` decidem se dá para entrar (no chão, sem inimigo a 360 px, sem tiros ou granadas por perto, sem parede no caminho). | As casas do vilarejo (`villageHome`) são só decoração de fundo. Não dá para entrar nelas. |
| Interior atual | `src/ui/investigation.ts` + `src/art/cabin.ts` | Modal DOM com um SVG fixo em perspectiva e botões-hotspot por objeto (`rect` em 960×540). O mundo fica pausado. | Karimbo não aparece. Não há espaço, movimento, risco nem consequência. É um "point-and-click de inventário". |
| Recompensas | `Exploration.inspect` | Gaveta e baú abrem primeiro e dão munição na segunda vez (18 e 12), com regra especial para quem só tem a pistola (+1 granada). Retrato e carta liberam fragmentos de `VILLAGE_LORE`. | A lógica é boa e já tem teste. **Reaproveitar e não duplicar.** |
| Persistência | `w.encounters.completed` → `SaveState.encounters` | IDs `cabin:<x>:<obj>` e `cabin:<x>:<obj>:open`, `lore:<id>`. | `saveValidation.ts` aceita **no máximo 64 IDs** e o padrão `^[a-z0-9:-]{1,80}$`. Estado rico de interior (comida mordida, vaso quebrado, gaveta aberta) **não cabe** aí. |
| Moradores | `src/game/village.ts` | `Village.residents` (por `villageResident`, `villageWeaver`...) andam, olham para o Karimbo e falam uma linha por visita. | Não têm memória do que o Karimbo fez. |
| Primeira palafita | `src/game/level/jungle.ts:449` | `b.deco('jHut', 251, G - 3)` com um sniper no telhado (`enemy('sniper', 251, G-6)`). | — |
| Primeira casa | `src/game/level/jungle.ts:106` (`expandJungle`) | `villageHome` em 702 (depois 719 e 739), cada uma com `villageResident` em `x-2` e `x+5`. | — |

**Conclusão:** a fundação de regras (segurança para entrar, economia de munição, lore, IDs estáveis) está sólida. O que falta é o **jogo** dentro da casa: espaço, corpo, verbos, risco, reação e espetáculo.

---

## 2. O que aprender com quem é especialista nisso

| Referência | O que roubar (com orgulho) | Como entra no Karimbolândia |
| --- | --- | --- |
| **Habbo Hotel** | Grade isométrica 2:1, clicar no chão para andar com caminho automático, móveis com estados (ligar, abrir, sentar), cursor em losango no piso, quarto como diorama flutuando no escuro. | É a base visual e de controle. |
| **The Sims** | Menu radial (pie menu) de verbos contextuais por objeto e NPCs com rotina que reagem ao que veem. | Cada objeto mostra 2 a 5 verbos em leque. A dona da casa tem rotina e opinião. |
| **Untitled Goose Game** | Lista de travessuras como objetivo, comédia sistêmica (o NPC reage ao estado do mundo, não a scripts) e o prazer de bagunçar sem violência. | "Lista de travessuras" por cômodo. Completar tudo rende o selo **KARIMBADO!** (trocadilho com o nome do jogo). |
| **Hitman / Assassin's Creed** | Medidor de suspeita legível acima da cabeça (olho que enche) e o aviso "esta ação será vista" antes de agir. | Olho de suspeita na moradora. O verbo no menu ganha um ícone de olho quando há testemunha. |
| **Thief / Metal Gear** | Barulho como recurso, piso que range, andar na ponta dos pés, ondas de som visíveis. | Tábuas rangentes na palafita, ponta dos pés e anéis de ruído no chão. |
| **Hello Neighbor** | O dono pode **voltar para casa** a qualquer momento. Tensão sem combate. | Dona Benedita volta da roça com um temporizador ou se ouvir barulho. |
| **Commandos / Desperados** | Cone de visão desenhado no chão. | Cone suave e translúcido só quando o NPC está atento. |
| **Animal Crossing / Paper Mario** | Interior que "se monta" ao entrar (móveis caem com squash), cutaway de casa de bonecas e aconchego. | Transição de entrada em que o diorama se monta em cascata diagonal. |
| **EarthBound / Disco Elysium / Gone Home** | Todo objeto responde com personalidade, e a história se conta pelos objetos. | Nenhum clique morto. Até parede e chão têm piada. O lore da aldeia continua nos objetos. |

---

## 3. Pilares de design (o critério para decidir qualquer dúvida)

1. **Todo objeto responde.** Nenhum clique morto. Repetir uma ação gera variação ou uma piada nova, e nunca a mesma frase duas vezes seguidas.
2. **Sistemas, não scripts.** A moradora reage ao **estado** da casa (filtro quebrado, comida comida, gaveta aberta), não a uma sequência pré-gravada.
3. **Tensão sem tiro.** Lá dentro Karimbo não pula, não voa e não atira. O risco vem de barulho, olhares e do dono voltando.
4. **Toda ação tem consequência legível.** Antes de agir o jogador vê ruído e testemunha. Depois vê a reação. Ao sair, o mundo lembra.
5. **Suco (juice) em tudo.** Squash and stretch, partículas, onomatopeias, luz quente, som. O interior tem de parecer **mais caprichado** que o mundo lá fora, não um menu.
6. **Leve como pena.** Nada do interior é carregado antes de o jogador chegar perto da porta. Ao sair, tudo é liberado.

---

## 4. O laço de jogo dentro da casa

```
chegar na porta (F · ENTRAR) → diorama se monta → explorar (andar, olhar, fuçar)
   → escolher verbos (comer, pegar/roubar, derrubar, usar, deitar...)
   → ruído e testemunhas → reação do NPC (suspeita, acordar, voltar para casa)
   → completar travessuras e achar recompensas → sair (pela porta ou expulso)
   → consequência lá fora (falas, mercenário alertado, presente, reputação)
```

### 4.1 Verbos (menu radial contextual)

| Verbo | Ícone (vetor, sem emoji) | Exemplos | Ruído base |
| --- | --- | --- | --- |
| Examinar | olho | qualquer coisa | 0 |
| Abrir / Fechar | porta | armário, gaveta, baú, panela | 6–12 |
| Fuçar | lupa | gaveta aberta, baú de enxoval, lata de biscoito | 8 |
| Pegar (mercenário) / **Roubar** (morador, em vermelho) | mão | munição, panela apreendida, cofrinho | 4 |
| Comer | garfo | feijão (3 colheradas), bolo, ração militar | 6 |
| Usar | engrenagem | TV (tapa técnico), rádio, fogão, regar planta | variável |
| Sentar / Deitar | cadeira | cadeira, rede (cochilo) | 3 |
| Derrubar / Chutar | estrela de impacto | garrafa, vaso, caneca, pilha de pratos | 30–60 |
| Dar / Devolver | presente | entregar a panela à Dona Benedita | 0 |
| Pregar peça | risadinha | amarrar os cadarços, bigode no retrato | 5 |

Cada fatia do menu mostra: nome, **ondas de ruído (0–3)** e um **olho** se alguém acordado vai ver. Fatia vermelha indica ação que irrita o morador.

### 4.2 Ruído e percepção (simulação, sem arte)

- **Evento de ruído** `{x, y, intensidade}`. A intensidade cai com a distância em tiles (distância de Chebyshev). Paredes internas cortam 50%.
- **Ponta dos pés** (segurar um botão): metade da velocidade e um quarto do ruído dos passos.
- **Tábua rangente:** pisar normalmente gera 18 de ruído; na ponta dos pés gera 4.
- **Visão do NPC:** cone de 100°, alcance de 5 tiles, linha de visada por Bresenham na grade. Móveis altos e paredes bloqueiam; móveis baixos não.
- **Sono do mercenário (0–100):** cai com ruído percebido e se recupera a +4/s.
  - Abaixo de 60 ele vira na rede e resmunga (aviso).
  - Abaixo de 30 senta meio acordado por 3 s ("Hm?... mãe?"). Se vir o Karimbo nesse intervalo, acorda.
  - Em 0 acorda de vez com um **!**.
- **Suspeita do morador (0–100):** sobe ao ver ações irritantes, sobe devagar só de ver o Karimbo em cômodo "privado" (o quarto) e cai devagar quando ele se comporta. A reputação na aldeia multiplica o ganho de suspeita (de ×0,6 a ×1,5).
  - 30: **?**, ela olha e comenta.
  - 60: **!**, ela segue o Karimbo e reclama.
  - 100: pega a vassoura e expulsa o Karimbo, que é varrido tile a tile até a porta.
- **Furto não visto** é descoberto depois. Quando o NPC passa a 1 tile de um objeto alterado, reage com atraso ("Cadê meu feijão?!").

### 4.3 Saídas possíveis

| Saída | Como | Consequência lá fora |
| --- | --- | --- |
| Pela porta, numa boa | andar até o tapete da porta | normal |
| Fugindo do mercenário acordado | correr até a porta antes de ser pego | o mercenário sai pela porta 0,8 s depois como inimigo **alertado** no mundo lateral |
| Pego pelo mercenário | coronhada | `player.hit` com dano moderado (nunca letal dentro de casa: vida mínima 1) e Karimbo arremessado para fora rolando |
| Expulso pela moradora | vassourada até a porta | Karimbo tropeça para fora. A porta fica trancada até o próximo checkpoint, e ela diz lá fora: "Só volta com a minha panela!" |

---

## 5. Os dois interiores da primeira entrega

As grades abaixo são **sugestões de leitura e caminho**. O implementador ajusta para ficar bonito e legível, mas mantém a intenção de cada peça.
Convenção: `gx` cresce para a direita-baixo na tela e `gy` para a esquerda-baixo. As paredes visíveis ficam no fundo (linha `gy=-1` à direita e coluna `gx=-1` à esquerda). A porta fica na parede esquerda, perto da frente, para que se veja a selva por ela.

### 5.1 Palafita do vigia (mercenários). Tema: furtividade cômica

- **Habitante:** **Cabo Ronco**, de folga, dormindo na rede com o chapéu no rosto. O sniper do telhado é o inimigo de fora e precisa estar morto para que `safe()` libere a entrada, como já acontece hoje.
- **Clima visual:** bambu escuro, lona verde-oliva, mosquiteiro, lampião pendurado balançando (a luz oscila), frestas no piso mostrando a água do pântano lá embaixo com reflexos animados (as palafitas ficam sobre a água!), vagalumes na janela e luz fria e azulada de fora contra a luz âmbar de dentro.

```
         gx→  0  1  2  3  4  5  6
 parede fundo: [armeiro][ . ][retrato][ . ][janela][ . ]
 gy=0          A  A  .  .  R  R  R      R = rede 3×1 com o Cabo Ronco
 gy=1          .  .  #  .  .  .  C      # = tábua rangente  C = caixa de munição
 gy=2          M  M  #  .  #  .  B      M = mesa 2×1 (rádio, garrafa, gaveta)  B = baú 1×2
 gy=3          .  .  .  #  .  .  B
 gy=4          T  .  #  .  .  O  .      T = mesinha (carta sob a caneca, revista)  O = botas do Cabo
 gy=5          D  .  .  .  .  .  K      D = porta (tapete)  K = cofrinho do soldo
```

| Objeto | Verbos | Estado e recompensa | Observação |
| --- | --- | --- | --- |
| Gaveta da mesa | Abrir → Fuçar | **18 de munição** (mesma regra e mesma chave de `cabin:<x>:drawer`) | range (ruído 10) |
| Baú de emergência | Abrir → Fuçar | **12 de munição** (chave `cabin:<x>:chest`) | tampa pesada (ruído 14) |
| Retrato do capitão | Examinar, Pregar peça (bigode) | fragmento **04 · A concessão do nada** (`lore:debt`) | o bigode é uma travessura |
| Carta sob a caneca | Examinar, Pegar | fragmento **05 · A frequência das avós** (`lore:signal`) | — |
| Rádio | Usar (liga ou desliga), Examinar | piadas do locutor | ligado = ruído contínuo de 6/s. Pode **mascarar** os passos (ruído de passo −50% a 2 tiles do rádio): é uma mecânica! |
| Garrafa "Coragem Líquida" | Examinar, Derrubar | quebra em cacos e fica quebrada | ruído 45. Cacos no chão fazem barulho se pisados |
| Revista de carreira | Examinar, Pegar | piada | — |
| Armeiro | Examinar | dica da oficina do Sivirino | — |
| **Panela de barro apreendida** (em cima da caixa) | Examinar, Pegar | item de missão: **"Operação Panela Fria"** (lore 05) | etiqueta: "equipamento de rádio inimigo" |
| Botas do Cabo | Pregar peça (amarrar cadarços) | se ele acordar, **tropeça** na primeira perseguição (1,5 s caído) | recompensa sistêmica |
| Cofrinho do soldo | Pegar | moedas (economia existente) | — |
| Caixa de munição | Abrir | granada se houver espaço | ruído 12 |
| Rede com o Cabo Ronco | Examinar ("ronca em dó menor"), Balançar (ruído 20, travessura arriscada) | — | — |

**Lista de travessuras da palafita** (selo KARIMBADO! ao completar):
1. Recuperar a panela apreendida.
2. Amarrar os cadarços do Cabo Ronco.
3. Desenhar um bigode no retrato do capitão.
4. Esvaziar a gaveta e o baú.
5. Ler a carta sob a caneca.
6. **Bônus:** sair sem acordar o Cabo.

### 5.2 Casa da Dona Benedita (primeira `villageHome`, x=702). Tema: visita, vergonha e afeto

- **Habitante:** **Dona Benedita**, tecelã. É o `villageResident` em `x-2`, ligado a essa casa. Quando Karimbo entra, ela está "na roça" e volta depois de 45–70 s, ou antes se ouvir barulho alto vindo da casa (a porta tem "ouvido" a 4 tiles para fora).
- **Clima visual:** casa ribeirinha brasileira com parede caiada e **barra azul**, piso de cimento queimado vermelho, chita florida (cortina, toalha de mesa, colcha de retalhos), janela com venezianas verdes e quintal ao sol, fachos de luz com poeira dançando, fogão a lenha soltando fumaça, uma galinha que entra e sai e um gato dormindo na cadeira.

```
         gx→  0  1  2  3  4  5 |6| 7  8  9
 parede fundo: [calendário][janela][ . ][filtro][prateleira] | [espelho][foto][ . ]
 gy=0          F  F  .  .  W  .  |  K  K  .     F = fogão a lenha 2×1 (panela de feijão)  W = filtro de barro
 gy=1          .  .  .  .  .  .  |  K  K  .     K = cama 2×2 com colcha de retalhos
 gy=2          A  .  M  M  .  .  c  .  .  E     A = armário de cozinha  M = mesa 2×1 com bolo  E = cômoda (3 gavetas)
 gy=3          .  .  M  M  .  .  |  .  .  .     c = cortina de chita (passagem)  | = parede interna
 gy=4          V  .  .  .  .  R  |  B  .  P     V = TV de tubo  R = rede da sala  B = baú de enxoval  P = porquinho (cofrinho)
 gy=5          D  .  G  .  .  R  |  .  .  .     D = porta  G = gato na cadeira (galinha anda solta)
```

| Objeto | Verbos | Efeito | Reação da Dona Benedita (se vir) |
| --- | --- | --- | --- |
| Panela de feijão | Comer (3 colheradas) | **+cura** por colherada, usando a vida existente do jogador | "Ô, menino, pede antes!" (+15) |
| Bolo de mandioca | Comer | cura | +10. Se a panela foi devolvida, ela oferece o bolo de graça |
| Filtro de barro | Examinar, Beber (cura pequena), **Derrubar** | quebra: água no chão (poça que espirra) | **+70** e briga: "O FILTRO DA MINHA MÃE!" |
| Armário | Abrir → Fuçar | dentro, a **lata de biscoito… cheia de costura** (piada nacional) | +10 se fuçar na frente dela |
| Lata de biscoito | Abrir | "Era costura. Sempre é costura." Linha e agulha viram item | — |
| TV de tubo com antena de palha de aço | Usar ("tapa técnico") | o chiado vira imagem: novela ou futebol | ela **gosta**: −10 de suspeita, "Agora pegou!" |
| Rede da sala | Deitar (cochilo) | o tempo passa 3× mais rápido e ela pode chegar | se ela chegar e ele estiver na rede: "Folgado!" (+20, comédia) |
| Gato | Fazer carinho, Derrubar da cadeira | o gato ronrona ou foge miando (ruído 25) | carinho: −5 |
| Galinha | Enxotar, Pegar | cacareja (ruído 30) e voa pelo cômodo (partículas de pena) | — |
| Planta na janela | Regar (com a caneca do filtro) | a planta "se anima" (squash) | −10 |
| Cômoda (3 gavetas) | Abrir → Fuçar | meias, cartas antigas (texto de memória da aldeia) e moedas | moedas: **Roubar** +40 |
| Porquinho cofrinho | **Roubar**, **Quebrar** | moedas | +60 / +90. Escolha moral explícita |
| Baú de enxoval | Abrir → Fuçar | fotos antigas: memória de Entre-Raízes (texto extra; **não** é fragmento novo, os 6 de `VILLAGE_LORE` continuam) | +20 |
| Espelho | Usar | Karimbo se admira (foto real do rosto, pose orgulhosa) | — |
| Calendário de farmácia | Examinar | "Ainda em 2009. Ninguém teve coragem de virar." | — |
| Penico debaixo da cama | Examinar | "Melhor não." | — |

**A missão que costura os dois interiores:** Karimbo pega a **panela de barro apreendida** na palafita e a **devolve** à Dona Benedita. Ela comemora, cozinha e oferece um prato que cura muito, e a reputação na aldeia sobe. Lá fora, os moradores comentam ("Foi o Karimbo que trouxe a panela!"). Se Karimbo tiver roubado dela antes, ela perdoa metade ("Panela por porquinho... tá quase quite.").

**Lista de travessuras da casa:**
1. Devolver a panela da Dona Benedita.
2. Dar um tapa técnico na TV.
3. Descobrir o que tem na lata de biscoito.
4. Regar a planta **ou** fazer carinho no gato.
5. Tirar um cochilo na rede.
6. **Bônus:** sair sem ser expulso.

### 5.3 Reputação na aldeia

`villageRep` vai de −100 a +100 e é persistido. Ações boas (devolver, regar, carinho, consertar a TV) aumentam. Roubar e quebrar diminuem.
Efeitos: multiplicador de suspeita nas casas, falas especiais dos moradores lá fora (um banco curto de falas por faixa de reputação) e um presente de reputação alta (bolo para levar = cura). Nada disso bloqueia o caminho crítico.

---

## 6. Direção de arte: "diorama aconchegante que flutua no escuro"

1. **Fundo:** ao entrar, captura-se **uma vez** o quadro atual do jogo num canvas, com desfoque barato (reduzir para 1/8 e ampliar) e escurecimento. O diorama flutua sobre essa "lembrança" desfocada da selva. Custo por quadro: um `drawImage`.
2. **Diorama:** laje do piso com **espessura visível** (lados do bloco desenhados, como em Monument Valley), duas paredes de fundo e as paredes da frente cortadas, como na casa de bonecas do Habbo. A porta na parede esquerda deixa ver luz e selva.
3. **Luz:** camada de luz pré-assada. Lampião ou facho de janela é um sprite radial pré-desenhado; o tremular e o balanço vêm só de offset e alfa. Na qualidade alta, aplicar a camada com `multiply`; na média e na baixa, usar a camada pré-tingida. Fachos de janela com poeira (partículas com orçamento fixo).
4. **Profundidade:** tudo ordenado por `gx+gy` da pegada (desempate por altura). Móvel alto na frente do Karimbo fica com 35% de opacidade e ganha contorno (raio-X), essencial para ler a cena isométrica.
5. **Contorno e paleta:** contorno `#170f2e` como no resto do jogo. Dentro é quente (âmbar e madeira), fora é frio (verde-azulado pela janela e pela porta). Na palafita há oliva militar; na casa, chita vermelha, amarela e verde e barra azul.
6. **Karimbo:** reutilizar `drawKarimbo` (a **foto real do rosto, nunca redesenhar**), em escala reduzida, sem arma (coldre), com `facing` ±1 vindo da direção na tela. Poses extras por transformação: comer (cabeça balança e migalhas), sentar (offset), deitar na rede (rotação e Zzz), carregar item (sprite do item na mão), admirar-se no espelho. A skin equipada é respeitada.
7. **Juice:** squash nos móveis tocados, gaveta deslizando com easing, cacos com física simples no plano isométrico, item voando em arco até o "bolso" do HUD, onomatopeias em quadrinho (NHAC!, CRASH!, TÁÁ!), **anéis de ruído** no chão, "!" e "?" com pulinho, tremor de câmera curto ao quebrar algo e o carimbo **KARIMBADO!** batendo na tela com poeira de tinta.
8. **Entrada:** no mundo lateral Karimbo caminha até a porta, a câmera dá zoom na porta (usar `camera.zoomTarget/focus`) e uma íris fecha. Em seguida o diorama se monta: piso em cascata diagonal (ease-out-back), paredes subindo e móveis caindo com squash. Tudo leva no máximo 1,2 s e qualquer botão pula. A saída é o inverso, em 0,4 s.
9. **UI dentro de casa:** cursor em losango no piso, caminho pontilhado de pegadas até o destino, contorno brilhante no objeto alcançável, menu radial desenhado no canvas (botões de toque com 44 px ou mais), lista de travessuras como um papelzinho preso com fita no canto e bolso com até 6 itens.

---

## 7. Controles (todos os dispositivos)

| Ação | Mouse | Teclado | Controle | Toque |
| --- | --- | --- | --- | --- |
| Andar | clicar no piso (A*) | setas/WASD **relativas à tela**: ↑ = (−1,−1), → = (+1,−1), combinações dão os eixos puros | analógico (8 direções relativas à tela) | tocar no piso |
| Selecionar objeto | passar o mouse | `next`/`prev` alternam alvos ao alcance | LB/RB | tocar no objeto: anda até ele e abre o menu |
| Abrir menu e confirmar | clicar no objeto | `interact` (F), `jump` (Espaço) confirma | A | tocar na fatia |
| Examinar rápido | botão direito | — | Y | toque longo |
| Ponta dos pés | Shift segurado | o mesmo | X segurado | botão "pontinha" |
| Cancelar / sair | Esc (fecha o menu; sem menu, pergunta "Sair pela porta?" e anda até lá) | Esc | B | botão "Sair" |
| Lista de travessuras | clicar no papel | `reload` (R) | Select | tocar no papel |
| Pausa | — | `pause` | Start | botão de pausa |

Tudo passa pela `Input` existente (ações `jump`, `fire`, `interact`, `next`, `prev`, `reload`, `pause` e o movimento). **Não criar escuta de teclado paralela.** Se faltar uma ação (por exemplo, a ponta dos pés), adicioná-la à `Input` de forma consistente, incluindo controle e toque.

---

## 8. Arquitetura proposta

```
src/game/interior/          (simulação pura: sem getArt, sem document; testável em Node)
  iso.ts                    gridToScreen / screenToGrid / depthKey
  grid.ts                   caminhável, A* 8 direções sem cortar quina, linha de visada, distância
  types.ts                  RoomDef, FurnitureDef, VerbDef, ItemDef, NpcDef, InteriorEvent
  sim.ts                    InteriorSim: caminhada, fila de ações, ruído, cérebros dos NPCs, eventos, RNG semeado
  state.ts                  flags compactas por cômodo (bitmask) + ponte para chaves legadas cabin:<x>:<obj>
  session.ts                cola com o World: entrar e sair, recompensas (reusa a lógica de Exploration.inspect), reputação, inimigo alertado ao sair
  rooms/index.ts            mapa id → () => import('./palafitaVigia') | () => import('./casaBenedita')
  rooms/palafitaVigia.ts    dados + roteiro leve (falas, travessuras)
  rooms/casaBenedita.ts
src/art/interior/           (desenho: carregado só junto do interior)
  renderer.ts               InteriorRenderer: assa a sala uma vez, desenha a lista ordenada, câmera de encaixe
  furniture.ts              pintores procedurais dos móveis (com estados: aberto, quebrado, comido)
  actors.ts                 Karimbo (adaptador de drawKarimbo), Cabo Ronco, Dona Benedita, gato, galinha
  fx.ts                     partículas (cacos, migalhas, penas, poeira), anéis de ruído, onomatopeias
  ui.ts                     menu radial, cursor, caminho pontilhado, papel de travessuras, bolso
src/game/game.ts            novo estado 'interior'; step e render despacham para a sessão; import() dinâmico
src/game/exploration.ts     ganha os pontos de villageHome (só a primeira por enquanto) e o campo `interior?: RoomId`
```

**Carregamento sob demanda (requisito):**

- `game.ts` **não importa estaticamente** nada de `interior/` nem de `art/interior/`. Quando o jogador passa a ~600 px de uma porta com interior, chama-se `import()` como pré-busca, sem bloquear. No `F · ENTRAR`, aguarda-se a promessa enquanto a transição já roda.
- A arte da sala é assada ao entrar, no máximo 2 canvases fora da tela do tamanho da sala, e **liberada ao sair** (`width = height = 0`, referências zeradas).
- Os pontos que não migram nesta entrega (cabanas 2 e 3 e as 3 pistas da trilha) continuam no modal `Investigation` atual, sem regressão.

**Persistência:**

- Novo campo opcional em `SaveState`: `interiors?: [string, number][]` (id do cômodo → bitmask de flags), mais `villageRep?: number`. A validação aceita a ausência dos campos (saves antigos), no máximo 16 cômodos, IDs no mesmo padrão e inteiros de 0 a 2³¹−1.
- Mesmo ciclo de vida de `encounters.completed`: entra no snapshot do checkpoint e é gravado ao sair do interior (como hoje no `onChange`). **Não** gravar no meio do interior. Se a página recarregar lá dentro, Karimbo volta do lado de fora da porta.
- As chaves que já existem (`cabin:<x>:drawer`, `:open`, `chest`, `portrait`, `letter`, `lore:*`) **continuam valendo**: quem já pegou a munição no modal antigo não ganha de novo no interior novo, e vice-versa.

---

## 9. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Escopo enorme | Fases com portões de teste. A Fase 1 (motor + palafita jogável e feia) precede qualquer polimento. |
| Ordenação isométrica com móvel grande | Pegadas de até 2×2 e `depthKey` pelo canto frontal. Fatiar móveis compridos se aparecer artefato. |
| Engasgo ao entrar | Pré-busca do módulo por proximidade, assar a arte durante a íris e orçamento medido (<1 quadro perceptível). |
| Quebrar o save | Campos opcionais, validação com limites, testes de ida e volta e de save antigo. |
| Leitura ruim no celular (640×360 lógico) | Câmera de encaixe com folga, zoom suave nas interações, botões de 44 px ou mais, QA em 667×375 e 360×640 (paisagem forçada). |
| Karimbo de lado em diagonal de costas | Aceito: apenas `facing` ±1, como muitos 2.5D. Leve achatamento vertical ao andar "para o fundo". Nunca redesenhar o rosto. |
| Narrador falando por cima | Interior não dispara narração. As falas pendentes seguem a regra existente (`narrator.busy()` e descarte das vencidas). |
| Morrer dentro de casa | Vida mínima 1 dentro do interior. Dano vira expulsão. |

---

## 10. Critério de "uau" (como saber que ficou além do esperado)

- Em **30 s** o jogador ri (a lata de biscoito, o tapa na TV, o Cabo roncando).
- Em **60 s** sente tensão (o Cabo se mexe, a porta range, a Dona Benedita aparece na porta).
- Ao sair, **o mundo lembra** (o mercenário sai atrás, os moradores comentam a panela).
- Quer **voltar** para completar a lista e carimbar o KARIMBADO!.
- O interior roda com o **mesmo frametime** que o mundo lá fora e não deixa nenhum canvas vivo depois de 10 entradas e saídas.
