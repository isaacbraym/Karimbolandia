# Agent Instructions

## Regras técnicas de desenvolvimento (obrigatórias)

Para Codex, Claude e qualquer outro agente: antes de alterar renderização, arte, HUD, loop, resolução, métricas ou controles, leia [docs/desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md](docs/desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md) e o estudo de caso indicado para a área. As regras valem para todo este repositório, inclusive módulos novos.

- Preserve o visual: não trate retirar efeitos ou reduzir qualidade como correção de um desperdício ainda não investigado.
- No canvas principal durante gameplay, mantenha suavização `low`; alta qualidade de filtro fica nos bakes/pré-reduções cacheados. Preserve `drawSprShrunk`, o piso atual `DRS_MIN = 0.75` e a separação entre intervalo bruto de desenho e tempo protegido da física. Veja regras D01–D04 e testes associados no guia.
- Ao tocar uma dessas decisões, valide mecanismo, imagem e cadência nas condições afetadas; não apresente testes unitários, FPS médio ou viewport emulado como prova de fluidez física. Uma revisão sustentada por evidência pode mudar a decisão, mas deve atualizar código, testes e documentação juntos.
- Minijogos e cenas pesadas (D09): carregam só por `import()` a partir do fluxo pequeno `src/game/minigameFlow.ts`; o pacote principal usa apenas `import type` de `src/game/minigames/**`; o mundo fica congelado, a simulação é headless e determinística, toda saída entrega `abort` uma vez e restaura controle/toque/música, e nada é criado por quadro. Veja [docs/desenvolvimento/MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md](docs/desenvolvimento/MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md).
- Ao resolver um novo problema difícil, registre sintomas, causa demonstrada, forma correta de desenvolver, limites de aplicação, evidência e proteção contra regressão em um estudo técnico versionado; ligue-o ao índice [docs/desenvolvimento/README.md](docs/desenvolvimento/README.md). Tarefas e pendências continuam no Beads.

Para reutilizar em outro jogo, siga [docs/desenvolvimento/ADOTAR_EM_OUTRO_JOGO.md](docs/desenvolvimento/ADOTAR_EM_OUTRO_JOGO.md). Constantes locais não são regras universais de hardware.

## Regra do usuário: commit ao concluir cada tarefa (obrigatória)

Vale para Codex, Claude e qualquer outro agente. Tem prioridade sobre o perfil "Conservative" do bloco Beads abaixo, no que diz respeito a commits.

- Ao concluir uma tarefa que alterou o projeto, **faça o commit antes de encerrar a sessão**. Nada de deixar trabalho pronto só na árvore local.
- O commit inclui **todos os arquivos que a tarefa criou ou usa**: código, testes e arquivos novos referenciados pelo código (ex.: `public/assets/audio/*.mp3`, `public/assets/img/*`, novos módulos em `src/`, novos testes em `tests/`). Antes de commitar, rode `git status --short` e confira que nenhum `??` necessário ficou de fora — um arquivo novo esquecido quebra o build publicado.
- Antes do commit: `npm run typecheck` e `npm test`; se mexeu em assets, config ou entrada, também `npm run build`.
- Um commit por tarefa, mensagem em português dizendo o que mudou e por quê.
- Não inclua o que não é da tarefa: anotações de terceiros (`docs/` alheios, `plans/`), `tools/_work/`, `dist/`.
- Se não for possível commitar (teste falhando, trabalho incompleto), diga isso explicitamente ao encerrar e liste os arquivos pendentes.
- Push e deploy (GitHub Pages) continuam exigindo pedido explícito do usuário.

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [sync-concepts](https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
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
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
