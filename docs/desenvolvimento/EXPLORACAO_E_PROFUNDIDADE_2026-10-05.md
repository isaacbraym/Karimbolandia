# Exploração livre e profundidade das fases iniciais

## Sintomas e escopo

Na versão anterior, a aldeia tinha 30 fachadas, mas apenas a casa da Dona Benedita tinha interior jogável. Das três cabanas mercenárias, apenas a palafita do vigia podia ser percorrida; as outras abriam um modal. Fachadas repetidas e a pequena superfície superior do caminho enfraqueciam a leitura 2.5D. A balada tinha 13 dançarinos efetivos alinhados no mesmo plano, com seis lasers de dano. Ao passar checkpoints, `World.blockBehind` criava um obstáculo e apagava entidades anteriores, impedindo voltar para explorar.

Esta entrega altera as fases 1 e 2 localmente. A evidência visual foi obtida em Chrome desktop sem janela, com viewports de 1440×900, 844×390 e 360×640. Esses dois últimos são verificações de layout emulado, não medições de aparelhos móveis.

## Mecanismos e implementação

- `game/buildings.ts` fornece identidade, dimensões, número de pavimentos e posição da porta. A mesma especificação alimenta as fachadas assadas em `art/buildings.ts`, as entradas em `game/exploration.ts` e os novos interiores. A fase atribui variantes estáveis na ordem espacial das construções. Não derive a porta de uma semente diferente da arte.
- As 30 casas e três cabanas agora têm interiores. Benedita e vigia conservam suas cenas próprias; os outros 31 usam plantas distintas, ofícios, paletas, mobiliário e moradores. Dez casas e a cabana do comando têm dois pavimentos. Escadas emitem uma troca explícita de andar, sem teleporte automático ao pisar no patamar.
- Ao trocar de andar, a sessão grava flags, libera os canvases do renderer anterior e cria o próximo renderer. Os pavimentos compartilham o ID da casa, evitando repetir presentes, cura e reputação. A restauração continua colocando Karimbo do lado de fora; os IDs e bits das duas cenas antigas foram preservados. O limite de entradas do save passou de 16 a 64 para comportar os 33 interiores.
- Os objetos das duas cabanas convertidas continuam chamando a investigação anterior por suas chaves originais: baú, gaveta, carta, retrato, rádio, revista, garrafa e armeiro. A reserva de munição e a lore usam a persistência existente.
- A superfície superior dos tiles sólidos passa a projetar 34 px em profundidade e 22 px para cima; plataformas usam 20/12 px. Faces laterais, juntas e bordas reforçam o volume. A colisão permanece a mesma. O excedente do cache de chunks aumenta para 38 px para não cortar a projeção nos limites da imagem.
- A pista da balada usa um trapézio com juntas diagonais, reflexos e profundidades variadas dos dançarinos. São 65 identidades, exatamente cinco vezes os 13 atores efetivos anteriores. Cada identidade tem 12 poses assadas, distribuídas entre quatro estilos de dança, com expressões e fases diferentes. O cache é finito e criado uma vez; o quadro usa sprites, sem refazer 65 rigs completos continuamente. Os lasers de dano foram retirados do autoramento; iluminação, entrada e cena do Sivirino continuam funcionando.
- Checkpoints salvam progresso sem criar barreira nem podar inimigos, itens ou objetos. `blockBehind` mantém a interface usada pela restauração, mas deixa `blockX` em `-Infinity` e remove qualquer prop legado de barreira. Isso também permite voltar depois de carregar um save.

Não foram alterados suavização `low` do canvas principal, `drawSprShrunk`, piso `DRS_MIN = 0.75` nem a separação entre intervalo bruto de desenho e tempo protegido da física.

## Problemas encontrados durante a validação

As primeiras plantas geradas colocavam uma planta entre cama e parede e um baú junto à escada. O teste de caminho demonstrou que algumas interações não tinham célula vizinha alcançável. Os móveis foram reposicionados, mantendo corredores livres; a verificação agora percorre todos os móveis de todos os pavimentos, não apenas o ponto inicial.

O simulador também considerava uma lista vazia de travessuras como completamente resolvida. Bastava visitar uma casa nova para receber moedas e `KARIMBADO!`. `checkPranks` agora exige ao menos uma travessura normal antes de conceder a conclusão. A proteção cobre uma visita sem ação durante dois segundos.

Na revisão visual seguinte, o usuário apontou que os dançarinos ainda formavam diagonais muito regulares: cinco linhas com a mesma distância horizontal e profundidade fixa. A distribuição agora escolhe, na criação da cena, pontos contínuos por PRNG determinístico e maior distância disponível entre candidatos. O piso visual passa de 156 a 224 px de profundidade, dando mais espaço. Escala acompanha a profundidade e os pontos são ordenados do fundo para a frente antes da atribuição das identidades, preservando a correspondência com os sprites assados. Não há sorteio ou ordenação contínua por quadro.

A ampliação também demonstrou uma falha de camadas: pintar o piso depois dos tiles escondia plataformas com colisão. O piso ganhou um passe próprio antes de tiles/objetos; luzes e dançarinos continuam nos passes posteriores. Ao aumentar um plano decorativo, verificar sempre se a imagem encobre uma superfície caminhável.

## Evidência e reprodução

`tests/communityInteriors.test.ts` verifica as 33 portas após assentamento físico no chão, unicidade das fachadas e plantas novas, acesso a porta/móveis/escadas, persistência dos 33 interiores, recompensas entre pavimentos, acesso aos objetos antigos das cabanas, ausência de barreiras após checkpoint/restauração e 65 dançarinos sem lasers. Os testes anteriores de exploração, save, fluxo de entrada e floresta foram atualizados para a nova exploração livre.

Na validação desta entrega, typecheck, build e diff check passaram; a suíte completa passou com 65 arquivos e 593 testes. O build manteve os avisos anteriores de importação dinâmica ineficaz de áudio/música.

Para conferir visualmente: percorra a aldeia, entre em casas pequenas e grandes, use a escada da segunda casa nos dois sentidos e volte pela porta. Visite as três cabanas e examine cartas/retrato; abra e recolha reservas, saia e retorne para verificar que não se repetem. Na fase 1, entre na balada, confira a distribuição irregular, a leitura de Karimbo à frente e a visibilidade das plataformas e caixas de som, tanto na entrada quanto na saída. Nas duas fases, passe por checkpoints e volte ao trecho anterior, inclusive depois de salvar/carregar. Confira bordas dos chunks do caminho em movimento, com câmera avançando e recuando.

Na revisão do espaçamento, o mesmo teste da balada exige profundidades variadas, margem dentro da sala, plano do Karimbo livre, separação mínima ponderada entre atores e ordem de oclusão. O QA local em Chrome registrou 65 atores, 52 profundidades mesmo arredondadas em pixels, plataformas visíveis, nenhum erro JavaScript e nenhum overflow em 844×390. Capturas e harness dessa revisão ficam em `tools/_work/club-spacing-*`, fora do Git; os limites de medição descritos abaixo continuam valendo.

A inspeção local registrou troca real de pavimento nos dois sentidos, posição caminhável na chegada, ausência de erros JavaScript e de overflow nos dois viewports menores. As capturas e o harness local estão em `tools/_work/` e não são versionados; o procedimento acima e os testes permitem repetir a validação numa nova máquina.

## Limites da evidência

O harness desenha cenas controladas com o mundo pausado. Os intervalos de `requestAnimationFrame` obtidos nele não medem a fluidez física do gameplay, a GPU móvel ou o pacing normal do jogo. Não há promessa de aumento de FPS. A multidão adiciona um cache de poses e mais sprites; medir memória, frametime, quedas e imagem em aparelhos reais continua sendo necessário antes de afirmar fluidez móvel. Essa medição está no Beads `karim-4hw`.

Para reproduzir as verificações automatizadas, execute `npm run typecheck`, `npm test`, `npm run build` e `git diff --check`. Uma mudança de quantidade de casas, ordem autorada ou personagens deve revisar também os IDs estáveis, limites de save, dimensões de bake e os testes de alcançabilidade. A solução de projeção visual é específica desta câmera lateral 2.5D: não converte a física em deslocamento livre em dois eixos.
