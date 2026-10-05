# Regras técnicas de desenvolvimento

Escopo: todo o Karimbolandia, para pessoas e agentes. Aplicar a regra pertinente antes de alterar render, arte, HUD, loop, resolução, métricas ou controles. O objetivo é fluidez com a qualidade visual preservada. Uma regra pode evoluir com evidência: atualize implementação, proteção e explicação conjuntamente.

Os princípios abaixo são reutilizáveis. Os valores específicos deste jogo estão identificados e precisam ser recalibrados em outro projeto. O mecanismo observado no Chrome/Skia não deve ser apresentado como comportamento obrigatório de qualquer navegador ou engine.

## D01 — Separar preparar a imagem de desenhá-la continuamente

**Problema evitado:** pedir um filtro mais caro para sprites Canvas reduzidos pode provocar cópia de textura e construção de mipmaps a cada quadro, fora do tempo síncrono medido em JavaScript. Foi o mecanismo encontrado no ambiente deste jogo.

**Forma correta aqui:** o contexto principal mantém a suavização habilitada e usa bilinear:

```ts
g.imageSmoothingEnabled = true;
g.imageSmoothingQuality = 'low';
```

`low` é a qualidade do filtro de amostragem; não troca o preset gráfico, não remove efeitos e não significa que o jogo precise ter aparência pior. `medium`/`high` ficam nos contextos que preparam uma imagem uma vez e reutilizam o resultado. Um novo módulo não deve deixar um filtro caro ativo no contexto compartilhado durante gameplay; proteja e restaure seu estado de desenho.

**Exceção visual importante:** uma imagem muito reduzida pode serrilhar com bilinear. Prepare uma versão no tamanho necessário em vez de mudar o filtro de todo o canvas por quadro. Não desligue a suavização como substituição automática.

Referências: [Game.render](../../src/game/game.ts), [kit de arte](../../src/art/kit.ts), [estudo do mecanismo GPU](../desempenho/OTIMIZACAO_GPU_2026-10-05.md). Proteção existente: [renderCost.test.ts](../../tests/renderCost.test.ts), teste do filtro do canvas principal. Esse teste verifica a configuração; o custo real exige trace/medição.

## D02 — Cachear variantes de imagens pelo contrato real de desenho

**Forma correta:** asse a arte fora do caminho quente do quadro. Para ícones pequenos, prepare a redução com um bom filtro uma vez, na dimensão em pixels correspondente ao destino. Reutilize por identidade da fonte e dimensão/escala relevante. Invalide quando a fonte ou o tamanho realmente mudar; não regenere na mera repetição do desenho. Considere o ciclo de vida e o custo de memória das variantes.

Neste jogo, `drawSprShrunk` usa um cache ligado ao canvas-fonte e à dimensão reduzida. Ele preserva a qualidade dos retratos e demais ícones do HUD sem pedir mipmaps repetidamente no canvas principal. Não copie apenas a linha do filtro e esqueça essa compensação visual.

Uma alta resolução de bake não é universalmente melhor: confira dimensão da fonte, dimensão no destino, zoom e DPR. Uma fonte enorme reduzida continuamente pode custar mais que uma variante preparada para a escala do aparelho.

Referências: [drawSprShrunk](../../src/art/kit.ts) e [HUD](../../src/game/hud.ts). Proteção existente: `renderCost.test.ts`, reutilização da cópia reduzida com filtro de alta qualidade no preparo. Comparar a imagem também faz parte da validação.

## D03 — Resolução dinâmica precisa provar ganho e preservar nitidez

Reduzir a área do destino não garante reduzir o trabalho. Pode mudar quais imagens-fonte precisam de minificação, provocar invalidação de buffers e aumentar o custo de amostragem. No diagnóstico original, meia largura e meia altura pioraram os dois celulares; eram 25% da área de pixels, não 50%.

**Contrato local:** manter `DRS_MIN = 0.75` com a arte atual assada em 3× e o filtro bilinear. Esse piso protege a aparência neste desenho. Não transplantar 0,75 como constante universal para outro motor ou conjunto de assets.

Ao revisar o piso, os passos ou a política de DRS, medir o jogo real com DRS ligado, repetir controles e comparar a imagem. Se forem necessárias escalas menores, avaliar arte/variantes apropriadas para elas. Não promover um resultado em resolução fixa a garantia para o modo automático. Só atribuir dimensões ao canvas quando elas mudarem de fato, para não descartar seu conteúdo/estado desnecessariamente.

Referências: [game.ts](../../src/game/game.ts), [renderBudget.ts](../../src/core/renderBudget.ts). Proteção parcial: [mobileRendering.test.ts](../../tests/mobileRendering.test.ts) verifica dimensões e redimensionamento redundante. O ganho da política e o piso visual ainda dependem do experimento.

## D04 — Tempo de apresentação, desenho e física são grandezas diferentes

O callback de `requestAnimationFrame` não garante que houve desenho, e enviar desenho não mede diretamente a apresentação física do display. O tempo síncrono de `render()` não inclui todo trabalho assíncrono de rasterização/composição/GPU. Nenhuma dessas durações equivale automaticamente à utilização percentual de CPU/GPU.

**Forma correta:** manter um intervalo bruto real entre desenhos aceitos e um tempo separado para simulação. Uma pausa ativa de 300 ms ou 3 s precisa aparecer nas métricas, mas não deve avançar a física sem proteção. Aba oculta/retorno e troca de estado têm tratamento explícito; não esconda um travamento ativo tratando-o como ausência de amostra.

Neste jogo, `FramePacer.raw` conserva o intervalo real. O loop o usa no painel/DRS; a física recebe o tempo protegido. Não substitua novamente o intervalo bruto pelo retorno zerado/clampado destinado à simulação.

Cadência deve tolerar jitter e deriva normal dos timestamps. Não suponha que a tela opera em exatamente 60,000 ou 120,000 Hz, nem que qualquer taxa de tela comporta 60 quadros igualmente espaçados. O marcapasso atual trata múltiplos do alvo contando vsyncs; em taxas não múltiplas, uma média de 60 pode exigir alternância de intervalos.

Referências: [framePacing.ts](../../src/core/framePacing.ts), [performance.ts](../../src/debug/performance.ts), integração em `game.ts`. Proteção: `renderCost.test.ts` e `mobileRendering.test.ts` cobrem jitter, taxas de tela, retorno de pausa e integração do intervalo bruto.

## D05 — Preservar o visual e medir o mecanismo

Um controle sem efeitos ou com desenho simples é útil para localizar custo; não vira solução final por ter FPS bom. Preservar a qualidade inclui sprites, texto, HUD, iluminação, efeitos, escala e animação. Compare o mesmo quadro/câmera/estado; controle sementes e efeitos aleatórios quando comparar pixels. Uma diferença percentual pequena não dispensa inspecionar regiões importantes, como retratos e texto.

**Procedimento de investigação:**

1. Reproduzir o sintoma do jogador e registrar build, cena/estado, navegador, dispositivo, resolução/DPR e configurações relevantes.
2. Formar uma hipótese sobre uma operação e prever um resultado que possa refutá-la.
3. Alternar controle e intervenção, repetir o controle e separar aquecimento, caches e variação entre rodadas.
4. Quando o tempo JS não explicar o atraso, analisar o caminho gráfico; investigar cópias, mipmaps, minificação, flush, composição e volume de pintura conforme a evidência.
5. Conferir a imagem e medir novamente o candidato com áudio, saves, controles e adaptação normais.

Não se contentar com “Canvas pesa”, “é a GPU” ou “a média está boa”. Explicar o mecanismo, incluindo resultados paradoxais, é parte da conclusão. Não atribuir a diferença entre dois builds/origens apenas ao domínio.

## D06 — Evidência de fluidez inclui os picos e o estado certo

Reportar cadência de desenho, P95/P99, máximo e proporção de quadros lentos, com limiar e duração definidos. Uma média próxima de 60 pode esconder uma pausa longa. Um limiar como 20,8 ms pertence ao orçamento daquele alvo; explicitar o alvo ao reutilizá-lo.

Separar gameplay de menu, pausa, loading e cinemática. No primeiro teste curto, uma apresentação ocupou parte da janela: a análise precisou separar playing de comic. Verificar o estado realmente medido antes de comparar cenários. Não considerar um teste de viewport/DPR emulado como GPU do celular, nem teste unitário/build como prova física. Registrar relato humano como relato e medição instrumentada como medição.

Um teste de regressão deve proteger um comportamento que já falhou. Quando o risco for assíncrono/gráfico, incluir procedimento de benchmark/trace e comparação visual: não inventar um teste de mock que promete medir uma GPU real.

## D07 — Renderização e controles têm contratos de estado

**Princípio:** o desenho deve representar o estado; emissão de efeitos, recompensas e avanço de simulação precisam de tempo/eventos explícitos. Desenhar mais vezes, pausar ou mudar de taxa de tela não deve criar progresso duplicado. Proteger estados compartilhados do contexto e os ciclos de vida dos caches.

Nos controles, distinguir movimento, mira e ações. Conferir toques simultâneos, dono de cada ponteiro, cancelamento/perda de captura, camadas DOM que interceptam toques e transição entre modos de jogo. Não extrapolar um clique automatizado para ergonomia física no celular. Mudanças nessas áreas devem consultar as regras/testes correspondentes e [notas da v6](../v6/NOTAS_DA_VERSAO.md), além da causa tratada pelo teste específico.

Esses princípios são portáveis; o mapeamento dos botões e a arquitetura de contexto/modal pertencem a cada jogo. Referências locais: [input.ts](../../src/core/input.ts) e [touch.ts](../../src/ui/touch.ts).

## D08 — Manter a decisão acessível e revisável

Uma correção difícil deve deixar uma regra preventiva, um estudo de caso, evidência identificável e uma proteção executável ou um procedimento de medição. Explique o que fazer na implementação, não apenas “não mexer”. Ligue o estudo ao [índice](README.md) e espelhe os pontos de entrada em `AGENTS.md`/`CLAUDE.md`.

Revisar uma decisão com nova evidência é permitido. A mudança deve incluir os testes afetados, o efeito visual, as condições medidas e a atualização do estudo/regra; não remover a proteção silenciosamente para fazer um teste passar. Não é necessária uma autorização adicional para revisão rotineira já dentro da tarefa autorizada.

Antes de concluir uma tarefa neste repositório, cumprir também as instruções de validação e commit da raiz. Documentação não substitui acompanhamento de pendências no Beads.

## D09 — Minijogos e cenas pesadas carregam sob demanda

**Princípio:** o que só roda de vez em quando (minijogo, cena longa, módulo de arte grande) não entra no pacote que todo jogador baixa e parseia. Um fluxo **pequeno** no pacote principal usa apenas `import type` e `import()`; o módulo pesado vira chunk próprio. A tela é entregue a uma *sessão* e o resto do jogo espera, congelado.

**Como fazer:**

- Contrato só de tipos (`src/game/minigames/types.ts`): ninguém o importa por valor. O fluxo (`minigameFlow.ts`) captura o retrato do mundo, fecha a íris, espera o módulo, cria a sessão, reabre a íris e devolve tudo. Pré-busque em silêncio antes do ponto de entrada; trate falha de rede como `abort` com aviso, nunca como tela presa.
- O mundo **não avança** durante a sessão; a sessão recebe o `dt` protegido (D04). Simulação *headless*, determinística (PRNG com semente) e sem DOM em `sim/**`; a arte só desenha o estado e reage a eventos. Isso permite medir equilíbrio e duração com bots em vez de ajustar "no olho".
- **Saída sempre limpa:** `reset` em qualquer fase, exceção em `update`/`dispose`/callback, pausa e recusa de `start` entregam `abort` **uma vez só** e devolvem toque, entrada, música e controle. Prêmio só no `win`, concedido por quem pediu.
- Entrada/toque por modo (D07): o que já estava apertado só vale depois de solto; cada dedo é dono do seu botão; liberar tudo ao trocar de layout.
- Nada criado por quadro (D01): textos em cache por conteúdo estável (pulsar por escala, não por tamanho), contadores dígito a dígito, bakes na entrada. Teste de custo com contexto falso (teto de `drawImage`, canvases e gradientes não crescem) — e saiba que ele prova um teto, não a cadência.

**Proteção:** `tests/minigameLoading.test.ts` (o pacote principal não importa por valor nada de `minigames/**`), `tests/minigameFlow.test.ts` (ciclo de vida) e os testes de custo por minijogo. Detalhes e histórico em [MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md](MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md); o caso do lago em [LAGO_VIVO_E_MINIMAPA_2026-10-05.md](LAGO_VIVO_E_MINIMAPA_2026-10-05.md).

## Verificação antes de concluir mudanças nessas áreas

- Identificar regras afetadas e comportamento protegido; conferir contextos novos/compartilhados, bakes, variantes e invalidações.
- Se alterar render/escala, comparar a imagem e os intervalos no cenário afetado, com controles repetidos.
- Se alterar loop/métricas, validar jitter, pausas longas, física protegida e retorno de aba oculta.
- Se alterar controles, validar estados de ponteiros e transições, distinguindo QA automatizado de uso físico.
- Executar os testes relevantes e os comandos exigidos na raiz; registrar exatamente o que foi e não foi validado.
- Atualizar regra/estudo quando o contrato mudar; incluir os arquivos necessários no commit da tarefa.

## O que é específico e o que transportar

| Decisão | Karimbolandia atual | Para outro jogo |
|---|---|---|
| Amostragem do canvas | Bilinear `low` no desenho contínuo; preparo caro fora dele. | Partir dessa alternativa para Canvas 2D semelhante e verificar navegador/backend, imagem e trace. |
| Ícones | `drawSprShrunk` e cache das variantes pequenas. | Levar o padrão de variante preparada; adaptar escala, pivô, formatos e ciclo de vida. |
| Piso DRS | 0,75 com arte atual 3×. | Calibrar com assets/câmeras próprios e benefício/qualidade medidos. |
| Cadência | Alvo 60, marcapasso tolerante à taxa/jitter; métricas brutas. | Escolher alvo/taxas e política de física do jogo, preservando tempos separados. |
| Prova de fluidez | Testes de contrato + A/B/visual + aparelho real. | Mesma disciplina; novos resultados e aparelhos próprios. |

Para começar outro projeto, siga [ADOTAR_EM_OUTRO_JOGO.md](ADOTAR_EM_OUTRO_JOGO.md).
