# Lago vivo, peixes por trás das pedras, minimapa e Praça do Pensador

## Sintomas e escopo

Na selva (fase 2) o lago raso e a Atlântida submersa tinham peixes que **travavam nas paredes**: `Waters.update` tratava toda pedra como parede para qualquer peixe (`freeAt` + rebote), embora as camadas 0 e 1 já fossem desenhadas *atrás* dos tiles. O resultado era um cardume rebatendo na torre e no palácio. Além disso o lago era vazio (peixes-foto soltos, nenhuma vegetação de rio, pouca bolha), não havia mapa para se orientar nos 150 tiles de profundidade e a estátua do Pensador aparecia sem cerimônia.

Esta entrega altera só a fase 2. Evidência visual: Chrome embutido (Chromium) em 1440×900, 844×390, 667×320 e 360×640. Os três últimos são **layout emulado**, não aparelho físico.

## Causa demonstrada e forma correta de desenvolver

**Causa:** o rebote em pedra estava no laço de todos os peixes. Como o desenho já põe a camada de fundo atrás dos tiles, bastava o peixe *parecer* passar por trás.

**Forma correta (profundidade, não colisão):**

- O peixe ganha `depth` contínuo (0 = no plano; 1 = afastado da câmera). Ao detectar pedra no corpo ou à frente (`FISH_LOOKAHEAD = 0,8 s`, duas amostras) ele sobe `depthGoal`, encolhe (`FISH_BACK_SCALE = 0,78`), se mistura à água (`FISH_BACK_FADE = 0,35`) e passa para o passe de desenho de trás da pedra (`fishPass`). Volta depois de `FISH_CLEAR_HOLD` segundos livres (histerese). Seguidores copiam a meta do líder.
- Peixe ainda no plano e prestes a entrar na pedra *espera afastar* (nada de estalo de camada, nada de rebote). Salvaguarda: preso mais de 5 s atrás de pedra, escolhe outro alvo em água livre. A borda da **zona d'água** continua sendo parede (`inZone`); a pedra não (`rockAt`). `pickTarget`/spawn continuam escolhendo água livre: o peixe nunca "mora" dentro da pedra, só o caminho cruza.
- O desenho filtra por `fishPass(f)`, não mais por `f.layer`, e usa a escala derivada da profundidade para a escala **e** para escolher o mip.
- Piranhas (inimigos) continuam no plano do Karimbo e colidem: balas e mordidas precisam ser coerentes.

Armadilha: um teste antigo (`tests/jungle.test.ts`, "peixes nunca ... pedras") protegia exatamente o comportamento errado. Foi atualizado para o contrato novo (dentro da pedra só com `depth ≥ 0,5`). Ao trocar uma decisão com nova evidência, o teste que a protegia muda junto — não se apaga a proteção para fazer a suíte passar.

## Ecossistema (barato por construção)

- Dez espécies (`src/game/lake/species.ts`): neon e cardinal (cardumes de 20–36), acará-bandeira, acará-disco, coridora (saltinhos rente ao leito), tucunaré (às vezes persegue neons; nunca remove peixes), pirarucu (rota longa; evento "peixe gigante" no máximo 1× a cada 90 s), arraia (levanta areia), poraquê (corpo de 6 segmentos, brilho elétrico) e os peixes-foto originais. Cardume = **líder + seguidores em treliça** (O(n), sem boids O(n²)); seguidores têm velocidade de alcance proporcional à folga (`+ max(0, gap−60)·1,1`), senão o cardume nunca se reagrupava depois do susto.
- Teto `MAX_AMBIENT_FISH = 1200` (a fase já nascia com 648 peixes; o plano chegou a prever 300, mas o total real vem da fase e o teto protege a soma). **Culling por distância**: só se simula peixe a até `FISH_SIM_MARGIN = 700` px da câmera em X; o resto fica congelado. A sonda de pedra é espalhada no tempo: cada peixe testa a pedra a cada 3 quadros, e todo quadro só se estiver perto de pedra (`rockNear`).
- Vegetação: `decorateLake(b)` é chamada **no fim** de `buildAtlantis` (decos não têm ID persistido; não reordena pickups/inimigos). Estáticas assadas no cache de decos; animadas com teto de 48 visíveis e ≤ 4 `drawImage` cada. Neve em suspensão com duas texturas em mosaico e paralaxe. Primeiro plano desfocado (marca do jogo) em poucos pontos, sem encobrir pérolas, relíquias ou passagens.
- **Pérolas:** `LAKE_PEARLS = 12` espalhadas pelo lago (`placePearls`); cada uma vale 5 moedas. São itens anexados **no fim** de `buildAtlantis` para não deslocar IDs de itens existentes.
- **Embalo de braçadas** (`lake/stroke.ts`): braçadas encadeadas no ritmo (a nova entre 0,25 e 0,65 s depois da anterior) sobem o embalo até o nível 3; cada nível acima de 1 dá +12% de velocidade horizontal (máx. +24%) e sem braçada por 1 s o embalo cai. Só rastro e velocidade: não mexe em oxigênio, pressão nem colisão.
- Cardume leal e anéis (`spawnRings`/`spawnLoyal`): ao passar por anéis de luz um cardume passa a escoltar o Karimbo; congelado no lago raso e desfeito ao abortar a cena (revisão: antes ele ficava parado e os anéis ficavam órfãos).

## Minimapa

- `LakeMap` (`src/game/lake/lakeMap.ts`): grade de células de 2×2 tiles sobre a união das zonas `lake` com a superfície do lago principal (derivada das zonas, não de números fixos). Revela num raio de 5 tiles **só quando o Karimbo muda de célula**. O percentual é `round` com mínimo 1 e máximo 99 até completar (antes, `floor` mostrava `0%` depois de explorar bastante).
- Desenho assado em pixels do destino (D02): terreno, névoa cinza e a composição; só as células novas são copiadas para a composição. Por quadro: moldura + composição + ponto pulsando + pinos (≤ 12) + o número em vaga fixa. O rótulo vive **dentro** da moldura (em 667×320 ele colidia com o botão de toque).
- **Save compatível:** `lakeMap` é um campo **opcional** em `SaveState`, base64 do bitset (≤ 1024 caracteres), validado em `saveValidation.ts` e tolerante: tamanho diferente é ignorado sem lançar. Save sem o campo carrega normalmente.

## Praça do Pensador

Cena roteirizada, uma vez por partida (`lake/thinkerReveal.ts`, padrão de cena do clube: controle, câmera e música do roteiro; `reset` sempre libera): ao chegar a 9 tiles da estátua (`THINKER_TRIGGER`) a câmera enquadra o monumento, os cristais acendem, um facho de luz desce do teto, dois anéis de neon (40 peixes) orbitam em sentidos opostos e a música vira `monument`, por 6,5 s com o Karimbo flutuando. Depois ficam o halo (facho a 35%), os cristais e os anéis. Foto, pose, textura e posição da estátua são preservadas. O custo é testado com o **menor zoom** usado pela revelação, porque o zoom-out multiplica os sprites visíveis (item 4 do foco de revisão do plano).

## Revisões que acharam falhas reais

A revisão independente após a T4 (commit `0770ed2`) achou, entre outras: a música sobrescrita a cada quadro pelo diretor durante a cena; cardume leal parado no lago raso; anéis órfãos ao abortar; espaçamento das enguias; neve estourando o orçamento; mips ausentes na arte nova. Todas viraram teste antes da correção.

## Proteção contra regressão

| Risco | Proteção |
|---|---|
| Peixe volta a travar na pedra ou aparece na frente dela | `tests/lakeFish.test.ts` (camadas 0/1/2 atravessam, encolhem e voltam; borda da zona limita; nenhum peixe parado contra pedra no lago real) |
| Ecossistema determinístico e sem estourar teto | `tests/lakeLife.test.ts` (mesma semente = mesmas posições; teto; reagrupamento; tucunaré não remove peixes) |
| Custo de desenho do lago/zoom da revelação | `tests/lakeRenderCost.test.ts` (contexto falso: ≤ 360 `drawImage` por quadro no pior enquadramento) |
| Minimapa e save | `tests/lakeMap.test.ts` (bitset, percentual, save opcional e tolerante) |
| Cena do Pensador libera o controle | `tests/thinkerReveal.test.ts` |

## Evidência de desempenho (e o que ela não prova)

Rota única da T0 (`?fase=2&qa=1&god=1&tp=520`: lago raso → fenda → praça → palácio, 240 quadros por parada, Chromium embutido 1440×900, quadros avançados manualmente — painel oculto): ver a tabela registrada no estudo de minijogos (mesma metodologia). Isso é custo de CPU/JS por quadro numa máquina de desenvolvimento, **não** fluidez em celular. A validação física (g54 / Edge 30 Neo) está aberta no Beads (ver `bd show karim-uer`).

## Limites

- A profundidade resolve peixes (decoração viva). Qualquer inimigo ou projétil continua no plano do Karimbo.
- `MAX_AMBIENT_FISH` e `FISH_SIM_MARGIN` foram calibrados para esta fase; outro lago exige reavaliar o orçamento.
- O minimapa cobre o lago principal; o pequeno lago da aldeia não entra.
