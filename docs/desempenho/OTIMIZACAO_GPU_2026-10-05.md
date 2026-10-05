# Otimização real de fluidez — 05/10/2026

Resumo para quem mexer no render depois: **o engasgo principal não era JavaScript nem rede; era trabalho de GPU escondido, causado por uma linha.** Este documento explica o mecanismo, a correção, as regras para não reintroduzi-lo e como medir.

## 1. O que causava os engasgos

`Game.render` definia `g.imageSmoothingQuality = 'medium'` no canvas principal a cada quadro.

- A arte é assada em 3× (`ART_SCALE = 3` na qualidade alta, `src/art/index.ts`).
- No celular, na alta, o canvas usa `pxScale = 2`. Quase todo sprite é desenhado **reduzido** (~0,55–1×, conforme o zoom da câmera).
- Com `medium`, o Chrome/Skia exige *mipmaps* para imagens reduzidas. Cada sprite é um `<canvas>` (textura sem mipmaps), então o Skia **copia a textura inteira e regenera todos os níveis de mipmap, em todo quadro** (`GrGpu::copySurface` + `GrGpu::regenerateMipMapLevels` no processo de GPU).
- Esse custo fica fora do `performance.now()` do render: o JS media 5–8 ms por quadro, mas o próximo quadro só vinha ~48 ms depois (Moto g54).

### Por que baixar a resolução piorava

Na escala 0,5 (`pxScale = 1`), as faixas grandes do fundo (3900×480, 3600×450…) deixam de ser ampliadas e passam a ser reduzidas, então também entram no caminho caro. Pixels-fonte copiados por quadro: **1,3 M → 11,2 M na cidade** e **5,3 M → 18,5 M na selva**. A resolução dinâmica descia até 0,5 justamente quando o jogo estava lento, e o jogo ficava ainda mais lento (no build anterior, uma rodada caiu para 16,7 desenhos/s).

### Evidência (Chrome 154, notebook com Intel Iris Xe, geometria do Moto g54: 1600×720, DPR 2,5)

| Medida | `medium` (antes) | `low` (depois) |
|---|---|---|
| Cópias por quadro (trace do processo de GPU), escala 0,5 | ~48 cópias + ~46 mipmaps | ~3 cópias, 0 mipmaps |
| Cópias por quadro, escala 1 | ~14–17 cópias + ~11–14 mipmaps | ~3 cópias, 0 mipmaps |
| Desenhos/s, escala 0,5 (rodadas intercaladas) | 28,0 / 33,8 | 60,0 / 60,0 |
| Builds reais, cidade, DRS normal | 58,6 / 59,8; 2,8–5,3% de quadros >20,8 ms; picos de 43–317 ms | 60,0 / 60,0; 0%; máximo 19,5 ms |
| Builds reais, selva, DRS normal | 58,9 / 58,9; ~1,8% >20,8 ms; picos de 51–62 ms | 60,0 / 60,0; 0%; máximo 18,5 ms |

O desenho mínimo (só um retângulo) já chegava a ~60 nos dois celulares, o que localizava o problema no caminho gráfico; a medição acima localiza a operação exata.

**Ainda não validado fisicamente nos celulares.** O notebook tem bem mais folga de GPU que o g54 (PowerVR BXM-8-256) e o Edge 30 Neo (Adreno 619). O quadro também pinta o equivalente a ~17 telas cheias na cidade e ~21 na selva; em GPUs de entrada isso pode continuar sendo um limite depois desta correção.

## 2. O que mudou

1. **Suavização `low` no canvas principal** (`src/game/game.ts`, `render`): bilinear, sem mipmaps. No mesmo quadro congelado, o mundo fica praticamente idêntico (0,14% dos pixels mudam mais de 8 níveis em 255).
2. **Ícones muito reduzidos do HUD** (retratos de vida 0,32×, emblema, segredos, ícones de arma): `drawSprShrunk` em `src/art/kit.ts` cria **uma vez**, por sprite e tamanho em pixels, uma cópia reduzida com filtro `high` e a desenha ~1:1. Sem isso, o aro dos retratos serrilhava com `low`.
3. **Resolução dinâmica com piso 0,75** (`DRS_MIN` em `game.ts`). Abaixo disso, sprites assados em 3× ficariam reduzidos a <0,5× e serrilhariam com `low`.
4. **Marcapasso de quadros robusto** (`src/core/framePacing.ts`):
   - Em telas de 60/120/240 Hz, conta vsyncs inteiros desde o último quadro. O jitter normal dos carimbos do rAF (±0,3 ms) e uma tela a 120,016 Hz geravam quadros extras de 25/33 ms; agora a cadência é exata.
   - Em 90/144 Hz, mantém a média de 60 escolhendo o vsync mais próximo do horário ideal. A alternância 11/22 ms em 90 Hz é inerente; decidir entre 90 ou 45 qps estáveis fica para a validação física.
   - O período da tela é a média do grupo de intervalos de rAF mais curtos. Quadros atrasados pela GPU não "travam" a estimativa: uma versão intermediária com média móvel travou e chegou a desenhar 72/s.
5. **Pausas reais visíveis nas métricas** (`karim-qyv.31`): `FramePacer.raw` guarda o intervalo verdadeiro, inclusive pausas >250 ms. O painel `?perf=1` e a resolução dinâmica usam esse valor; a física continua recebendo o dt protegido (0 após pausa longa; máximo 0,1 s). Aba oculta/retorno continuam excluídos.

Testes: `tests/renderCost.test.ts` (cadência com jitter em 60/120/120,016/119,98/240 Hz, média em 90/144 Hz, GPU lenta no começo, pausas de 300 ms e 3 s, aba oculta, suavização `low`, cache de ícones) e `tests/mobileRendering.test.ts`.

## 3. Regras para não reintroduzir o problema

- **Não use `imageSmoothingQuality = 'medium'` nem `'high'` no canvas principal durante o jogo.** Só em canvases que você assa uma vez (bakes, cópias pré-reduzidas).
- Se algo for desenhado reduzido a menos de ~0,6×, não peça mipmaps por quadro: crie uma cópia pré-reduzida uma vez (`drawSprShrunk` ou equivalente).
- Não baixe o piso da resolução dinâmica abaixo de 0,75 sem antes assar a arte na escala do aparelho.
- Antes de culpar "Canvas pesado", meça: o custo da GPU não aparece nos cronômetros de `render()`.
- Desenhos/s altos não bastam: olhe P95/P99, o máximo e a % de quadros acima de 20,8 ms.

## 4. Como medir

As ferramentas ficam em `tools/_work/opus-diag/` (pasta local, fora do Git):

- `run-ab-real.cjs` — antes × depois com builds reais, comportamento normal (DRS ligado), geometria do celular ou do desktop.
- `run-census.cjs` + `census-pre.js` — censo de comandos Canvas por quadro e por etapa (fundo/mundo/HUD/pós), com área visível (overdraw).
- `run-desktop.cjs` + `analyze-trace.cjs` — variantes intercaladas e trace do processo de GPU (`copySurface`, `regenerateMipMapLevels`, `DoEndRasterCHROMIUM::Flush`).
- `phone/` + `phone-server.cjs` + `analisar-v2.cjs` — teste físico v2 nos celulares (cenas sem cinemática, controles A repetidos, estatísticas recalculadas dos lotes brutos).
- Relatório completo da investigação: `tools/_work/opus-diag/RELATORIO-OPUS-DESEMPENHO-2026-10-05.md`.

## 5. Próximos passos (só com medida no aparelho)

1. Rodar o teste v2 no g54 e no Edge 30 Neo (`karim-qyv.41`). Critérios definidos antes: o mecanismo se confirma no aparelho se "metade da resolução + `low`" ≥ 1,3 × "metade da resolução + `medium`"; a correção basta se a alta com `low` ficar ≥55 desenhos/s com P95 ≤25 ms nas duas cenas.
2. Se não bastar, o teste diz o que sobra: bloom (`multiply` do buffer sobre ele mesmo), gradação/granulação (modos de mistura avançados de tela cheia) ou preenchimento (overdraw do fundo; arte assada em 2× no celular).
3. Em telas de 90 Hz, decidir entre 90 qps ou 45 qps estáveis.
