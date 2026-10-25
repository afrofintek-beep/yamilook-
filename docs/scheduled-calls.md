# Agendamento KOSOLOLA / Yamilook

## Contrato

O RPC `scheduled_call_action` valida a sessão e o organizador/convidado em cada operação. A lógica privilegiada fica no esquema privado, com `search_path` fixo. O cliente não pode escrever diretamente nas tabelas de agendamento.

Criar grava chamada, convites e avisos numa transação. `request_id` impede duplicados numa repetição do pedido; uma impressão digital impede aceitar outros dados com a mesma chave. Editar exige a revisão apresentada ao utilizador.

Só contactos existentes e não bloqueados podem ser convidados: máximo 31 convidados e 200 ocorrências futuras por organizador. Uma ligação partilhada não concede acesso a terceiros.

Repetições são materializadas de uma vez (até 52), com fuso IANA. A hora local e o dia original ancoram a série; 31 de janeiro → último dia de fevereiro → 31 de março. Horas inexistentes durante mudanças de horário são rejeitadas. A hora ambígua usa a resolução do PostgreSQL nas ocorrências futuras.

A edição altera apenas uma ocorrência e solicita nova resposta aos convidados. O cancelamento permite esta ocorrência ou esta e as seguintes. Chamadas iniciadas são encerradas, não editadas.

A sala tem rota própria `/scheduled-call/:sessionId` (com `/papos-app` na PWA). A identidade do agendamento nunca é usada como um registo da tabela `calls`.

O organizador abre a sala até 15 minutos antes do início. Uma sala de espera exige admissão antes da emissão de credenciais de media. Convidados que recusaram precisam de aceitar novamente antes do início.

Áudio/vídeo e chat da chamada usam LiveKit. O chat é temporário, limitado à ligação atual, e não substitui o histórico de conversas. Câmara/microfone começam desligados e recusar permissões mantém o modo de escuta.

Encerrar bloqueia novas entradas na base de dados e pede `DeleteRoom` ao LiveKit. Falhas no fecho remoto são mostradas e permitem repetir. Tokens de entrada duram no máximo 60 segundos; não há promessa de revogação instantânea de um token já emitido. A interface verifica o estado a cada 5 segundos e sai quando a chamada termina.

Os agendamentos concluídos permanecem guardados, mas não aparecem na lista de próximos. Não são adicionados ao histórico antigo de chamadas diretas.

## Avisos e lembretes

`scheduled_call_events` guarda convites, alterações, cancelamentos e um lembrete por destinatário/revisão. O cron `kosolola-call-reminders` corre a cada minuto, gera lembretes nos 15 minutos anteriores e conclui ocorrências expiradas. A interface autenticada consulta avisos a cada 30 segundos e ao recuperar foco. Marcar como lido persiste no servidor.

São avisos **dentro da aplicação**. Não estão implementados SMS, email nem entrega push garantida com a aplicação fechada. Não se deve apresentar `reminder_sent` da estrutura antiga como prova de entrega: este fluxo usa eventos idempotentes.

## Publicação e compatibilidade

1. Aplicar `20261025022806_scheduled_call_workflow.sql` ao projeto Yamilook.
2. Publicar a Edge Function `scheduled-call-video`, que autentica o bearer via `getUser` (JWT gateway desativado no config porque a função faz a autenticação).
3. Confirmar que `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` e `LIVEKIT_URL` estão configurados; nunca colocar estes segredos no cliente.
4. Integrar/publicar a interface desta PR. Coordenar os passos: o formulário antigo escreve diretamente nas tabelas e deixa de poder guardar após a migração. As chamadas diretas existentes não são alteradas.
5. Verificar dois utilizadores autorizados: criar, convite/RSVP, entrada do anfitrião, espera/admissão, áudio em ambos os sentidos, vídeo, chat, sair/reentrar e encerrar para todos. Repetir na PWA e em Safari móvel.

Rollback da interface exige restaurar os privilégios antigos de escrita nas duas tabelas para o formulário legado; não apagar agendamentos, eventos ou dados de utilizadores. Preferir corrigir em frente. A função de media nova pode ser desativada sem interferir nas funções LiveKit da Academia/Mokubico.

## Verificação realizada

- Suíte Vitest: 430 testes passaram, incluindo 23 novos testes de serviço/formulário/media (media simulada).
- PostgreSQL isolado via PGlite: 36 verificações sobre a migração real, incluindo atomicidade, controlo de acesso, revisão concorrente, repetição mensal/DST, lembretes idempotentes e confirmação de leitura. O cron é simulado no teste; nenhuma conta/contacto real é utilizado.
- WebKit em emulação móvel: 4 testes passaram (320, 390 e 430 px; fechar, rolar, guardar com sucesso/falha). Serviço de gravação simulado.
- Compilação de produção passou. A verificação TypeScript global contém erros anteriores fora destes ficheiros; não é apresentada como limpa.
- Não foi realizada chamada real entre dois dispositivos ou teste de entrega push.

Comandos:

```sh
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test npx vitest run
npm run build
npx playwright test -c playwright.scheduled.config.ts
# Instalar @electric-sql/pglite@0.3.14 num diretório temporário, depois:
PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-scheduled-calls.mjs
```
