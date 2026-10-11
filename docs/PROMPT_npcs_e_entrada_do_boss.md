# Tarefa: civis (NPCs) pela cidade + entrada dramática do Felipão com áudio + voz do Karimbo no Nômad

Você vai trabalhar no jogo **KARIMBOLÂNDIA** (run-and-gun 2.5D, navegador, mobile-first em paisagem).
Repositório local: `C:\PROJETOS\Karimbolandia` (GitHub `isaacbraym/Karimbolandia`, branch `main`).
O jogo é publicado automaticamente no GitHub Pages a cada push em `main`:
https://isaacbraym.github.io/Karimbolandia/

Leia o `README.md` antes de começar. Trabalhe de forma autônoma, sem pedir aprovação para cada passo.
No fim, rode os testes, gere o build e faça commit + push.

---

## 1. Como o projeto funciona (leia antes de mexer)

- **Stack:** TypeScript + Vite + Canvas 2D puro + WebAudio procedural. Não há biblioteca de jogo nem de áudio; **não adicione nenhuma**.
  - `npm run dev`: servidor em http://localhost:5173.
  - `npx tsc --noEmit`: checagem de tipos.
  - `npx vitest run`: testes, hoje 50, todos passando.
  - `npm run build`: build.
- **Arte:** quase tudo é procedural e **pré-desenhado ("baked") uma vez no carregamento**, com os helpers de `src/art/kit.ts` (`bake`, `drawSpr`, `glowSprite`, `softDot`). Exemplos de personagem: `src/art/soldiers.ts` (partes baked + rig animado por transformações) e `src/art/karimbo.ts`.
  - Contorno escuro `#170f2e`, paleta neon roxo/magenta/ciano (`src/art/palette.ts`).
  - Os rostos do Karimbo e do Felipão são **fotos reais** (`public/assets/img`). **Não use fotos de nenhuma outra pessoa real.** Os civis devem ser desenhados (cartoon), no mesmo estilo dos soldados.
- **Arquivos principais:**

  | Arquivo | O que faz |
  | --- | --- |
  | `src/game/world.ts` | Mundo, atualização e desenho, hooks para o `Game`. |
  | `src/game/director.ts` | Arenas, gatilhos, cinemáticas, checkpoints, música, Nômad, `startBoss`. |
  | `src/game/game.ts` | Estados do jogo (`playing`, `paused`, `comic`, `continue`…), render, pós-processamento, resolução dinâmica. |
  | `src/game/comic.ts` | Filminho de HQ atual antes do chefe (`BossComic`, `COMIC_LEN = 8.6`). |
  | `src/game/enemies/felipao.ts` + `src/art/felipao.ts` | O chefe: estado `enter` cai do céu (`hover = 520`), arroto, animações. |
  | `src/core/audio.ts` | `AudioEngine`: `audio.ctx`, `master`, `sfxBus`, `musicBus`, `setDuck(v)`, `init()` (desbloqueio por gesto), `play(name)`. |
  | `src/core/music.ts` | Música em camadas: `music.play(theme, mix)`, `music.setMix()`, `music.stop(fade)`, `MIX`. |
  | `src/game/level/sections*.ts` + `src/game/level/extras.ts` | Montagem da fase (DSL `LevelBuilder`, coordenadas em tiles). |
  | `src/game/level/cut.ts` | **Importante:** a fase é montada em coordenadas ORIGINAIS e depois `applyCuts()` remove 195 tiles. Tudo que você posicionar nas seções usa coordenadas originais. Se criar um tipo novo de entidade na fase, **inclua-o em `applyCuts()`** (filtrar o que cai no corte + `mapPx`). Nos testes, converta posições com `mapTile` (importado como `M`). |

- **Simulação headless:** os testes rodam o mundo em Node, sem canvas. **Código de simulação (`update`) nunca pode chamar `getArt()` nem usar `document`**; só o `draw` usa arte. Hooks do `World` (`w.hooks.*`) são opcionais e nos testes ficam vazios.
- **QA no navegador:**
  - Parâmetros de URL: `?autoplay=1&god=1&nopause=1&qa=1&tp=<tile>`. O `qa=1` expõe `window.__kg = { game, world, art }`, e `tp` usa coordenada já cortada.
  - Se o navegador embutido do seu ambiente pausar o `requestAnimationFrame`, avance quadros na mão: `G.step(w, 1/60); G.render(1/60)`.
  - **Não use `getImageData` para medir desempenho:** ele joga o canvas para software e invalida a medição.

## 2. Regras de ouro (critério de aceite)

1. **Mesmo padrão visual:** mesma paleta, contorno, escala e acabamento. Civis na altura dos soldados (`SOLDIER_SCALE = 1.7`, cerca da altura do Karimbo), com animação por rig como os soldados (inclinação, respiração, peso).
2. **Zero perda de desempenho.** O jogo acabou de passar por otimização pesada. Mantenha:
   - **Sem criar canvas, gradiente ou string por quadro.** Tudo que é imagem é baked no carregamento ou com cache (veja o cache de texto com orçamento por quadro em `src/game/hud.ts`: `textBudget`, e os popups em `src/game/fx.ts`).
   - **Descarte por câmera:** não atualize nem desenhe NPC fora da tela (use o padrão de `world.ts`, ex.: `cam.visible(x, y, margem)` e "longe da câmera congela").
   - **Sem alocação por quadro** (sem `filter`/`map`/spread no laço quente) e sem `shadowBlur`/`ctx.filter`.
   - **Cache de texto:** balões de fala com texto pré-desenhado (um canvas por frase, criado no carregamento ou sob orçamento de 1–2 por quadro), nunca `strokeText` por quadro.
   - **Orçamento:** o custo por quadro dos NPCs visíveis deve ser desprezível (alvo < 0,3 ms de CPU com todos os da tela).
3. **Não quebre nada:** `npx tsc --noEmit` limpo e `npx vitest run` com todos os testes passando, mais os testes novos que você criar.
4. Comentários e textos do jogo em **português do Brasil**, no estilo dos comentários existentes.

---

## 3. Tarefa A: civis (NPCs) pela cidade

Coloque **civis em alguns trechos do chão da cidade** (nunca em plataformas, nunca dentro de arenas de combate, nunca sobre buracos), reagindo à chegada do Karimbo.

- **Quantidade e lugares:** cerca de 10 a 16 civis, distribuídos em 5 a 7 pontos da fase.
  - **Onde colocar:** na rua inicial, perto de checkpoints, depois das zonas de guerra (comemorando) e antes da torre ou do telhado final, com gente pedindo ajuda.
  - **Onde não colocar:** no trecho obrigatório do Nômad (hordas) nem na arena do chefe.
  - **Como registrar:** crie no builder um método `b.civilian(x, row, opts)` e um array novo em `LevelData` (ex.: `civilians`), lembrando de `applyCuts()`.
- **Nenhum civil repetido:** cada civil é gerado por **semente** com combinação única de:
  - tom de pele;
  - cabelo (curto, longo, cacheado, coque, careca, boné/chapéu) e cor do cabelo;
  - roupa (camiseta, regata, jaqueta, vestido, macacão) e cores;
  - calça/saia/bermuda e tênis;
  - acessórios (óculos, mochila, fone, bolsa, celular na mão);
  - porte (alto/baixo, magro/forte, criança/idoso).

  Gere as partes baked **uma vez no carregamento** (poucas variantes, só as que existem na fase). Garanta por teste que não há dois civis com a mesma combinação.
- **Comportamentos (animados, com rig):**
  - **Comemorando:** pula, braços para cima, punho no ar quando o Karimbo chega perto.
  - **Pedindo ajuda:** acena com os dois braços, alguns ajoelhados ou abaixados.
  - **Correndo:** foge num trecho curto do chão quando há combate perto e depois se esconde atrás de algo ou para.
  - **Com medo:** agachado, tremendo, olhando para os lados.

  Eles não são alvos: tiros e explosões não os atingem. Não são sólidos e não bloqueiam o jogador nem os inimigos.
- **Falas (balões de HQ):**
  - **Quando falam:** quando o Karimbo chega a cerca de 260 px, o civil mais próximo fala uma frase num balão no estilo dos balões de `comic.ts`. Uma fala por vez na tela, com recarga por civil e sem repetir a mesma frase seguida.
  - **Direção do olhar:** o civil vira para o Karimbo.
  - **Frases mínimas:**
    - "O Karimbo chegou! Estamos salvos!"
    - "Karimbo, nos ajude!"
    - "Precisamos de você, Karimbo!"
    - "Karimbo, resgate nossa princesa Júlia!"
    - "Karimbo, a Júlia precisa de você!"
    - "Corre, ele está vindo!"
    - "Vai, Karimbo! Acaba com eles!"
    - "Eles levaram a Júlia pro telhado!"
    - "Que orelhas incríveis!"
    - "Cuidado com o Felipão!"
  - **Por comportamento:** comemorando usa as frases de vitória, pedindo ajuda usa as de pedido.
  - **Júlia:** a "princesa Júlia" existe **só nas falas**. Não desenhe uma personagem Júlia.
- **Detalhes de vida:** sombra no chão (como os outros personagens, `softDot` baked), poeira leve ao correr. No máximo um balão e poucas partículas por civil.
- **Testes a adicionar:**
  - civis sobre chão sólido, não em plataforma one-way, fora de arenas e fora de buracos;
  - nenhum civil fora da fase depois dos cortes;
  - combinações de aparência únicas;
  - a simulação headless roda com civis sem chamar arte.

## 4. Tarefa B: entrada dramática do Felipão (15 s, com áudio)

Hoje, ao entrar na arena do chefe, `Director.startBoss()` chama `w.hooks.onBossComic()`. Isso põe o `Game` no estado `'comic'` (mundo congelado) e toca o `BossComic` (8,6 s). Depois o Felipão cai do céu (`w.after(0.8, …)`, estado `enter`) e a luta começa. Isso acontece só na primeira vez da partida (`world.comicShown`).

Transforme isso numa **entrada de cerca de 15 s, guiada pelo áudio** `audio boss1.mp3` (15,7 s). O áudio **abafa a música do jogo** do começo ao fim da entrada:

1. **t = 0 s:** o áudio começa e a música do jogo é abafada (fade rápido do `musicBus` ou `music.stop`). O jogador fica travado.
2. **0 → 4 s, suspense:** o Felipão ainda NÃO aparece. Tela escurece, céu e luzes piscam, tremor crescente, sombra enorme passando, poeira caindo, holofotes procurando, faixa de "ALERTA". Use o que já existe: `w.fx.addShake`, `addFlash`, partículas e luzes.
3. **≈ 4 s, revelação:** o Felipão aparece como um chefe poderoso, por exemplo:
   - cai do céu e o chão racha no pouso;
   - onda de choque e flash;
   - câmera em zoom lento nele;
   - aura e reator do peito acendendo;
   - canhões se armando;
   - título "FELIPÃO — O Chefe da Legião".

   Reaproveite os estados e animações de `felipao.ts` (`enter`, `jig`, `rage`, `doBurp`) e o enquadramento de câmera do `Director` (`cine 'bossIntro'`, `camera.focus/zoomTarget`).
4. **Cena da HQ (já existe):** depois da revelação, a cena de HQ deles se encarando. **No momento em que as fotos dos dois aparecem**, toca `audio 1 karimbo.ogg` (3,7 s).
   - Ajuste a duração da HQ para tudo caber nos cerca de 15 s do áudio do chefe.
   - O balão do Felipão continua ("Vou te ensinar a jogar de verdade, Karimbo!").
   - Mantenha o close final dos olhos.
5. **≈ 15,7 s:** termina o áudio do chefe, a música de chefe (`boss1`) volta e a luta começa.

Sobre pular e repetir:
- **Pular:** toque, tiro ou pulo continua pulando a sequência inteira; nesse caso corte os áudios com fade curto e vá direto para a luta.
- **Primeira vez:** só na primeira vez da partida, como hoje. Ao continuar depois de morrer ou voltar ao checkpoint, nada de entrada longa.

Pode reorganizar `comic.ts`, `director.ts` e `game.ts` como achar melhor. O resultado precisa:
- ficar sincronizado com o áudio;
- não deixar o mundo andar "por baixo" de forma errada, ou seja, inimigos não podem atacar durante a entrada;
- continuar funcionando sem áudio (headless/testes e quem está sem som): a sequência roda por tempo.

## 5. Tarefa C: voz do Karimbo ao encontrar o Nômad

Sempre que o Karimbo **encontra o Nômad**, toca `audio 2 karimbo.ogg` (1,5 s):
- na apresentação do Nômad na garagem (gatilho `nomadMeet`, cinemática `kind: 'nomad'` no `Director`), no momento em que o Nômad liga (`c.stage = 1`, cerca de 0,7 s);
- quando o Nômad de apoio pousa (`updateSupport`, quando `s.ready` vira `true`).

Não toque ao remontar no checkpoint nem em cada embarque.

## 6. Áudio: como integrar (sem libs)

- **Arquivos de origem** (máquina do usuário):
  - `C:\Users\Dell\Downloads\audio boss1.mp3` (MP3 estéreo, 44,1 kHz, 15,7 s, ~470 KB)
  - `C:\Users\Dell\Downloads\audio 1 karimbo.ogg` (Opus mono, 3,7 s)
  - `C:\Users\Dell\Downloads\audio 2 karimbo.ogg` (Opus mono, 1,5 s)

  Se você não tiver acesso a essa pasta, peça ao usuário para colocar os arquivos em `public/assets/audio/`.
- **Copie e converta** para `public/assets/audio/` com nomes sem espaço (ex.: `boss_intro.mp3`, `karimbo_encara.mp3`, `karimbo_nomad.mp3`).
  - **Por que converter:** o Safari do iPhone tem suporte irregular a Opus em `.ogg`. Converta os dois `.ogg` para MP3 ou AAC (`.m4a`) com o ffmpeg, que existe em `C:\ffmpeg\bin\ffmpeg.exe`.
  - **Exemplo:** `ffmpeg -i "audio 1 karimbo.ogg" -c:a libmp3lame -b:a 128k karimbo_encara.mp3`.
  - **Tamanho:** mantenha os arquivos pequenos.
- **Carregamento:** baixe com `fetch` e decodifique com `audio.ctx.decodeAudioData` **uma vez**, durante a tela de carregamento (barra de progresso de `Menus.setLoading`). Respeite o `base` do Vite (`import.meta.env.BASE_URL`, caminhos relativos), porque o site roda em `/Karimbolandia/`.
- **Reprodução:**
  - Crie no `AudioEngine` um barramento de voz/cinema (`GainNode` ligado ao `master`, respeitando o volume de efeitos do jogador) e um método do tipo `playClip(name, { vol, fadeIn }) → handle` com `stop(fade)`.
  - Tudo continua passando pelo `audio.init()` (desbloqueio por gesto) e não pode quebrar se o contexto ainda não existir.
- **Abafar a música:** durante a entrada, baixe o `musicBus` (rampa suave) ou pare a música e restaure no fim. Os efeitos da cena continuam audíveis.
- **Service worker e cache:** o `sw.js` é gerado em `vite.config.ts` (`pwaPlugin`). Os arquivos em `dist` entram no pré-cache automaticamente, então não precisa mexer. O aviso de "NOVA VERSÃO" (`src/core/update.ts`) já cuida de os jogadores receberem a versão nova.

## 7. Verificação antes de entregar

- `npx tsc --noEmit` limpo e `npx vitest run` todo verde, incluindo os testes novos dos civis e um teste de que a entrada do chefe roda até o fim sem áudio e termina na luta.
- **No navegador:**
  - os civis aparecem no chão, com aparências diferentes, falam ao se aproximar, comemoram, pedem ajuda e correm;
  - a entrada do Felipão dura cerca de 15 s, com suspense nos 4 s iniciais, revelação, HQ com a voz do Karimbo no momento das fotos e a luta em seguida;
  - a voz do Nômad toca na garagem e no Nômad de apoio;
  - pular a entrada funciona.
- **Desempenho:** compare o tempo de CPU por quadro antes e depois numa rua com vários civis (envolva `G.render` com `performance.now()`). Não pode piorar de forma perceptível, nem criar canvas por quadro.
- `npm run build` sem erros. Commit com mensagem descritiva em português e `git push origin main`. Depois confirme que o GitHub Actions "Deploy GitHub Pages" terminou com sucesso.
