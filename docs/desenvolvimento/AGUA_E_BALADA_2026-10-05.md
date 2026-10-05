# Superfície da água, saída da balada e reprodução do MP3

## Sintomas e causas demonstradas

As margens já projetavam o topo 34 px para a direita e 22 px para cima, mas a água só desenhava uma faixa horizontal na linha física. A saída da balada tinha uma porta lógica interna e apenas uma decoração externa na camada anterior aos tiles. A imagem exata de Karimbo pensador já estava no mapa de Atlântida, na coluna 518,5 e linha 104, entre a torre e o palácio; faltava orientar a exploração até a praça.

O arquivo `public/assets/audio/balada.mp3` existia, era decodificável e estava registrado. Havia dois problemas de reprodução: `Game.setMusic` memorizava o estado mesmo quando o clipe ainda não estava pronto, sem nova tentativa após decodificar; e o diretor voltava a pedir exploração depois da dança, mesmo dentro da sala. A cena só impunha sua trilha enquanto estava ativa, permitindo parar o MP3 e alternar estados dentro da balada.

## Implementação e limites

`src/art/perspective.ts` compartilha a projeção do chão com o plano superior da água. A linha frontal permanece na altura física original. O plano é recortado em paralelogramo, desenhado antes dos tiles e atores, com textura periódica e cáusticas deslizando em sentidos opostos em coordenadas do mundo. O pântano também distribui vitórias-régias pelo plano superior. A camada frontal anterior continua cobrindo apenas a região submersa. Câmaras com `surface` explícita não recebem outra superfície: usam a superfície real do lago.

Gradientes e texturas são preparados no cache existente; a animação usa cópias de imagem, transformações e recortes. As portas são assadas junto da arte da balada e copiadas depois dos tiles e da multidão, antes do jogador. Suas duas posições vêm diretamente da porta lógica, evitando deslocar desenho e transição separadamente. A placa interna indica `SAÍDA / ↑ SAIR`; a externa identifica a saída da balada. Os avisos de transição da fase 1 agora mencionam a cidade e a balada.

A estátua conserva a imagem, pose, textura e posição. Uma placa à esquerda da praça, dois cristais próximos, a identificação `O PENSADOR` e a dica na fenda indicam o trajeto. Para encontrá-la: entrar na fenda com o traje do Sivirino, descer até o leito profundo e seguir à direita, entre a torre e o palácio. Decoração não altera colisões, entradas, tesouros ou IDs de progresso.

O diretor deixa a sala controlar sua trilha. A balada continua solicitando `club` ou `drop` após a cena, sem alternar para exploração por quadro. `AudioEngine.onPlayable` permite recuperar a reprodução após decodificação, retorno do contexto ou remoção do mute. `Game` só recupera o pedido durante gameplay dentro da sala; pausa e saída impedem um início tardio. Um loop já tocando não é duplicado. A pausa da fala do Sivirino mantém o silêncio previsto na cena.

## Evidência e proteção

`tests/immersionFixes.test.ts` cobre continuidade da trilha sem alternância por 300 quadros, transição real pela porta, recuperação após fallback sem loop duplicado, notificação de decodificação, bloqueio de início durante pausa/fora da sala, projeção sem alterar volumes físicos e ausência de superfície falsa na câmara profunda. Rodar `npm run typecheck`, `npm test` e `npm run build`.

Validação local em Chrome, com perfil isolado e carregamento do MP3 deliberadamente retido até entrar na sala: fallback inicialmente ativo; MP3 iniciado automaticamente após liberar a resposta; relógio do clipe avançando; sinal medido no barramento de música (RMS aproximadamente 0,027); mesmo controle de loop após a dança; avanço zero durante pausa e aproximadamente 0,31 s ao retomar por 0,30 s. A saída chegou a `(5712, 1024)` e parou o clipe. Não houve erro de página. Imagens locais conferiram a água, as duas portas e a estátua no mapa jogável. Artefatos de QA ficam em `tools/_work/`, ignorados pelo Git, e não são dependências do jogo.

O canvas principal continua com suavização `low`; DRS, física e marcapasso não mudaram. Capturas e layout em viewports menores verificam legibilidade e enquadramento, sem constituir prova de cadência física em aparelhos móveis. A validação é local, sem publicação no GitHub Pages.
