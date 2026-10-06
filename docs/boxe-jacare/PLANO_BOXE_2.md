# Boxe do Jacaré 2.0 — estudo e plano de desenvolvimento

> Objetivo: transformar a luta do Karimbo contra o jacaré dançante num minijogo **épico, fluido, engraçado e viciante**, igualmente bom no celular e no computador. Tudo é refeito: câmera, ringue, crianças, luvas, golpes, animações, IA do jacaré, controles, botões, som e recompensa. A infraestrutura que já funciona (carregamento sob demanda, mundo congelado, simulação headless testada) é mantida.
>
> Status: **plano** (nada do jogo foi alterado). Base de código: `main` em `04363ff`.

---

## 1. Diagnóstico do boxe atual

Captura do jogo em 1067×600 e 844×390 (`?qa=1&fase=2&mini=boxing&autoplay=1`):

| Problema | Causa encontrada no código |
|---|---|
| **Crianças em fila no meio do ringue**, entre o Karimbo e o jacaré | `src/game/minigames/boxing/sim/crowd.ts`: os ângulos vão de π·1,08 a π·1,92, então `sin(a)` é sempre negativo e `depth = 0.5 − 0.5·sin(a)` fica entre 0,5 e 1. Todas as crianças ficam no lado da câmera, cobrindo a largura inteira. O comentário diz o contrário do que o código faz. |
| Karimbo de costas é um **retângulo bege** com cabeça pequena | `src/art/minigames/boxing/karimboBack.ts` desenha nuca/cabelo de forma procedural (não havia foto de costas), sem ombros, sem musculatura e sem silhueta. |
| **Luvas minúsculas** e sem volume | Elipses de 22×20 px lógicos. Não há perspectiva: a luva não cresce perto da câmera nem encolhe ao esticar o braço. |
| Jacaré fino, com **luvas soltas no ar** | `gatorFront.ts`: os braços são traços finos e as luvas ficam longe do corpo. Não há leitura de guarda alta ou baixa. |
| Ringue é uma elipse de terra | Não há cordas, postes, lona, iluminação nem torcida em arquibancada. |
| Sem sensação de impacto | Não há parada de impacto (hitstop), tremida direcional, deformação do rosto ou som em camadas. |
| Botões genéricos (3 + 3 + zona de gesto) | Os botões são de texto e cobrem o terço inferior. O gesto de guarda (segurar parado) concorre com toques de soco. |
| Engasgo conhecido | O estudo `MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md` registra quadros de 100–190 ms em `drawKidsFront` (cópia da camada intermediária das crianças da frente). |

---

## 2. O que os jogos de sucesso ensinam

| Jogo | Mecânica que importa | Lição para o Karimbo |
|---|---|---|
| **Punch-Out!! (NES/Wii)** | O boxe é **reconhecimento de padrões**: cada adversário tem sinais visuais e sonoros (telegrafia), o jogador esquiva ou bloqueia e então **pune**. Dá para vencer de olhos fechados só pelos sons. Acertar no momento da provocação dá **estrelas** (até 3) para um **Star Punch**; levar golpe faz perder as estrelas. Contra-ataques no tempo certo atordoam e interrompem sequências. | O jacaré precisa de **padrões aprendíveis**, sinais claros de imagem **e** som, e recompensa por ler o momento certo. A IA atual sorteia demais. |
| **Super Punch-Out!! (SNES)** | Medidor de poder que enche com acertos e esvazia ao levar golpe; socos fortes só com o medidor cheio; personalidade exagerada dos adversários. | Um medidor de **Fúria das Orelhas** e um jacaré com personalidade de comédia. |
| **Punch Hero (celular — a imagem anexada)** | Toque = jab, deslizar na horizontal = cruzado, deslizar na diagonal para cima = gancho (o golpe mais forte, lento para sair e com recuperação longa), dois dedos segurados = guarda, setas grandes nos cantos = esquiva. Medidor de **RAGE**, rounds com relógio (1 de 3, 0:36) e dicas contextuais ("saia da guarda com o gancho"). | Controles por **gesto** em vez de muitos botões; esquiva em dois botões grandes nos cantos; dicas na tela que ensinam lendo a situação. |
| **Boxing Star (celular)** | Toque no alvo = jab, deslizar para o lado = cruzado, deslizar para cima ou para baixo = gancho; esquiva (*weaving*) seguida de **contra-ataque** e guarda em botão. As análises elogiam a variedade e criticam o excesso de controles no começo. | Ensinar os controles em camadas (primeiro round guiado) e fazer a esquiva **abrir** o contra-ataque. |
| **Real Boxing 2 (celular)** | Toque de cada lado = jab daquele lado; deslizar para cima, para baixo ou para o centro = gancho, golpe no corpo ou cruzado; vida + energia (sem energia o soco perde força); especial que carrega com sequências. Crítica frequente: **esquiva "travada" e golpes que acertam mesmo depois de esquivar**. | A esquiva precisa ser **instantânea e honesta**: invulnerabilidade visível e janela clara. |
| **Fight Night (console)** | Gesto no analógico ligado ao tipo de soco, peso e momento; câmera dramática nos nocautes. | A cinemática do nocaute e da ORELHADA pode copiar o "replay em câmera lenta". |
| **Game feel** (estudos de *hitstop*/*juice*) | Parada de impacto de 2–4 quadros nos golpes leves e de 8–12 nos fortes (até ~0,25 s); tremida **direcional** com decaimento rápido; faísca e flash no alvo. | Cada golpe tem peso proporcional; tremida sempre na direção do impacto. |

> Sobre o "vida 2.5D": não encontrei um jogo com esse nome que tenha troca de socos (o "Vida" do itch.io, de 2017, é uma jam de ação com ataque e pulo). As mecânicas de trocação que você descreveu estão cobertas pelas referências acima. Se puder mandar um link ou vídeo, eu incluo no estudo.

---

## 3. Pilares da nova luta

1. **Legível:** o jogador sempre vê o rosto e as mãos do jacaré. Cada ataque tem um sinal de imagem, som e cor, com tempo justo.
2. **Responsivo:** a entrada vale no mesmo quadro, com buffer de entrada de 0,15 s e cancelamento da recuperação do soco pela esquiva. Esquiva honesta: se a animação desviou, o golpe não acerta.
3. **Suculento:** parada de impacto, tremida direcional, deformação do rosto, gotas de suor e saliva, dentes voando, estrelas, vibração no celular e no controle.
4. **Engraçado:** o jacaré é um personagem de comédia (dança no ritmo, provoca, faz careta), e as crianças reagem a tudo.
5. **Viciante:** padrões que se aprendem, três rounds com crescendo, nota no fim (S/A/B/C) e revanche mais difícil.

---

## 4. Desenho da luta

### 4.1 Câmera e composição

- **Por cima do ombro, deslocada** (como na imagem anexada): o Karimbo de costas ocupa o **terço inferior esquerdo** (cabeça em ~35% da largura) e o jacaré fica no **centro-direita**. Assim, o rosto e as luvas do jacaré nunca ficam atrás da cabeça do Karimbo.
- Ao esquivar, o Karimbo desliza e inclina para o lado. A câmera acompanha 20% do deslocamento (paralaxe), e o jacaré continua visível.
- Aproximação de câmera de 8% nos contra-ataques e na ORELHADA; recuo no nocaute.
- **Área de ação protegida:** um retângulo central (de 18% a 82% da largura e de 12% a 78% da altura) onde **nenhuma** criança, placa ou efeito de primeiro plano pode ficar. Um teste verifica isso.

### 4.2 Ringue e ambiente: "o ringue da aldeia"

- Na praça, ao entardecer. As crianças montaram o ringue:
  - postes de tronco nos cantos, cordas de **cipó trançado** com faixas coloridas;
  - lona remendada de **saco de farinha** com "KARIMBOLÂNDIA" pintado à mão;
  - bandeirinhas de festa junina e lamparinas penduradas.
- **Mesa do juiz** à esquerda: uma criança com o **sino do jacaré** (está na história da aldeia) para abrir e fechar os rounds, e um **placar de madeira** escrito a giz.
- Fundo: casas da aldeia e palmeiras assadas uma vez a partir do retrato do mundo (o `backdrop` que já existe), com luz quente e vinheta.
- Tudo é estático e assado **uma vez** na entrada. Por quadro, só se movem bandeirinhas e lamparinas (poucos sprites), as crianças animadas e os lutadores.

### 4.3 Crianças: fora do caminho e vivas

- **Arquibancada atrás do ringue**, em duas fileiras atrás das cordas do fundo (menores e um pouco desfocadas no bake), e **laterais** nas colunas de 0–14% e 86–100% da largura, encostadas nas cordas.
- **Primeiro plano**: no máximo 2 cabeças de criança desfocadas, só nos **cantos inferiores**, fora da área de ação.
- As fileiras estáticas são assadas no fundo. Só as **8 a 12 crianças da frente da arquibancada** animam (pular, cobrir os olhos, apontar, rir), em sprites pequenos. Isso elimina a camada intermediária que causava os engasgos de 100–190 ms.
- Torcidas: crianças com **plaquinhas** "VAI KARIMBO!" e "VAI JACARÉ!" (60/40). Coro "BRIGA! BRIGA!" nas batidas da música, gritos em balões por cima, nunca sobre o rosto do jacaré.

### 4.4 Lutadores, luvas e animações

**Karimbo de costas (com a foto anexada, salva como `Karimbo_costas.webp` na raiz):**
- Novo recorte `tools/cutout_karimbo_back.py`, no mesmo processo de `cutout_karimbo.py`:
  - separa **orelha esquerda, orelha direita e nuca/cabelo** em camadas próprias;
  - **aumenta as orelhas** em 1,35× (fiel ao jogo, onde as orelhas são exageradas);
  - **tira o pescoço**: corta a pele abaixo da linha do cabelo com degradê suave, para que a gola de cada skin cubra a junção;
  - gera `karimbo_back_head.webp`, `karimbo_back_ear_l.webp`, `karimbo_back_ear_r.webp` e um `back_meta.json` com a raiz de cada orelha.
- As orelhas usam a mesma **mola** do jogo base: balançam ao esquivar, levar golpe e socar. Na ORELHADA, crescem como no `earGlide`.
- Costas por skin: ombros largos e trapézio com volume, gola/costura da roupa. Variantes: clássico (camiseta bege), explorador, neon, mergulho (traje e capacete visto de trás), atlante (escamas) e jacaré (macacão com o chapéu de caça e o rabo aparecendo atrás das pernas).

**Luvas (dos dois lutadores):**
- Luva "3D" assada em 3 ângulos (frente, perfil e três-quartos) com punho, cadarço e costura. Karimbo: vermelha com faixa branca e "KRB". Jacaré: verde-musgo com **garrinhas furando a ponta**.
- **Perspectiva:** a luva do Karimbo é grande perto da câmera e diminui conforme o braço estica até o jacaré (escala de 1,0 → 0,55 no reto e trajetória curva no cruzado e no gancho), com rastro de movimento.

**Jacaré de frente (redesenho):**
- Corpo de boxeador cartunesco: peitoral em barril, barriga com placas creme, ombros largos, calção "JACARÉ" com cinto, chapeuzinho de palha com fita vermelha e **sino no pescoço**.
- Focinho em perspectiva (vindo na direção da câmera).
- **Guardas legíveis**: alta (luvas no rosto), baixa (na barriga), aberta (dançando).
- **Animação por clipes de pose-chave** (`anim/clips.ts`): cada estado tem um clipe com 3 a 6 poses e suavização, avaliado sem alocação por quadro, sobre partes assadas (tronco, cabeça, mandíbula, braços, luvas, rabo).
  - Clipes: respiração no ritmo, telegrafia de cada ataque, golpe, recuperação;
  - **reação ao soco por direção** (cabeça vira para a esquerda, a direita ou para cima no gancho);
  - tonto, queda, levantar, provocação (dança da roda), risada, nocaute.
- **Expressões:** sobrancelha brava, olho brilhando na telegrafia, bocão aberto na mordida, olhos em espiral quando tonto, língua de fora no nocaute, dente voando em contra-ataques fortes.

### 4.5 Controles (celular e computador com o mesmo vocabulário)

O vocabulário é sempre o mesmo: **mão esquerda / mão direita × reto / cruzado / gancho**, mais **esquiva E/D, abaixar e guarda**.

**Celular — esquema padrão por gestos** (comprovado em Punch Hero, Boxing Star e Real Boxing):
- A **metade esquerda da tela é a mão esquerda; a metade direita é a mão direita**.
  - **Toque** = reto (jab na esquerda, direto na direita).
  - **Deslizar para o centro** = cruzado daquele lado.
  - **Deslizar para cima** = gancho daquele lado (forte e lento).
- **Esquiva:** dois botões redondos grandes nos cantos inferiores (« e »), como na imagem anexada, sempre no mesmo lugar sob o polegar.
- **Abaixar:** deslizar para baixo em qualquer metade. **Guarda:** segurar os dois polegares ao mesmo tempo (um em cada metade).
- **ORELHADA / Star Punch:** botão grande central que só aparece quando está disponível.
- Regras de toque: cada dedo é dono do seu gesto (`pointerId`); gesto decidido em ≤ 120 ms ou 28 px; toque curto vira reto **na hora** (sem esperar o gesto); `pointercancel` solta tudo do ponteiro.
- **Esquema alternativo "Botões"** nas Configurações: 3 botões em arco sob cada polegar (reto, cruzado, gancho), com ícones de trajetória em vez de texto, semitransparentes e com área de toque de ≥ 64 px.

**Teclado** (as duas mãos, espelhando a tela):

| Mão esquerda (defesa) | Mão direita (socos, grade 2×3 = mão E | mão D) |
|---|---|---|
| A / ← esquiva esq. | U cruzado esq. · I cruzado dir. |
| D / → esquiva dir. | J jab · K direto |
| S / ↓ abaixar | N gancho esq. · M gancho dir. |
| W / ↑ segurar = guarda | Espaço = ORELHADA / Star Punch |

**Controle:** analógico/d-pad esquivas, abaixar e guarda; X jab, Y direto, LB/RB cruzados, LT/RT ganchos, A especial.

**Responsividade:** buffer de entrada de 0,15 s; a esquiva cancela a recuperação de um soco que **errou** (não de um que acertou); vibração curta ao acertar e longa ao levar golpe (`input.vibrate`, desligável).

### 4.6 Regras da luta

- **3 rounds de 60 s.** O sino da criança-juíza abre e fecha cada round. **Intervalo de 8 s** com cena cômica: uma criança abana o Karimbo com uma folha de bananeira, e o jacaré bebe água de coco e provoca. O intervalo recupera 15% da vida dos dois.
- **Knockdown:** a vida do jacaré chega a zero no round ⇒ ele cai e a criança-juíza conta. Ele levanta com menos vida máxima (100% → 70% → 45%). O nocaute vem no **terceiro knockdown** ou com a **ORELHADA** quando ele está grogue. Se acabarem os 3 rounds, vence quem tiver mais pontos (acertos, defesas e knockdowns), o que evita uma luta sem fim.
- **Knockdown do Karimbo:** ao zerar a vida, ele cai. É preciso **martelar os socos** para levantar antes do 10 (como no Punch-Out). São 3 knockdowns no total; o terceiro é derrota.
- **Energia:** cada soco gasta; sem energia, os socos ficam lentos e fracos. Recupera ao defender ou esquivar, o que premia o ritmo e pune quem só martela.
- **Estrelas de orelha (⭐ até 3):** ganha uma estrela quem acerta no momento da **provocação** do jacaré (dança, risada, ajeitar o chapéu) ou com **contra-ataque após esquiva perfeita**. Levar golpe faz perder as estrelas. Gastar 1 a 3 estrelas = **Orelhada carregada** (dano ×2, ×3 ou ×4, com cinemática curta).
- **Fúria das Orelhas (medidor):** enche com combos e defesas perfeitas. Quando cheio: 6 s com socos 30% mais rápidos e +25% de dano, orelhas brilhando e música mais intensa.
- **Guarda do jacaré:** a alta bloqueia retos, o **gancho abre a guarda** (dica na tela: "SAI DA GUARDA COM O GANCHO!"); a baixa deixa os retos entrarem e bloqueia o gancho. Bater num jacaré com a guarda bem fechada provoca o **contrapé**, que pune quem só martela.
- **Defesa do Karimbo, por cor de telegrafia** (leitura instantânea):
  - **amarelo** = pode bloquear com a guarda;
  - **laranja** = abaixar;
  - **vermelho** = só esquiva lateral.
  - **Esquiva perfeita** (últimos 0,2 s) = câmera lenta de 0,3 s + janela de contra-ataque com ⭐.

### 4.7 Jacaré: repertório e IA por padrões

| Golpe | Telegrafia (imagem / som) | Cor | Defesa | Punição |
|---|---|---|---|---|
| **Patada** | ombro recua, olho brilha / "hã!" | amarelo | guarda ou esquiva | 0,5 s |
| **Cabeçada do chapéu** | ajeita o chapéu, inclina / "toc" | laranja | abaixar | 0,7 s |
| **Rabada** | rabo recua levantando poeira / chocalho | vermelho | esquiva lateral | 0,8 s |
| **Mordidona** | bocão abre, dentes brilham / "CHOMP" pisca | vermelho | esquiva | 1,2 s + ⭐ |
| **Chapelada** (round 2+) | tira o chapéu e mira / assobio | amarelo | guarda (o chapéu volta como bumerangue: segunda defesa) | 0,6 s |
| **Giro da Roda** (round 3) | crianças batem palmas, ele gira | sequência | 3 esquivas alternadas **no ritmo das palmas** | 1,5 s + ⭐ |
| **Passinho provocador** | dança com o sino | — | — | janela aberta: ⭐ por acerto |

- **Padrões autorados por round** (como no Punch-Out), com pouca aleatoriedade (escolha entre 2 ou 3 variações por PRNG com semente):
  - Round 1: patada, patada, provocação; ensina.
  - Round 2: misturas com rabada e mordidona; a chapelada entra.
  - Round 3: "Jacaré Furioso" (olhos vermelhos), sequências de 3, o Giro da Roda e telegrafias 20% mais curtas.
- **Ataques no ritmo da música:** os golpes saem nas batidas (132 bpm), o que dá sensação de "dança de luta" e ajuda a prever pelo som.
- Dificuldade (`src/core/difficulty.ts`): fácil alonga telegrafias (×1,3) e reduz o dano; difícil encurta (×0,85) e o jacaré faz fintas.

### 4.8 Sensação de impacto e som

- **Parada de impacto:** jab 2 quadros, reto 3, cruzado 5, gancho 7, contra-ataque 9, ORELHADA 14. O jogador nunca perde entrada durante a parada (fica no buffer).
- **Tremida direcional** com decaimento exponencial: o cruzado empurra a câmera para o lado, o gancho para cima.
- **Deformação** do rosto do jacaré no impacto (achatamento de 0,12 s), gotas de suor e saliva (pool de partículas), estrelinhas no grogue, dente voando em contra-ataque com ⭐, flash branco de 1 quadro no alvo.
- **Som em camadas:** sopro + baque grave + estalo; o volume e o tom variam por golpe. Torcida reage com "UUUH!", risada ou silêncio tenso na mordidona. Sino real dos rounds. Música `fight` com intensidade por round (camadas entram) e corte seco no knockdown.
- **Texto de impacto** curto e grande: "CONTRA!", "PERFEITO!", "COMBO x4!", com balões em estilo HQ só em momentos importantes.

### 4.9 Interface e aprendizado

- **HUD** (inspirado na imagem anexada):
  - barras de vida nas laterais do topo, com retratos;
  - **"ROUND 1/3 · 0:36"** no centro;
  - estrelas abaixo da vida do Karimbo;
  - medidor de Fúria;
  - indicador de energia em arco perto das luvas;
  - nada por cima do rosto do jacaré.
- **Primeira luta guiada:** no round 1, uma criança "treinadora" ensina em 3 dicas que só somem quando o jogador executa (tocar = reto; deslizar para cima = gancho; « » = esquiva).
- **Dicas contextuais** (Punch Hero): guarda alta por 3 s ⇒ "SAI DA GUARDA COM O GANCHO!"; energia zerada ⇒ "RESPIRA! DEFENDE PRA RECUPERAR".
- **Telas de resultado:** nota **S/A/B/C** (tempo, dano recebido, esquivas perfeitas, estrelas), melhores marcas salvas e o botão **REVANCHE**.

### 4.10 Para ficar viciante (depois de vencer)

- **Revanche do Jacaré:** a mesma luta com o jacaré "Campeão da Roda" (guarda melhor, padrões novos, cinto de campeão de lata).
- Recompensas cosméticas por nota: **luvas douradas** (nota S), **calção de onça** (vencer sem cair) e **sino de ouro** para o jacaré da aldeia (pura vaidade).
- Contador de vitórias e de nocautes em placa de giz na praça do mundo.

---

## 5. Arquitetura técnica

**Mantém:**
- `src/game/minigameFlow.ts` e o carregamento por `import()`;
- mundo congelado, saída com `abort` única e restauração de controles, toque e música;
- simulação headless e determinística;
- testes por bots;
- `onDone` → `grantSkin('jacare')` e o nocaute no mundo.

**Reescreve:**

| Área | Arquivos (novos ou refeitos) |
|---|---|
| Regras e luta | `src/game/minigames/boxing/sim/rules.ts` (v2: rounds, knockdowns, estrelas, fúria, cores de defesa), `sim/match.ts` (máquina de estados por round), `sim/gatorScript.ts` (padrões autorados por round), `sim/inputBuffer.ts`, `sim/scoring.ts` (nota S–C) |
| Torcida | `sim/crowd.ts`: posições em **faixas** (arquibancada e laterais), nunca na área de ação |
| Animação | `src/art/minigames/boxing/anim/clips.ts` (poses-chave com suavização, sem alocação), `anim/gatorClips.ts`, `anim/karimboClips.ts` |
| Arte | `ring.ts` (ringue e ambiente assados), `karimboBack.ts` (foto de costas + orelhas em mola + costas por skin), `gatorFront.ts` (redesenho), `gloves.ts` (luvas em 3 ângulos com perspectiva), `kids.ts` (fileiras assadas + 8–12 animadas), `juice.ts` (parada de impacto, tremida, partículas em pool), `hud.ts` |
| Recorte da foto | `tools/cutout_karimbo_back.py` + `public/assets/img/karimbo_back_*.webp` + `back_meta.json` |
| Toque | `src/ui/touch.ts`: modo `boxing` com **zonas de mão por gesto** + 2 botões de esquiva + botão especial; modo alternativo "Botões"; preferência em Configurações |
| Entrada | `src/core/input.ts`: mapa de teclado e controle desta seção, buffer de entrada |
| Som | `src/core/audio.ts` (golpes em camadas, sino, reações da torcida) e `src/core/music.ts` (`fight` com camadas por round) |

**Desempenho (regras D01–D09):** suavização `low` no canvas principal; tudo assado na entrada (ringue, fileiras, partes, luvas nos 3 ângulos); nada de camada intermediária por quadro (corrige o engasgo das crianças); pools de partículas; orçamento de ≤ 220 `drawImage` por quadro medido por teste com contexto falso; P95/P99 medidos antes e depois com `?perf=1`, sem alegar FPS de celular sem aparelho real.

---

## 6. Plano de execução (fases com entrega testável)

| Fase | Entrega | Testes e aceite |
|---|---|---|
| **B0 — Linha de base** | Branch nova, capturas do boxe atual em 4 viewports, P95/P99 e contagem de `drawImage` | Números registrados no bead |
| **B1 — Recorte da foto de costas** | `cutout_karimbo_back.py`: camadas da cabeça e orelhas, orelhas 1,35×, sem pescoço, meta das raízes | Imagem comparada sobre as 6 skins; junção da gola sem emenda visível |
| **B2 — Simulação v2** | Rounds, knockdowns, estrelas, fúria, cores de defesa, energia, buffer, padrões do jacaré, nota | Bots: **defensivo-leitor** vence no normal em 2–3 rounds; **martelador** perde; **esquivador sem socar** perde por pontos; determinismo; a esquiva honesta nunca toma dano dentro da invulnerabilidade |
| **B3 — Ringue e torcida** | Ringue da aldeia assado, fileiras, laterais, 8–12 crianças animadas, coro no ritmo | **Nenhuma criança na área de ação** (teste geométrico em 4 viewports); fim do engasgo de `drawKidsFront` (P99 medido) |
| **B4 — Karimbo e luvas** | Costas com foto, orelhas em mola, costas por skin, luvas em 3 ângulos com perspectiva e rastro | Vitrine `?debug=sprites` com as 6 skins × poses |
| **B5 — Jacaré** | Redesenho + clipes de pose-chave (todos os golpes, reações por direção, tonto, queda, levantar, provocações) | Vitrine dos clipes; cada ataque reconhecível sem som e sem cor (teste de leitura feito por pessoa) |
| **B6 — Controles** | Gestos por metade, esquivas nos cantos, abaixar, guarda de dois polegares, esquema "Botões", teclado, controle, vibração | Testes de toque com dois ponteiros, cancelamento, decisão de gesto ≤ 120 ms; layout em 360×640, 667×320 e 844×390 |
| **B7 — Impacto e som** | Parada de impacto por golpe, tremida direcional, deformação, partículas, sons em camadas, música por round | Parada de impacto não perde entrada; orçamento de desenho mantido |
| **B8 — HUD, ensino e resultado** | HUD de rounds, estrelas, fúria, dicas contextuais, round guiado, nota S–C, revanche | Jogador novo vence o round 1 guiado sem ler texto externo (teste com pessoa) |
| **B9 — Revanche, cosméticos e documentação** | Jacaré Campeão, luvas douradas e calção de onça, placa de giz; estudo de caso atualizado | Saves com campos opcionais validados; perfil antigo intacto |

Cada fase termina com `typecheck`, testes, build, QA visual nos 4 viewports e commit próprio, como manda o `AGENTS.md`. Proposta de Beads: épico "Boxe do Jacaré 2.0" com B0–B9 encadeadas (criar quando o plano for aprovado).

---

## 7. Riscos e cuidados

- **Muitos gestos confundem no começo** (crítica ao Boxing Star): resolvido com o round guiado e o esquema "Botões" opcional.
- **Esquiva que não protege** (crítica ao Real Boxing 2): a invulnerabilidade é a fonte da verdade da simulação, e a animação segue a simulação (nunca o contrário).
- **Foto de costas × skins:** o capacete de mergulho cobre a cabeça; a skin jacaré tem o chapéu de caça visto de trás. Cada skin precisa ser conferida na vitrine.
- **Tamanho do chunk do boxe:** com a arte nova ele cresce. Continua fora do pacote principal; registrar o tamanho antes e depois.
- **Duração:** 3 rounds de 60 s + intervalos ≈ 3–4 min no máximo. Se ficar longo para uma luta de aldeia, dá para cair para 2 rounds sem mudar a arquitetura.

---

## 8. Decisões para você confirmar antes de começar

1. **Controles no celular:** gestos por metade da tela como padrão, com "Botões" como opção (recomendado), **ou** só botões redesenhados?
2. **Rounds:** 3 rounds de 60 s com knockdowns (recomendado), ou luta única contínua como hoje?
3. **Revanche e cosméticos** (B9): entram agora ou ficam para depois?

## Fontes da pesquisa

- [Punch-Out!! (Wii) — sistema de estrelas e sinais dos adversários](https://en.wikipedia.org/wiki/Punch-Out!!_(2009_video_game))
- [Punch-Out!! — reconhecimento de padrões (Hardcore Gaming 101)](https://www.hardcoregaming101.net/punch-out-wii/)
- [Punch-Out!! como jogo de padrões e sons](https://malvasiabianca.org/archives/2007/06/punch-out/)
- [Super Punch-Out!! (SNES)](https://punchout.fandom.com/wiki/Super_Punch-Out!!_(SNES))
- [Punch Hero — controles por gesto (Android Central)](https://www.androidcentral.com/punch-hero-review-free-swipe-based-boxing-android)
- [Punch Hero — golpes e Rage (NamuWiki)](https://en.namu.wiki/w/%ED%8E%80%EC%B9%98%ED%9E%88%EC%96%B4%EB%A1%9C)
- [Boxing Star — controles](https://wiki.boxingstarx.com/how-to-start/controls) e [guia de luta](https://www.talkandroid.com/4454-boxing-star-fighting-guide/)
- [Real Boxing 2 — análise (Gamezebo)](https://www.gamezebo.com/reviews/real-boxing-2-creed-review-punching-up/) e [crítica à esquiva (Nintendo Life)](https://www.nintendolife.com/reviews/switch-eshop/real-boxing-2)
- [Hitstop e tremida — game feel](https://salivity.github.io/game-development/article/maximizing-game-feel-in-action-game-development) e [hitstop nos beat 'em ups da Capcom](https://shane-sicienski.com/blog/blog-post-title-one-55pmn)
- [Vida (itch.io, 2017)](https://sukafu-team.itch.io/vida)
