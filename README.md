# KARIMBOLÂNDIA

Run-and-gun **2.5D moderno** que roda direto no navegador (celular e PC) — uma fase grande e completa numa cidade futurista em guerra, com **Karimbo** (o herói de orelhas gigantes), o robô **Nômad** e o chefe **Felipão**.

▶ **Jogue:** https://isaacbraym.github.io/Karimbolandia/

## Como jogar

| Ação | Teclado / mouse | Celular | Gamepad |
|---|---|---|---|
| Mover | `A` `D` / `←` `→` | joystick (esquerda) | analógico esq. |
| Mirar | mouse (ou `W` p/ cima) | **arrastar o botão FOGO** (analógico de tiro 360°) ou joystick p/ cima/diagonal | analógico dir. |
| Pular | `ESPAÇO` | **PULO** | A |
| **EAR GLIDE** (planar) | pular de novo no ar e segurar | tocar PULO de novo no ar | idem |
| Atirar | clique / `J` | **FOGO** (segurar; arraste para mirar) | X / RT |
| Granada | `G` / botão direito | botão granada | B |
| Trocar arma | `Q` `E` / roda | botão de troca | LB / RB |
| Especial (Nômad) | `SHIFT` | botão ⚡ (só pilotando) | Y |
| Agachar / engatinhar | `S` / `↓` | joystick p/ baixo | analógico p/ baixo |
| Pausa | `ESC` | botão de pausa | Start |

* **Deslizar:** agache correndo (`S`/`↓` ou joystick p/ baixo) para deslizar por baixo dos tiros.
* **Combo:** abates em sequência (janela de 3 s) multiplicam os pontos até x5.
* **Vida:** o Karimbo aguenta 40% a mais (140). Ao chegar no **Felipão** você ganha **+3 vidas**.
* **Nômad:** é um robô grande — caixas, barris, barricadas e carros **quebram só de encostar/pousar** (sem atirar) e cair em cima de inimigos os esmaga. A cabeça do Karimbo fica em destaque na cabine.
* **Câmera dinâmica:** na exploração fica mais perto do personagem; se alguém atira de fora da tela ela abre o zoom e desloca o quadro para mostrar o atirador.
* **Felipão** anda arrotando como um monstro, e antes do chão desabar os blocos **piscam por 2 s** com contagem regressiva.
* **Controles de toque modernos:** botões de vidro com áreas de toque maiores, ícone da arma atual e munição no botão de troca, contador de granadas, anel de recarga do avanço e **vibração** (celular e gamepad; desliga nas configurações).
* **Gráficos:** bloom (brilho neon real), chuva com respingos, relâmpagos com trovão, gradação de cor cinematográfica, granulação de filme e distorção de impacto ao levar dano (ajustados pela qualidade LOW/MEDIUM/HIGH).
* **Desempenho em celulares modestos (sem cortar efeitos):** resolução dinâmica (baixa a resolução interna em passos de 10% só quando o quadro passa de ~21 ms e volta sozinha), cenário em blocos pré-montados (≈300 desenhos de tiles por quadro → ≈12–24), decorações estáticas e textos do HUD/popups pré-desenhados, chuva em lote, bloom com uma passada de tela cheia e nada desenhado fora da tela.
* **Soldados na altura do Karimbo:** o tiro reto sai na altura do peito — em pé você leva, agachado passa por cima.
* **Zonas de guerra:** contador no topo ("FALTAM N INIMIGOS" + onda atual) e setas vermelhas nas bordas da tela apontando os inimigos que estão fora de vista (estilo GTA).
* **Soldado de escudo:** o escudo tem vida própria (barrinha azul em cima dele); tiros de frente e explosões gastam, e quando zera ele quebra de vez.
* **Nômad:** 450 de vida (+50%). **Granada:** área de explosão ~50% maior, com onda de choque e anel de fogo do tamanho real do dano.
* **Alturas ao alcance do pulo:** plataformas que ficavam 4–5 tiles acima do chão desceram para 3 (com o que estava em cima delas), paredes de 4 tiles ganharam um degrau e o pulo ficou ~7% mais alto.
* **Escopeta com coice:** atirando para a frente o Karimbo dá um pulinho para trás; atirando para baixo ele é jogado para cima (no ar vira um impulso extra).
* **Armas com munição limitada:** pistola (∞), metralhadora, shotgun, lança-granadas e canhão de plasma — varie as armas! Caixas e inimigos soltam munição.
* **3 vidas por fase** (fichas de fliperama): ao morrer aparece **CONTINUAR?** com contagem regressiva de 10 s; confirmar gasta 1 vida e você continua *de onde parou* (inimigos, arena e chefe seguem como estavam). Sem confirmar, volta ao último checkpoint. Sem vidas: **FIM DE JOGO** (recomeçar a fase ou menu).
* **Vida com critério:** corações fixos após combates duros, caixas sorteadas (nem toda caixa tem item) e drops que aparecem mais quando você está ferido.
* **Nômad de apoio:** depois de ~1,5 min de jogo aparece uma entrega aérea de um segundo Nômad, emprestado por 50 s — pule em cima para pilotá-lo.
* Multitouch real: dá para mover, pular e atirar ao mesmo tempo.
* No celular em retrato o jogo **já abre deitado** (a tela gira 90° sozinha); é só virar o aparelho de lado e ele preenche a tela. Ao tocar em JOGAR ele também tenta fullscreen + `orientation.lock('landscape')`.
* Câmera 25|75: o personagem fica a ~25% da borda de trás e você vê 75% do que vem à frente (inverte suavemente ao andar para trás).
* O Nômad é **obrigatório**: o portão da garagem só abre depois que você **pula em cima dele** para pilotá-lo. No trecho de guerra seguinte chegam hordas contínuas (frenesi): cada abate recupera um pouco do Nômad e sequências de 5 dão bônus. Ele tem barra de vida própria; ao chegar a zero o Karimbo é ejetado e segue a pé.
* Existe uma mecânica secreta no avanço do Nômad. Só os atentos vão descobrir. 😉

## A fase

14 seções (~15–25 min): entrada na cidade → primeiros soldados → verticalidade e glide → primeiro segredo → grande combate (arena com ondas) → **encontro com o Nômad** → power trip → avanço → exploração → área de guerra (arena) → passagem estreita (saída do Nômad) → subida final → preparação → **Felipão** (3 fases, piso que desaba).

Coletáveis: fichas, **10 emblemas**, **3 Orelhas Douradas** (muito secretas), caixas com munição/armas/vida/granadas. Cenário destrutível (caminho crítico sempre indestrutível), 8 checkpoints, reiniciar fase, pontuação e ranking S/A/B/C.

## Identidade dos personagens (arte)

Karimbo e Felipão **são as pessoas das fotos**: os recortes vêm dos arquivos canônicos (`Karimboprotagonista.png`, `Boss_Felipe.png`) e o rosto **não é redesenhado** — só recortado, com orelhas ampliadas (Karimbo) e uma leve projeção cilíndrica para dar perspectiva lateral. O Nômad (`Nomad_RoboMontaria.webp`) é recortado em camadas (torre, chassi e esfera que gira de verdade). Todo o resto (cenário, inimigos, armas, HUD, efeitos) é arte procedural gerada por código, assim como **todos os sons e a música** (WebAudio, em camadas dinâmicas).

Pipeline de recorte (opcional; os resultados estão versionados em `public/assets/img`):

```bash
python -m venv .venv && . .venv/bin/activate   # ou .venv\Scripts\activate
pip install opencv-python-headless numpy pillow
python tools/cutout_karimbo.py  tools/_work
python tools/cutout_felipao.py  tools/_work
python tools/cutout_nomad.py    tools/_work
python tools/split_nomad.py     tools/_work
python tools/finalize_assets.py tools/_work
python tools/make_icons.py
```

## Desenvolvimento

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run check      # typecheck + testes
npm run build      # build de produção em dist/
npm run preview
```

* **Stack:** TypeScript + Vite + Canvas 2D + WebAudio (sem bibliotecas de jogo — bundle de ~280 kB). Escolhido por estabilidade no mobile, simulação testável sem navegador e deploy trivial.
* **Base path:** `base: './'` — funciona em `/Karimbolandia/` (GitHub Pages) ou em qualquer subpasta. PWA com service worker que pré-cacheia o build (funciona offline depois de carregado).
* **Qualidade:** presets LOW/MEDIUM/HIGH (resolução interna, partículas) + modo automático que reduz sozinho se o FPS cair.

### Arquitetura

```
src/core      input unificado (teclado/mouse/gamepad/toque), áudio e música procedurais, storage, math
src/art       arte procedural (tiles, props, inimigos, parallax), fotos recortadas (Karimbo/Felipão/Nômad)
src/game      mundo, jogador, inimigos, chefe, câmera, HUD, diretor (arenas, cinemáticas, checkpoints)
src/game/level  DSL de fase (builder), 14 seções e validador de alcançabilidade
src/ui        menus (DOM) e controles de toque (Pointer Events)
tests         validação da fase + simulações headless com bot
```

### Testes

`npm test` roda: integridade da fase; **alcançabilidade** com a física real (o caminho crítico, checkpoints, emblemas, orelhas douradas e o trecho do Nômad são provadamente atravessáveis; o buraco do glide *exige* o glide); e **simulações headless** com um bot (todas as seções, arenas, Nômad + avanço duplo, ejeção, o chefe até o fim da fase, reinício e respawn).

Ferramentas de depuração via URL: `?debug=sprites` (arte), `?debug=map` (mapa da fase), `?autoplay=1&god=1&arms=1&tp=<tile>` (QA), `?touch=1` (forçar controles de toque).

## Créditos

Feito com TypeScript, Vite e muito carinho. Fontes Lilita One e Rajdhani (SIL OFL). Inspirado no *ritmo* dos clássicos run-and-gun — nenhum sprite, música, mapa ou marca de terceiros foi usado.
