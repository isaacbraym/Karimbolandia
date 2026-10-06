# Minijogos sob demanda: perseguição do macaco, boxe do jacaré e a skin Jacaré

> **Atualização:** o boxe descrito aqui (luta única, seis botões, camada de crianças) foi **reconstruído** no [Boxe 2.0](BOXE_2_0_2026-10-05.md). As regras de carregamento (D09), a entrada por modo, a skin Jacaré e a roda continuam valendo como descritas; as medições e o "achado não resolvido" do boxe abaixo são do boxe antigo.

## Sintomas e escopo

A fase 2 ganhou dois minijogos de tela cheia: o **boxe em terceira pessoa** contra o jacaré dançante da roda (prêmio: a skin Jacaré) e a **perseguição pela copa** atrás do macaco que rouba a carta da princesa Júlia (cena do pombo-correio no mundo → corrida → filminho da carta → rebobinar até o ponto do roubo). Os riscos que o desenho precisava evitar eram: (1) crescer o pacote principal, que a tela de carregamento e o celular pagam sempre; (2) deixar o jogador preso (controle, toque, música) se algo falhasse no meio; (3) prêmio duplicado ou concedido sem vitória; (4) dois dedos no mesmo botão; (5) perfil gravado pela versão nova invalidado por um cliente antigo em cache; (6) minijogos que "passam nos testes" mas ficam longos demais, curtos demais ou impossíveis.

Evidência visual: Chromium embutido em 1440×900, 844×390, 667×320 e 360×640 (layout emulado, não aparelho físico).

## Forma correta de desenvolver

### Carregar sob demanda (regra D09)

- `src/game/minigameFlow.ts` é o **único** arquivo pequeno no pacote principal. Só usa `import type` dos tipos (`src/game/minigames/types.ts`, *somente tipos*) e `import()` dos módulos `minigames/boxing` e `minigames/chase`. O Vite os emite como chunks próprios. O fluxo captura um retrato borrado do mundo, fecha uma íris, espera o módulo (`wait`), cria a sessão (`live`), reabre a íris (`back`) e devolve o jogo.
- **O mundo fica congelado** durante o minijogo (`Game` não chama `World.update`); a sessão recebe o `dt` protegido do loop (D04). Girar a tela chega à sessão por `resize`; pausar e aba oculta simplesmente não chamam `step`, então a sessão não avança.
- **Pré-busca silenciosa:** `hooks.onMinigamePrefetch('chase')` baixa o módulo ~60 tiles antes da cena do pombo; `abortLoad` cobre falha de rede com um banner e o resultado `abort`.
- **Saída sempre limpa:** `restore()` devolve toque, entrada, música e áudio; `reset` em *qualquer* fase (carregando, vivo, voltando) entrega `abort` **uma vez só** (`fire` zera o callback); exceção em `update`, `dispose` ou no callback de resultado é capturada (revisão T5–T8) e termina como `abort`. `onMinigame` recusado (`start` devolve `false`) também devolve `abort`, senão o `lockInput` do chamador ficaria preso.
- **Prêmio só por resultado:** quem pede (`alligatorTalk`, `letterScene`) concede no `onDone` e só em `win`; o salvamento acontece uma vez, depois da vitória.
- **Teste de isolamento:** `tests/minigameLoading.test.ts` falha se o pacote principal importar por valor qualquer arquivo de `src/game/minigames/**`/`src/art/minigames/**`.

Tamanho (build de produção): ver a tabela de medições abaixo; o crescimento do pacote principal vem do lago/skin/cenas no mundo, **não** dos minijogos (`boxing` ≈ 30 kB e `chase` ≈ 48 kB brutos, só carregados quando pedidos; a letra Caveat é um asset separado, baixado só pela perseguição).

### Entrada e toque por modo

- `Input.setMiniMode('boxing' | 'chase' | null)`: no boxe o teclado vira 6 golpes (Q/W/E e J/K/L), esquivas (A/D ou setas), guarda (S/↓) e especial (Espaço/Enter); a perseguição usa o `ControlState` normal (←: frear, ↓: deslizar, PULAR: pular/planar). Ao entrar, **tudo que já estava apertado** (toque *ou teclado*) só vale depois de solto (revisão T5–T8: segurar A/D na entrada virava esquiva de graça).
- `TouchUI.setMinigame(mode)` troca o layout por classe CSS (`mini-boxing`: 3 botões de cada lado + zona central de gestos; `mini-chase`: joystick + PULO). **Cada dedo é dono do seu botão** (`dataset.pid`, `lostpointercapture`): soltar um não solta o outro. Zona de gestos: deslizar ≥ 40 px em ≤ 250 ms = esquiva; segurar parado ≥ 180 ms = guarda. `releaseAll` zera ponteiros, bordas, temporizadores e o realce da zona.

### Simulação separada da arte e testada por bots

Toda a regra vive em `src/game/minigames/*/sim/**` (sem DOM, PRNG com semente, `dt` fixo de 1/60 nos testes). A arte só desenha o estado e reage a **eventos**. Isso permitiu medir equilíbrio e duração com bots em vez de achar números "no olho":

- **Boxe:** tabela de golpes com custo de energia, guarda do jacaré (alta/baixa/aberta/tonto/cobertura/ataque) com multiplicadores de passagem, esquiva perfeita abrindo contra-ataque ×2 com câmera lenta, combo JAB→DIRETO→CRUZADO medido de início a início (≤ 0,45 s, +25%), cinco acertos seguidos deixam o jacaré tonto, **GROGUE → ORELHADA é o único caminho de vitória** (cinemática de 2,4 s + contagem). Três bots serviram para ajustar o equilíbrio: o afobado (só soca) **perde no normal** (protegido por teste); o defensivo (esquiva no tempo, contra-ataca na janela e dá a ORELHADA) e o cauteloso (esquiva e dá um golpe por janela, como um jogador de verdade) mediram a duração da luta durante o ajuste; o defensivo também prova o determinismo. A dificuldade escala dano, telegrafia e vida do jacaré (no fácil o afobado já se sai melhor que no difícil). O primeiro ajuste dos bots mostrou luta de 13 s: faltava uma reação do jacaré (se **cobre** ao ser socado repetidamente, depois contra-ataca), *armadura* durante golpe comprometido (0,5) e raciocínio por fase.
- **Perseguição:** percurso **autorado** (lista fixa de segmentos: galho firme, vão, galho que treme, bromélia-mola, cipó, preguiça, quatis, tucano, cobra, colmeia, casca de banana, coco) com *dicas de linha de corrida* que os bots seguem. O corredor usa `moveBody` e as constantes de `movement.ts`, a 1,22× (`CHASE_RUN`). Regras do macaco: foge com um salto antes de `MIN_CATCH_T = 48 s`; provoca e espera se a distância passa de 1100 px; cansa depois de 68 s; depois de `RESCUE_T = 82 s` escorrega e **volta** até o Karimbo (garante o fim). Resultado medido: perfeito **51 s**, comum **64 s**, péssimo (6 sementes) **≤ 92 s**, determinístico. Galhos que tremem quebram **por tile**, `SHAKE_T = 0,28 s` depois de pisados: quem corre atravessa; quem freia ou para cai (com 0,5 s a frenagem ainda atravessava e o galho nunca "pegava").

### Lições do processo de ajuste

- Um bot que não sabe se recuperar mascara armadilhas: depois de cair, o bot reiniciou as dicas e **sorteou erros de novo** (como um jogador que aprende); sem isso os testes mostravam 77 quedas no mesmo vão.
- Vão largo (≥ 5 tiles) é impossível só com pulo: a dica passou a incluir o planar com as orelhas. Mola precisa de `g = 5`: voo de ≈ 6 tiles.
- Percurso longo demais **nunca** é pego em 50 s: o macaco só pode ser alcançado depois de 48 s, então o percurso foi cortado em ≈ 410 tiles (≈ 13 000 px a ~245 px/s ≈ 52 s). A duração do minijogo é uma propriedade do *percurso*, não só dos parâmetros do macaco.
- Soco "fantasma" por pressionar uma tecla ao entrar, texto que pulsava mudando o tamanho (canvas novo por quadro) e estado de cobertura contaminado por socos no deboche foram achados pela **revisão independente** — nenhum aparecia nos testes naturais. Cada um virou teste.

## Skin Jacaré sem quebrar clientes antigos

`storage.ts` invalidava o progresso inteiro se `ownedSkins` tivesse um ID desconhecido. Uma aba/versão antiga em cache leria o perfil novo como corrompido e **perderia moedas e skins**. Decisão: skins de **recompensa** (hoje só `jacare`) ficam numa chave própria, `karimbolandia.rewards.v1`; o perfil principal e a carteira gravam uma *visão legada* (`legacyView`: a skin de recompensa equipada aparece como a última skin antiga equipada). O `readProfileProgress` mescla as duas; um equipado de recompensa só é restaurado se o equipado do perfil ainda é aquele (uma troca feita pelo cliente antigo prevalece). Se a vitória está no save mas a skin sumiu (perfil de recompensas perdido), `alligatorTalk` entrega de novo, uma vez (idempotente).

Perk da skin: fôlego +30%, nado +40%, vida +10% (`SKIN_PERKS`, reaplicado em `Player`). O "chapéu" da skin é a própria **cabeça de um jacaré usada como fantasia/chapéu de caça** pelo Karimbo (`art/alligatorHood.ts`); o jacaré da roda/boxe não usa chapéu.

## Roda do jacaré: AGIR = FALAR

> **Tempo dos balões (2026-10-06):** cada balão da conversa dura o tempo de ler o texto (`readTime` em `alligatorTalk.ts`: ~14 caracteres/s + 1,3 s, mínimo 2,4 s) e o roteiro espera a leitura antes da resposta; antes todos duravam 1,8–3,6 s e as falas longas (mais de 100 caracteres) sumiam pela metade. A janela do desafio do Campeão acompanha a leitura da oferta. Os testes (`tests/alligatorTalk.test.ts`) esperam por `settle()`/`untilBoxing()` em vez de segundos fixos.

↑ continua batendo palmas (a roda de antes); **AGIR** conversa com o jacaré em 3 estágios (conversa, bronca, tapa na orelha → convite ao boxe). A ação mais próxima vence (`preferred`): porta de casa mais perto que o jacaré = exploração; jacaré mais perto = conversa. Depois da vitória ele fica nocauteado só enquanto o Karimbo está por perto; ao se afastar volta de curativo. Reiniciar a partida o devolve a dançar e esquece a derrota (revisão: a ordem `village.reset × encounters.reset` estava invertida).

## Proteção contra regressão

| Risco | Proteção |
|---|---|
| Pacote principal importando minijogo | `tests/minigameLoading.test.ts` |
| Fluxo: abort único, restauração, falha de import, exceção na sessão, pausa | `tests/minigameFlow.test.ts` |
| Toque por dedo, gestos, entrada por modo | `tests/minigameFlow.test.ts` (toque do boxe) |
| Boxe: tabela, guarda, esquiva, combo, vitória só pela ORELHADA, equilíbrio por bots | `tests/boxing.test.ts` |
| Custo de desenho do boxe (≤ 140 `drawImage` no 2.0, 1 por criança) e letreiros sem canvas por quadro | `tests/boxingRenderCost.test.ts` |
| Perseguição: tempos dos bots (51 / 64 / ≤ 92 s), regras do macaco, galhos que tremem, sem arma | `tests/chase.test.ts` |
| Custo de desenho da perseguição, da carta e do rebobinar | `tests/chaseRenderCost.test.ts` |
| Texto da carta idêntico ao Apêndice A, páginas, pular após 2 s, rebobinar 4 s, fonte ausente | `tests/letterFilm.test.ts` |
| Cena do pombo e do macaco no mundo (uma vez, trava de controle, medalhas, abort) | `tests/letterScene.test.ts` |
| Skin e save/compatibilidade | `tests/skinJacare.test.ts` |
| Conversa, vitória, derrota, reinício | `tests/alligatorTalk.test.ts` |

Os testes de custo usam um contexto falso que só conta chamadas: provam um **teto de chamadas e ausência de criação por quadro**, não a cadência de um aparelho.

## Medições finais (2026-10-05) e o que elas não provam

Ambiente: Chromium embutido do app, 1440×900, DPR 1, **painel oculto** (os quadros são avançados à mão com `step` + `render`; `tools/_work/qa.js`, não versionado). É custo de CPU/JS numa máquina de desenvolvimento, **não** fluidez em celular.

| Cena | Linha de base (T0, `e37992d`) | Final (`6e2d04b`+) |
|---|---|---|
| Lago, rota única (7 paradas × 240 quadros), 2ª passada | p50 1,9 · p95 4,5 · p99 5,7 · máx 8,8 ms · 0 quadros > 20,8 ms · 648 peixes | p50 2,7 · p95 5,6 · p99 7,2 · máx 11 ms · 0 quadros > 20,8 ms · 1067 peixes |
| Lago, 1ª passada (frio, servidor de desenvolvimento) | p95 5,0 · máx 78,6 ms | p95 6,5 · p99 13,8 · máx 143 ms (10 quadros > 20,8 ms: bakes) |
| Perseguição (900 quadros) | — | p50 0,1 · p95 0,3 · p99 1,1 · máx 4,3 ms |
| Boxe (900 quadros) | — | p50 1,2–1,5 · p95 2,1–3,7 ms; **travadas de ~130 ms em ~5% dos quadros** (ver abaixo) |

O lago ficou ~1 ms mais caro no P95 com 65% mais peixes, vegetação e pérolas; nenhum quadro passou do orçamento de 20,8 ms na 2ª passada. Não foi cortado nenhum efeito (D05).

**Achado do boxe antigo (resolvido por projeto no 2.0, ainda sem validação em aparelho):** nos estados de ataque do jacaré (`tele`/`recover`) alguns quadros levam 100–190 ms, todos dentro de `drawKidsFront` (a cópia da camada intermediária das crianças da frente para o canvas principal; cronometrado: `blit` 109/192/172 ms). Com essa camada desligada: p99 5,7 ms e máximo 7 ms. Remover `source-atop` não mudou; desenhar as crianças direto no canvas principal deu resultados inconsistentes entre rodadas, então pode ser artefato do raster por software com painel oculto. **Não foi tratado como defeito de aparelho nem como resolvido** no boxe antigo. No Boxe 2.0 a camada deixou de existir (cada criança é um quadro assado desenhado direto, p50 0,5 ms contra 3,0 ms); o item continua aberto no Beads para repetir em Chrome visível/aparelho real e, se persistir, trocar a camada por sprites pré-assados escurecidos.

Build de produção (`npm run build`), brutos / gzip:

| Chunk | Linha de base | Final |
|---|---|---|
| `index-*.js` (principal) | 759,67 kB / 252,32 kB | 840,05 kB / 277,89 kB |
| `boxing-*.js` | — | 30,17 kB / 11,11 kB |
| `chase-*.js` | — | 47,79 kB / 17,64 kB |
| `firebaseCloud-*.js`, `interior-*.js` | 529,26 / 68,26 kB | iguais |
| Letra Caveat (`woff2`) | — | asset separado, só pedido pela perseguição |

O principal cresceu ~80 kB (+25 kB gzip) por causa de lago/skin/cenas do mundo (espécies, vegetação, minimapa, revelação, conversa do jacaré, cena do pombo), não dos minijogos. Testes: 598 em 66 arquivos → 733 em 81.

## Limites

- Os tempos 51/64/≤ 92 s são de bots determinísticos em 1/60 s; jogador real varia. As constantes (`MONKEY_V`, `SHAKE_T`, dicas) foram calibradas **com esses bots**; mexer no percurso ou na física obriga a rodar `tests/chase.test.ts` e reavaliar.
- Layout de toque foi verificado emulado (sem ergonomia física): o bead de validação em aparelho real cobre dois polegares, gesto de esquiva e legibilidade da carta em tela pequena.
- Pendências menores da revisão (ver Beads): `lastLegacyEquipped` é global do módulo; o backup `.json` e a nuvem carregam `jacare` em `ownedSkins` (cliente antigo falha a validação sem apagar dados); alocações pequenas por quadro no `Input.poll` do boxe.
