# KARIMBOLÂNDIA

Run-and-gun **2.5D moderno** que roda direto no navegador (celular e PC) — uma fase grande e completa numa cidade futurista em guerra, com **Karimbo** (o herói de orelhas gigantes), o robô **Nômad** e o chefe **Felipão**.

▶ **Jogue:** https://isaacbraym.github.io/Karimbolandia/

## Como jogar

| Ação | Teclado / mouse | Celular | Gamepad |
|---|---|---|---|
| Mover | `A` `D` / `←` `→` | joystick (esquerda) | analógico esq. |
| Mirar | mouse (ou `W` p/ cima) | joystick p/ cima/diagonal | analógico dir. |
| Pular | `ESPAÇO` | **PULO** | A |
| **EAR GLIDE** (planar) | pular de novo no ar e segurar | tocar PULO de novo no ar | idem |
| Atirar | clique / `J` | **FOGO** | X / RT |
| Granada | `G` / botão direito | botão granada | B |
| Trocar arma | `Q` `E` / roda | botão de troca | LB / RB |
| Especial (Nômad) | `SHIFT` | botão ⚡ (só pilotando) | Y |
| Agachar / engatinhar | `S` / `↓` | joystick p/ baixo | analógico p/ baixo |
| Pausa | `ESC` | botão de pausa | Start |

* Multitouch real: dá para mover, pular e atirar ao mesmo tempo.
* Em retrato o jogo pede para girar o celular; ao tocar em JOGAR ele tenta fullscreen + `orientation.lock('landscape')`.
* O Nômad é encontrado numa garagem: **pule em cima dele** para pilotá-lo. Ele tem barra de vida própria; ao chegar a zero o Karimbo é ejetado e segue a pé.
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
