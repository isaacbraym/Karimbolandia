# Adotar estes aprendizados em outro jogo

Use Karimbolandia como referência técnica com decisões explicadas. Não basta copiar sprites, o loop ou uma linha de configuração: a qualidade visual depende também dos tamanhos de bake, escalas de destino, caches e ritmo de quadros.

## O que levar

1. Copie [REGRAS_DE_DESENVOLVIMENTO.md](REGRAS_DE_DESENVOLVIMENTO.md) e o [caso GPU](../desempenho/OTIMIZACAO_GPU_2026-10-05.md) para a documentação do novo projeto, preservando sua relação de origem. Corrija os links e identifique os parâmetros que são históricos do Karimbolandia.
2. Acrescente uma página de decisões do novo jogo: engine/backend, alvo de cadência, aparelhos de referência, resolução lógica, escala dos assets, política de cache e proteções existentes. Defina parâmetros a partir dos seus assets e testes, em vez de herdar 0,75/3×/60 por obrigação.
3. Para Canvas 2D semelhante, consulte as implementações de `Game.render`, `drawSprShrunk`, `FramePacer` e sua integração. Adapte dependências, pivôs, escalas, física e ciclo de vida. Para outra engine, transporte os princípios de preparo/reuso, medição e pacing, não APIs Canvas inexistentes.
4. Adapte os testes de comportamento que façam sentido e crie um cenário pequeno, representativo e repetível para a imagem/cadência. Depois confira no aparelho real escolhido.
5. Vincule a documentação ao README e aos arquivos de instruções que seus agentes realmente usam. Cada ferramenta tem seu próprio mecanismo de carregar instruções; copiar um documento não garante leitura automática.

Não copie os relatórios de benchmark como se fossem resultados do novo jogo. Traces e ferramentas em `tools/_work/opus-diag/` são artefatos locais deste diagnóstico e não vêm automaticamente num clone do Git; use o estudo versionado como referência e reproduza a medição com ferramentas disponíveis no novo ambiente.

## Bloco para as instruções dos agentes

Após copiar/adaptar o guia, este bloco pode ser acrescentado ao `AGENTS.md` e, se usado, ao `CLAUDE.md` na raiz do novo jogo. Preserve as instruções de trabalho já existentes. Ajuste o caminho se escolher outra organização.

```md
## Regras técnicas do jogo

Antes de alterar renderização, arte, HUD, loop, resolução, métricas ou controles,
leia docs/desenvolvimento/REGRAS_DE_DESENVOLVIMENTO.md e as decisões técnicas
deste projeto. Essas regras valem para todo o repositório.

- Preserve a qualidade visual. Investigue desperdício antes de propor cortar efeitos.
- Evite preparo, cópias e filtros caros repetidos no quadro; use variantes cacheadas
  adequadas à escala e ao ciclo de vida da imagem.
- Separe intervalo bruto de desenho do tempo protegido de simulação.
- Verifique jitter/taxas de tela, pausas longas e mudança de estado.
- Valide uma otimização com antes/depois comparável, imagem e picos de frametime.
  Testes unitários e viewport emulado não provam desempenho no aparelho físico.
- Não herde constantes do jogo de referência sem validar com os assets próprios.
- Ao resolver um problema difícil, documente causa, forma correta, limites,
  evidência e prevenção; ao revisar uma decisão, atualize proteção e documentação.
```

O bloco é uma base de instruções, não um instalador ou alteração automática das configurações globais da máquina. Ele precisa ser adotado por cada novo repositório. No Karimbolandia, os pontos de entrada já foram adicionados aos dois arquivos.

## Verificação inicial recomendada

Defina o cenário e os critérios de aceitação antes de medir. Por exemplo, escolha um trecho com o volume normal de sprites, transparências, texto e efeitos; use o build real com áudio/controles/configurações normais e delimite apenas gameplay. Registre o estado do cache e do aquecimento e alterne controle/intervenção para separar efeito de ordem.

Compare um quadro controlado para nitidez, texto e ícones, além da cena em movimento. Registre cadência de desenho, P95/P99, máximo e proporção de intervalos acima do orçamento escolhido. Se o custo síncrono não explicar os atrasos, investigue o processo gráfico. Em desktop com geometria de celular, chame o resultado de emulação de geometria, não de medição da GPU do celular.

O resultado esperado da adoção é ter uma forma de desenvolver e validar que reduza a chance de repetir erros. Nenhum conjunto de arquivos garante ausência de engasgos em toda combinação de navegador, driver, aparelho e conteúdo.
