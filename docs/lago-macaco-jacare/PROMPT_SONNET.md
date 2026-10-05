# Prompt de execução — Lago vivo, perseguição do macaco e boxe do jacaré

> Cole tudo abaixo da linha num chat novo do Claude Code (modelo Sonnet) aberto em `C:\PROJETOS\Karimbolandia`.

---

Você é o engenheiro responsável por implementar uma expansão grande do jogo **KARIMBOLÂNDIA** (TypeScript + Vite + Canvas 2D + WebAudio procedural, sem libs de jogo). O design já foi decidido e está escrito. Seu trabalho é **executar com precisão, testar, medir e documentar**, sem perder desempenho nem qualidade visual. Criatividade sua só entra onde o plano deixa espaço (detalhes de arte, animação, timing fino) e sempre coerente com o estilo existente do jogo.

## 1. Fonte da verdade

1. `docs/lago-macaco-jacare/PLANO.md` — especificação + plano tarefa por tarefa (T0–T12), com interfaces, números, falas, texto da carta (Apêndice A) e testes. **Leia inteiro antes de qualquer edição.**
2. Beads: épico `karim-uer`, tarefas `karim-uer.1` (T0) … `karim-uer.13` (T12), já com dependências. Rode `bd prime`, depois `bd show karim-uer` e `bd ready`.
3. Regras do repositório: `AGENTS.md`, `CLAUDE.md` e, antes de tocar em render/arte/HUD/loop/controles, `docs/desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md` (D01–D08), `docs/desenvolvimento/AGUA_E_BALADA_2026-10-05.md` e `docs/desenvolvimento/EXPLORACAO_E_PROFUNDIDADE_2026-10-05.md`.

Se o código real divergir do que o plano cita (linhas mudam), **o código atual e os testes existentes vencem**: confirme assinaturas lendo o arquivo antes de usar, ajuste o `PLANO.md` no mesmo commit e anote a decisão no bead (`bd update <id> --notes "..."`). Nunca invente API.

## 2. O que será entregue (resumo — detalhes no plano)

- **Lago/Atlântida estilo Hungry Shark:** peixes ambientes deixam de travar nas paredes da cidade submersa; ao cruzar pedra eles **encolhem ~22% e se misturam à água** (afastando-se da câmera), passam por trás e voltam ao tamanho normal (T1). Cardumes de neon/cardinal, acará-bandeira, disco, coridoras, tucunaré, pirarucu, arraia e poraquê; vegetação de rio (vallisnéria, cabomba, aguapé, sagitária, raízes de igapó), bolhas e partículas (T2). **Minimapa**: explorado colorido, a explorar em **cinza**, marcos e % explorado (T3; contador de pérolas entra na T4). **Praça do Pensador épica** (câmera, luz, halo de neon, música), 12 pérolas, cardume fiel, embalo de braçadas (T4).
- **Skin Jacaré** (fôlego +30%, nado +40%, vida +10%, com o chapéu de caça: a cabeça de jacaré, como fantasia, na cabeça do Karimbo) (T5).
- **Infra de minijogos sob demanda** + modos de entrada/toque (T6).
- **Jacaré dançante:** conversa em 3 estágios (educado → aviso → tapa na orelha), nocaute caprichado no mundo com crianças preocupadas e uma cutucando com graveto (T7).
- **Boxe em 3ª pessoa** com o Karimbo de costas (orelhas para os lados), 3 botões à esquerda + 3 à direita (jab, direto, cruzado, gancho), esquiva/guarda, crianças gritando "BRIGA!", golpe final **ORELHADA**, vitória/derrota com deboche (T8).
- **Fase 2:** pombo-correio entrega a carta da Júlia, macaco rouba e foge mato adentro (T9); **perseguição pela copa** sem arma, Karimbo 22% mais rápido, galhos que tremem e quebram, bichos engraçados, música tribal de ação, 50–70 s (T10); **filminho da carta** (texto fixo do Apêndice A) e **rebobinar** com o Karimbo andando para trás até o ponto do roubo (T11).
- Documentação, regra D09, medições e handoff (T12).

## 3. Inegociáveis

- **Desempenho e visual:** canvas principal com suavização `low` durante gameplay e minijogos; `high` só em bake. Não mexer em `DRS_MIN = 0.75`, `drawSprShrunk`, `FramePacer.raw`/tempo protegido da física. Nada de canvas, gradiente, `ctx.filter`, `shadowBlur`, `getImageData` ou fonte criados por quadro. Nenhuma alocação por quadro nos laços quentes. Culling e tetos do plano (peixes ≤ 300, plantas animadas visíveis ≤ 48, bolhas com troca-com-o-último, boxe ≤ 250 `drawImage`/quadro). Não "resolva" custo cortando efeito: investigue o mecanismo (D05).
- **Carregamento:** boxe e perseguição só por `import()` via `src/game/minigameFlow.ts`; `src/game/minigames/**` e `src/art/minigames/**` nunca importados por valor fora deles (teste de isolamento obrigatório, como `tests/interiorLoading.test.ts`).
- **Simulação headless e determinística:** nada de arte/DOM em `sim/`, `water.ts`, `lake/`, `village.ts`, `alligatorTalk.ts`, `letterScene.ts`; PRNG com semente.
- **Saves:** IDs antigos intocados; itens novos anexados no fim de `buildAtlantis`; campos novos opcionais e validados; `encounters` ≤ 64. Novos IDs: `atlantis:thinker`, `jungle:alligator-boxing`, `jungle:letter-chase`. Campo novo: `lakeMap?: string`.
- **Compatibilidade da skin:** `src/core/storage.ts:115` invalida o perfil inteiro com skin desconhecida. Antes de adicionar `jacare`, descubra o que uma aba antiga faz com isso e proteja moedas/skins (padrão do espelho `karimbolandia.wallet.v1`). Skin de recompensa tem **preço 0**.
- **Identidade:** rosto do Karimbo é sempre a foto; **a Júlia nunca é desenhada** (só texto). Estátua do Pensador: imagem, pose, textura e posição preservadas. Primeiro plano desfocado estilo Rayman é marca do jogo.
- **Comportamentos existentes:** ↑ continua batendo palmas na roda; AGIR vira FALAR só depois da primeira dança, e porta/objeto mais perto tem prioridade. Piranhas continuam colidindo (são inimigos no plano do Karimbo). Atualize testes antigos só quando o comportamento mudou de propósito, explicando no commit e no estudo de caso; nunca apague teste para passar.
- **Texto:** português do Brasil; a carta do Apêndice A é exatamente aquela; falas do Apêndice B e das tarefas como estão (pode criar falas extras no mesmo tom).

## 4. Como trabalhar (cada tarefa, na ordem T0 → T12)

1. `bd update <id> --claim`. Releia a seção da tarefa no plano e os arquivos que ela cita.
2. **Testes primeiro** para toda lógica de simulação (TDD): escreva, rode e veja falhar pelo motivo certo.
3. Implemente o mínimo que passa; depois a arte/áudio/HUD.
4. Rode o teste da tarefa, os testes vizinhos afetados e `npm run typecheck`; ao fim, `npm test` completo (e `npm run build` se mexeu em assets, config, entrada ou dependências).
5. QA no navegador embutido conforme o **Apêndice C** do plano (`preview_start`, `?fase=2&qa=1&god=1&tp=…`, avançar quadros manualmente, capturar `canvas.toDataURL()`), em 1440×900 e 844×390 (e 360×640/667×320 quando houver HUD/toque). Viewport emulado é verificação de layout, não prova de fluidez física.
6. Em tarefas de render, compare P95/P99/máximo com a linha de base da T0 (`?perf=1`, mesma rota de câmera). Registre números no bead; nunca afirme ganho de FPS em celular.
7. `git status --short`; `git add` **com caminhos explícitos** (todos os arquivos novos da tarefa: `src/`, `tests/`, `public/` se houver); nunca `docs/NARRACAO.md`, `docs/PROMPT_npcs_e_entrada_do_boss.md`, `plans/`, `tools/_work/`, `dist/`. Um commit por tarefa, mensagem em português dizendo o que mudou e por quê, terminando com a linha de coautoria do seu ambiente.
8. `bd close <id> --reason "<o que foi feito, testes, medições, limites>"`.
9. Depois de T4, T8 e T11, peça uma revisão independente do diff da fase (subagente de revisão de código ou `/code-review`) e corrija o que for confirmado antes de seguir.

Trabalhe em `feat/lago-macaco-jacare` criada a partir do HEAD atual de `feat/interiores-iso` (T0). **Não faça push nem deploy** sem pedido explícito do usuário.

## 5. Quando parar e perguntar ao usuário

Só nestes casos (no resto, siga o plano e decida pelo padrão do código existente):
- mudar o texto da carta, as falas centrais do jacaré ou o resultado das lutas/perseguição;
- não conseguir cumprir a janela de 50–70 s ou o orçamento de desempenho sem cortar efeito visual;
- a análise de compatibilidade da skin mostrar risco real de perda de perfil que o padrão existente não cubra;
- qualquer ação de publicação, push, deploy ou exclusão de dados.

## 6. Erros que não podem acontecer

- Peixe da frente "estalando" para trás de uma parede; peixe parado contra pedra; peixe saindo da zona d'água.
- Minimapa recalculado/redesenhado inteiro a cada quadro; minimapa cobrindo oxigênio, profundidade, pontuação ou botões de toque.
- Arte de minijogo no chunk principal; `import` estático de `minigames/` fora dele.
- Controle preso (`lockInput`) ou layout de toque errado depois de pausar/sair/redimensionar no meio de um minijogo; prêmio dado duas vezes ou sem vitória.
- AGIR na praça entrando numa casa quando o jogador queria falar com o jacaré (ou o contrário); palmas quebradas.
- Arma, mira, tiro ou HUD de munição aparecendo na perseguição.
- `grantSkin` mexendo no saldo de moedas; perfil antigo invalidado/sobrescrito por causa de `jacare`.
- Arquivo novo usado pelo código esquecido fora do commit.

## 7. Relatório final (ao concluir T12)

Em português, curto e verificável: o que foi entregue por tarefa (com commits), como testar cada parte (URLs com `?qa=1&fase=2&tp=…` e `?mini=boxing|chase`), resultados de `typecheck`/`test`/`build` (números), medições antes/depois (P95/P99/máximo, tamanho dos chunks), o que **não** foi validado (aparelho físico, áudio ouvido por humano) e os beads abertos para isso. Comece agora pela T0.
