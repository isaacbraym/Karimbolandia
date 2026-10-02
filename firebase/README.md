# Saves privados por conta

O jogo continua funcionando sem Firebase: checkpoints, recordes e backups portáteis são locais. O recurso de nuvem só aparece quando a configuração pública do projeto estiver disponível. Nenhum login ou envio de dados é simulado.

## Configurar uma vez

1. Crie um projeto Firebase na conta do dono do jogo. Use o plano Spark, sem cadastrar cobrança. Desative Google Analytics e recursos opcionais se não forem necessários.
2. Registre um aplicativo web. Copie a configuração pública fornecida pelo console.
3. Em Authentication, habilite Google. Cadastre o domínio `isaacbraym.github.io` e, para desenvolvimento, `localhost` em Authorized domains. Defina o e-mail de suporte solicitado pelo provedor.
4. Crie um banco Cloud Firestore Standard em modo de produção. Escolha a região antes de criar: ela não pode ser alterada diretamente depois. Para o público brasileiro, avalie `southamerica-east1`.
5. Publique exatamente as regras de `firestore.rules` no banco. Nunca habilite leitura/escrita pública nem use modo de teste para o jogo publicado.
6. Substitua `public/cloud-config.json` por:

```json
{
  "enabled": true,
  "apiKey": "CONFIGURACAO_PUBLICA_DO_APP_WEB",
  "authDomain": "SEU_PROJETO.firebaseapp.com",
  "projectId": "SEU_PROJETO",
  "appId": "ID_PUBLICO_DO_APP_WEB"
}
```

Também é possível definir `VITE_FIREBASE_CONFIG` como o mesmo JSON durante o build. A configuração web do Firebase é pública; **não coloque chaves de service account, senhas ou credenciais de administrador no frontend**.

## Comportamento

Cada conta possui um documento privado `saves/{uid}`. O e-mail serve só para exibir qual conta está conectada; não é usado como identidade ou caminho do documento. O objeto contém versão, revisão, payload do save, payload anterior e timestamp do servidor. Partidas, fichas, inventário, itens coletados, inimigos derrotados, recordes e fases concluídas estão no payload. Configurações de áudio, qualidade e toque permanecem no aparelho.

O SDK é carregado em um chunk separado. O jogo salva localmente a cada checkpoint, a cada 20 segundos de partida viva e ao pausar/sair. A rede recebe alterações agrupadas, sem bloquear o render. Transações verificam a revisão antes de escrever: uma partida divergente em outro aparelho exige escolher qual continuar, e os melhores recordes são combinados sem somar fichas ou duplicar inventário. Visitante e contas distintas possuem perfis locais separados.

Se a conexão falhar, o aparelho mantém seu save e a interface informa que o envio não foi confirmado. Voltar à aba, recuperar a internet ou tocar em SINCRONIZAR AGORA inicia nova conferência. SAIR DA CONTA mantém o save pendente dessa conta no aparelho.

O arquivo exportado não contém e-mail nem credenciais. Restaurar exige confirmação dentro do jogo e guarda o perfil anterior para desfazer em RECUPERAR SAVE ANTERIOR.

## Validar antes de anunciar o serviço ativo

- Login Google real no domínio publicado, sem solicitar senha do jogo.
- Conta A salva e recupera fichas, inventário e recordes em outro navegador/aparelho.
- Conta B não consegue ler nem escrever `saves/{uid da conta A}`; jogador sem login não lê saves.
- Saves divergentes não se sobrescrevem automaticamente.
- Offline → progresso local → reconexão → confirmação real de envio.
- Quotas e utilização do projeto acompanhadas no console. A disponibilidade depende da configuração, conexão e limites do serviço.

Os testes locais do sincronizador usam um transporte controlado: demonstram sua lógica de conflito e troca de conta, mas não substituem o teste de login e regras do projeto real.

Referências: [login Google](https://firebase.google.com/docs/auth/web/google-signin), [transações](https://firebase.google.com/docs/firestore/manage-data/transactions), [regras de acesso](https://firebase.google.com/docs/firestore/security/get-started).

## Diagnóstico de desempenho

Abra o jogo com `?perf=1` para exibir FPS médio, frametimes p95/p99, tempo de atualização/render e quadros acima de 33 ms. A coleta usa um buffer fixo de até 1.800 quadros e só atualiza o painel uma vez por segundo. Janelas sem foco, abas ocultas, menu e pausa não entram nas amostras. A coleta é opt-in e não equivale a benchmark por si só: compare o mesmo aparelho, viewport, cena e qualidade em ambas as versões, com o navegador em primeiro plano e depois do aquecimento.
