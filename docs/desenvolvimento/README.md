# Guia de desenvolvimento e lições reutilizáveis

Este é o ponto de entrada técnico para quem mantém Karimbolandia ou usa seus arquivos como referência para outro jogo. A intenção é preservar o conhecimento sobre **como desenvolver corretamente**, além do histórico de bugs: reconhecer o risco antes de escrever código, saber por que existe uma decisão e ter uma forma de detectar sua regressão.

## Ordem de leitura

1. [Regras de desenvolvimento](REGRAS_DE_DESENVOLVIMENTO.md): contratos atuais, exemplos, limites e proteções existentes. Ler antes de alterar as áreas afetadas.
2. [Caso GPU e cadência](../desempenho/OTIMIZACAO_GPU_2026-10-05.md): mecanismo de cópia/mipmaps, suavização, HUD, resolução dinâmica e marcapasso; medições e critérios para os aparelhos reais.
3. [Adoção em outro jogo](ADOTAR_EM_OUTRO_JOGO.md): o que transportar, o que medir novamente e um bloco para os arquivos de instruções do novo projeto.
4. [Notas da v6](../v6/NOTAS_DA_VERSAO.md): panorama da entrega, incluindo controles e interiores.

O [estudo de interiores](../interiores/ESTUDO_DE_CASO_interiores_isometricos.md) também fornece referências de arquitetura/design. Ele é um documento histórico de planejamento; confira código e notas atuais antes de interpretar seu “estado atual” como implementação vigente.

O [caso de exploração e profundidade](EXPLORACAO_E_PROFUNDIDADE_2026-10-05.md) registra a ampliação para 33 interiores, troca de pavimentos, trilha 2.5D, balada com 65 dançarinos e checkpoints sem barreiras, incluindo regressões e limites da validação.

O [caso da água e balada](AGUA_E_BALADA_2026-10-05.md) explica a superfície animada na perspectiva das margens, saídas alinhadas à transição, localização do Pensador em Atlântida e recuperação do MP3 após carregamento tardio.

O [caso do lago vivo](LAGO_VIVO_E_MINIMAPA_2026-10-05.md) documenta por que peixes passam *por trás* das pedras em vez de colidir (profundidade em vez de rebote), o ecossistema com tetos e culling, o minimapa com save opcional e a revelação da Praça do Pensador.

O [caso dos minijogos](MINIJOGOS_PERSEGUICAO_E_BOXE_2026-10-05.md) explica o carregamento sob demanda (regra D09), a entrada/toque por modo, o equilíbrio por bots do boxe e da perseguição (51 / 64 / ≤ 92 s), o filminho da carta e a skin Jacaré gravada numa chave separada para não invalidar clientes antigos.

O [caso do Boxe 2.0](BOXE_2_0_2026-10-05.md) documenta a reconstrução da luta (3 rounds, defesa por cor, câmera por cima do ombro, gestos no celular, HUD guiado, revanche do Jacaré Campeão e enfeites por nota), o cache assado com variantes na chave, o orçamento de desenho (≤ 140 `drawImage`) e o que a medição não prova.

## Como este conhecimento é protegido

| Camada | Função |
|---|---|
| Este índice e o README da raiz | Tornar o conhecimento encontrável por pessoas e outros projetos. |
| Regras técnicas | Dizer como desenvolver, onde se aplicam e o que verificar ao mudar uma decisão. |
| Estudos de caso versionados | Preservar sintomas, mecanismo, alternativa escolhida, evidência e limites. |
| `AGENTS.md` e `CLAUDE.md` | Exigir que agentes consultem as regras antes de alterar áreas afetadas. |
| Testes de regressão | Detectar comportamentos específicos que já falharam; não medem toda a GPU do aparelho. |
| Experimentos antes/depois e teste físico | Verificar visual, cadência real e custos que testes de lógica não enxergam. |

Essas camadas se complementam. Um documento sozinho não garante que um problema nunca volte; instruções, revisão, testes e evidência aumentam a proteção. A regra global aqui significa **todo o repositório**. Outro projeto precisa adotar suas próprias instruções e testes; apenas abrir este diretório como referência não instala regras automaticamente nele.

## Como acrescentar uma nova lição

Ao resolver um problema difícil, acrescente um estudo técnico em `docs/` e um link aqui. Use esta estrutura no relato concluído:

- Sintoma percebido pelo jogador e condições de reprodução, incluindo build e aparelho.
- Hipóteses investigadas; separar o que foi demonstrado do que apenas pareceu plausível.
- Mecanismo responsável, com referências ao código e à evidência relevante.
- Forma correta de desenvolver: alternativa recomendada, pequeno exemplo ou implementação de referência.
- Escopo e exceções: engine, navegador, escala, asset ou contrato do qual a decisão depende.
- Proteção contra regressão: teste significativo, condição de revisão e procedimento de medição.
- Resultado antes/depois, comparação visual e limitações ainda existentes.

Atualize as regras quando a nova lição mudar um contrato. Registre tarefas/pendências no Beads, sem transformar os documentos em listas de trabalho. Mantenha no Git explicações, resultados resumidos e instruções para reproduzir; traces enormes e ferramentas locais podem ficar fora dele. Identifique explicitamente evidência local não incluída no repositório, para ninguém depender de um caminho inexistente numa nova máquina.
