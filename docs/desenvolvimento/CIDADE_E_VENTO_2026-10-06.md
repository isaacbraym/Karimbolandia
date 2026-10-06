# Cidade atacada e vento ambiental — amostra local

## Pedido e escopo

Após aprovar a clareira e a correção dos montes, o usuário pediu o mesmo conceito de profundidade nos primeiros 30 segundos da cidade atacada e vento na vegetação da floresta e nos elementos flexíveis urbanos. A cidade é `stage = 1` no código; a floresta é `stage = 2`. A página de amostra usa os nomes dos cenários para evitar confundir essa numeração.

`buildLevel` configura `scenicStreet` depois dos cortes do mapa: 0 até `playerStart.x + RUN * 30` (6024 px). O limite é espacial, à velocidade normal de caminhada; combate e pausas não desligam a arte. O vento nas decorações vale ao longo das duas fases; o piso da cidade continua sendo uma amostra, assim como a clareira inicial da floresta.

## Profundidade urbana

A cidade tinha fachadas detalhadas e paralaxe, mas a face repetida dos tiles ainda separava a rua do fundo, como uma passarela. `art/cityStreet.ts` integra os pés em um plano amplo de asfalto, com calçada recuada, fissuras irregulares, reflexos fragmentados, becos em perspectiva, dois planos de fachadas e escombros próximos. Patamares existentes recebem fachadas recuadas que os ligam visualmente à arquitetura, sem mudar os tiles de mão única.

`cityGround` identifica somente o chão base da amostra, nos temas STREET/STEEL. Não cobre fossos, degraus sólidos altos, plataformas ou tiles HANGAR dos interiores. Os lábios dos fossos têm uma borda própria. A cobertura próxima de asfalto começa 24 px abaixo dos pés e esconde a face do teto da balada vista do exterior; `World` suprime ambos os passes de cidade ao entrar em um interior. A física, posições dos inimigos, itens, portas e triggers permanecem as mesmas.

A pintura usa patches de 512×720 unidades a 1,25×, dois canvases por patch, no máximo dois patches preparados por desenho. As fachadas e texturas usam células globais e contribuições vizinhas para atravessar limites do cache. A extensão limita o cache a 12 patches, cerca de 53 MiB de pixels quando completamente preenchido, antes de despesas do navegador. A revisão do mapa invalida o cache. Tecidos, fumaça e papéis usam tempo de simulação e sprites preparados; o quadro estável não prepara gradientes nem canvases nesses passes.

## Vento sem refazer a arte

`art/wind.ts` fornece rajadas determinísticas que variam suavemente em espaço e tempo. Árvores, palmeiras, bananeiras, arbustos, flores, samambaias e plantas de brejo usam os mesmos ciclos de vento. A amplitude depende da flexibilidade do elemento. Pedras, raízes, fachadas, postes e construções mantêm sua geometria.

As imagens cacheadas de vegetação são desenhadas em faixas com deformação crescente em direção às pontas. Cada faixa usa uma transformação linear que coincide com a seguinte na borda; pequeno recobrimento protege contra frestas de amostragem. As bases ficam firmes. A bandeira da floresta separa o mastro rígido do tecido deformado. O culling inclui margem para o movimento das pontas.

As samambaias próximas da clareira passam a usar quatro sprites pequenos compartilhados pelo mundo e registros de posição/escala preparados no bake. Cada exemplar inclina a partir de sua raiz, em vez de mover todo o patch de piso. Isso substitui o canvas grande de primeiro plano de cada patch da clareira. A animação não rebakeia as samambaias.

Na cidade, árvores, bandeiras existentes, plantas, fumaça dos canos e fogo acompanham rajadas; tecidos suspensos têm pontos de fixação no fio, pontas livres e ondulação local. Fumaça distante e papéis soltos reforçam a direção do vento. Não há forças novas na física do jogador. Usar `World.time` congela a animação ao pausar, e desenhar duas vezes não avança efeitos.

## Evidência e reprodução

Abra `http://localhost:5255/tools/ambientacao.html?cidade`. Os botões **Cidade atacada: início**, **Floresta: início**, **Vilarejo** e **Jogar** permitem alternar os cenários. O perfil `amostra-ambientacao` isola a avaliação do progresso normal. É uma página de desenvolvimento do Vite, não uma entrada publicada do build.

`cityWind.test.ts` protege o limite espacial, fossos e plataformas reais, a exclusão dos tiles HANGAR, caminhada no asfalto e queda no primeiro buraco. Também protege continuidade entre faixas de deformação, base firme, determinismo das rajadas e rigidez de construções. A suíte anterior de montes, telhados e interiores continua passando.

No Chrome desktop sem janela, capturas cobrem abertura, rua, primeiro fosso, patamares e dois instantes do vento na floresta/cidade. A balada também foi conferida colocando o jogador no destino da porta: `inRoom() = true`, piso físico em 1440 px e interior visível sem o passe de asfalto. A caminhada com D de coluna 4 a 15 chegou ao destino sem pulo e sem parede; os triggers e inimigos foram desativados somente nesse experimento para isolar o terreno. Em viewports 844×390 e 360×640 não houve overflow nem erro JavaScript.

Após aquecimento, 120 repetições dos novos passes de piso/vento e decorações visíveis criaram **zero canvases e zero gradientes**, tanto na cidade quanto na floresta. Isso comprova reutilização dessas imagens, não o custo total da GPU. Uma janela curta de gameplay da cidade, com 310 intervalos de desenho após aquecimento, registrou P95 17 ms, P99 17,4 ms, máximo 19 ms e 0% acima de 20,8 ms. Não houve comparação A/B nem apresentação física medida; essa conferência local não comprova desempenho móvel. Harness e capturas estão em `tools/_work/city-wind-*` e `forest-wind-*`, fora do Git.

Typecheck, 854 testes em 92 arquivos e build passaram. Foram preservados o filtro `low` do canvas principal, `drawSprShrunk`, `DRS_MIN = 0.75` e os tempos separados de desenho/física. A extensão da direção artística além da amostra depende da avaliação do usuário. Não houve push ou deploy.
