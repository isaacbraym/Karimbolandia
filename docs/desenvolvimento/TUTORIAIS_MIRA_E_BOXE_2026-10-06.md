# Treino de mira e identificação do tutorial de boxe

## Sintoma e causa

O jogador não recebia um treino inicial para o analógico de mira. No boxe, o tutorial usava a própria apresentação da luta, com barras e um cartão pequeno; faltava uma identificação permanente que distinguisse demonstração, prática e partida válida. A simulação de demonstração já era independente (`TutorialDemo`); a confusão era de apresentação.

## Implementação

A primeira entrada na cidade sem checkpoint abre o treino de mira depois da abertura/cinemática e da narração, antes de simular o primeiro quadro disponível ao jogador. A janela declara **TUTORIAL · MIRA E DISPARO**, **FASE PAUSADA** e treino sem custo. Há demonstração animada, três alvos opcionais e abas para mouse/teclado, celular e controle. No controle: eixos 2/3 apontam a arma; R2/RT ou X/Quadrado disparam; apertar R3 recarrega. No celular: arrastar FOGO mira e atira. O joystick esquerdo continua sendo movimento. A janela mostra estes comandos sem alterar o mapeamento do jogo.

`AimPractice` é uma simulação pura, sem World, munição, saves ou DOM. Demonstração não conta acertos do jogador. `AimTutorial` prepara SVG/nós na abertura e só atualiza atributos durante o treino, pelo loop existente. O módulo carrega por `import()`; o principal só importa seu tipo. Nenhum canvas, gradiente ou fonte é criado por quadro. O mundo permanece pausado, incluindo tiros e inimigos. Ao confirmar, o jogo limpa bordas e suprime ações seguradas antes de restaurar controle, toque e música. A confirmação A/Cross só arma depois de soltar esse botão. Trocar de fase, reiniciar ou voltar ao menu invalida carregamentos pendentes por uma geração, removendo a interface antiga. Após concluir o treino, ele não volta durante a mesma sessão do Game; o atalho de validação permite repeti-lo.

No boxe, uma moldura envolve a tela e o título **TUTORIAL DE BOXE** permanece acima da demonstração. A mensagem **a luta ainda não começou** explica o estado. O HUD da partida fica oculto durante o tutorial; a interface de gestos continua disponível para praticar. Os botões dizem **IR PARA A LUTA** e **TERMINAR TREINO E LUTAR**, usando o fluxo existente que inicia uma simulação nova ao fechar o tutorial.

## Evidência, proteção e limites

`aimPractice.test.ts` cobre direções, zona morta, três alturas de alvo, cadência e demonstração sem crédito. `aimTutorialFlow.test.ts` cobre congelamento antes do passo do mundo, confirmação e cancelamento durante/depois do import. Os testes existentes do tutorial de boxe mantêm a demonstração e a simulação independentes.

Chrome local: três alvos acertados com mouse; relógio, posição, vida, moedas e projéteis do mundo intactos; Escape manteve a janela; confirmação por controle simulado restaurou entrada sem tiro/pulo adicional. Arrastar o analógico de treino em modo celular apontou e disparou. Capturas em 1440×900, 844×390 e 360×640 verificaram leitura e ausência de overflow horizontal; no retrato a janela rola, mantendo o cabeçalho visível. No boxe, o relógio da luta real permaneceu em zero enquanto a demonstração rodava, e sair do tutorial iniciou a introdução da luta. Não houve erro JavaScript. Estes são testes de navegador e controle simulado, não prova de latência ou fluidez em aparelho físico. Harnesses e imagens em `tools/_work/` não são versionados.

A página `tools/ambientacao.html` oferece atalhos **Tutorial de mira** e **Tutorial de boxe**. Na partida normal, o treino de mira é automático no começo da cidade; saves com checkpoint não são interrompidos.

A entrada automática foi conferida sem atalho: com narração desligada, a janela abriu com o relógio da fase em zero. Com a abertura narrada real, ela permaneceu ausente durante a cinemática e só abriu depois, com a narração ociosa (14,43 s do relógio do mundo nesse ensaio). Validação geral: typecheck, 868 testes em 95 arquivos e build aprovados. O build gerou `aimTutorial` separado (8,96 kB / 3,72 kB gzip).
