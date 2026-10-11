# Narração do KARIMBOLÂNDIA (roteiro para gravar no MiniMax Audio)

## 1) Prompt da voz (Voice Design)

> Narrador masculino brasileiro, adulto, voz grave e encorpada de trailer de cinema épico, dicção clara, sotaque neutro. Fala com seriedade dramática exagerada, como um documentário de guerra, mas com timing cômico: faz pequenas pausas antes das piadas e solta a punchline num tom seco, quase sarcástico, como quem segura o riso. Ritmo médio, energia alta nas frases épicas e mais baixa e irônica nas piadas. Estilo paródia de narrador de filme de ação dos anos 90.

Configurações sugeridas: velocidade 1.0 (0.95 se ficar corrido), emoção "neutral" ou "happy" (evite "angry"), saída MP3 ou WAV 44,1 kHz, mono.

## 2) Texto para colar (tudo de uma vez)

Os blocos estão separados por `<#2.0#>`, que no MiniMax gera 2 segundos de silêncio. Esse silêncio é o ponto de corte.
Se o site ler `<#2.0#>` em voz alta, apague as marcas e deixe só uma linha em branco entre os blocos.
Se passar do limite de caracteres, gere em duas partes: do audio1 ao audio14 e do audio15 ao audio28.

```
Karimbolândia. Uma cidade em ruínas, invadida pela Legião do planeta Chupaku. Quando tudo parecia perdido... surge o herói do povo. O homem. A lenda. As orelhas. Seu nome é... Karimbo!
<#2.0#>
Um soldado da Legião. Parado. Distraído. Karimbo fez o que todo grande herói faria: mirou com cuidado... e torceu pra acertar.
<#2.0#>
Karimbo olhou atentamente... e viu plataformas. Muitas plataformas. Ninguém sabe quem constrói tantas plataformas numa cidade, mas ele agradece.
<#2.0#>
Ai. Essa doeu até nas orelhas.
<#2.0#>
E Karimbo tinha uma habilidade inusitada: voar com suas enormes orelhas. O único problema... é que o zumbido de pernilongo entregava sua posição pra Legião inteira.
<#2.0#>
Somente nesses momentos as mulheres da cidade viam Karimbo como alguém importante. Mas Karimbo só pensava em uma coisa: salvar a Júlia.
<#2.0#>
A temida Orelhada! Uma técnica milenar, proibida em três galáxias... e em todos os salões de beleza.
<#2.0#>
Uma área secreta! Karimbo ouviu tudo de longe. Com essas orelhas, nenhum segredo dura muito tempo.
<#2.0#>
Uma Orelha Dourada! Dizem que quem junta as três ganha... mais orelhas. Como se ele precisasse.
<#2.0#>
Emboscada desfeita. A Legião aprendeu da pior forma: nunca subestime um homem que escuta você recarregar a três quarteirões de distância.
<#2.0#>
A cidade comemorava. Pela primeira vez na história, alguém agradecia por orelhas daquele tamanho.
<#2.0#>
Na garagem, o Nômad. Protótipo de guerra da Legião. Grande, pesado... e com espaço de sobra para as orelhas. Foi amor à primeira vista.
<#2.0#>
Karimbo no comando do Nômad. A Legião ainda não sabia, mas o dia dela tinha acabado de piorar. Muito.
<#2.0#>
E lá vinham eles. Uma leva, duas, três... A Legião tinha muitos soldados. Karimbo tinha muita munição. E nenhuma paciência.
<#2.0#>
O avanço do Nômad! Tudo o que estava na frente virou lembrança. Inclusive aquele carro estacionado em local proibido.
<#2.0#>
Um abismo. Pulando, não dá. Mas dizem que quem avança rápido o bastante... nem percebe que o chão acabou.
<#2.0#>
Área de guerra. Até o vento pediu pra sair. Karimbo respirou fundo... e as orelhas também.
<#2.0#>
A passagem era estreita demais para o Nômad. Para as orelhas de Karimbo também... mas ninguém teve coragem de avisar.
<#2.0#>
Karimbo se arrastou pelo túnel, raspando as orelhas no teto. Ele jurou que essa parte não entraria no trailer.
<#2.0#>
Um Nômad emprestado! Cinquenta segundos de pura felicidade. Igualzinho a férias.
<#2.0#>
Os moradores apontavam para o alto. A princesa Júlia estava presa no telhado. E entre Karimbo e ela, só uma torre gigante, alguns soldados... e a lei da gravidade.
<#2.0#>
Hora de subir. Andar por andar, plataforma por plataforma. Se cair, as orelhas amortecem. Em teoria.
<#2.0#>
O telhado. O vento batia nas orelhas de Karimbo como numa bandeira hasteada em dia de vitória.
<#2.0#>
Karimbo sente uma presença pesada e mortal no ar... e um leve cheiro de refrigerante. Será que é o Felipão, o líder da invasão?
<#2.0#>
O Felipão ficou furioso! E quando o Felipão fica furioso... até os arrotos ficam mais altos.
<#2.0#>
Última cartada! Agora é tudo ou nada. E pra tudo, Karimbo tem orelha.
<#2.0#>
Calma. Até os maiores heróis tropeçam nas próprias orelhas.
<#2.0#>
E assim, o Felipão caiu. A cidade estava salva... por enquanto. E a princesa Júlia? Bem... essa história continua. Ouviu, Karimbo? É claro que ouviu.
```

## 3) Onde cada áudio toca (para salvar e recortar)

| Arquivo | Onde toca no jogo | Texto (início) |
|---|---|---|
| audio1 | Começo da fase, 1 s depois de tocar em JOGAR | "Karimbolândia. Uma cidade em ruínas…" |
| audio2 | Ao avistar o primeiro soldado parado (logo no começo da rua) | "Um soldado da Legião. Parado…" |
| audio3 | Primeiro buraco com degraus de plataformas | "Karimbo olhou atentamente…" |
| audio4 | Primeira vez que o Karimbo leva dano | "Ai. Essa doeu até nas orelhas." |
| audio5 | Primeira vez que ele plana com as orelhas (depois de 10 s de jogo) | "E Karimbo tinha uma habilidade inusitada…" |
| audio6 | Moradores pedindo ajuda no checkpoint "Rua principal" | "Somente nesses momentos as mulheres…" |
| audio7 | Primeira ORELHADA (baixo + pulo no ar) | "A temida Orelhada!…" |
| audio8 | Primeira área secreta encontrada | "Uma área secreta!…" |
| audio9 | Primeira Orelha Dourada coletada | "Uma Orelha Dourada!…" |
| audio10 | Fim da primeira arena (EMBOSCADA → ÁREA LIMPA) | "Emboscada desfeita…" |
| audio11 | Moradores comemorando logo depois da emboscada | "A cidade comemorava…" |
| audio12 | Garagem: depois da apresentação do Nômad (após a voz do Karimbo), quando aparece "pule em cima" | "Na garagem, o Nômad…" |
| audio13 | Ao embarcar no Nômad pela primeira vez | "Karimbo no comando do Nômad…" |
| audio14 | Primeira leva das hordas do Nômad | "E lá vinham eles…" |
| audio15 | Primeiro avanço (dash) do Nômad | "O avanço do Nômad!…" |
| audio16 | Chegando no abismo que só passa com o avanço | "Um abismo. Pulando, não dá…" |
| audio17 | Início da ÁREA DE GUERRA (segunda arena) | "Área de guerra…" |
| audio18 | Nômad estacionado na passagem estreita | "A passagem era estreita demais…" |
| audio19 | Entrando no túnel de engatinhar | "Karimbo se arrastou pelo túnel…" |
| audio20 | Ao embarcar no Nômad de apoio (depois da voz do Karimbo no pouso) | "Um Nômad emprestado!…" |
| audio21 | Moradores na base da torre | "Os moradores apontavam para o alto…" |
| audio22 | Início da subida final (torre) | "Hora de subir…" |
| audio23 | Chegada ao telhado | "O telhado. O vento batia…" |
| audio24 | Aviso "ALERTA! Algo enorme se aproxima", poucos metros antes do Felipão | "Karimbo sente uma presença pesada…" |
| audio25 | Felipão entra na fase 2 (FÚRIA!) | "O Felipão ficou furioso!…" |
| audio26 | Felipão entra na fase 3 (ÚLTIMA CARTADA!) | "Última cartada!…" |
| audio27 | Primeira vez que aparece a tela CONTINUAR? | "Calma. Até os maiores heróis…" |
| audio28 | Vitória sobre o Felipão (FASE COMPLETA) | "E assim, o Felipão caiu…" |

## 4) Regras de aplicação (implementação)

- Canal próprio do narrador: uma fala por vez, numa fila. Nunca toca junto com as vozes dos personagens (Karimbo no Nômad, HQ, entrada do Felipão): espera elas terminarem.
- Se a fala esperar demais e perder o sentido (ex.: o jogador já passou do lugar), ela é descartada.
- A música abaixa um pouco enquanto o narrador fala.
- Cada fala toca só uma vez por partida (não repete ao morrer/voltar ao checkpoint).
- Opção para ligar/desligar o narrador nas configurações.
