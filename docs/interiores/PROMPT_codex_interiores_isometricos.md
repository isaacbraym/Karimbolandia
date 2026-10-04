# Tarefa: interiores isométricos jogáveis (estilo Habbo) — Palafita do vigia + Casa da Dona Benedita

Você vai trabalhar no **KARIMBOLÂNDIA** (run-and-gun 2.5D no navegador, mobile-first em paisagem).
Repositório local: `C:\PROJETOS\Karimbolandia` (GitHub `isaacbraym/Karimbolandia`). Publicado no GitHub Pages pelo workflow `.github/workflows/deploy-pages.yml` (typecheck + testes + build).

## 0. Quem você é nesta tarefa

Você é, ao mesmo tempo, **game designer sênior de imersive sims e jogos de casa** (Habbo, The Sims, Untitled Goose Game, Hitman, Thief, Hello Neighbor, Animal Crossing) e **engenheiro de jogos em Canvas 2D** obcecado por frametime. O objetivo não é "cumprir a lista". O objetivo é que **explorar uma casa seja tão divertido quanto o resto do jogo**: o jogador ri em 30 segundos, sente tensão em 60 e sai querendo voltar.

Quando houver dúvida de design, decida pelos pilares do estudo de caso (seção 3). Quando houver dúvida de engenharia, decida pelo que mantém **simulação pura, save compatível e zero alocação por quadro**. Não pare para pedir aprovação de passos intermediários. Decida, registre a decisão e siga.

**Antes de escrever qualquer código, leia inteiro:** `docs/interiores/ESTUDO_DE_CASO_interiores_isometricos.md`. Ele tem os mapas dos cômodos, os objetos, os verbos, os números de ruído e suspeita, a direção de arte e a arquitetura. Este prompt é o contrato e o estudo é a especificação.

---

## 1. Leia o código antes de mexer (obrigatório)

- `AGENTS.md`, `CLAUDE.md` e `bd prime`. O projeto usa **beads (`bd`)** para tarefas. O épico já existe, **`karim-clb`**: crie uma issue filha por fase. Não use listas TODO em markdown.
- **Como é hoje:** `src/game/exploration.ts` (spots, `nearest`, `safe`, `inspect` com a economia de munição), `src/ui/investigation.ts` + `src/art/cabin.ts` (modal SVG atual), `tests/exploration.test.ts`.
- **Estados e render:** `src/game/game.ts` (`State`, `step()`, `render()`, `openInvestigation`, `pause/resume`, `updateTouchState`, resolução dinâmica, `post.*`).
- **Mundo e jogador:** `src/game/world.ts` (`hooks`, `encounters`, `checkpointSnap`, `drawWorld`), `src/game/player.ts` (`hp`, `maxHp`, `hit()`, `grenades`, `weapons`).
- **Arte:** `src/art/kit.ts` (`bake`, `drawSpr`, `shadedRR`, `poly`, `glowSprite`, `softDot`), `src/art/karimbo.ts` (`drawKarimbo`, `KPose`), `src/art/village.ts` (desenho das casas `villageHome` e dos moradores), `src/art/jungleDecor.ts` (`jHut`).
- **Aldeia:** `src/game/village.ts` (moradores, falas `LINES`, `speech`), `src/game/level/jungle.ts` (`jHut` em `:449`, `expandJungle` com `villageHome` em 702/719/739 em `:106`).
- **Save:** `src/game/save.ts` (`SaveState`, `captureSave`, `applySave`), `src/core/saveValidation.ts` (**no máximo 64 IDs em `encounters`**, padrão `^[a-z0-9:-]{1,80}$`).
- **Entrada:** `src/core/input.ts` (`ControlState`, ações `jump/fire/grenade/special/next/prev/pause/reload/interact`), `src/ui/touch.ts` (`sync`, botão de interação).
- **Áudio:** `src/core/audio.ts` (`SfxName`, `play`, `setUnderwater`, filtros), `src/core/music.ts`.

## 2. Regras inegociáveis do projeto

1. **Stack:** TypeScript + Vite + Canvas 2D + WebAudio procedural. **Nenhuma biblioteca nova** (nem de jogo, nem de UI, nem de pathfinding).
2. **Simulação headless:** tudo em `src/game/interior/` roda em Node, sem `getArt()`, `document`, `window` ou canvas. Só `src/art/interior/` desenha.
3. **Rosto do Karimbo é a foto real:** use `drawKarimbo` e nunca redesenhe o rosto. Nenhuma foto de outra pessoa real. Dona Benedita, Cabo Ronco, gato e galinha são cartoon procedural no estilo dos moradores e soldados.
4. **Desempenho (lições pagas caro neste projeto):**
   - nunca criar canvas, gradiente ou `Path2D` por quadro. Assar uma vez, ao entrar;
   - texto dinâmico com cache por string e orçamento por quadro, como o `numText` do HUD. **Não** usar atlas de glifos por caractere (o Chrome corta glifos em canvas pequeno: testado e revertido);
   - não usar `getImageData` em caminho quente;
   - partículas com pool de tamanho fixo.
5. **Dentro de casa Karimbo não pula, não voa, não nada e não atira.** A arma fica no coldre.
6. **Caminho crítico intocado:** nenhuma travessura ou interior pode ser obrigatório para avançar na fase.
7. **Save compatível:** saves antigos carregam, e recompensas já coletadas no modal antigo **não** se repetem no interior novo (e vice-versa).
8. **Narração:** o interior não dispara o narrador e respeita a regra de vozes nunca sobrepostas.
9. **Git:** a árvore de trabalho já tem mudanças não commitadas de outra pessoa. **Não reverta, não descarte e não faça stage delas.** Trabalhe numa branch própria `codex/interiores-iso` e commite só os seus arquivos.

## 3. O que construir

Um **modo de interior isométrico** (estado de jogo `'interior'`) e dois cômodos completos:

- **Palafita do vigia:** o primeiro `jHut` da fase 2, com o **Cabo Ronco** dormindo na rede. Tema: furtividade cômica (tábuas rangentes, rádio que mascara passos, cadarços amarrados que o fazem tropeçar na perseguição).
- **Casa da Dona Benedita:** o primeiro `villageHome` (x=702), que hoje é só decoração e passa a ter porta. Tema: visita, vergonha e afeto (comida, filtro de barro, TV com tapa técnico, lata de biscoito cheia de costura, cofrinho como escolha moral). Ela volta da roça no meio da visita.
- **Missão que liga as duas casas:** a **panela de barro apreendida** na palafita é devolvida à Dona Benedita. Isso rende um prato que cura, sobe a reputação e gera comentários dos moradores lá fora.

Os detalhes (grades, objetos, verbos, números, falas de exemplo, listas de travessura, reações) estão no estudo, nas seções 4 e 5. Siga a intenção e ajuste os números jogando.

### 3.1 Sistemas obrigatórios

- **Grade isométrica 2:1** com conversões puras (`gridToScreen`, `screenToGrid`, `depthKey`) e testes de ida e volta.
- **Caminho A\* em 8 direções sem cortar quina**, com destino em objeto = tile adjacente livre mais próximo, voltado para o objeto. Andar é suave entre tiles (cerca de 0,22 s por tile; ponta dos pés, 0,4 s).
- **Menu radial de verbos** por objeto. Cada fatia mostra o nome, as ondas de ruído (0–3), um **olho** se houver testemunha acordada e fica vermelha se irritar o morador. Use ícones vetoriais desenhados, não emoji.
- **Ruído** (eventos com raio, atenuação por parede, ponta dos pés, tábua rangente, rádio mascarando) e **percepção** (cone de 100°, alcance de 5 tiles, linha de visada que respeita móveis altos e paredes).
- **Cérebros de NPC** como máquina de estados legível:
  - Cabo Ronco: `dormindo → inquieto → meio acordado → alerta → perseguindo`, com `tropeçou` se os cadarços estiverem amarrados;
  - Dona Benedita: `fora → chegando → rotina → desconfiada → incomodada → expulsando`, com reações atrasadas a mudanças que ela não viu acontecer ("Cadê meu feijão?!").
- **Saídas e consequências** (seção 4.3 do estudo):
  - se o mercenário acordar e Karimbo fugir, ele sai pela porta como **inimigo alertado** no mundo lateral;
  - se ele pegar o Karimbo, usa `player.hit` com dano moderado, mas a vida mínima é 1 dentro de casa, e Karimbo é arremessado para fora;
  - se a moradora expulsar o Karimbo, ele é varrido até a porta, a porta fica trancada até o próximo checkpoint e ela diz uma fala lá fora.
- **Reputação na aldeia** (`villageRep`, de −100 a +100) que multiplica a suspeita e muda falas dos moradores em `village.ts`.
- **Lista de travessuras** por cômodo. Completar tudo dispara o carimbo **KARIMBADO!** (animação de carimbo batendo, com poeira de tinta) e uma recompensa na economia existente.
- **Recompensas reaproveitando a lógica atual:** extraia a regra de munição e granada de `Exploration.inspect` para uma função compartilhada e use-a nos dois lugares. **Não duplique a economia.** As chaves `cabin:<x>:drawer|chest|portrait|letter` (e `:open`) e `lore:*` continuam sendo a fonte da verdade para esses objetos.
- **Persistência compacta:** adicione `interiors?: [string, number][]` (bitmask por cômodo) e `villageRep?: number` ao `SaveState`, valide-os com limites em `saveValidation.ts` e siga o mesmo ciclo de vida de `encounters`. Grave ao sair do interior, nunca no meio. Se a página recarregar lá dentro, Karimbo volta do lado de fora da porta.

### 3.2 Carregamento sob demanda (requisito, não sugestão)

- `game.ts` **não pode importar estaticamente** nada de `src/game/interior/` nem de `src/art/interior/`. Use `import()`.
- Faça a **pré-busca** do módulo quando o jogador estiver a ~600 px de uma porta com interior. No `F · ENTRAR`, a transição já começa enquanto a promessa resolve.
- Os cômodos ficam em `rooms/index.ts` como um mapa `id → () => import('./palafitaVigia')`, com caminhos estáticos para o Vite gerar chunks.
- Asse a arte da sala ao entrar (no máximo 2 canvases do tamanho da sala) e **libere tudo ao sair**.
- Comprove no `npm run build`: as strings únicas dos cômodos (por exemplo, "Cabo Ronco") aparecem **só** em chunks separados, nunca no chunk de entrada. Escreva também um teste que falha se `game.ts` importar `interior/` estaticamente.

### 3.3 Visual: tem de ser incrível

Siga a seção 6 do estudo. Os pontos que separam "funciona" de "uau":

1. **Diorama flutuante** com laje de piso de espessura visível, paredes de fundo e frente cortada, sobre uma **captura desfocada do quadro do mundo**, feita uma vez ao entrar (reduzir para 1/8, ampliar e escurecer).
2. **Luz quente dentro e fria fora:** lampião balançando (a luz acompanha), fachos de janela com poeira, frestas no piso da palafita mostrando a água do pântano com reflexo animado, fumaça do fogão a lenha.
3. **Leitura isométrica impecável:** ordenação por profundidade, móvel na frente do Karimbo fica translúcido com contorno (raio-X), cursor em losango e caminho pontilhado de pegadas.
4. **Karimbo vivo:** `drawKarimbo` em escala reduzida, com ciclo de passos sincronizado ao deslocamento, `facing` ±1 pela direção na tela e poses por transformação (comer, sentar, deitar na rede, carregar item, admirar-se no espelho). A skin equipada é respeitada.
5. **Juice em toda ação:** squash and stretch, cacos e penas com física simples, migalhas, item voando em arco até o bolso, onomatopeias em quadrinho, anéis de ruído no chão, "!" e "?" com pulinho, tremor curto ao quebrar algo.
6. **Entrada e saída cinematográficas:**
   - entrada: zoom na porta no mundo lateral (`camera.zoomTarget/focus`), íris fechando e o diorama se montando em cascata diagonal (ease-out-back), em no máximo 1,2 s;
   - saída: o inverso, em 0,4 s;
   - qualquer botão pula a transição.
7. **Som:**
   - a música de fora fica abafada por um passa-baixa (reaproveite o caminho de `setUnderwater` ou o bus de música);
   - som ambiente do cômodo: ronco procedural, rádio, chiado de TV, galinha;
   - passos em madeira com variação de pitch, rangido forte na tábua solta, quebra procedural.
   - Arquivo de áudio novo é opcional; procedural é o padrão.
8. **Qualidades:** em `high` vale o composite `multiply` da luz. Em `medium` e `low`, use a camada pré-tingida e menos partículas. A resolução dinâmica existente continua valendo.

### 3.4 Controles (todos, sem exceção)

Mouse, teclado, controle e toque, conforme a tabela da seção 7 do estudo. Movimento por teclado e analógico é **relativo à tela** (↑ = diagonal para o fundo). Tudo passa pela `Input` existente. Se faltar uma ação (como a ponta dos pés), adicione-a à `Input` de forma consistente para os três dispositivos. **Não crie escuta de teclado paralela.**

No toque:

- esconda os controles de tiro e pulo;
- mostre só **Sair**, **Lista**, **Pontinha** e **Pausa**;
- tocar no piso anda, tocar no objeto anda até ele e abre o menu, toque longo examina;
- alvos de toque com 44 px ou mais.

Na primeira visita, mostre 3 dicas contextuais curtas (sem modal): andar, abrir o menu e ruído/ponta dos pés.

### 3.5 Integração com o que já existe

- `Exploration` ganha o ponto da primeira `villageHome` (porta calculada a partir do desenho em `art/village.ts`, que depende da variante `seed%3`) e um campo `interior?: RoomId`. As regras de `nearest()`/`safe()` continuam valendo para entrar.
- A primeira palafita usa o interior novo. **As cabanas 2 e 3 e as 3 pistas da trilha continuam no `Investigation` atual, sem regressão.**
- O `villageResident` em `x-2` da primeira casa **é** a Dona Benedita: some de fora enquanto ela está dentro e, depois da visita, diz lá fora uma fala que depende do desfecho.
- O touch mostra `ENTRAR` na porta da casa, como já faz com as cabanas.
- Pausa dentro do interior abre o menu de pausa e volta para o interior. O salvamento automático de 20 s não grava dentro do interior.

---

## 4. Fases com portão (não pule o portão)

Abra uma issue `bd` por fase. Cada fase termina com `npm run typecheck` e `npm test` verdes.

| Fase | Entrega | Portão |
| --- | --- | --- |
| **1. Motor puro** | `iso.ts`, `grid.ts` (A\*, LOS), `types.ts`, `sim.ts` (andar, ações, ruído, eventos, RNG semeado), `state.ts` (bitmask + ponte legada) | testes de iso, A\* (sem quina, inalcançável, destino em objeto), determinismo e ruído |
| **2. Sessão e save** | `session.ts`, estado `'interior'` em `game.ts` via `import()`, entrada e saída, recompensas compartilhadas, `interiors`/`villageRep` no save | testes de save (ida e volta, save antigo, validação com limites, `encounters` < 64) e de economia sem duplicar com as chaves legadas |
| **3. Palafita jogável** | dados da sala, Cabo Ronco (sono, perseguição, tropeço), travessuras, saída com inimigo alertado. Arte provisória permitida | testes de percepção, sono, cadarço e saída alertada. Dá para zerar a lista no navegador |
| **4. Casa jogável** | Dona Benedita (rotina, volta para casa, suspeita, furto descoberto depois, expulsão), comida que cura, reputação, missão da panela entre as casas | testes de suspeita com e sem testemunha, expulsão, porta trancada até o checkpoint e devolução da panela |
| **5. Arte e juice** | renderer completo, diorama, luz, raio-X, transições, menu radial bonito, partículas, carimbo KARIMBADO!, som | QA visual (seção 5) com capturas |
| **6. Polimento e desempenho** | dicas, toque, controle, frametime, liberação de memória, chunks separados, textos revisados | todos os critérios da seção 6 |

## 5. QA no navegador (obrigatório, com evidência)

- Servidor: `npm run dev`. Use `?fase=2&qa=1&god=1&tp=<tile>` para chegar às portas. `qa=1` expõe `window.__kg = { game, world }`.
- Se o `requestAnimationFrame` estiver pausado (painel oculto), avance na mão: `G.step(w, 1/60); G.render(1/60)` em laço com try/catch. Tempos de render medidos com o painel oculto são falsos; não conclua desempenho a partir deles.
- Capturas em **1280×720**, **667×375** e **360×640** (paisagem forçada): entrada (transição no meio), cômodo inteiro, menu radial aberto, Cabo acordando, Dona Benedita desconfiada, carimbo KARIMBADO! e saída.
- Console sem erros. Depois de **10 ciclos de entrar e sair**, nenhum canvas do interior continua vivo (exponha um contador de debug).
- Jogue os dois cômodos do começo ao fim com teclado, com toque emulado e, se possível, com controle.

## 6. Definição de pronto

- [ ] Os dois interiores são jogáveis do início ao fim, com todas as travessuras alcançáveis e todas as saídas funcionando.
- [ ] Todo objeto responde. Repetir uma ação gera variação, nunca a mesma frase duas vezes seguidas.
- [ ] A missão da panela liga as duas casas e o mundo de fora reage a ela.
- [ ] A economia de munição e granada é compartilhada com `Exploration`, sem recompensa duplicada entre o modal antigo e o novo nem entre saves.
- [ ] O save antigo carrega, os campos novos são validados e `encounters` continua abaixo de 64.
- [ ] Os chunks do interior estão separados (comprovado no build) e não há import estático em `game.ts` (comprovado por teste).
- [ ] O frametime dentro do interior não é pior que o do mundo lá fora na mesma qualidade, e não há canvas, gradiente ou `Path2D` por quadro.
- [ ] Mouse, teclado, controle e toque cobrem todos os verbos.
- [ ] Os modais antigos (cabanas 2 e 3, pistas) funcionam como antes e `tests/exploration.test.ts` continua verde (ajuste só o que a migração da cabana 1 exigir, explicando o motivo).
- [ ] `npm run build` passa.

## 7. Autocrítica antes de entregar (faça de verdade)

Antes de declarar pronto, jogue os dois cômodos como um jogador que **nunca viu o jogo** e escreva, para você mesmo, a resposta a:

1. Em que segundo eu ri pela primeira vez? E senti tensão? Se passou de 30 s ou 60 s, o que falta?
2. Houve algum clique morto, objeto sem resposta ou fala repetida?
3. O que fica feio em 360×640? O que é ilegível na ordem de profundidade?
4. O que este interior faz que o modal antigo não fazia? Se a resposta for curta, o trabalho não acabou.
5. Que detalhe, sozinho, faria alguém mandar um vídeo disso para um amigo? Ele existe? Se não, crie.

Corrija o que encontrar e repita a rodada **pelo menos duas vezes**. Registre as rodadas no relatório final.

## 8. Não faça

- Não substitua o modal antigo para os pontos fora do escopo.
- Não desenhe o rosto do Karimbo nem use fotos de pessoas reais.
- Não crie dependências, servidores ou assets externos de CDN.
- Não faça o interior bloquear a fase ou o caminho crítico.
- Não grave no meio do interior.
- Não use emoji como ícone (a renderização varia por plataforma).
- Não "conserte" os testes antigos apagando asserções. Se um teste precisar mudar, explique o motivo.
- Não toque nas mudanças não commitadas que já estavam na árvore.

## 9. Entrega

1. Commits pequenos por fase na branch `codex/interiores-iso` (só os seus arquivos), com mensagem clara em português.
2. `npm run typecheck`, `npm test` e `npm run build` verdes. Cole a saída resumida.
3. Push da branch e abertura de um PR para `main` com: o resumo do que foi construído, as capturas da seção 5, as rodadas de autocrítica, as decisões de design tomadas e o porquê, o que ficou de fora e as próximas casas candidatas a migrar para o motor.
4. Feche as issues `bd` concluídas e crie issues para o que sobrar.
5. Atualize o README (seção de controles) com os controles de interior.
