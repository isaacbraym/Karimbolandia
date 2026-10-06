# Perseguição em galhos curvos

## Problema e solução

Os tiles de mão única de madeira desenhavam pranchas retas. Trocar somente a arte deixaria pés e obstáculos numa altura diferente da madeira visível. O percurso agora fornece `pathY(x)` e `surfaceY(x)`: duas ondas suaves acrescentam até 25 px de relevo à altura autorada de cada galho. A primeira também interpola a altura dos vãos para o macaco; a segunda retorna `null` nos vãos e tiles quebrados.

O `Runner` usa colisão local de mão única: acompanha a curva quando já apoiado e varre aterrissagens em passos de até 8 px. Não há paredes em pequenas subidas. Saltos, coyote, buffer, planar, bromélias e cipós mantêm as constantes de movimento. O ponto seguro, os quatis, objetos, bônus de pouso e galhos que quebram usam a mesma superfície. Nas subidas de um tile, a dica de salto passa de 44 para 18 px antes da borda: o salto anterior chegava ao outro lado depois de descer abaixo da madeira. O bot perfeito comprova a nova linha sem falhas.

## Arte e ritmo

`BranchCanopy` assa casca com nervuras curvas, musgo, flores pequenas e ramificações pendentes. A espessura afina nas pontas. Troncos continuam abaixo da corrida; folhas irregulares, ramificações do fundo, névoa e fachos de luz são preparados no backdrop com paralaxe. Os tiles deixam de aparecer como plataformas; continuam representando presença e quebra da madeira na simulação. A máscara de desenho usa essa presença, portanto um galho quebrado desaparece também na imagem.

A velocidade começa em `RUN × 1,22`, aquece por 8 s e cresce até mais 32% aos 48 s. Macaco e Karimbo compartilham a progressão, preservando diferença de velocidade, provocação, cansaço e resgate. O limite do boost de pouso continua +15% sobre o ritmo atual. Bot perfeito: 49,07 s, zero quedas/tropeços; comum: 58,20 s. Seis sementes do bot ruim continuam vencendo em até 92 s. A janela do bot comum admite 50–74 s para proteger o novo ritmo.

## Evidência e limites

`tests/chase.test.ts` cobre apoio exato na curva, subida sem pulo, remoção de apoio quando quebra, teto de aceleração, bots e determinismo. `chaseRenderCost.test.ts` mantém ≤250 cópias de imagem por quadro e nenhum gradiente depois do preparo. Os novos canvases de galhos são criados no construtor, antes da corrida; quebra e resize não refazem a casca. Não se alterou o carregamento por `import()` no fluxo pequeno, congelamento do mundo ou restauração de controle/música/toque.

Capturas no Chrome desktop incluem 2, 14 e 35 s da corrida e entrada real pelo fluxo do jogo. No fluxo real, posição e relógio do mundo permaneceram congelados enquanto a corrida avançou; 120 desenhos da casca criaram zero canvases/gradientes. Viewports 844×390 e 360×640 não tiveram overflow nem erros JavaScript. Há atalho **Perseguição do macaco** na página de amostra. O build mantém a perseguição num chunk próprio. A conferência local não prova fluidez num aparelho físico nem substitui avaliação humana de arte. Harnesses em `tools/_work/` ficam fora do commit.
