# UNITEL Money na MASSA — preparação do sandbox

## Estado e âmbito

Esta entrega implementa o pagamento de **encomendas existentes** por UNITEL Money,
num projecto Supabase de testes separado. Usa `buyGoods_async` e
`queryTransactionStatus_sync` conforme o manual **UNITELMoney API PARTNERS V4.7**
recebido da UNITEL. O manual e as credenciais não fazem parte do repositório.

A integração está **desactivada por omissão**. Os testes automatizados simulam a
rede UNITEL e usam PGlite isolado; não demonstram uma transacção no sandbox da
UNITEL. Não foi feita qualquer chamada à API da operadora ou migração remota nesta
entrega. A configuração completa e a confirmação explícita de um ambiente sem
fundos reais são necessárias antes do primeiro teste externo.

O âmbito inicial não inclui carregamentos MASSA, B2C, vouchers, pagamentos a
vendedores terceiros em produção, reembolsos ou reversões. A existência destes
métodos no manual não confirma a autorização comercial da AFROFINTEK para cada
modalidade. O piloto restringe pagadores, beneficiários e números de teste.

## Fluxo implementado

1. O browser obtém as capacidades com sessão autenticada. Só contas autorizadas
   recebem o método `UNITEL_MONEY` e os números de teste configurados.
2. Antes da cobrança, o browser guarda o identificador idempotente por utilizador
   e encomenda. Envia apenas `requestId`, `orderId` e o telefone seleccionado.
3. O RPC `massa_unitel_prepare` lê o valor e o vendedor da encomenda, verifica a
   validade e elegibilidade e persiste uma referência original antes da rede.
4. Só a primeira preparação autoriza o envio de `buyGoods_async`. Uma repetição
   devolve a tentativa existente. Timeouts não originam outra cobrança.
5. A aceitação do pedido mantém a operação pendente. Um callback apenas sugere
   uma consulta; não decide o resultado financeiro nem associa os seus IDs.
6. A consulta autenticada usa sempre a referência original persistida no campo
   `QueryTransactionStatusRequest.OriginalConversationID`. A recuperação funciona
   mesmo sem callback ou `ConversationID` da resposta inicial.
7. Apenas `ResultType=0`, `ResultCode=0`, `TransactionStatus=Completed` e um recibo
   válido permitem chamar a confirmação financeira. O RPC volta a verificar a
   encomenda e a identidade e escreve um diário com duas entradas balanceadas.

O manual não inclui valor ou moeda na resposta de consulta (pp. 43–47). Por isso,
não é feita uma comparação inventada desses campos: a consulta fica associada à
referência original da cobrança, cujo valor foi fixado no servidor. Qualquer eco
incoerente, estado desconhecido ou resultado sem recibo exige revisão. Um recibo
de resposta incoerente fica apenas no registo de observações; não passa a ser o
identificador canónico da tentativa.

Os estados são `submitting`, `pending`, `uncertain`, `confirmed`, `failed`,
`expired` e `review`. O adaptador inicial não interpreta automaticamente códigos
ambíguos como falha definitiva ou expiração. Falhas antes do envio financeiro,
como erro de autenticação, podem ficar em `failed`; uma resposta perdida fica em
`uncertain`. Todas as tentativas `review` bloqueiam novas cobranças até resolução.
Um sucesso recebido depois de a encomenda expirar ou de outra tentativa assumir
a encomenda mantém a evidência e fica em revisão, sem crédito automático.

## Coexistência com MASSA e AppyPay

O lock de transacção já usado pelo ledger (`7218961`) é partilhado pelas operações
locais e pelos dois prestadores. As guardas impedem que a mesma encomenda tenha
novas cobranças em vias diferentes enquanto existir uma tentativa activa ou em
revisão. A interface acompanha essas guardas, mas a base de dados é a autoridade.

`payment_point_orders.payment_provider` passa a admitir `unitel`. O comprovativo
identifica o prestador, e um pagamento externo não pode ser reembolsado através
da operação local de saldo. Sucessos tardios AppyPay/UNITEL são registados para
revisão nos dois sentidos. Não existe transferência automática entre prestadores.

## Funções e persistência

| Componente | Responsabilidade |
| --- | --- |
| `massa-unitel` | Acções autenticadas `capabilities`, `create` e `status` |
| `massa-unitel-webhook` | Recepção e confirmação de entrega do callback |
| `massa-unitel-reconcile` | Consultas de recuperação protegidas por segredo próprio |
| Esquema privado `massa_unitel` | Tentativas, observações imutáveis e inbox durável |
| RPCs `massa_unitel_*` | Única via permitida de acesso ao esquema, apenas `service_role` |

Os RPCs usam `SECURITY DEFINER` com `search_path` vazio. As tabelas têm RLS e não
são acessíveis directamente por `anon`, `authenticated` ou `service_role`.
O valor, beneficiário e referência não são aceites do browser. As respostas
públicas omitem telefones, operador, comerciante, credenciais e corpos brutos.
A consulta do vendedor também redige o telefone na fronteira SQL.

## Configuração necessária, exclusivamente no servidor

Não copiar segredos para variáveis `VITE_*`, código, tickets, logs ou o browser.
Obter os valores de provisionamento da UNITEL pelo canal seguro acordado.

| Variável | Requisito |
| --- | --- |
| `MASSA_UNITEL_ENABLED` | Exactamente `sandbox`; omitir para manter desactivado |
| `MASSA_UNITEL_SANDBOX_CONFIRMED` | `true` só depois de confirmar com a UNITEL que não há fundos reais |
| `MASSA_UNITEL_SANDBOX_PROJECT_REF` | Referência do projecto Supabase isolado; produção é rejeitada |
| `SUPABASE_URL` | Origem exacta do projecto acima |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave do mesmo projecto, apenas no servidor |
| `MASSA_UNITEL_ALLOWED_HOSTS` | Hosts UNITEL explicitamente autorizados, separados por vírgulas |
| `MASSA_UNITEL_API_BASE_URL` | Base HTTPS do sandbox provisionado, sem valor por omissão |
| `MASSA_UNITEL_TOKEN_URL` | Endpoint OAuth HTTPS provisionado, sem valor por omissão |
| `MASSA_UNITEL_CLIENT_ID` | Consumer key da subscrição de testes |
| `MASSA_UNITEL_CLIENT_SECRET` | Consumer secret da subscrição de testes |
| `MASSA_UNITEL_OPERATOR` | Identificador do operador fornecido pela UNITEL |
| `MASSA_UNITEL_SECURITY_CREDENTIAL` | Credencial do operador cifrada pelo método/certificado correcto |
| `MASSA_UNITEL_MERCHANT_ID` | ShortCode do comerciante autorizado para o piloto |
| `MASSA_UNITEL_POS_DEVICE_ID` | POSDeviceID autorizado |
| `MASSA_UNITEL_CALLBACK_URL` | `SUPABASE_URL` + `/functions/v1/massa-unitel-webhook`, sem query string |
| `MASSA_UNITEL_ALLOWED_USERS` | UUIDs das contas pagadoras/observadoras do piloto |
| `MASSA_UNITEL_ALLOWED_BENEFICIARIES` | UUIDs dos beneficiários autorizados para estas encomendas |
| `MASSA_UNITEL_ALLOWED_PHONES` | Números de teste fornecidos pela UNITEL, nove dígitos começando por 9 |
| `MASSA_UNITEL_ALLOWED_ORIGINS` | Origens HTTPS exactas da interface de testes |
| `MASSA_UNITEL_RECONCILE_TOKEN` | Segredo aleatório dedicado, pelo menos 32 caracteres |
| `MASSA_UNITEL_WEBHOOK_TOKEN` | Opcional, apenas se a UNITEL suportar o header `x-massa-unitel-token` |

A allowlist de hosts aceita subdomínios de `unitel.co.ao`. Se a UNITEL fornecer um
domínio de testes diferente, é necessário verificar esse domínio e adaptar a
validação antes de activar. Endpoints locais, IPs literais, HTTP, credenciais na
URL e redirects são rejeitados. O exemplo OAuth `localhost:9443` do manual não é
um endpoint utilizável. O URL de API documentado também não é assumido como
sandbox sem confirmação do fornecedor.

## Callbacks e reconciliação

O callback recebe o ACK previsto no manual (p. 18), incluindo as duas referências,
mensagem e timestamp. Um callback com referência desconhecida é descartado sem
provocar uma consulta. As entregas conhecidas são guardadas antes do ACK e
eliminadas por hash quando repetidas. Só a primeira entrega inicia processamento
imediato; duplicados pendentes ficam para o worker, evitando amplificação de
consultas. A inbox limita novos eventos por tentativa a 10/minuto e 100 no total.

O header opcional não substitui a consulta autenticada. Enquanto a UNITEL não
confirmar assinatura ou autenticação de callback, a sua carga permanece um
indício não fiável. Nenhum resultado recebido pelo callback credita saldo.

Após configurar e publicar as funções no **projecto isolado**, configurar um
agendador de servidor para invocar `massa-unitel-reconcile` por POST, corpo `{}`
e header `x-massa-reconcile-token`. A credencial do agendador deve ficar num gestor
de segredos. O worker consulta até 10 eventos e 10 tentativas, respeita um orçamento
de 45 segundos entre operações e usa leases de 120 segundos. Não reenviar cobranças
para recuperar falhas. Uma invocação com `{ "attemptId": "UUID" }` consulta uma
tentativa específica pela referência que já está guardada.

Esta entrega não configura um agendador remoto nem aplica migrações. Registos em
`review` precisam de comparação com o portal/apoio UNITEL antes de qualquer acção
de reembolso, resolução ou desbloqueio. Não há endpoint de browser para forçar
uma confirmação ou eliminar essa evidência.

## Verificação local e limites da evidência

```sh
node --test --test-concurrency=1 tests/payment-point/ledger.test.mjs tests/massa-appypay/*.test.mjs tests/massa-unitel/*.test.mjs
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=unit-test-key npm test -- src/features/payment-point
npx tsc --noEmit -p tsconfig.app.json
npm exec tsc -- --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --allowImportingTsExtensions --skipLibCheck supabase/functions/_shared/massa-unitel.ts supabase/functions/_shared/massa-unitel-service.ts supabase/functions/massa-unitel/handler.ts
npm run build
```

O workflow `MASSA UNITEL Money sandbox boundary` executa estes controlos sem
credenciais do fornecedor. A integração testa handlers, adaptador e RPCs reais
contra uma rede simulada; o harness verifica os hashes das migrações originais.
PGlite não substitui a validação de concorrência com várias sessões PostgreSQL,
as regras de rede do ambiente remoto nem a certificação/homologação da UNITEL.

## Pendências para o primeiro teste com a UNITEL

- Receber sandbox, subscrições, credenciais, operador, comerciante, certificado e
  telefones de teste; confirmar o formato de SecurityCredential e os cenários USSD.
- Confirmar autenticação, repetição e tempos de callback; semântica de duplicação
  de OriginatorConversationID e de consulta não encontrada; estados finais.
- Esclarecer reembolso versus reversão, as diferenças dos exemplos B2C e a
  autorização comercial para cada modalidade pretendida.
- Preparar o projecto isolado com as migrações, contas elegíveis, funções e worker;
  configurar os valores aprovados e testar aprovação, recusa, timeout, duplicados,
  perda da resposta, expiração da encomenda e reconciliação sem callback.
- Comparar o recibo, valor e estado com o portal/extracto UNITEL antes de considerar
  o fluxo validado. A passagem a produção será uma entrega própria.
