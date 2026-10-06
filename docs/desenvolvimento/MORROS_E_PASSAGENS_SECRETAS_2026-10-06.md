# Morros caminháveis e passagens secretas

## Composição e escopo

A referência fornecida pelo usuário mostra uma crista arredondada e uma entrada descoberta por baixo de uma aba de rocha. A entrada do Templo Esquecido ganhou essa composição, conservando a masmorra existente e a saída próxima. “Tempo Perdido” não aparece literalmente no código: interpretar esse nome como referência ao templo foi uma suposição comunicada ao usuário, sujeita à revisão visual.

Há quatro descobertas opcionais adicionais: Estação Esquecida e Jardim da Resistência na cidade; Relógio da Mata e Refúgio das Raízes na floresta. Cada uma possui interior 2D, moedas, jingle de descoberta uma vez por save e duas portas de retorno à própria entrada. Não usa o fluxo dos interiores isométricos nem um minijogo. As entidades novas são anexadas; IDs anteriores de inimigos, objetos e itens permanecem estáveis. As seis moedas do antigo topo do templo mantêm seus IDs, agora sobre a crista.

`src/game/level/passages.ts` procura entradas em terra firme e salas no subsolo maciço. O volume completo do morro deve ficar fora de água, fossos, paredes altas, arenas e construções exploráveis. A busca é determinística. Props, inimigos e objetos que ocupavam o chão no volume alterado são assentados na nova superfície sem trocar IDs. Na entrega das passagens, as clareiras adicionais eram locais. Após a aprovação da amostra, a campanha foi ampliada conforme o [caso das paisagens da fase 2](PAISAGENS_DA_FASE_2_2026-10-06.md).

## Física demonstrada

Uma colina sólida preenchida impediria alcançar a porta inferior. Uma escada de tiles reintroduziria os degraus que o usuário rejeitou. O `Level` agora possui cristas de mão única (`mounds`), cujo perfil é compartilhado pelo desenho e pela física. É possível andar até o topo, cair pela lateral e voltar à entrada inferior. A face de rocha é cenário, e a superfície superior é caminhável. Não há colisão lateral invisível no arco.

Durante a validação, o relevo baixo anterior puxava o corpo para baixo depois de ele aderir à crista: `moveBody` projetava primeiro no morro e depois novamente no chão antigo, cuja tolerância de descida era um tile. O trace mostrou o personagem permanecendo no chão embora a crista já estivesse acima. A correção seleciona o suporte anterior sob a largura dos pés e impede a segunda projeção quando o corpo já está sobre o morro. Um jogador que chega pelo vão inferior não é transportado para cima. `groundBelow` reconhece a crista somente quando ela realmente está abaixo da consulta.

O ensaio no mundo também encontrou a borda de uma arena dentro do começo de um morro. A seleção passou a excluir arenas pelo volume completo, em vez de apenas pela posição da porta. A regra evita esconder bloqueios de combate numa subida que parece livre.

A seleção também preserva os corredores autorados de entrega e drone e evita cobrir civis. Inimigos que já tinham apoio numa plataforma conservam esse apoio. O teste de agachar isola seu plano horizontal, sem uma crista opcional entre o alvo e o atirador.

## Desenho e preparação

`src/art/passages.ts` pinta silhueta assimétrica, rochas, musgo, raízes, arco com profundidade e interiores distintos. Os motivos de relógio parado, estação e sementes fazem parte da descoberta. As ruínas do templo são recuadas e variam em altura. O desenho usa o cache e orçamento existentes de decorações: preparação ocasional, cópia de imagem nas cenas aquecidas. As plantas próximas usam os movimentos de vento existentes.

As salas de passagem não recebem a escuridão circular do templo. A decoração exterior é excluída enquanto se está nelas; suas imagens internas não são desenhadas na superfície. As clareiras locais substituem apenas o piso elegível, incluindo a área externa de pedra do templo. Água, plataformas e demais trechos conservam suas regras de desenho. Suavização principal, `drawSprShrunk`, DRS e loop não foram alterados.

## Evidência e reprodução

`tests/passages.test.ts` atravessa todas as cristas sem pulo, verifica descida e aproximação por baixo, entrada, devolução de controle, caminhada interna, descoberta única e retorno. Os testes da selva reconhecem suporte curvo para o guarda do templo. O teste artístico conserva a amostra original e verifica que clareiras adicionais são locais. A regressão do lago permite anexar cenários novos sem exigir que sua decoração seja o último elemento da fase.

No Chrome local, o ensaio em `World.update` confirmou subida até aproximadamente 257 px na floresta e 225 px na cidade, descida, aproximação inferior e entrada com controle restaurado nas cinco passagens. Esse ensaio remove tropas e props para isolar a geometria, portanto não prova dificuldade do combate. Em 120 quadros aquecidos de desenho das novas decorações: zero canvases e zero gradientes criados. Capturas foram inspecionadas em 1440×900, 844×390 e 360×640, sem overflow ou erro JavaScript. Os harnesses e relatórios estão em `tools/_work/`, ignorados no Git.

Para reproduzir a revisão jogável, abra `/tools/ambientacao.html?passagem=temple`, use os botões dos cinco locais e clique em Jogar. Atravesse o morro, volte pelo vão inferior e pressione ↑ diante do arco. As salas novas oferecem retorno na entrada e no fundo. Na gameplay normal continuam valendo combate, props e coletáveis da fase. Execute typecheck, suíte completa e build antes de publicar.

Esta é evidência de física e imagem no navegador local. Contagem de alocações aquecidas e viewports emulados não demonstram cadência ou GPU de celular físico. O tamanho da crista é uma escolha autorada desta câmera, não uma constante universal.
