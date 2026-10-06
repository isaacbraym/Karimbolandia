# Balada: filminho com câmera, pista viva e bar com barman

Estudo de caso da revisão da cena da balada da fase 1 (2026-10-06). Código: `src/game/club.ts` (simulação), `src/art/club.ts`, `src/art/clubBar.ts`, `src/art/clubDancers.ts`, `src/art/karimbo.ts` (apito), `src/art/photo.ts` (cabeça do Sivirino).

## Pedidos e o que mudou

| Pedido | Solução |
|---|---|
| Cabeça do Sivirino do tamanho da do Karimbo, onde quer que ele apareça | `bakeSivirinoHead` assa a foto com `SIVIRINO_HEAD_H = 49` (era 30). O Karimbo mostra `KARIMBO_HEAD_H = 41` × `KSCALE = 1,2` ≈ 49 px; o Sivirino da balada (figura a 1,7 × 0,95, `headScale` 1,2) fica em ≈ 47,5 px e o da barraca em 49 px. Uma constante só serve às duas telas. |
| Apito maior, mais alto e *na boca* | Medido sobre a foto da cabeça (grade de 2 em 2 unidades em cima do sprite `heads.right`): o centro dos lábios está em **x ≈ 5, y ≈ −4,5** do pivô da cabeça; o apito antigo ficava em y −9 (no nariz). O novo tem bocal nos lábios, câmara da bolinha, faixa rosa e cordão, com ~1,8× o tamanho. O som (`audio.ts`, `whistle`) subiu de 0,13 para 0,30 e ganhou um harmônico quadrado e mais ruído de ar; `club.ts` toca com volume 1. |
| Zoom no Karimbo ao entrar | `ClubScene.camera`: de `BASE_ZOOM` (1,14) a 1,35 durante a entrada e a dança, com o Karimbo na metade de baixo do quadro e o bar aparecendo em cima. |
| A câmera acompanha o Sivirino até o Karimbo | O Sivirino entra pela esquerda (`CLUB_T.sivirino` = 9 s) e atravessa a pista em `CLUB_T.sivWalk` = 4,4 s, com passo quase constante; o foco da câmera vai um pouco à frente dele e, ao chegar, fecha nos dois (zoom ≥ 1,5) até o Karimbo se virar (`CLUB_T.turn` = 14,2 s). |
| Alguns da pista andam dançando | Um em cada cinco (`walksAt(i)`: 13 de 65) vai e volta numa faixa de 110–220 px, com 22–34 px/s, e para dançando nas pontas. Quadros próprios de passada (`walkPose` em `clubDancers.ts`: pés alternando e levantando, tronco inclinado, braços no ritmo), assados só para os 13. Estado determinístico (semente 9301, sem sorteio por quadro). |
| Barman preparando bebidas | `clubBar.ts`: ciclo de 9 s: sacode a coqueteleira no ritmo, serve (o líquido sobe no copo), enfeita com uma fatia e desliza o copo, seca um copo conversando, malabarismo com a garrafa (pega na prateleira, joga, gira e pega) e serve uma dose. A cor do drinque muda a cada ciclo. |

## Lições (para reutilizar)

1. **Meça o enquadramento antes de posicionar cenário.** O bar nasceu no fundo da pista (profundidade 220), mas a parede do fundo fica *acima* da tela: com a câmera normal e com o zoom da cena ninguém o veria. Foi preciso trazê-lo para a profundidade 140 como uma "ilha" (balcão + armário + prateleira), tirar a multidão da faixa dele e ajustar o foco do filminho para o Karimbo (inteiro, com os pés) e o barman caberem juntos. A câmera é limitada pela sala (`lock`), então o foco desejado nem sempre é alcançável.
2. **Peças seguradas precisam estar ao alcance do braço.** A primeira versão pedia mãos a 15–19 unidades para um braço de 13,2: a figura corta por IK e a coqueteleira ficava solta no ar. `segPose` limita a mão a 97% do alcance e o teste confere isso quadro a quadro.
3. **Misture as etapas, não as poses finais.** Cada etapa do barman é uma pose "crua"; perto de uma troca, a pose é a mistura do fim da anterior com o começo da seguinte (`BLEND` = 0,22 s), inclusive na volta do ciclo. Sem isso a mão pulava até 13 unidades entre quadros.
4. **O teste de câmera precisa iniciar a cena.** `club.active` só vira verdadeiro no primeiro `update`; um laço `while (active)` que começa antes nunca roda.

## Proteção contra regressão

### Entrada e contato — revisão de 2026-10-06

A fala 8 da descoberta podia iniciar ao atravessar a porta e cruzar com a música. `World.updateDoors` agora registra a entrada solicitada do lado de fora, pede essa fala e aguarda tanto a fila quanto o áudio ativo acabarem. Usa o estado real `narrPlaying`, não apenas a duração estimada. Terminada a fala, a mesma solicitação entra automaticamente; afastar-se cancela a entrada e não trava o controle. Com narrador desligado, a porta responde diretamente. Reinício limpa a espera, e o narrador não começa falas dentro da pista.

Sivirino termina a aproximação 20 px atrás da posição real do Karimbo, em vez de 46 px atrás do alvo de caminhada. Isso encosta as silhuetas mesmo com a tolerância de parada do roteiro. O teste de câmera usa a posição real e essa distância. `clubEntry.test.ts` cobre áudio ainda carregando, reprodução prolongada além da estimativa, entrada automática, ausência de sobreposição, narrador desligado e saída da porta durante a espera. O teste de porta/pista em `jungle.test.ts` desliga a narração para isolar seu objetivo.

No navegador, a fala carregada pelo jogo estava tocando do lado de fora, com `doorT = -1` e música `explore`. Ao entrar, `narrBusy` e `narrPlaying(8)` já eram falsos e a música era `rave`. A captura da dança confirmou contato, com distância física de 20 px, sem erros JavaScript. O atalho **Balada: porta e narração** isola os inimigos e gatilhos anteriores somente na página de desenvolvimento; aperte ↑ ou ↓ para solicitar a entrada. Isso verifica sequência de reprodução, mas não é uma avaliação auditiva humana.

`tests/club.test.ts` (linha do tempo; câmera: zoom, foco acompanhando o Sivirino e virada; um em cada cinco anda, nos limites, o bar cabe no enquadramento e ninguém dança nem passa pela ilha dele) e `tests/clubBar.test.ts` (ciclo completo usa todas as peças, mão contínua e dentro do alcance, cor muda, copo enche e desliza). Os testes de `communityInteriors` continuam garantindo 65 dançarinos espaçados.

## Limites

Não validado em aparelho físico nem ouvido por uma pessoa (o apito foi só aumentado em ganho e harmônicos). O barman é uma figura de perfil como as demais, virada para a pista.
