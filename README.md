# KARIMBOLÂNDIA

Run-and-gun **2.5D moderno** que roda direto no navegador (celular e PC) — uma fase grande e completa numa cidade futurista em guerra, com **Karimbo** (o herói de orelhas gigantes), o robô **Nômad** e o chefe **Felipão**.

▶ **Jogue v5:** https://isaacbraym.github.io/Karimbolandia/v5/

O endereço anterior continua funcionando. A v5 aproveita o progresso já salvo no mesmo navegador e aparelho.

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
* **Vida:** o Karimbo tem 119 de vida. Ao chegar no **Felipão** você ganha **+3 vidas**.
* **Nômad:** é um robô grande — caixas, barris, barricadas e carros **quebram só de encostar/pousar** (sem atirar) e cair em cima de inimigos os esmaga. A cabeça do Karimbo fica em destaque na cabine.
* **Câmera dinâmica:** na exploração fica mais perto do personagem; se alguém atira de fora da tela ela abre o zoom e desloca o quadro para mostrar o atirador.
* **Felipão** anda arrotando como um monstro, e antes do chão desabar os blocos **piscam por 2 s** com contagem regressiva.
* **Controles de toque modernos:** botões de vidro com áreas de toque maiores, ícone da arma atual e munição no botão de troca, contador de granadas, anel de recarga do avanço e **vibração** (celular e gamepad; desliga nas configurações).
* **Gráficos:** bloom (brilho neon real), chuva com respingos, relâmpagos com trovão, gradação de cor cinematográfica, granulação de filme e distorção de impacto ao levar dano (ajustados pela qualidade LOW/MEDIUM/HIGH).
* **Sem travadinhas no Nômad e no Felipão:** os números do HUD que mudam o tempo todo (munição, pontos, relógio, combo) reaproveitam uma imagem fixa por campo em vez de criar uma nova a cada valor; decorações idênticas (postes, bancos, hidrantes…) compartilham a mesma imagem pronta, então nada é recriado quando o Nômad atravessa a cidade correndo; brilhos dos buracos, barreiras, esfera do Nômad e vinheta de perigo são pré-desenhados; as máscaras brancas de dano do Felipão/Nômad são geradas no carregamento; inimigos das hordas que ficaram para trás saem do mundo; e a resolução dinâmica não recria mais os textos do HUD a cada ajuste.
* **Desempenho em celulares modestos (sem cortar efeitos):** resolução dinâmica (baixa a resolução interna em passos de 10% só quando o quadro passa de ~21 ms e volta sozinha), cenário em blocos pré-montados (≈300 desenhos de tiles por quadro → ≈12–24), decorações estáticas e textos do HUD/popups pré-desenhados, chuva em lote, bloom com uma passada de tela cheia e nada desenhado fora da tela.
* **Soldados na altura do Karimbo:** o tiro reto sai na altura do peito — em pé você leva, agachado passa por cima.
* **Zonas de guerra:** contador no topo ("FALTAM N INIMIGOS" + onda atual) e setas vermelhas nas bordas da tela apontando os inimigos que estão fora de vista (estilo GTA).
* **Soldado de escudo:** o escudo tem vida própria (barrinha azul em cima dele); tiros de frente e explosões gastam, e quando zera ele quebra de vez.
* **Nômad:** 450 de vida (+50%). **Granada:** área de explosão ~50% maior, com onda de choque e anel de fogo do tamanho real do dano.
* **Alturas ao alcance do pulo:** plataformas que ficavam 4–5 tiles acima do chão desceram para 3 (com o que estava em cima delas), paredes de 4 tiles ganharam um degrau e o pulo ficou ~7% mais alto.
* **Escopeta com coice:** atirando para a frente o Karimbo dá um pulinho para trás (~45 px); atirando para baixo ele é jogado para cima (no ar vira um impulso extra).
* **Cidade destrutível:** o Nômad destrói carros estacionados, lixeiras, hidrantes, bancos, caçambas, máquinas de venda, árvores e postes só de passar por cima (e atropela inimigos em movimento). Explosões também destroem o cenário. Carros explodem e viram carcaças em chamas; hidrantes viram **gêiseres que lançam o Karimbo para cima**; lixeiras espalham papel; máquinas de venda soltam fichas.
* **Faquinha de cortar manteiga:** com inimigo colado, o tiro vira um golpe de faca (como no Metal Slug) — a arma some, a faquinha aparece na mão e corta de cima para baixo e de baixo para cima, alternando. Derruba soldados e robôs pequenos num golpe só, pega todos que estiverem encostados à frente, não gasta munição e atravessa escudos.
* **ORELHADA:** no ar, baixo + pulo faz o Karimbo mergulhar de orelhas abertas; ao tocar o chão solta uma onda de choque que arremessa inimigos e quebra caixas.
* **Novo inimigo — Rolo-Bomba:** esfera com espinhos que rola até você apitando cada vez mais rápido e explode ao encostar; se abatida antes, estoura e fere os inimigos em volta.
* **Felipão mais vivo:** barriga que quica com mola a cada passo e tiro, respiração, tronco que joga para trás ao arrotar, andar mais pesado e aura de fúria com vapor na fase 3.
* **Imersão:** chão molhado com poças refletindo o neon na chuva, respingos nos passos e na esfera do Nômad, clarão dos tiros iluminando o cenário e câmera lenta no último abate de cada zona de guerra.
* **Menu:** botão VOLTAR fixo no canto superior esquerdo dos painéis.
* **Animação (rig com molas):** o Karimbo inclina ao acelerar/frear, estica no ar e achata ao pousar, a cabeça segue o corpo com atraso (follow-through), as orelhas balançam como mola (sobem na queda, quicam no pouso, tremem parado), respira e olha em volta quando parado, achata na virada, tem poses próprias de deslize, ORELHADA e golpe em arco, e o tronco recua a cada disparo. Soldados inclinam ao correr, respiram, erguem a arma suavemente e recuam ao atirar; **todos os inimigos** dão um tranco na direção do golpe ao levar dano e surgem com um "pop"; o Nômad tem suspensão (afunda no pouso, estica no pulo e no avanço, o piloto balança junto).
* **Buracos sinalizados:** os fossos sem fundo soltam fumaça, brasas incandescentes e um brilho de calor alaranjado que sobe acima da borda — dá para ver o perigo de longe.
* **Entrada dramática do Felipão (~20 s, com áudio):** na primeira vez da partida, o áudio da entrada abafa a música e guia a cena — 4 s de suspense (tela escurece, céu e luzes piscam, tremor crescente, sombra enorme passando, poeira caindo, holofotes procurando e faixa de **ALERTA**), depois ele **cai do céu**, o chão racha, onda de choque, zoom lento com reator e canhões acendendo e o título *"FELIPÃO — O Chefe da Legião"*. Em seguida vem a **HQ** dos dois se encarando: o balão do Felipão acompanha o resto do áudio dele e, **assim que ele termina, entra a voz do Karimbo** ("PODE VIR, FELIPÃO!" e o close dos olhos) — as duas vozes nunca tocam juntas. Quando a voz acaba, a música do chefe volta e a luta começa. Toque/tiro/pulo pula tudo; ao continuar ou voltar ao checkpoint a entrada é curta. Sem som (ou nos testes), a cena roda por tempo.
* **Narrador da história (28 falas, ~4 min):** abertura de cinema na primeira partida (câmera passeia pelas ruínas e volta ao herói no ritmo de *"O homem. A lenda. As orelhas... Karimbo!"*) e falas engraçadas nos momentos certos — primeiro voo com as orelhas, ORELHADA, segredos, emboscadas, Nômad, abismo, túnel, torre, telhado, o ALERTA antes do Felipão, as fases dele e a vitória. Uma fala por vez, cada uma no máximo uma vez por partida; se a cena passou, a fala é descartada (nada atrasado). **Nunca cruza com as vozes dos personagens:** a apresentação do Nômad, o pouso do Nômad de apoio e a entrada do Felipão esperam o narrador terminar, e ele não começa quando uma dessas cenas está chegando. A tela de resultados espera a fala da vitória. A música abaixa um pouco enquanto ele fala. Leve: as falas ficam comprimidas (~1,3 MB) e cada uma só é decodificada pouco antes de tocar. Dá para desligar em Configurações → "Narrador da história".
* **Moradores da cidade:** 16 civis desenhados (cartoon, rig animado como os soldados), cada um com aparência única gerada por semente (pele, cabelo, roupa, calça/saia/bermuda, tênis, acessórios e porte — criança, idoso, alto, forte…). Eles **comemoram** com pulinhos e punho no ar, **pedem ajuda** acenando (alguns ajoelhados), **fogem** quando o tiroteio chega e se escondem, ou ficam **encolhidos de medo** olhando para os lados. O mais próximo vira para o Karimbo e fala num balão de HQ (*"O Karimbo chegou! Estamos salvos!"*, *"Karimbo, resgate nossa princesa Júlia!"*, *"Que orelhas incríveis!"*…). Não são alvos nem obstáculos, e fora da tela ficam congelados (custo ≈ 0,1 ms por quadro).
* **Voz do Karimbo ao encontrar o Nômad:** na apresentação da garagem (quando o Nômad liga) e quando o Nômad de apoio pousa.
* **Caminho ~15% mais curto até o chefe:** 195 tiles de corredores repetitivos foram removidos (sem perder emblemas, segredos, checkpoints, arenas nem cenas).
* **Sempre a versão mais nova:** o jogo confere a versão publicada (version.json) ao abrir, a cada 90 s e ao voltar para a aba; se houver atualização aparece **"NOVA VERSÃO! — ATUALIZAR AGORA"** (durante a partida, um botão discreto no topo), que limpa os caches e recarrega. A página principal vem sempre da rede (o cache só guarda arquivos imutáveis).
* **Armas com munição limitada:** pistola (∞), metralhadora, shotgun, lança-granadas e canhão de plasma — varie as armas! Caixas e inimigos soltam munição.
* **3 vidas por fase** (fichas de fliperama): ao morrer aparece **CONTINUAR?** com contagem regressiva de 10 s; confirmar gasta 1 vida e você continua *de onde parou* (inimigos, arena e chefe seguem como estavam). Sem confirmar, volta ao último checkpoint. Sem vidas: **FIM DE JOGO** (recomeçar a fase ou menu).
* **Vida com critério:** corações fixos após combates duros, caixas sorteadas (nem toda caixa tem item) e drops que aparecem mais quando você está ferido.
* **Nômad de apoio:** depois de ~1,5 min de jogo aparece uma entrega aérea de um segundo Nômad, emprestado por 50 s — pule em cima para pilotá-lo.
* Multitouch real: dá para mover, pular e atirar ao mesmo tempo.
* No celular em retrato o jogo **já abre deitado** (a tela gira 90° sozinha); é só virar o aparelho de lado e ele preenche a tela. Ao tocar em JOGAR ele também tenta fullscreen + `orientation.lock('landscape')`.
* Câmera 25|75: o personagem fica a ~25% da borda de trás e você vê 75% do que vem à frente (inverte suavemente ao andar para trás).
* O Nômad é **obrigatório**: o portão da garagem só abre depois que você **pula em cima dele** para pilotá-lo. No trecho de guerra seguinte chegam hordas contínuas (frenesi): cada abate recupera um pouco do Nômad e sequências de 5 dão bônus. Ele tem barra de vida própria; ao chegar a zero o Karimbo é ejetado e segue a pé.
* Existe uma mecânica secreta no avanço do Nômad. Só os atentos vão descobrir. 😉

### Dentro das casas (interiores isométricos)

Na fase 2, a **Palafita do vigia** (primeira cabana mercenária) e a **Casa da Dona Benedita** (primeira casa da aldeia) abrem um modo próprio: o Karimbo anda por uma grade isométrica 2:1 (sem pular, voar nem atirar), usa os móveis, come, pega ou rouba, derruba e fuça. Chegue na porta com a área livre de inimigos e aperte `F` (ou **ENTRAR**).

* **Ruído e olhares:** cada ação mostra ondas de ruído e um olho se alguém vai ver; vermelho irrita o morador. O mercenário dorme (sono 0–100) e a moradora volta da roça no meio da visita, com uma suspeita 0–100 que a reputação na aldeia multiplica.
* **Travessuras:** cada casa tem uma lista (papel no canto). Completar tudo dá o carimbo **KARIMBADO!**; a estrela dourada exige não acordar o Cabo / não ser expulso.
* **Missão da panela:** pegue a panela apreendida na palafita e devolva à Dona Benedita (toque nela e escolha *Devolver*).
* Tudo do interior só é baixado perto da porta e liberado ao sair.

| Ação no interior | Teclado / mouse | Celular | Gamepad |
|---|---|---|---|
| Andar | clicar no chão · `WASD`/setas (relativas à tela) | tocar no chão | analógico esq. |
| Escolher objeto / verbo | passar o mouse · `E` `Q` / roda | tocar no objeto | LB / RB |
| Abrir o menu / confirmar | clique · `ESPAÇO` ou `F` | tocar na fatia | A / Select |
| Examinar rápido | botão direito · `J` | toque longo | X |
| Ponta dos pés (segurar) | `SHIFT` | **PONTA** | Y |
| Fechar menu / sair pela porta | `G` | **SAIR** | B |
| Lista de travessuras | clicar no papel · `R` | **LISTA** | R3 |
| Pausa | `ESC` | botão de pausa | Start |

## A fase

14 seções (~13–21 min): entrada na cidade → primeiros soldados → verticalidade e glide → primeiro segredo → grande combate (arena com ondas) → **encontro com o Nômad** → power trip → avanço → exploração → área de guerra (arena) → passagem estreita (saída do Nômad) → subida final → preparação → **Felipão** (3 fases, piso que desaba).

Coletáveis: fichas, **10 emblemas**, **3 Orelhas Douradas** (muito secretas), caixas com munição/armas/vida/granadas. Cenário destrutível (caminho crítico sempre indestrutível), 8 checkpoints, reiniciar fase, pontuação e ranking S/A/B/C.

## Identidade dos personagens (arte)

Karimbo e Felipão **são as pessoas das fotos**: os recortes vêm dos arquivos canônicos (`Karimboprotagonista.png`, `Boss_Felipe.png`) e o rosto **não é redesenhado** — só recortado, com orelhas ampliadas (Karimbo) e uma leve projeção cilíndrica para dar perspectiva lateral. O Nômad (`Nomad_RoboMontaria.webp`) é recortado em camadas (torre, chassi e esfera que gira de verdade). Todo o resto (cenário, inimigos, civis, armas, HUD, efeitos) é arte procedural gerada por código, assim como os efeitos sonoros e a música (WebAudio, em camadas dinâmicas). As únicas gravações são as vozes/entrada do chefe em `public/assets/audio` (MP3 curtos — o Safari do iPhone não toca Opus em .ogg de forma confiável), baixadas na tela de carregamento e tocadas por um barramento de voz que respeita o volume de efeitos.

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

### Progresso e backup

Use **SAVE E CONTA** no menu ou na pausa para baixar/restaurar um backup e conferir se o progresso foi gravado. O save local guarda a partida no último checkpoint, fichas, equipamentos e itens, com validação e uma cópia anterior. A partida também é salva periodicamente e ao pausar ou sair. Se o navegador impedir a gravação, o jogo avisa para baixar um backup antes de fechar.

O login Google e o save privado por conta são opcionais e dependem de um projeto Firebase configurado. As instruções e regras de acesso estão em [firebase/README.md](firebase/README.md). A interface distingue progresso local de envio confirmado para a nuvem.

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
src/game/interior  interiores isométricos (simulador puro, cérebros dos NPCs, cômodos); carregado por import()
src/art/interior   desenho do diorama, móveis procedurais, partículas e UI do interior (também sob demanda)
src/ui        menus (DOM) e controles de toque (Pointer Events)
tests         validação da fase + simulações headless com bot
```

### Testes

`npm test` roda: integridade da fase; **civis** (chão sólido, fora de arenas/buracos/trecho do Nômad, aparências únicas, simulação headless sem arte); **entrada do chefe** sem áudio (roda até o fim e termina na luta, pular, só a primeira vez é longa); **alcançabilidade** com a física real (o caminho crítico, checkpoints, emblemas, orelhas douradas e o trecho do Nômad são provadamente atravessáveis; o buraco do glide *exige* o glide); e **simulações headless** com um bot (todas as seções, arenas, Nômad + avanço duplo, ejeção, o chefe até o fim da fase, reinício e respawn).

Ferramentas de depuração via URL: `?debug=sprites` (arte), `?debug=map` (mapa da fase), `?autoplay=1&god=1&arms=1&tp=<tile>` (QA), `?touch=1` (forçar controles de toque).

## Créditos

Feito com TypeScript, Vite e muito carinho. Fontes Lilita One e Rajdhani (SIL OFL). Inspirado no *ritmo* dos clássicos run-and-gun — nenhum sprite, música, mapa ou marca de terceiros foi usado.
