# Karimbolândia v6 — notas da versão (05/10/2026)

Endereço: https://isaacbraym.github.io/Karimbolandia/v6/ (o `/v5/` e a raiz continuam abrindo a mesma versão; o progresso salvo no aparelho é mantido).

## 1. Fluidez (o problema principal)

**O que era:** o canvas principal pedia suavização `medium`. Com a arte assada em 3× e desenhada reduzida, o navegador (Skia) copiava cada sprite e gerava mipmaps de novo em todo quadro, no processo de GPU. Isso não aparecia nos cronômetros do JavaScript e piorava quando a resolução dinâmica baixava a resolução — por isso "baixar a resolução" deixava os celulares mais lentos.

**O que mudou:**
- suavização bilinear (`low`) no jogo; ícones muito reduzidos do HUD são pré-reduzidos uma vez, em alta qualidade, para não serrilhar;
- resolução dinâmica com piso de 75%;
- o ritmo de 60 quadros não gera mais quadros extras de 25/33 ms por causa da oscilação do relógio da tela (telas de 60/120 Hz);
- pausas reais agora aparecem no painel `?perf=1`.

**Medido no notebook, com a tela e a resolução do Moto g54 e o comportamento normal do jogo:** cidade de 58,6–59,8 para 60,0 desenhos/s, com quadros lentos (>20,8 ms) de 2,8–5,3% para 0% e pico máximo de até 317 ms para ~19 ms; selva de 58,9 para 60,0, com quadros lentos de 1,8% para 0%. Antes da correção, quando a resolução dinâmica descia a 50%, o jogo chegou a 16,7 desenhos/s.

**Ainda não medido nos celulares.** O teste físico está pronto (`tools/_work/opus-diag/phone/`) e vale rodar no g54 e no Edge 30 Neo. Os detalhes técnicos, as regras para não reintroduzir o problema e as ferramentas de medida estão em [`docs/desempenho/OTIMIZACAO_GPU_2026-10-05.md`](../desempenho/OTIMIZACAO_GPU_2026-10-05.md).

## 2. Mira: analógico esquerdo só move

**O que era:** no celular, o joystick esquerdo também apontava a arma. Andando para a frente, o dedo escorregava para baixo e o tiro ia para o chão, gastando munição.

**Agora:** o analógico esquerdo (toque e controle) só anda, agacha, desce de plataformas e vira o corpo. A mira vem de:
- **celular:** arrastar o botão **FOGO** (o analógico direito);
- **controle:** analógico direito;
- **PC:** mouse (W/↑ continua mirando para cima no teclado).

Sem arrastar o FOGO, o tiro sai reto para a frente, com a assistência de mira normal.

## 3. Casas exploráveis no celular

**O que era:** no celular, entrar na palafita ou na casa da Dona Benedita "não fazia nada". O joystick sumia no modo interior, e a camada invisível dos controles de toque cobria a tela e engolia todos os toques — nem tocar no chão funcionava. A sala também aparecia pequena, no meio da tela.

**Agora:**
- o **joystick esquerdo anda livre** pelo cômodo, em qualquer direção (não só de casa em casa);
- o objeto mais perto fica **destacado com o nome** e o botão **AGIR** abre o menu dele;
- tocar no chão (anda até lá) e tocar num objeto (abre o menu) também funcionam;
- **PONTA** (andar sem barulho), **SAIR** e **LISTA** continuam;
- a sala ocupa a tela inteira (a palafita foi de escala 0,93 para 1,41). Quando a sala é mais alta que a tela, a câmera acompanha o Karimbo, e os móveis são desenhados na resolução real da tela, sem borrar.

Também foi corrigido, de quebra: tocar numa área vazia da tela durante o jogo podia virar um "clique fantasma" e disparar um tiro.

## 4. Como foi validado

- Testes automáticos: 586, mais typecheck e build. Entre eles, os novos `renderCost`, `aimSticks` e `interiorScreen`.
- Navegador com toque emulado (geometria do g54): joystick, PULO e FOGO no jogo lateral; no interior, toque no chão, joystick, toque em móveis e AGIR, na palafita e na casa da Dona Benedita; `/v6/`, `/v5/` e a raiz carregando sem erros.
- **Não substitui** jogar no celular de verdade: vale uma partida curta nas duas fases nos dois aparelhos.

## 5. Regra nova para agentes

`AGENTS.md`/`CLAUDE.md`: ao concluir uma tarefa, o agente faz commit de **todos** os arquivos que ela criou ou usa (incluindo assets novos em `public/`), depois de typecheck e testes. Isso evita builds publicados sem `balada.mp3`, `karimbo-thinker.jpeg` ou `atlantisDecor.ts`.
