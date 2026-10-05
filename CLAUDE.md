# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Regras técnicas de desenvolvimento (obrigatórias)

Para Codex, Claude e qualquer outro agente: antes de alterar renderização, arte, HUD, loop, resolução, métricas ou controles, leia [docs/desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md](docs/desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md) e o estudo de caso indicado para a área. As regras valem para todo este repositório, inclusive módulos novos.

- Preserve o visual: não trate retirar efeitos ou reduzir qualidade como correção de um desperdício ainda não investigado.
- No canvas principal durante gameplay, mantenha suavização `low`; alta qualidade de filtro fica nos bakes/pré-reduções cacheados. Preserve `drawSprShrunk`, o piso atual `DRS_MIN = 0.75` e a separação entre intervalo bruto de desenho e tempo protegido da física. Veja regras D01–D04 e testes associados no guia.
- Ao tocar uma dessas decisões, valide mecanismo, imagem e cadência nas condições afetadas; não apresente testes unitários, FPS médio ou viewport emulado como prova de fluidez física. Uma revisão sustentada por evidência pode mudar a decisão, mas deve atualizar código, testes e documentação juntos.
- Minijogos e cenas pesadas (D09): carregam só por `import()` a partir do fluxo pequeno `src/game/minigameFlow.ts`; o pacote principal usa apenas `import type` de `src/game/minigames/**`; o mundo fica congelado, a simulação é headless e determinística, toda saída entrega `abort` uma vez e restaura controle/toque/música, e nada é criado por quadro. Veja [docs/desenvolvimento/MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md](docs/desenvolvimento/MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md).
- Ao resolver um novo problema difícil, registre sintomas, causa demonstrada, forma correta de desenvolver, limites de aplicação, evidência e proteção contra regressão em um estudo técnico versionado; ligue-o ao índice [docs/desenvolvimento/README.md](docs/desenvolvimento/README.md). Tarefas e pendências continuam no Beads.

Para reutilizar em outro jogo, siga [docs/desenvolvimento/ADOTAR_EM_OUTRO_JOGO.md](docs/desenvolvimento/ADOTAR_EM_OUTRO_JOGO.md). Constantes locais não são regras universais de hardware.

## Regra do usuário: commit ao concluir cada tarefa (obrigatória)

Ao concluir uma tarefa que alterou o projeto, faça o commit antes de encerrar, incluindo todos os arquivos novos que o código usa (assets em `public/`, módulos em `src/`, testes). Rode `git status --short` para não esquecer nenhum `??` necessário; rode `npm run typecheck` e `npm test` antes. Não inclua `docs/`/`plans/` de terceiros nem `tools/_work/`. Esta regra prevalece sobre o perfil "Conservative" do bloco Beads quanto a commits; push/deploy continuam exigindo pedido explícito. Texto completo em `AGENTS.md`.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_
