# Lago vivo, perseguição do macaco e boxe do jacaré — Plano de implementação

> **Para agentes executores:** este arquivo é a especificação e o plano. Execute tarefa por tarefa (T0 → T12), na ordem das dependências do Beads. Cada tarefa tem: bead, arquivos, interfaces, desenho, passos com checkbox, testes e critério de aceite. O prompt de execução fica em [PROMPT_SONNET.md](PROMPT_SONNET.md).

**Objetivo:** transformar o lago da selva/Atlântida numa exploração viva no espírito de Hungry Shark Evolution (sem peixes travando nas paredes, cardumes, vegetação de rio, bolhas, minimapa e uma Praça do Pensador épica) e criar dois minijogos novos na fase 2: a perseguição do macaco que rouba a carta da princesa Júlia e o boxe em terceira pessoa contra o jacaré dançante, que dá a skin Jacaré.

**Arquitetura:** o lago continua no mundo (simulação pura em `src/game/`, desenho em `src/art/`, arte preparada na tela de carregamento da selva). Os dois minijogos seguem o padrão dos interiores: um fluxo minúsculo no pacote principal (`src/game/minigameFlow.ts`) que só usa `import type` e `import()`, congela o mundo e entrega a tela a uma sessão carregada sob demanda (`src/game/minigames/**` + `src/art/minigames/**`). Simulações são headless e determinísticas (PRNG com semente), testadas em Vitest sem DOM.

**Stack:** TypeScript + Vite + Canvas 2D + WebAudio procedural; Vitest. Sem bibliotecas de jogo. Única dependência nova permitida: `@fontsource/caveat` (letra de mão da carta), carregada só dentro do módulo da perseguição.

**Beads:** épico `karim-uer`; tarefas `karim-uer.1` (T0) até `karim-uer.13` (T12). Ver `bd show karim-uer`.

---

## Restrições globais (valem para todas as tarefas)

- Ler antes de tocar em render/arte/HUD/loop/controles: [REGRAS_DE_DESENVOLVIMENTO.md](../desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md) (D01–D08), [AGUA_E_BALADA_2026-10-05.md](../desenvolvimento/AGUA_E_BALADA_2026-10-05.md) e [EXPLORACAO_E_PROFUNDIDADE_2026-10-05.md](../desenvolvimento/EXPLORACAO_E_PROFUNDIDADE_2026-10-05.md).
- Canvas principal durante gameplay e minijogos: `imageSmoothingEnabled = true`, `imageSmoothingQuality = 'low'`. Qualidade `high` só em contextos de bake/pré-redução. Quem mudar estado de contexto salva e restaura.
- Não mexer em `DRS_MIN = 0.75`, `drawSprShrunk`, `FramePacer.raw` nem na separação entre intervalo bruto e tempo protegido da física.
- Nada de canvas, gradiente, `ctx.filter`, `shadowBlur`, `getImageData` ou fonte nova criados por quadro. Tudo assado no carregamento (ou na entrada do minijogo) e reaproveitado.
- Nenhuma alocação por quadro nos laços quentes (`update`/`draw`): sem arrays/objetos/closures novos por entidade por quadro; use pools e arrays pré-alocados; remoção por troca-com-o-último quando a ordem não importa.
- Simulação não importa arte nem DOM (`src/game/**/sim/**`, `water.ts`, `lake/*.ts`, `village.ts`, `letterScene.ts`). Testes rodam em Node.
- Simulação determinística: PRNG com semente (`Rng` de `src/core/math.ts` ou `mulberry` de `water.ts`). `Math.random` só em efeito puramente visual que não afeta estado.
- Saves: IDs existentes de inimigos/itens nunca mudam; itens novos são **anexados no fim** de `buildAtlantis` (última chamada de `buildJungle`). Campos novos de save são **opcionais** e validados em `src/core/saveValidation.ts`. `encounters` ≤ 64 IDs, formato `/^[a-z0-9:-]{1,80}$/`.
- Rosto do Karimbo é sempre a foto (nunca redesenhar). A princesa Júlia **não é desenhada**: existe só em texto (falas e carta).
- Decoração nunca altera colisão, entradas, tesouros ou IDs. Ao aumentar um plano decorativo, conferir se não encobre superfície caminhável, item ou o Karimbo.
- Primeiro plano desfocado estilo Rayman Legends (decos com `par`) é marca do jogo: usar no lago e na perseguição.
- Texto do jogo em português do Brasil. Mensagens de commit em português.
- Commit ao concluir cada tarefa (regra do usuário em `AGENTS.md`): `npm run typecheck` e `npm test` antes; `npm run build` quando mexer em assets/config/entrada; `git status --short` para não esquecer `??` necessários; `git add` com caminhos explícitos (há alterações de terceiros possíveis). Nunca incluir `docs/NARRACAO.md`, `docs/PROMPT_npcs_e_entrada_do_boss.md`, `plans/`, `tools/_work/`, `dist/`. Push/deploy só com pedido explícito do usuário.

## Foco de revisão (falhas que nenhum teste "natural" pegaria)

1. **Perfil gravado pela versão nova lido por cliente antigo em cache.** `src/core/storage.ts:115` invalida o progresso inteiro se `ownedSkins` contiver ID desconhecido. Com a skin `jacare`, uma aba antiga pode tratar o perfil como inválido. Esperado: nenhuma perda de moedas/skins. Dono: T5 (teste + análise documentada; seguir o padrão do espelho `karimbolandia.wallet.v1` criado em `2a6395b`/`8d9ec92`).
2. **Interrupção no meio do minijogo** (pausa, aba oculta, voltar ao menu, girar/redimensionar a tela, perder o foco). Esperado: `lockInput` liberado, modo de toque normal, música restaurada, nenhum prêmio duplicado ou concedido sem vitória. Dono: T6.
3. **Dois polegares no boxe** (dois botões ao mesmo tempo, `pointercancel`, gesto de esquiva com o outro dedo segurando um botão). Esperado: cada ponteiro tem dono; soltar um não solta o outro. Dono: T6/T8.
4. **Custo com zoom-out** na revelação da estátua e com todos os cardumes na tela. Esperado: tetos de desenho respeitados também no menor zoom usado. Dono: T2/T4.
5. **AGIR na praça do jacaré** com porta de casa por perto. Esperado: a ação mais próxima vence; nunca entrar numa casa querendo falar com o jacaré (nem o contrário); ↑ continua batendo palmas. Dono: T7.

Cada item acima tem o teste correspondente dentro da tarefa dona.

---

## Mapa do código atual (onde cada coisa vive hoje)

| Assunto | Onde | Observação |
|---|---|---|
| Peixes ambientes, bolhas, ondas | `src/game/water.ts` (`Waters`) | `freeAt` (l.112) faz **todo** peixe rebater em pedra (l.244–256): é a causa do bug. |
| Desenho da água/peixes | `src/art/waterDraw.ts` | `drawWaterBack` desenha camadas 0 e 1 **antes** dos tiles (l.324–372); camada 2 em `drawWaterFront` (l.433). `drawFish` escolhe mip pela largura na tela (l.260). |
| Ordem no mundo | `src/game/world.ts` | update: `village` l.1132, `club` l.1133, `encounters` l.1135, `water` l.1137; draw: `drawWaterBack` l.1244, decos back l.1246, `drawWaterFront` l.1310, `drawDeepLights` l.1311, decos front l.1314. |
| Lago e Atlântida | `src/game/level/atlantis.ts` | `LAKE_X0=474, LAKE_X1=550, LAKE_TOP=34, LAKE_FLOOR=44, DEEP_X0=464, DEEP_X1=616, ABYSS_FLOOR=104`; estátua `aThinker` em x=518 no leito; relíquias, cardumes de piranha. |
| Lago raso (zona) | `src/game/level/jungle.ts:538` | `b.waterZone('lake', LAKE_X0, LAKE_X1, LAKE_TOP, LAKE_FLOOR, 0)`. Outro lago pequeno em l.124 (aldeia): **não** entra no minimapa. |
| Arte da estátua | `src/art/atlantisDecor.ts` | Foto `getJungle().thinker`; imagem, pose, textura e posição devem ser preservadas. |
| Nado do Karimbo | `src/game/player.ts` | `updateSwim` l.1169; velocidade `SW` l.1186 (Atlante 1.3× embutido); `applyPerks` l.332 (vida e ar). |
| Atributos base | `src/core/gearCatalog.ts:32` | `KARIMBO_BASE={hp:119, air:13.8, nades:2}`; `karimboStats(gear)`. |
| Skins | `src/core/skinCatalog.ts`, `src/core/skins.ts`, `src/art/karimbo.ts:87-91` | Paletas por skin em `Record<SkinId,string>`; `chooseSkin`; loja em `src/ui/menus.ts:530-579`. |
| Validação do perfil | `src/core/storage.ts:114-116` | Skin desconhecida invalida o progresso. |
| Jacaré da roda | `src/game/village.ts`, `src/art/dancingAlligator.ts`, `src/game/level/community.ts` | `DANCE_TILE=1004`, `DANCE_ID='jungle:alligator-circle'`; hoje ↑ **ou** AGIR entram na roda (`join`). Jacaré não tem chapéu (e **não ganha**: o "chapéu" do plano é só o da skin, ver T5). |
| Macacos | `src/art/wildlife.ts` | Partes `marmoset`/`capuchin` (corpo+cabeça) assadas em `prepareWildlifeArt` (chamada em `src/art/jungle.ts:141`). |
| Cena roteirizada no mundo | `src/game/club.ts` | Padrão: `control(ctl)`, `camera(w)`, `music(w)`, `reset(w)`, `finish` → `hooks.onControlReturned/onBanner/onProgress`. |
| Cinemática em tela | `src/game/comic.ts` (`BossComic`) | Desenho em espaço de tela sobre o mundo congelado. |
| Carregamento sob demanda | `src/game/interiorFlow.ts` + integração em `src/game/game.ts` (l.1040, 1158, 1267, 1316; resets l.429/479/627/648) | Teste de isolamento: `tests/interiorLoading.test.ts`. |
| Toque | `src/ui/touch.ts` (`TouchUI`) | Dono do ponteiro por `dataset.pid`, `lostpointercapture`, `releaseAll` (l.349), `setInterior`. |
| Entrada | `src/core/input.ts` | `ActionName`, mapeamento teclado l.260–276, gamepad l.280–315, `isKeyDown` l.408. |
| Física | `src/game/movement.ts` (`RUN=196`, `RUN_ACC=2300`, `GRAV=1780`, `JUMP_V=668`, `COYOTE=.11`, `JUMP_BUF=.13`), `src/game/physics.ts` (`Body`, `newBody`, `moveBody(b, dt, level, solids, oneWay)`), `src/game/level.ts` (`Level(w,h)`, `TILE=32`, `T`). |
| Música | `src/core/music.ts` | `ThemeName` l.9, `THEMES` l.154, percussão tribal/congas l.579–672, `MIX` l.688. `MusicState` em `src/game/world.ts:56`. |
| Saves | `src/game/save.ts` (`SaveState` l.15–50, gravação l.84–85, restauração l.133–134), `src/core/saveValidation.ts` (l.22 encounters ≤ 64). |
| Encontros/prêmios | `src/game/encounters/index.ts` (`completed`, `reward`). |
| HUD | `src/game/hud.ts` | Lado direito: oxigênio/profundidade em `W-16, T+46/62` (l.385–411); `numText` com vaga fixa por campo; `drawSprShrunk` para ícones. |
| Testes úteis | `tests/helpers/bot.ts` (`makeWorld`, `newCtl`), `tests/atlantis.test.ts` (helper `jungle()` com `localStorage` falso), `tests/club.test.ts`, `tests/skins.test.ts`, `tests/interiorLoading.test.ts`, `tests/renderCost.test.ts`, `tests/touchPointers.test.ts`, `tests/touchSync.test.ts`. |
| QA no navegador | `?qa=1` expõe `window.__kg = {game, world, art}`; `?fase=2&tp=<tile>&god=1&touch=1&perf=1&nopause=1`. |

## Estrutura de arquivos

**Novos — no pacote principal (pequenos):**
- `src/game/lake/species.ts` — tabelas de espécies e comportamento (sim).
- `src/game/lake/lakeMap.ts` — grade explorada, bitset, marcos, % (sim).
- `src/game/lake/thinkerReveal.ts` — cena única da Praça do Pensador (sim).
- `src/game/level/lakeFlora.ts` — posicionamento de vegetação/pérolas (chamado no fim de `buildAtlantis`).
- `src/art/lake/lakeLife.ts` — sprites das espécies (assados).
- `src/art/lake/lakeFlora.ts` — plantas estáticas (cache de decos) e animadas.
- `src/art/lake/minimap.ts` — bake e desenho do minimapa.
- `src/art/lake/thinkerFx.ts` — facho de luz, halo, brilho dos cristais.
- `src/game/alligatorTalk.ts` — máquina da conversa com o jacaré (sim).
- `src/art/alligatorHood.ts` — o **chapéu de caça da skin Jacaré**: a própria cabeça de um jacaré (focinho, olhos saltados, dentes, crista) usada como fantasia na cabeça do Karimbo, entre as orelhas, sem cobrir o rosto. Só a skin usa; o jacaré da roda/boxe/KO **não** usa chapéu.
- `src/art/alligatorKO.ts` — jacaré nocauteado + crianças preocupadas + graveto.
- `src/game/letterScene.ts` — cena do pombo e do macaco no mundo (sim).
- `src/art/letterActors.ts` — pombo-correio, bolsinha, carta dobrada (macaco reaproveita `wildlife.ts`).
- `src/game/minigameFlow.ts` — fluxo sob demanda (só `import type` + `import()`).
- `src/game/minigames/types.ts` — **somente tipos** (`MinigameId`, `MinigameResult`, `MinigameSession`, `MinigameContext`).

**Novos — carregados só por `import()`:**
- `src/game/minigames/boxing/index.ts` + `sim/{rules,fighter,gator,crowd,match}.ts`
- `src/art/minigames/boxing/{scene,karimboBack,gatorFront,kids,hud,fx}.ts`
- `src/game/minigames/chase/index.ts` + `sim/{course,runner,monkey,hazards,match,letterFilm,rewind}.ts`
- `src/art/minigames/chase/{canopy,branches,animals,monkey,hud,letterPaper,rewindFx}.ts`

**Modificados:** `src/game/water.ts`, `src/art/waterDraw.ts`, `src/game/level/atlantis.ts` (só anexos no fim + exportar marcos), `src/game/world.ts`, `src/game/save.ts`, `src/core/saveValidation.ts`, `src/game/hud.ts`, `src/game/player.ts` (perks por skin, embalo de braçadas), `src/core/skinCatalog.ts`, `src/core/skins.ts`, `src/core/storage.ts` (se a análise de compatibilidade exigir), `src/art/karimbo.ts`, `src/ui/menus.ts`, `src/game/village.ts`, `src/art/dancingAlligator.ts` (sem chapéu; só tapa/cabeçada/nocaute), `src/art/village.ts` (poses de criança), `src/game/game.ts`, `src/ui/touch.ts`, `src/core/input.ts`, `src/core/music.ts`, `src/core/audio.ts` (sfx procedurais novos), `src/art/jungle.ts` (preparar artes novas), `src/game/level/jungle.ts` (gatilho da carta), `src/debug/sprites.ts`/`npcs.ts` (vitrine).

**Testes novos:** `tests/lakeFish.test.ts`, `tests/lakeLife.test.ts`, `tests/lakeMap.test.ts`, `tests/thinkerReveal.test.ts`, `tests/skinJacare.test.ts`, `tests/minigameLoading.test.ts`, `tests/minigameFlow.test.ts`, `tests/alligatorTalk.test.ts`, `tests/boxing.test.ts`, `tests/letterScene.test.ts`, `tests/chase.test.ts`, `tests/letterFilm.test.ts`.

**Documentação (T12):** `docs/desenvolvimento/LAGO_VIVO_E_MINIMAPA_<AAAA-MM-DD>.md`, `docs/desenvolvimento/MINIJOGOS_PERSEGUICAO_E_BOXE_<AAAA-MM-DD>.md`, nova regra D09 em `REGRAS_DE_DESENVOLVIMENTO.md`, links no índice `docs/desenvolvimento/README.md`, ponteiros espelhados em `AGENTS.md` e `CLAUDE.md`.

---

## T0 — Preparação e linha de base (`karim-uer.1`)

- [ ] `bd update karim-uer.1 --claim`. Ler `AGENTS.md`, `CLAUDE.md`, as três leituras obrigatórias das restrições globais e este plano inteiro.
- [ ] `git status --short` e `git log --oneline -5`. A base é a branch atual `feat/interiores-iso` (contém o alinhamento da água à perspectiva, `6724199`). Criar `feat/lago-macaco-jacare` a partir do HEAD atual. Não descartar nem estagiar alterações de terceiros.
- [ ] Rodar `npm run typecheck`, `npm test`, `npm run build`; anotar número de arquivos/testes e o tamanho (bruto e gzip) do chunk principal `dist/assets/index-*.js` e dos chunks da selva.
- [ ] Linha de base de desempenho do lago (D05/D06): Chrome desktop, `?fase=2&qa=1&perf=1&god=1&tp=520`; mesma rota de câmera (lago raso → fenda → praça → palácio) com o traje de mergulho; registrar P95/P99/máximo e % de quadros acima de 20,8 ms do painel `perf`, mais resolução/DPR. Guardar em `tools/_work/lago-baseline.json` (não versionado). Não chamar isso de prova física.
- [ ] Sem commit nesta tarefa (nada versionado mudou). Fechar o bead com as medições no `--reason`.

## T1 — Peixes atravessam paredes com profundidade (`karim-uer.2`)

**Sintoma:** peixes do lago batem nas paredes da cidade submersa e ficam rebatendo. **Causa demonstrada:** `Waters.update` trata pedra como parede para todo peixe (`freeAt` + rebote), embora as camadas 0 e 1 já sejam desenhadas atrás dos tiles. **Correção:** o peixe se afasta da câmera (encolhe ~22% e some um pouco na água), passa por trás da pedra e volta ao tamanho normal. As bordas da zona d'água continuam limitando.

**Arquivos:** `src/game/water.ts`, `src/art/waterDraw.ts`, `tests/lakeFish.test.ts`.

**Interfaces (produz):**
```ts
// src/game/water.ts — campos novos em Fish
/** 0 = no plano de origem; 1 = afastado da câmera (passando atrás de pedra). Contínuo. */
depth: number;
depthGoal: 0 | 1;
/** segundos seguidos sem pedra no corpo e à frente (histerese da volta) */
clearT: number;
/** segundos seguidos dentro de pedra (salvaguarda) */
rockT: number;

export const FISH_BACK_SCALE = 0.78; // −22% no fundo
export const FISH_BACK_FADE = 0.35;  // quanto se mistura à água no fundo
export const FISH_DIVE_RATE = 2.2;   // 1/s: ~0,45 s para afastar
export const FISH_RISE_RATE = 1.4;   // 1/s: ~0,7 s para voltar
export const FISH_CLEAR_HOLD = 0.3;  // s livres antes de voltar
export const FISH_LOOKAHEAD = 0.8;   // s de antecipação da pedra
/** escala de desenho: diminui um pouco quando o peixe se afasta */
export const fishScale = (f: Fish) => 1 - (1 - FISH_BACK_SCALE) * f.depth;
/** passe de desenho: 0 = fundo (antes da névoa), 1 = meio (antes dos tiles), 2 = frente (depois do Karimbo) */
export const fishPass = (f: Fish): 0 | 1 | 2 => (f.layer === 0 ? 0 : f.layer === 2 && f.depth < 0.5 ? 2 : 1);
```

**Desenho do algoritmo (substitui o bloco "nunca atravessa pedra", l.244–256):**
```ts
// separar freeAt em duas consultas (freeAt continua = inZone && !rockAt, usado para alvos e spawn)
private inZone(z: WaterZone, x: number, y: number, pad: number) { /* só os limites da zona (parte 1 de freeAt) */ }
private rockAt(x: number, y: number, pad: number) { /* só os 4 solidAtPx de freeAt */ }

// dentro do laço, depois de calcular nx, ny:
const pad = Math.max(10, f.size * 0.35);
const lead = f.lead >= 0 ? this.fish[f.lead] : null;
const rockHere = this.rockAt(nx, ny, pad);
const rockAhead = this.rockAt(f.x + f.vx * FISH_LOOKAHEAD, f.y + f.vy * FISH_LOOKAHEAD, pad)
  || this.rockAt(f.x + f.vx * FISH_LOOKAHEAD * 0.5, f.y + f.vy * FISH_LOOKAHEAD * 0.5, pad);
if (rockHere || rockAhead || (lead !== null && lead.depthGoal === 1)) { f.depthGoal = 1; f.clearT = 0; }
else if ((f.clearT += dt) >= FISH_CLEAR_HOLD) f.depthGoal = 0;
f.depth = f.depthGoal === 1 ? Math.min(1, f.depth + dt * FISH_DIVE_RATE) : Math.max(0, f.depth - dt * FISH_RISE_RATE);
// ainda no plano e prestes a entrar na pedra: espera afastar (sem estalo de camada, sem rebote)
if (rockHere && f.depth < 0.5) { nx = f.x; ny = f.y; f.vx *= 0.5; f.vy *= 0.5; }
// salvaguarda: preso atrás de pedra por muito tempo, escolhe outro alvo em água livre
f.rockT = rockHere ? f.rockT + dt : 0;
if (f.rockT > 5 && f.lead < 0) { this.pickTarget(f); f.rockT = 0; }
// a borda da zona continua sendo parede (comportamento antigo de rebote, só para inZone)
if (!this.inZone(z, nx, ny, pad)) { /* mesmo tratamento por eixo que existia, usando inZone */ }
```
`pickTarget` e o spawn continuam escolhendo pontos com `freeAt` (água livre): o peixe nunca "mora" dentro da pedra; só o caminho cruza.

**Desenho (`waterDraw.ts`):** `fishLayer(g, w, pass)` filtra por `fishPass(f) === pass` (não mais `f.layer`). `drawFish` usa `size = f.size * fishScale(f)` para a escala **e** para escolher o mip (`need = size * k`), e `globalAlpha = 1 - FISH_BACK_FADE * f.depth` (dentro do `save/restore` que já existe). Nada de filtro/tint por quadro.

**Passos:**
- [ ] Escrever `tests/lakeFish.test.ts` (abaixo) e ver falhar.
- [ ] Implementar campos, constantes, `inZone/rockAt`, novo bloco, `fishPass/fishScale`; inicializar `depth=0, depthGoal=0, clearT=0, rockT=0` no spawn.
- [ ] Ajustar `fishLayer`/`drawFish`.
- [ ] Rodar teste novo + `tests/atlantis.test.ts` + suíte; typecheck.
- [ ] QA visual: `?fase=2&qa=1&god=1&tp=507` com traje: peixe cruzando a torre e o palácio encolhe, some atrás da pedra, reaparece e cresce; nenhum peixe da frente "estala" para trás da parede.
- [ ] Commit: `git add src/game/water.ts src/art/waterDraw.ts tests/lakeFish.test.ts` → "Faz os peixes do lago passarem por trás das paredes, afastando-se da câmera em vez de travar".

**Testes (`tests/lakeFish.test.ts`):**
```ts
import { describe, expect, it } from 'vitest';
import { Level, T, TILE } from '../src/game/level';
import { Waters, fishPass, fishScale, FISH_BACK_SCALE, type Fish } from '../src/game/water';
import type { WaterZone } from '../src/game/level';

function pond() {
  const L = new Level(40, 20);               // tudo vazio
  for (let y = 4; y < 16; y++) L.set(20, y, T.SOLID, 0); // parede no meio do lago (confira a assinatura de set)
  const zone = { id: 0, kind: 'lake', x: 2 * TILE, y: 3 * TILE, w: 36 * TILE, h: 14 * TILE } as WaterZone;
  const w = new Waters([zone], L, []);
  w.fish.length = 0;
  return { L, zone, w };
}
const fishAt = (zone: WaterZone, x: number, y: number, layer: 0 | 1 | 2, tx: number): Fish => ({
  kind: 0, x, y, vx: 0, vy: 0, size: 60, dir: 1, turn: 1, ph: 0, speed: 46, tx, ty: y, layer, lead: -1,
  offX: 0, offY: 0, wait: 0, scared: 0, zone, depth: 0, depthGoal: 0, clearT: 0, rockT: 0,
});

describe('peixes do lago passam por trás das paredes', () => {
  for (const layer of [0, 1, 2] as const) it(`camada ${layer}: atravessa, encolhe dentro da pedra e volta`, () => {
    const { L, zone, w } = pond();
    const f = fishAt(zone, 10 * TILE, 9 * TILE, layer, 32 * TILE);
    w.fish.push(f);
    let inRock = 0, minScale = 1;
    for (let i = 0; i < 60 * 30 && f.x < 30 * TILE; i++) {
      f.tx = 32 * TILE; f.ty = 9 * TILE; f.wait = 0;            // mantém o alvo do outro lado
      w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE);
      if (L.solidAtPx(f.x, f.y)) { inRock++; expect(f.depth).toBeGreaterThanOrEqual(0.5); }
      if (layer === 2 && L.solidAtPx(f.x, f.y)) expect(fishPass(f)).toBe(1); // nunca na frente da pedra
      minScale = Math.min(minScale, fishScale(f));
    }
    expect(f.x).toBeGreaterThan(30 * TILE);                   // passou: não ficou travado
    expect(inRock).toBeGreaterThan(0);
    expect(minScale).toBeCloseTo(FISH_BACK_SCALE, 2);
    for (let i = 0; i < 90; i++) w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE);
    expect(f.depth).toBeLessThan(0.05);                        // voltou ao tamanho normal
  });

  it('a borda da zona continua sendo limite', () => {
    const { zone, w } = pond();
    const f = fishAt(zone, 4 * TILE, 9 * TILE, 1, -50 * TILE);
    w.fish.push(f);
    for (let i = 0; i < 600; i++) { f.tx = -50 * TILE; w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE); }
    expect(f.x).toBeGreaterThanOrEqual(zone.x);
  });

  it('no lago real nenhum peixe fica parado contra pedra', async () => {
    const { buildJungle } = await import('../src/game/level/jungle');
    const { World } = await import('../src/game/world');
    const world = new World(buildJungle());
    const water = world.water;
    let stuck = 0, samples = 0;
    for (let i = 0; i < 60 * 30; i++) {
      water.update(1 / 60, -9999, -9999, false, 0, 1e9);
      for (const f of water.fish) {
        if (f.wait > 0 || f.scared > 0) continue;
        samples++;
        if (Math.hypot(f.vx, f.vy) < 2 && world.level.solidAtPx(f.x + Math.sign(f.tx - f.x) * f.size * 0.4, f.y)) stuck++;
      }
    }
    expect(stuck / samples).toBeLessThan(0.002);
  });
});
```
(O teste do lago real precisa do `localStorage` falso de `tests/atlantis.test.ts` se `World` ler o perfil; copie o `beforeEach`.)

**Aceite:** os 5 testes passam; suíte inteira verde; nenhuma mudança em piranhas (inimigos continuam no plano do Karimbo e colidem, porque balas e mordidas precisam ser coerentes).

## T2 — Ecossistema do lago (`karim-uer.3`)

**Meta:** o lago raso parece um rio amazônico cheio de vida; Atlântida tem cardumes reluzentes no breu. Tudo barato: comportamento O(n) (líder/seguidor, sem boids O(n²)), sprites assados, culling, tetos.

**Espécies (simulação em `src/game/lake/species.ts`, arte em `src/art/lake/lakeLife.ts`):**

| Espécie | Onde | Grupo | Tamanho (px) | Comportamento |
|---|---|---|---|---|
| Neon (*Paracheirodon innesi*) — faixa azul elétrica + vermelho atrás | raso e Atlântida | cardumes de 24–36 | 11–14 | seguidores em treliça girada pela direção do líder, fase própria; dispersam quando o Karimbo passa e se reagrupam |
| Cardinal (faixa vermelha inteira) | Atlântida | cardumes de 20–28 | 12–15 | igual ao neon, mais fundo |
| Acará-bandeira (*Pterophyllum*) — prateado, 3–4 faixas pretas, nadadeiras altas | raso (perto das plantas) | grupos de 3–5 | 34–46 | planam devagar, pausas longas junto à vegetação |
| Acará-disco | ruínas | pares | 30–38 | contornam colunas devagar |
| Coridora | leito | grupos de 6–10 | 14–18 | "saltinhos" rente ao fundo (altura do leito calculada só ao escolher alvo) |
| Tucunaré — amarelo-esverdeado, faixas, ocelo na cauda | raso | 2–3 solitários | 60–80 | de vez em quando (cooldown 25–40 s) persegue um cardume de neon que se espalha; nunca remove peixes |
| Pirarucu | Atlântida | 2 | 180–230 | patrulha lenta em rota longa no fundo (camada 0); evento "peixe gigante": passa na camada 2 perto do palácio no máximo 1× a cada 90 s |
| Arraia (*Potamotrygon*, ocelos laranja) | leito raso e fundo | 3 | 70–90 de envergadura | desliza rente ao chão; levanta areia (≤ 6 partículas por evento) |
| Poraquê | fendas (câmara do canto, cofre) | 2 | 120 de comprimento | corpo segmentado ondulando (4–6 segmentos), cintilação elétrica com sprite de brilho pré-assado e composição `lighter` só nele; inofensivo |

Peixes-foto atuais (`kind 0/1`) continuam. Acrescentar `species: FishSpecies` em `Fish` (`'photo'` nos atuais) e despachar arte por espécie; atualizar o helper `fishAt` de `tests/lakeFish.test.ts` com `species: 'photo'`. Contagens por zona derivadas da área, com teto global `MAX_AMBIENT_FISH = 300`.

**Vegetação de rio (`src/game/level/lakeFlora.ts` posiciona; `src/art/lake/lakeFlora.ts` desenha):**
- Estáticas (assadas no cache de decos, como `ATLANTIS_BOUNDS`/`paintAtlantis`): sagitária, pedras/seixos, tronco submerso com musgo, raízes de igapó descendo da margem/teto, esponja de água doce (Atlântida).
- Animadas (balanço por segmentos, ≤ 4 `drawImage` cada, teto de **48 visíveis**): vallisnéria (fitas longas), cabomba (plumosa), aguapé flutuando na superfície com raízes balançando, algas luminescentes do fundo (pulso lento; composição `lighter` com sprite pré-assado).
- Primeiro plano desfocado (`par` + `blur` no bake, como `puKelp`) em 4–6 pontos do lago, sem esconder pérolas, relíquias ou passagens.

**Partículas e bolhas:**
- "Neve" em suspensão: duas texturas em mosaico (256×256, assadas) com paralaxe diferente, desenhadas no passe de trás; ≤ 8 `drawImage` por quadro.
- Cortinas de bolhas em fendas (novo deco `uVentLine`, reaproveita `vents`).
- Teto de bolhas de 110 → 160 **só** se a remoção virar troca-com-o-último (sem `splice`).

**Passos:**
- [ ] Testes em `tests/lakeLife.test.ts` (abaixo) e ver falhar.
- [ ] `species.ts` (tabela + spawn determinístico + comportamentos) e integração em `Waters` (mesma regra de profundidade da T1 para todos).
- [ ] Arte assada na tela de carregamento da selva, no mesmo ponto de `prepareWildlifeArt()` (`src/art/jungle.ts:141`). Conferir em `tests/stage*`/`tests/mobileRendering.test.ts` se a arte da selva está num chunk separado e seguir o mesmo caminho. Mips como `fish_a` (cópias reduzidas uma vez, com `high` só no bake).
- [ ] Vegetação: `decorateLake(b)` chamada **no fim** de `buildAtlantis` (decos não têm ID persistido, mas não reordenar pickups/inimigos).
- [ ] Teste de custo: contexto falso que conta `drawImage` desenhando o lago na praça com o menor zoom usado pela revelação (T4): total ≤ orçamento definido e registrado no teste.
- [ ] QA visual em 1440×900 e 844×390; comparar com a linha de base; medir P95/P99 como na T0.
- [ ] Commit com todos os arquivos novos (`git status --short`).

**Testes (`tests/lakeLife.test.ts`):** spawn determinístico (duas instâncias, mesmas posições após 600 passos); `water.fish.length ≤ MAX_AMBIENT_FISH`; cardume de neon mantém ≥ 80% dos membros a ≤ 120 px do líder após 10 s sem susto; com o Karimbo atravessando o cardume, a distância média ao Karimbo cresce em 0,5 s e o cardume se reagrupa em ≤ 4 s; tucunaré nunca reduz `fish.length`; nenhuma alocação: rodar 600 `update` e comparar `fish.length`/`bubbles.length` dentro dos tetos; orçamento de `drawImage` (contexto falso) no pior enquadramento.

**Aceite:** visual rico e coerente com o jogo; P95/P99 no lago sem piora relevante em relação à T0 (registrar números; se piorar, investigar o mecanismo antes de cortar efeito — D05).

## T3 — Minimapa do lago (`karim-uer.4`)

**Comportamento:** dentro do lago (raso + Atlântida) aparece um minimapa no canto superior direito, abaixo do indicador de profundidade. Área explorada mostra água e rocha; área a explorar fica **cinza**. Marcos descobertos ganham pino; relíquias vistas e não coletadas aparecem como ◆. Mostra `EXPLORADO 37%`. Some com fade fora do lago, em cinemáticas, interiores e minijogos.

**Arquivos:** `src/game/lake/lakeMap.ts`, `src/art/lake/minimap.ts`, `src/game/hud.ts`, `src/game/world.ts`, `src/game/save.ts`, `src/core/saveValidation.ts`, `src/game/level/atlantis.ts` (exportar `ATLANTIS_LANDMARKS`), `tests/lakeMap.test.ts`.

**Interfaces:**
```ts
// src/game/level/atlantis.ts (só export de dados; nada muda no mapa)
export const ATLANTIS_LANDMARKS: readonly { id: string; name: string; tx: number; ty: number }[];
// ids e colunas: 'fenda' (FENDA), 'portal' (493), 'torre' (508), 'praca' — Praça do Pensador (518),
// 'palacio' — Palácio de Netuno (544), 'casa' — Casa desabada (573), 'camara' — Câmara do canto (606),
// 'cofre' — Cofre sob o leito (595), 'nicho' — Nicho alto (467); linha = leito/posição do tesouro correspondente

// src/game/lake/lakeMap.ts
export const LAKE_CELL_TILES = 2;
export const LAKE_REVEAL_TILES = 5;
export class LakeMap {
  readonly x0: number; readonly y0: number; readonly cols: number; readonly rows: number; // em células
  readonly water: Uint8Array;  // 1 = célula com água
  readonly seen: Uint8Array;   // 1 = explorada
  version: number;             // incrementa só quando revela algo
  constructor(level: Level, zones: readonly WaterZone[]); // região = união das zonas 'lake' com a mesma superfície do lago principal
  contains(px: number, py: number): boolean;
  /** chamado quando o Karimbo muda de célula; devolve as células novas para o desenho incremental */
  reveal(px: number, py: number): number;
  newlySeen(out: number[]): number;           // índices revelados desde a última leitura (sem alocar)
  percent(): number;                          // inteiro 0..100 sobre células com água
  landmarkSeen(id: string): boolean;
  toSave(): string | undefined;               // base64 do bitset; undefined se nada visto
  load(s: string | undefined): void;          // tolerante: tamanho diferente => ignora sem lançar
  reset(): void;
}
// src/game/world.ts
lakeMap: LakeMap | null; // criado só quando a fase tem o lago principal (fase 2); null na fase 1
```
- Região derivada das zonas (não números fixos): zonas `kind === 'lake'` cuja superfície (`surface ?? y`) é `LAKE_TOP * TILE`.
- Revelação só quando a célula do Karimbo muda (não a cada quadro) e só se ele estiver dentro de uma dessas zonas.
- Banner único ao descobrir marco: `DESCOBERTO!` / nome do marco (não repete após carregar save, porque vem do bitset).

**Desenho (`src/art/lake/minimap.ts`):** tamanho lógico `largura = clamp(W*0.22, 120, 190)`, altura pela proporção; respeitar `safeR/safeT`. Três canvases assados no tamanho em pixels do destino (D02): `terrain` (água em degradê pela profundidade, rocha escura), `fog` (cinza `#7a7f87` α .9) e `composed`. Na revelação, para cada célula nova copiar o retângulo de `terrain` para `composed` (O(células novas)). Por quadro: moldura assada + `composed` + ponto do Karimbo pulsando (arco simples) + pinos (sprites assados, ≤ 12) + `numText('lakePct', …)`. Rebake só se a escala do HUD mudar.

**Save:** `SaveState.lakeMap?: string` — gravar só se houver algo visto; validar `typeof === 'string' && length ≤ 1024 && /^[A-Za-z0-9+/]*={0,2}$/`; restaurar com `LakeMap.load`; nova partida/`nextStage` limpa.

**Passos:** testes primeiro → `lakeMap.ts` → integração em `World` (instância criada na fase 2; `reveal` no `update` depois do jogador) → save/validação → arte/HUD → QA em 844×390 e 360×640 (sem sobrepor oxigênio, profundidade, pontuação nem botões de toque) → commit.

**Testes (`tests/lakeMap.test.ts`):**
```ts
it('revela um círculo, conta % sobre água e salva/carrega o bitset', async () => {
  const w = await jungle();                       // helper de tests/atlantis.test.ts
  const m = w.lakeMap!;
  expect(m.percent()).toBe(0);
  const fresh = m.reveal(518 * TILE, 95 * TILE);
  expect(fresh).toBeGreaterThan(0);
  expect(m.reveal(518 * TILE, 95 * TILE)).toBe(0); // mesma célula: nada novo
  const s = m.toSave()!;
  m.reset(); expect(m.percent()).toBe(0);
  m.load(s); expect(m.percent()).toBeGreaterThan(0);
  m.load('AAAA'); // tamanho errado: ignora sem lançar
});
```
Mais três casos no mesmo arquivo:
- **Lago pequeno da aldeia fora do mapa:** pegue a zona `lake` cuja superfície é diferente de `LAKE_TOP * TILE` (a de `jungle.ts:124`) e espere `m.contains(zona.x + 16, zona.y + 16) === false`.
- **Marco sem banner repetido:** espione `w.hooks.onBanner`; `reveal` na praça (518, leito) chama o banner `DESCOBERTO!` uma vez e `landmarkSeen('praca')` fica verdadeiro; grave com `toSave`, crie outro mundo, `load`, revele de novo no mesmo ponto: zero banners.
- **Validação:** `validateSave({ ...freshSave(2), lakeMap: 'não é base64!' })` devolve `null`; `{ ...freshSave(2), lakeMap: 'A'.repeat(1025) }` devolve `null`; sem o campo continua válido; com `m.toSave()` válido faz a ida e volta igual.

**Aceite:** minimapa legível nos dois viewports, cinza onde não se explorou, % correto, sem custo por quadro além de poucos `drawImage`.

## T4 — Praça do Pensador épica, pérolas, cardume fiel e embalo (`karim-uer.5`)

**Revelação única (`src/game/lake/thinkerReveal.ts`, padrão de `ClubScene`):**
- Gatilho: Karimbo nadando a ≤ 9 tiles da estátua (x=518, leito), sem cinemática ativa, fora de combate de piranha (`aggro` de nenhum cardume a ≤ 600 px). Uma vez por partida: `encounters.completed` recebe `'atlantis:thinker'`.
- Linha do tempo (6,5 s, não repetível; o Karimbo flutua parado, `lockInput`):
  - 0,0 s: `w.narrator.stop()`, música `monument` (nova), câmera `focus` no centro da estátua, `zoomTarget = min(atual, viewW / 900)` (enquadra a estátua inteira).
  - 0,3 s: cristais `aCrystal` próximos acendem (intensidade 0 → 1), facho de luz desce por uma fenda no teto da caverna (sprite assado, composição `lighter`, respiração lenta).
  - 0,8 s: dois anéis de neon (40 peixes no total) convergem e orbitam a estátua em sentidos opostos (modo `orbit` com centro/raio; raios 150 e 220 px).
  - 1,2 s: banner `O PENSADOR` / `Praça de Atlântida — o monumento de Karimbo`.
  - 1,5–2,5 s: bolhas sobem das bases (≤ 30 bolhas, respeitando o teto).
  - 5,5 s: câmera volta; 6,5 s: controle devolvido (`hooks.onControlReturned`), `hooks.onProgress`.
- Depois: halo de neon continua orbitando (só desenhado/simulado se visível), facho em intensidade 0,35, cristais acesos. Restaurar save com o ID concluído já monta esse estado.
- A imagem da estátua, a pose, a textura e a posição **não mudam**.

**Pérolas do lago:** 12 pickups novos de tipo `'pearl'` (+5 moedas cada), anexados **no fim** de `buildAtlantis` (depois dos tesouros atuais), em lugares que recompensam explorar: sob raízes de aguapé, atrás de vegetação do primeiro plano (visível o bastante para ser achado), entre colunas, no leito perto das arraias, na janela da torre, no fundo da câmara do canto etc. Contagem derivada dos IDs coletados (sem campo novo). Minimapa mostra `PÉROLAS 7/12`. Teste de alcance: cada pérola em tile vazio, dentro de uma zona `lake`, conectada à fenda por inundação sobre tiles não sólidos.

**Cardume fiel (12/12):** um cardume de 20 neons acompanha o Karimbo dentro do lago (cosmético), mantendo distância e fugindo de piranhas. Banner único: `CARDUME FIEL!`.

**Embalo de braçadas (`player.ts`, `updateSwim`):** braçadas encadeadas no ritmo (nova braçada entre 0,25 s e 0,65 s depois da anterior) sobem `embalo` até 3; velocidade horizontal ×(1 + 0,12 × (embalo − 1)) (máx. +24%); cai para 1 após 1,0 s sem braçada; rastro de bolhinhas (taxa limitada) com embalo ≥ 2. Não muda oxigênio, pressão nem colisão.

**Testes (`tests/thinkerReveal.test.ts`):** cena dispara uma vez, trava e devolve controle em ≤ 7 s, adiciona o ID, não dispara de novo após restaurar; não dispara com piranha agressiva perto; 12 pérolas alcançáveis e com IDs depois dos antigos (comparar contagem de pickups antes/depois e que os antigos mantêm índice); embalo: sequência no ritmo chega a +24%, fora do ritmo volta a 1, velocidade nunca passa do limite; teto de desenho com zoom mínimo da revelação (contexto falso).

**Aceite:** a revelação arrepia (câmera, luz, cardume, música) e não pesa; pérolas/cardume fiel funcionam e são salvos.

## T5 — Skin Jacaré (`karim-uer.6`)

**Catálogo (`src/core/skinCatalog.ts`):**
```ts
{ id: 'jacare', name: 'Jacaré', price: 0, color: '#5f8a45', shop: 'boxing',
  perk: 'Fôlego +30%, nado +40% e vida +10%',
  description: 'Macacão de escamas, barriga listrada, rabo e o chapéu de caça: uma cabeça de jacaré usada de fantasia. Só veste quem vence o jacaré no boxe.' },

/** Multiplicadores por traje. Fonte única: o Player não testa ids de skin espalhados. */
export const SKIN_PERKS: Record<SkinId, { air: number; swim: number; hp: number }> = {
  classic: { air: 1, swim: 1, hp: 1 }, explorer: { air: 1, swim: 1, hp: 1 }, neon: { air: 1, swim: 1, hp: 1 },
  diver: { air: 1, swim: 1, hp: 1 }, atlante: { air: 1, swim: 1.3, hp: 1 }, jacare: { air: 1.3, swim: 1.4, hp: 1.1 },
};
```
- `breathesUnderwater` não muda (jacaré **não** respira debaixo d'água; tem mais fôlego).
- `Player.applyPerks`: `maxHp = Math.round(st.hp * perks.hp)`, `oxyMax = st.air * perks.air`. `updateSwim`: `SW = 150 * karimboStats(gear).swim * SKIN_PERKS[skin].swim` (remove o `atlante ? 1.3` embutido).
- Trocar de skin com partida aberta (loja acessível na pausa?) chama `player.applyPerks(false)` — conferir os pontos de troca em `menus.ts` (já existe `player.applyPerks(true)` em l.620 para melhorias).
- `chooseSkin`: `shop === 'boxing'` e não possuída ⇒ `'locked'`. Nova `grantSkin(id: SkinId, source: 'boxing' | 'relics'): boolean` (adiciona em `ownedSkins` uma vez, `saveProgress`); conferir como o Atlante é liberado hoje e reutilizar o mesmo caminho.
- Loja (`menus.ts:546-563`): texto bloqueado `VENÇA O JACARÉ NO BOXE`.
- Preço 0: o saldo (`coinBalance`) não muda ao ganhar. Nunca dar preço > 0 a skin de recompensa.

**Arte (`src/art/karimbo.ts` + `src/art/alligatorHood.ts`):** macacão verde (`#5f8a45`/`#4a7038`) com escamas assadas, barriga creme (`#e2d8a4`) com listras horizontais, luvas com garrinhas, rabo (camada própria atrás das pernas, balançando com a passada), e o **chapéu de caça**: a **própria cabeça de um jacaré** (focinho comprido apontando para a frente, dois olhos saltados, fileira de dentes, crista de escamas e boca entreaberta) assentada no alto da cabeça do Karimbo como fantasia de caçador/troféu, entre as orelhas, **sem cobrir o rosto** (a foto continua visível) e sem prender as orelhas. Mesma paleta verde do macacão; aceno cômico: o olho do chapéu acompanha o olhar do Karimbo. **Decisão do usuário (2026-10-05):** não é chapéu de palha; ele só existe na skin. Entradas nos `Record<SkinId,…>` de l.88–91. Pré-assar como as outras variantes; incluir na vitrine `?debug=sprites`.

**Compatibilidade (Foco de revisão 1):** investigar `git log -S "ownedSkins" -- src/core/storage.ts` e os commits `2a6395b`/`8d9ec92`; descobrir o que uma aba antiga faz quando `validateProgress` devolve `null` (sobrescreve? usa o espelho da carteira?). Proteger para que um cliente antigo nunca apague moedas/skins por causa de `jacare`, e registrar a análise no estudo de caso da T12.

**Testes (`tests/skinJacare.test.ts`):** `grantSkin('jacare','boxing')` adiciona uma vez e `coinBalance()` não muda; `chooseSkin('jacare')` antes de ganhar ⇒ `'locked'`, depois ⇒ `'equipped'`; com `jacare` equipado `maxHp` = `round(119 * 1.1)`, `oxyMax` = `13.8 * 1.3`, velocidade de nado 1,4× (medir `body.vx` alvo); Atlante continua 1,3× no nado; perfil com `jacare` passa na validação nova e sobrevive a `vi.resetModules()`; teste do comportamento combinado de carteira espelhada para o cenário de cliente antigo (o que for possível exercitar).

**Aceite:** skin bonita e reconhecível, perks corretos, saldo intacto, nenhum risco de perder perfil.

## T6 — Infra de minijogos sob demanda (`karim-uer.7`)

**Tipos (`src/game/minigames/types.ts`, só tipos):**
```ts
import type { World } from '../world';
import type { ControlState } from '../../core/input';
import type { Quality } from '../../art/index';
import type { DifficultyId } from '../../core/difficulty';
export type MinigameId = 'boxing' | 'chase';
export type TouchMinigameMode = 'boxing' | 'chase';
export interface MinigameResult { id: MinigameId; outcome: 'win' | 'lose' | 'abort'; time: number; mistakes: number }
export interface MinigameContext {
  w: World; quality: Quality; viewW: number; viewH: number; difficulty: DifficultyId;
  backdrop: HTMLCanvasElement | null;              // retrato do mundo na entrada (assado uma vez)
  music: (s: import('../world').MusicState) => void;
  touch: (mode: TouchMinigameMode | null) => void;
}
export interface MinigameSession {
  readonly done: boolean;
  update(dt: number, ctl: ControlState): void;     // dt protegido do loop (D04)
  draw(g: CanvasRenderingContext2D, W: number, H: number): void;
  resize(W: number, H: number): void;
  result(): MinigameResult | null;
  dispose(): void;                                 // libera canvases, listeners, clipes
}
export interface MinigameModule { create(ctx: MinigameContext): MinigameSession }
```

**Fluxo (`src/game/minigameFlow.ts`, copiar a forma de `InteriorFlow`):** fases `idle → zoom (íris 0,45 s) → wait (carregando) → live → back (0,4 s) → idle`. `prefetch(id)` faz `import('./minigames/boxing')`/`import('./minigames/chase')` em silêncio quando o jogador se aproxima do gatilho. `start(w, id, onDone)`: `w.narrator.stop()`, `w.clearEnemyBullets()`, guarda música/estado de toque, captura `backdrop` uma vez. `reset(w?)` aborta sem prêmio (`outcome: 'abort'`) e devolve tudo. Falha de carregamento ⇒ banner "O minijogo não pôde ser carregado. Tente de novo." e devolve o controle.

**Integração em `game.ts`:** espelhar `flow` dos interiores: `if (this.mini.active) { this.mini.step(w, dt, this.input.state); return; }` no passo; pular o mundo enquanto ativo; desenhar a sessão quando `drawsMinigame`; chamar `mini.reset` nos mesmos pontos de `flow.reset` (l.429/479/627/648); `resize` repassado. Hook novo em `World.hooks`: `onMinigame?: (id: MinigameId, done: (r: MinigameResult) => void) => void` (o mundo pede, o `Game` atende). Salvar só depois do resultado (`onProgress`), nunca no meio.

**Entrada:** `ControlState.mini?: MiniPad` preenchido só quando `input.miniMode !== null`:
```ts
export type MiniButton = 'jab' | 'cruzE' | 'ganchoE' | 'direto' | 'cruzD' | 'ganchoD' | 'esqE' | 'esqD' | 'guarda' | 'especial';
export type MiniPad = Record<MiniButton, Btn>;
```
- Teclado (modo boxe): Q jab, W cruzado esq., E gancho esq. | J direto, K cruzado dir., L gancho dir. | A/← esquiva esq., D/→ esquiva dir., S/↓ guarda | Espaço/Enter especial. Esc/P continuam pausando.
- Gamepad (modo boxe): X jab, Y direto, LB cruzado esq., RB cruzado dir., LT gancho esq., RT gancho dir., analógico/d-pad ←/→ esquiva, ↓ guarda, A especial.
- Modo perseguição: usa `moveX`, `moveY`, `jump` normais; `fire/grenade/reload/next/prev/interact` ignorados.
- Trocar de modo chama `suppressHeldActions` (exigir soltar antes de valer).

**Toque (`TouchUI.setMinigame(mode | null)`):** `'chase'` mostra joystick + PULO (esconde FOGO, granada, recarga, troca, AGIR); `'boxing'` esconde joystick e botões normais e mostra **3 botões à esquerda** (JAB, CRUZADO, GANCHO) e **3 à direita** (DIRETO, CRUZADO, GANCHO) + zona central de gesto (deslizar ←/→ ≥ 40 px em ≤ 250 ms = esquiva; segurar parado ≥ 180 ms = guarda enquanto segurar) + botão central grande `ORELHADA!` que só aparece quando liberado. Mesmas regras de dono de ponteiro (`dataset.pid`, `lostpointercapture`, `pointercancel`, `releaseAll`). `null` restaura o layout anterior. Respeitar áreas seguras.

**QA:** `?mini=boxing` e `?mini=chase` iniciam direto (só com `qa=1`).

**Testes:**
- `tests/minigameLoading.test.ts`: cópia adaptada de `tests/interiorLoading.test.ts` — nenhum arquivo fora de `src/game/minigames/**` e `src/art/minigames/**` importa deles por valor; `minigameFlow.ts` usa `import('./minigames/boxing')` e `import('./minigames/chase')`; `src/game/minigames/*/sim/**` não importa `art/` nem usa `document`/`window`.
- `tests/minigameFlow.test.ts` (com módulo falso injetável): `start` congela o mundo (posição do jogador e `w.time` não mudam durante `live`); `reset` no meio devolve `lockInput=false`, toque `null`, música anterior, resultado `abort` e nenhum prêmio; pausa não avança a sessão; falha de `import()` devolve o controle com banner.
- Toque: dois ponteiros (JAB e DIRETO) ao mesmo tempo geram as duas bordas; `pointercancel` em um não solta o outro; gesto de esquiva com o outro dedo segurando GANCHO funciona (Foco 3).

**Aceite:** nenhum byte dos minijogos no chunk principal (conferir `npm run build`), testes verdes.

## T7 — Jacaré: conversa e nocaute (`karim-uer.8`)

**Sem chapéu no jacaré:** o jacaré da roda, do boxe e do nocaute **não usa chapéu** (correção do usuário). O chapéu de caça é só da skin (T5) e o Karimbo o usa no boxe quando a skin estiver equipada.

**Conversa (`src/game/alligatorTalk.ts`, usada por `village.ts`):**
- Depois da primeira dança (`DANCE_ID` concluído), perto do jacaré (≤ 150 px) e com `canJoin` verdadeiro: **↑ continua batendo palmas** (comportamento atual) e **AGIR (F / botão AGIR / gamepad 8) passa a FALAR**. Antes da primeira dança nada muda. Atualizar os testes que esperavam AGIR = palmas e registrar a mudança no estudo de caso.
- Prioridade de AGIR (Foco 5): se houver porta/objeto de exploração mais perto que o jacaré, a exploração vence. Prompt sobre o jacaré: `AGIR: FALAR • ↑: PALMAS`.
- Estágios (sessão; voltam a 0 se o Karimbo se afastar > 1500 px, em `reset`/respawn). Balões curtos, 3,2 s cada, sem travar o controle nos estágios 1 e 2:
  1. **Karimbo:** "Ô seu jacaré, que palhaçada é essa de ficar dançando aí no meio?" — **Jacaré** (educado, para o gingado, endireita a postura e leva a mão ao peito): "Boa tarde, meu jovem! Isso aqui é a roda das crianças, eu trabalho com isso. Com todo o respeito... você tá atrapalhando o meu esquema."
  2. **Karimbo:** "Esquema? Que esquema, rapaz?" — **Jacaré** (para de dançar, rabo batendo no chão): "Ó, orelhudo... vou pedir uma vez só: para de encher o meu saco. Senão o bagulho vai ficar louco."
  3. **Karimbo:** "Louco como?" — **Jacaré** dá um TAPA na orelha (`thump`, orelha gira com impulso grande na mola `earSpr`, tremida de câmera, crianças: "UUUUUH!") — "Assim, ó! Agora é na mão, Parabólica! BORA PRO PAU!" → crianças começam "BRIGA! BRIGA! BRIGA! BRIGA!" → `hooks.onMinigame('boxing', …)`.
- Depois de perder: AGIR ⇒ "Quer mais, é? Tá bom... a orelha é sua." e vai direto ao boxe.
- Depois de vencer (`'jungle:alligator-boxing'` concluído): estado `ko` enquanto o Karimbo estiver na aldeia; ao se afastar > 2500 px da praça ou recarregar, estado `bandaged` (curativo no focinho, volta a dançar, roda reativada). Falar com ele `bandaged`: "Seu Karimbo! Tudo certo, patrão? Pode passar, pode passar..."; falar perto dele `ko`: criança "Shhh! Ele tá dormindo!".

**Nocaute no mundo (`src/art/alligatorKO.ts` + poses novas de criança em `src/art/village.ts`):** jacaré de barriga para cima, língua de fora, olhos em espiral, barriga subindo e descendo, rabo tremendo de vez em quando, uma luva azul caída ao lado, estrelinhas e três passarinhos girando sobre a cabeça, "Zzz" saindo. Crianças da roda em volta com poses preocupadas (mãos na cabeça/boca, inclinadas); uma **agachada cutucando com um graveto** em loop (cutucada 0,6 s a cada 2 s; o jacaré estremece e solta "Zzz" mais forte a cada cutucada). Balões ocasionais (um por vez, 8–12 s entre eles): "Será que ele morreu?", "Cutuca de novo!", "Ele tá respirando!", "Chama a Dona Benedita!". Palmas desativadas durante `ko`. Tudo assado/cacheado como os moradores (`figure.ts`), desenhado só se visível.

**Testes (`tests/alligatorTalk.test.ts`):** três AGIR ⇒ estágios 1, 2, 3 e pedido de `onMinigame('boxing')` exatamente uma vez; ↑ ainda inicia as palmas (rodar também os testes antigos da roda); afastar 1500 px zera; com porta de casa mais perto, AGIR vai para a porta; derrota ⇒ próxima conversa vai direto ao boxe; vitória ⇒ `ko`, palmas bloqueadas; afastar 2500 px ⇒ `bandaged`, palmas de volta; restaurar save com vitória ⇒ `bandaged`.

## T8 — Boxe em terceira pessoa (`karim-uer.9`)

**Cena:** câmera atrás do Karimbo (estilo Punch-Out!!/Fight Night). Karimbo **de costas** ocupando ~40% da parte de baixo da tela: nuca e cabelo procedurais (não há foto de costas), orelhas **para os lados** usando os sprites de orelha da foto (`earNear/earFar`, espelhados, com tom do verso assado uma vez), ombros, costas com a camiseta/macacão da skin equipada, luvas vermelhas. O jacaré de frente no meio da tela (paleta de `dancingAlligator.ts`, luvas azuis, sem chapéu). Se o Karimbo estiver com a skin Jacaré, ele aparece de costas com o chapéu de caça. Em volta, a roda das crianças em elipse com ordem de profundidade (as de trás menores; as mais próximas da câmera escuras e desfocadas, primeiro plano estilo Rayman). Fundo: `backdrop` da praça assado uma vez com desfoque no bake. HUD: barras de vida (retratos: `art.karimbo.heads.portrait` via `drawSprShrunk` e cabeça do jacaré), energia (stamina) do Karimbo, medidor de combo, avisos `CONTRA-ATAQUE!`, `ESQUIVA PERFEITA!`.

**Crianças:** ~60% torcem pelo Karimbo ("VAI KARIMBO!", "ORELHADA NELE!"), ~40% pelo jacaré ("VAI JACARÉ!", "ARRANCA A ORELHA DELE!"). Coro "BRIGA! BRIGA! BRIGA! BRIGA!" em balões no tempo da música (palmas/pisadas procedurais no beat). Reações: "UUUH!" em golpe forte, risada em golpe no ar, pulos em combo. Sem gravação de voz inventada: só balões + percussão/palmas procedurais. (Se o usuário fornecer um MP3 do coro depois, há um gancho opcional `clip 'briga'` — abrir bead, não criar áudio falso.)

**Regras (constantes em `sim/rules.ts`, valores iniciais; ajustar por teste e jogo):**

Karimbo: vida 100 (local do minijogo; a vida do mundo não muda), energia 100, regenera 22/s após 0,5 s sem socar; sem energia, golpes 40% mais lentos.

| Golpe | Lado | Dano | Energia | Preparo | Ativo | Recuperação |
|---|---|---|---|---|---|---|
| JAB | esq. | 4 | 5 | 0,06 s | 0,06 s | 0,14 s |
| DIRETO | dir. | 7 | 8 | 0,10 s | 0,07 s | 0,20 s |
| CRUZADO esq. | esq. | 10 | 12 | 0,16 s | 0,08 s | 0,28 s |
| CRUZADO dir. | dir. | 11 | 13 | 0,17 s | 0,08 s | 0,30 s |
| GANCHO esq. | esq. | 13 | 16 | 0,22 s | 0,08 s | 0,36 s |
| GANCHO dir. | dir. | 14 | 17 | 0,23 s | 0,08 s | 0,38 s |

Guarda do jacaré (visível: braços no rosto, na barriga ou abertos): **alta** — jab/direto 20%, cruzado 60%, gancho 100%; **baixa** — jab/direto/cruzado 100%, gancho 30%; **aberta** — 100%; **tonto** — 150%. Janela de contra-ataque: dano ×2. Combo: JAB→DIRETO→CRUZADO no ritmo (cada golpe ≤ 0,45 s depois do anterior) +25% no último; 5 acertos seguidos sem levar golpe ⇒ jacaré tonto 1,5 s.

Defesa do Karimbo: esquiva esq./dir. (invulnerável 0,30 s, recarga 0,25 s), guarda (dano recebido ×0,25, mas não segura rabada), esquiva nos últimos 0,25 s antes do impacto = **ESQUIVA PERFEITA** (câmera lenta 0,3 s + janela de contra).

| Ataque do jacaré | Telegrafia | Dano | Defesa certa | Janela de contra |
|---|---|---|---|---|
| Patada | 0,45 s (olho brilha) | 8 | esquiva ou guarda | 0,5 s |
| Rabada | 0,70 s (rabo recua, poeira) | 14 | só esquiva | 0,8 s |
| Mordidona | 0,90 s (bocão abre, dentes brilham, "CHOMP" pisca) | 22 | esquiva | 1,2 s |
| Cabeçada (fase 3) | 0,60 s (abaixa a cabeça e arranha o chão) | 10 | guarda | 0,6 s |
| Passinho da roda (provocação) | dança 1,5 s, crianças batem palmas | 0 | — | guarda aberta; se o Karimbo acertar 3+ golpes durante a dança, contrapé (10) |

Fases do jacaré (vida 160 no normal): **1** (100–60%) patadas e provocações; **2** (60–25%) entra mordidona, telegrafias ×0,9, combos de 2; **3** (< 25%) entra cabeçada, combos de 3, telegrafias ×0,8, olhos vermelhos ("FÚRIA"). Dificuldade (`src/core/difficulty.ts`): fácil — dano do jacaré ×0,7, telegrafias ×1,25, vida ×0,85; difícil — ×1,25, ×0,85, ×1,15. IA com PRNG de semente fixa por luta.

**Final:** vida do jacaré chega a 0 ⇒ estado **GROGUE** (cambaleando, estrelas) e o botão `ORELHADA!` aparece pulsando por 5 s. Se não apertar, ele se recupera com 12% e volta à fase 3. Apertando: cinemática de 2,4 s — câmera lenta, o Karimbo gira 360°, as orelhas crescem para os lados (mesma ideia do `earGlide`), PLAFT com clarão, quadro de impacto estilo HQ (letreiro `ORELHADA!!`, retícula), jacaré gira no ar, um dente voa, cai nocauteado; uma criança-juíza conta "1... 2... 3... 10! NOCAUTE!" em 1,5 s; crianças comemoram com folhas voando.

**Derrota:** vida do Karimbo 0 ⇒ ele cai de costas na direção da câmera (tremida, inclinação), o jacaré dança de deboche rebolando e batendo palma na própria barriga: "Volta pro berçário, Parabólica! Essa orelha apanha mais que bandeira em dia de vento!"; crianças riem "HAHAHA, ORELHUDO!". Volta ao mundo: Karimbo sentado tonto 1,5 s ao lado da roda; jacaré dançando de novo. Sem perda de vida/continue.

**Vitória:** `grantSkin('jacare','boxing')` (só a primeira vez), `encounters.completed.add('jungle:alligator-boxing')`, banner `SKIN DE JACARÉ DESBLOQUEADA!` / `Fôlego +30% • Nado +40% • Vida +10% — vista na Loja de Skins`, aldeia em estado `ko`, `onProgress`.

**Música:** tema novo `fight` (132 bpm, palmas no tempo do "BRI-GA!", surdo, congas; coro "HEY!" em viradas) e `silence` na cinemática da orelhada até o impacto. SFX procedurais novos em `audio.ts`: `punchLight`, `punchHeavy`, `whoosh`, `bell` (sino do jacaré abre a luta), `crowdGasp`, `crowdLaugh`, `chomp`.

**Testes (`tests/boxing.test.ts`, só simulação):** seis botões ⇒ seis golpes distintos; dano respeita guarda/tonto/contra; energia vazia deixa golpes mais lentos; `especial` antes do GROGUE não faz nada; GROGUE sem apertar em 5 s recupera 12%; vitória só via ORELHADA; derrota ⇒ `outcome 'lose'` sem `grantSkin`; determinismo (mesma semente + mesmas entradas ⇒ mesmo resultado); **bot defensivo** (reage às telegrafias com a defesa certa e contra-ataca) vence no normal em ≤ 120 s; **bot afobado** (só soca, nunca defende) perde no normal — garante que defender importa; escala de dificuldade aplicada.

**Aceite:** luta legível e épica no celular (667×320 e 360×640) e no desktop; botões alcançáveis com os polegares; nenhum `drawImage` acima do orçamento definido no teste de custo do boxe (≤ 250 por quadro).

## T9 — Cena do pombo-correio e do macaco (`karim-uer.10`)

**Lugar:** na fase 2, logo depois das dicas de tutorial (`hint:jump` em 188) e antes do checkpoint `Orla da selva` (214): **x ≈ 205**. Validar por teste: chão seco e plano por 6 tiles, sem água, sem spawn de inimigo a ≤ 900 px, sem gatilho sobreposto. Se falhar, usar o trecho logo depois do checkpoint `Margem` (555). Gatilho via `b.trigger('letter:start', …)` ou posição em `letterScene.ts` (não criar ID persistido novo além do encounter).

**Linha do tempo (~9 s, `src/game/letterScene.ts`, padrão `ClubScene`, controle roteirizado, sem armas visíveis):**
1. 0,0 s: assobio; o pombo-correio (cinza, bolsinha vermelha a tiracolo) chega voando pela direita, **pousa na cabeça do Karimbo, entre as orelhas**, dá uma bicada na orelha (`earPop`), entrega a carta e vai embora.
2. 3,0 s: banner `CARTA DA PRINCESA JÚLIA!`; o Karimbo abre a carta, coraçõezinhos sobem.
3. 4,5 s: um macaco-prego (partes `capuchin` de `wildlife.ts`) desce num cipó gritando, **arranca a carta**, pousa num galho, faz careta e dança balançando a carta.
4. 6,5 s: o Karimbo fica furioso: clarão vermelho, fumacinha saindo das orelhas, orelhas abrindo, tremida; balão "DEVOLVE ISSO, SEU MACACO!!!".
5. 7,5 s: o macaco pula **mato adentro** (fora da trilha: diminui e escurece entrando na folhagem do fundo, folhas balançam); o Karimbo pula atrás ⇒ íris ⇒ `hooks.onMinigame('chase', …)`.

`prefetch('chase')` a partir de ~60 tiles antes. Não dispara com inimigos perto, em cinemática, nadando, no Nômad, ou se `'jungle:letter-chase'` já estiver concluído. Abortar (menu/morte) antes do fim da perseguição faz a cena poder acontecer de novo depois. Arte nova pequena em `src/art/letterActors.ts` (pombo com 3 quadros de asa, carta dobrada/aberta), preparada na tela de carregamento da selva.

**Testes (`tests/letterScene.test.ts`):** posição validada (chão/água/inimigos/gatilhos); cena dispara uma vez, trava controle, pede `onMinigame('chase')` uma vez; com resultado `win` adiciona `'jungle:letter-chase'`, dá moedas uma vez e devolve o Karimbo no ponto do roubo virado para a direita; com `abort` não conclui e pode repetir; não dispara nas condições proibidas.

## T10 — Perseguição nos galhos (`karim-uer.11`)

**Conceito:** corrida de ação fora da trilha, pela copa das árvores, perseguindo o macaco que leva a carta. Sem arma (nada de mira, tiro, granada ou HUD de munição). O Karimbo corre **22% mais rápido** que o jogo base: `CHASE_RUN = RUN * 1.22` (≈ 239 px/s). Movimentos: correr, pular (altura variável, coyote e buffer iguais ao jogo base), **planar com as orelhas** (mesmas regras do jogo base) e **deslizar** (↓ correndo) por baixo de galhos baixos. Duração: jogador perfeito pega o macaco em **≈ 50 s**; jogador comum em **60–70 s**; nunca passa de ~90 s.

**Física:** `sim/course.ts` monta um `Level` próprio (tiles: galhos como plataformas de mão única, troncos sólidos) e o corredor (`sim/runner.ts`) usa `moveBody` de `src/game/physics.ts` e as constantes de `src/game/movement.ts`. Nada de copiar números: importar. O desenho do Karimbo reutiliza `drawKarimbo` com um `KPose` montado pelo corredor (sem arma: `hasGun` falso).

**Curso autorado (lista fixa de segmentos, sem sorteio por tentativa, ~450 tiles + clareira final):** cada segmento declara também as "dicas de linha de corrida" (`{ x, ação }`) usadas pelos bots de teste.
- Galho firme; **galho que treme** (pisou: treme 0,55 s com folhas caindo e rangido `creak`, depois quebra e cai em pedaços; volta a existir quando o Karimbo reaparece num ponto seguro); cipó (agarra ao encostar, balança com impulso, solta com pulo); folha gigante/bromélia-mola (quique alto); vãos com **ponto de pouso perfeito** marcado (pousar nele: `PERFEITO!` e +15% de velocidade por 1,5 s).
- Bichos (não machucam; fazem tropeçar e dão risada): **preguiça** pendurada (pular na barriga dá um quique enorme; ela diz bem devagar "Ôôô... calma... aí..."); **bando de quatis** correndo no galho em sentido contrário (pular por cima); **tucano** cruzando na altura da cabeça (deslizar por baixo); **cobra** pendurada balançando (passar no tempo); **abelhas** (o macaco chuta a colmeia; a nuvem persegue 3 s e faz o Karimbo correr agitando os braços).
- Objetos que o macaco joga para trás: **casca de banana** (escorregão de 0,6 s para a frente, pode cair do galho) e **coco** rolando (pular).
- Cair abaixo da copa: SPLASH na lama/folhagem, reaparece no último galho seguro em 0,8 s. Sem perda de vida.
- Galhos e bichos com falas/gags curtas do macaco: "Hihihi!", "Corre, orelhudo!", e no meio da corrida ele **lê um trecho da carta em voz alta debochando**: "'Querido Karimbo...' HAHAHAHA!".

**Macaco (`sim/monkey.ts`):** corre numa linha própria pela copa. Regras (ajustar constantes até os testes de tempo passarem):
- Começa `LEAD0 = 520 px` à frente; velocidade base `0,95 ×` a velocidade média do bot perfeito no curso.
- Se a distância passar de 1100 px (fora da tela), ele para e provoca (come banana) até a distância cair para 700 px.
- Antes de `MIN_CATCH_T = 48 s` ele não pode ser pego: ao ser alcançado dá um salto de fuga (+160 px) com piada ("Quase, Parabólica!").
- Depois de `TIRED_T = 68 s` cansa (língua de fora, suando): velocidade × 0,75.
- Depois de `RESCUE_T = 82 s` escorrega na própria casca de banana no próximo galho seguro (captura garantida).
- Captura: o Karimbo encosta nele depois de `MIN_CATCH_T` ⇒ nuvem de briga de desenho animado, a carta voa, o Karimbo pega no ar, o macaco foge chorando com um galo na cabeça.

**Câmera e arte:** antecipação para a direita, leve zoom-out para ler os pulos, linhas de velocidade; paralaxe da copa (silhuetas ao fundo, copa média, folhas próximas desfocadas), fachos de luz entre folhas (como `forestLight`), folhas caindo, pássaros. HUD: barra de distância (ícone do macaco × ícone do Karimbo), cronômetro, `PERFEITO!`. Tudo assado na entrada do minijogo; chunks do cenário assados conforme a câmera avança e descartados atrás (LRU como `tiles.ts`).

**Música `chase` (nova em `music.ts`):** tribal de ação, 156 bpm: surdo marcando, congas/atabaques densos (`l/m/h/x`), **agogô** (sino metálico de dois tons: voz nova curta com decaimento rápido), ganzá/chocalho em semicolcheias, gritos de coro ("HEY!") nas viradas; intensidade cresce conforme a distância ao macaco diminui (mix mais denso, entra `power` nos 10 s finais).

**Resultado:** cartão com tempo, erros e medalha — ouro: ≤ 55 s sem queda; prata: ≤ 68 s; bronze: o resto. Moedas só na primeira conclusão: ouro 30, prata 20, bronze 12 (concedidas no mundo pelo `onDone`; tornar público em `Encounters` um `grant(w, id, title, coins)` que reaproveita o `reward` privado atual, para não duplicar a lógica de moedas). Em seguida, T11.

**Testes (`tests/chase.test.ts`, só simulação, 1/60 s):** curso determinístico e todos os segmentos alcançáveis pela física (bot perfeito nunca cai); **bot perfeito pega o macaco em [48, 56] s**; **bot desleixado** (4 tropeços + 2 quedas injetados) em [60, 72] s; **bot péssimo** (cai a cada 10 s) em ≤ 92 s; galho que treme quebra 0,55 s depois de pisado e volta ao reaparecer; velocidade máxima no chão = `RUN * 1.22` (sem `PERFEITO!`); nenhuma ação de arma existe/é processada; antes de 48 s a captura é impossível.

## T11 — Filminho da carta e rebobinar (`karim-uer.12`)

**Leitura da carta (`sim/letterFilm.ts` + `art/minigames/chase/letterPaper.ts`):** tela cheia, papel de carta assado uma vez (vincos, mancha de café, marca de batom, rabiscos na margem: um desenho da Júlia mostrando o Karimbo com orelhas gigantes — **sem desenhar a Júlia**), letra de mão `Caveat` (de `@fontsource/caveat`, carregada só aqui com `FontFace` a partir de `?url`; fallback `"Comic Sans MS", cursive`), texto aparecendo como se escrito. O Karimbo no canto inferior esquerdo lendo (rosto é a foto; reações por orelhas mexendo, gota de suor, rubor desenhado ao lado, tremidinha nas piadas). Duas páginas; tocar/pular avança a página e, depois de 2 s, permite pular o filminho. Música `calm`. Texto exato no **Apêndice A** (não alterar sem pedido do usuário).

**Rebobinar (`sim/rewind.ts` + `art/minigames/chase/rewindFx.ts`):** 4 s: sobreposição de fita VHS (`◀◀ REBOBINANDO`, linhas de varredura e faixa de ruído assadas e deslizando, cronômetro andando para trás), cenário da perseguição rolando ao contrário rápido e o Karimbo **andando para trás** (ciclo de corrida invertido) segurando a carta; o macaco aparece correndo de costas por um instante (piada). Íris ⇒ mundo no ponto do roubo, virado para a direita, controle devolvido, banner `CARTA RECUPERADA!` / `A Júlia conta com você (e com essas orelhas).`

**Testes (`tests/letterFilm.test.ts`):** o texto do filminho é exatamente o do Apêndice A; páginas avançam por toque; pular só depois de 2 s; rebobinar dura 4 s e termina com o mundo restaurado no ponto do roubo; fonte indisponível cai no fallback sem travar.

## T12 — Documentação, QA e handoff (`karim-uer.13`)

- [ ] Estudos de caso (formato D08: sintomas, causa demonstrada, forma correta, limites, evidência, proteção): `LAGO_VIVO_E_MINIMAPA_<data>.md` (bug dos peixes, profundidade, ecossistema, orçamento, minimapa, compatibilidade de save) e `MINIJOGOS_PERSEGUICAO_E_BOXE_<data>.md` (carregamento sob demanda, entrada/toque por modo, bots de tempo, IA do boxe, compatibilidade da skin, mudança AGIR=FALAR na roda).
- [ ] Regra **D09 — Minijogos e cenas pesadas carregam sob demanda** em `REGRAS_DE_DESENVOLVIMENTO.md` (fluxo pequeno + `import()`, mundo congelado, sim headless, teste de isolamento, reset seguro); links no índice `docs/desenvolvimento/README.md`; ponteiro curto espelhado em `AGENTS.md` e `CLAUDE.md`.
- [ ] Medição final como na T0 nas cenas: lago raso, praça, revelação, boxe, perseguição. Registrar P95/P99/máximo e tamanho dos chunks (principal deve crescer pouco; minijogos em chunks próprios). Sem alegar FPS em celular físico: abrir bead de validação em aparelho real (g54 / Edge 30 Neo, como `karim-qyv.41`).
- [ ] QA visual em 1440×900, 844×390, 667×320 e 360×640 (layout emulado ≠ prova física).
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`; commit da documentação; `bd close` do épico com resumo; `bd remember` de 1–2 fatos duráveis (ex.: "minijogos ficam em src/game/minigames, só via minigameFlow").
- [ ] Relatório final ao usuário: o que mudou, como testar (URLs `?qa=1&fase=2&tp=…`, `?mini=…`), o que foi e o que não foi validado, pendências no Beads. Não fazer push/deploy sem pedido.

---

## Apêndice A — Carta da princesa Júlia (texto final)

**Página 1**

> Querido Karimbo,
>
> Se esta carta chegou, é porque o pombo sobreviveu — o que já é mais do que eu posso garantir sobre mim.
>
> Estou presa num lugar escuro, úmido e cheio de capangas. Pensei logo em você, porque é o único homem que eu conheço capaz de me ouvir gritando daqui sem precisar de telefone. Cada orelha sua é uma antena parabólica, Karimbo. Usa isso.
>
> Os sequestradores até que me tratam bem. A tortura é só uma vez por dia: eles leem em voz alta os poemas que você me mandou. Ontem o chefe chorou. Não foi de emoção.
>
> Por favor, venha rápido. Mas venha de frente pro vento: se pegar uma rajada de lado, você decola e só para na Bolívia. Se cair de algum lugar, abre as orelhas e plana. Deus não te deu beleza, mas te deu aerodinâmica.

**Página 2**

> Mamãe sempre disse que eu ia acabar com alguém de orelha grande. Eu achei que era força de expressão. Ela, coitada, achou que era praga. Acertou as duas.
>
> Se eu não sobreviver, deixo pra você a minha coleção de brincos. Espaço pra pendurar não falta: cabe a coleção inteira e ainda sobra lugar pro varal.
>
> E se você não chegar a tempo, tudo bem: já deixei avisado que quero ser velada debaixo das suas orelhas. Ninguém vai precisar alugar tenda.
>
> Com amor (e um pouco de vergonha),
> **Júlia** ♥
>
> PS: Não mostra esta carta pra ninguém. Principalmente pra macaco.
> PPS: O pombo se chama Orelhudo II. O primeiro morreu de inveja.

## Apêndice B — Falas curtas

- **Crianças no boxe (torcida Karimbo):** "VAI KARIMBO!", "ORELHADA NELE!", "BATE NO RABO!", "ESQUIVA, ORELHUDO!"
- **Crianças no boxe (torcida jacaré):** "VAI JACARÉ!", "ARRANCA A ORELHA DELE!", "MORDE ELE!", "JACARÉ NÃO PERDE!"
- **Coro:** "BRIGA! BRIGA! BRIGA! BRIGA!"
- **Jacaré durante a luta:** "Dança comigo, Parabólica!", "Essa orelha é pra ouvir ou pra apanhar?", (fúria) "AGORA EU FIQUEI BRAVO!"
- **Macaco na perseguição:** "Hihihi!", "Corre, orelhudo!", "'Querido Karimbo...' HAHAHAHA!", "Quase, Parabólica!", (cansado) "Arf... arf... pera aí..."
- **Preguiça:** "Ôôô... calma... aí..."

## Apêndice C — Procedimento de QA no navegador embutido

- Servidor pelo `preview_start` (`.claude/launch.json`), nunca pelo Bash. URL base: `/?fase=2&qa=1&god=1` (+ `&tp=<tile>`, `&touch=1`, `&perf=1`, `&mini=boxing|chase`).
- O painel oculto quase não roda `requestAnimationFrame`: avançar manualmente com `const {game:G, world:w}=window.__kg; G.input.poll(); G.step(w,1/60); G.render(1/60)` em laço com `try/catch`.
- Para capturar imagem quando o screenshot da ferramenta falhar: enviar `canvas.toDataURL()` por POST a um servidor Node local que grava PNG em `tools/_work/` e abrir com Read. Dar `resize_window` antes para o canvas ter tamanho.
- Importar o storage pela URL com `?t=` ao manipular saves no dev server (senão é outra instância de módulo).
- Encerrar servidores e abas próprios ao terminar; resetar o viewport com o preset `desktop`.
