# MASSA · integração AppyPay em sandbox

Este módulo liga a carteira MASSA ao ambiente de testes da AppyPay para cobranças GPO (Multicaixa Express) e REF (referência). O ambiente de testes do fornecedor mantém transacções e notificações próprias, mas não movimenta fundos reais. A demonstração local UNITEL Money da PR #247 não é utilizada como confirmação de pagamento.

## Âmbito e condições de activação

- Utilizar apenas uma instalação de testes com autenticação, base de dados e segredos próprios.
- Manter as chaves, tokens, identificadores comerciais e credenciais de serviço exclusivamente no servidor. Nenhum segredo AppyPay pode usar o prefixo `VITE_`, aparecer num URL, resposta ao browser ou log.
- GPO e REF requerem aplicações/chaves activas no comerciante de sandbox. As credenciais de Julho passaram nos ensaios directos do gateway em 24 de Novembro de 2026.
- UNITEL Money e SWEG ficam fora deste adaptador até haver confirmação dos contratos técnicos e comerciais descritos abaixo.
- O crédito de sandbox não representa saldo monetário disponível para levantamento. A activação de produção requer uma integração e aprovação próprias.

## Configuração do servidor

As novas funções utilizam variáveis próprias. Não reutilizam automaticamente `APPYPAY_API_KEY`, `APPYPAY_API_SECRET` ou outras credenciais dos módulos antigos de anúncios/KUMBU/Pro.

| Variável | Valor ou condição |
| --- | --- |
| `MASSA_APPYPAY_ENABLED` | Exactamente `sandbox`. Ausente ou diferente mantém a funcionalidade desligada. |
| `MASSA_APPYPAY_SANDBOX_PROJECT_REF` | Referência do projecto Supabase isolado de testes. O projecto de produção conhecido da Yamilook é recusado. |
| `SUPABASE_URL` | Origem HTTPS exacta do projecto de testes, sem credenciais, caminho extra, query ou fragmento. |
| `SUPABASE_SERVICE_ROLE_KEY` | Segredo do projecto de testes, exclusivamente no servidor, para os RPCs reservados. |
| `MASSA_APPYPAY_CLIENT_ID` | UUID OAuth do comerciante de sandbox. |
| `MASSA_APPYPAY_CLIENT_SECRET` | Segredo OAuth do mesmo comerciante/ambiente; não é apresentado no browser. |
| `MASSA_APPYPAY_RESOURCE` | Resource de sandbox publicado pela AppyPay e fixado em `SANDBOX_RESOURCE`. O resource de produção é recusado. |
| `MASSA_APPYPAY_MERCHANT_ID` | Etiqueta interna estável da conta comerciante, usada para separar tentativas e reconciliação. Não é enviada como parâmetro da API nem permite escolher o beneficiário no browser. |
| `MASSA_APPYPAY_GPO_KEY` | Identificador completo `GPO_<uuid>` da aplicação de testes. |
| `MASSA_APPYPAY_REF_KEY` | Identificador completo `REF_<uuid>` da aplicação de testes. |
| `MASSA_APPYPAY_ALLOWED_USERS` | UUIDs dos utilizadores de ensaio, separados por vírgulas. Lista obrigatória e sem wildcard. |
| `MASSA_APPYPAY_ALLOWED_ORIGINS` | Origens HTTPS exactas do frontend de testes, separadas por vírgulas. Definir explicitamente para o piloto. |
| `MASSA_APPYPAY_RECONCILE_TOKEN` | Segredo de no mínimo 32 caracteres para autorizar o worker de reconciliação. |
| `MASSA_APPYPAY_WEBHOOK_MODE` | `verify-by-query` por omissão; opcionalmente `shared-token` quando o fornecedor suportar o mecanismo de envio configurado. |
| `MASSA_APPYPAY_WEBHOOK_TOKEN` | Segredo de no mínimo 32 caracteres, obrigatório apenas em `shared-token`. Não colocar na query do URL. |

O token endpoint e o gateway estão fixados em constantes de sandbox. Não existe opção para mudar este adaptador para os hosts de produção. Redireccionamentos HTTP são recusados. As credenciais continuam a exigir confirmação de validade e pertença ao comerciante, mesmo com os hosts correctos.

Num projecto Supabase gerido, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injectadas pela plataforma. Não criar nem substituir variáveis do prefixo reservado `SUPABASE_` no gestor de secrets; configurar ali apenas as variáveis personalizadas `MASSA_APPYPAY_*`.

No frontend de testes, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` apontam para esse mesmo projecto isolado. Estes são os parâmetros públicos normais do Supabase; nenhuma variável `MASSA_APPYPAY_*` é colocada no build do browser. O painel só aparece quando a resposta autenticada de capacidades habilita os métodos de sandbox.

### Endpoints da aplicação

Os três endpoints aceitam `POST` com JSON e recusam os restantes métodos, excepto o preflight `OPTIONS` da interface do utilizador. As respostas não permitem cache.

| Função | Autorização | Operações |
| --- | --- | --- |
| `massa-appypay` | Sessão Supabase validada no servidor, utilizador de ensaio permitido e regras de acesso da carteira. | `capabilities`, `create`, `status`. |
| `massa-appypay-webhook` | No modo `shared-token`, header `x-yamilook-token`; em `verify-by-query`, o callback é apenas um aviso não autenticado. Em ambos, nenhuma confirmação ocorre sem GET autenticado. | Receber e persistir notificações correlacionadas antes do ACK; consultar e reconciliar. |
| `massa-appypay-reconcile` | Header `x-massa-reconcile-token` com segredo reservado ao servidor. | Recuperar eventos pendentes, consultar tentativas de forma limitada ou verificar uma charge identificada pelo operador. |

O callback a configurar no portal é `https://<projecto-de-testes>.supabase.co/functions/v1/massa-appypay-webhook`. A AppyPay tem de confirmar se suporta o envio do header escolhido antes de se seleccionar `shared-token`; esse header é uma convenção desta integração, não uma assinatura nativa comprovada do fornecedor.

O agendador envia `{}` à função de reconciliação. Para recuperação manual autorizada de uma resposta perdida, o operador pode fornecer `{ "attemptId": "<uuid-interno>", "chargeId": "<uuid-confirmado-no-portal-sandbox>" }`. Esta operação consulta e valida a charge; não cria uma nova cobrança. Não colocar tokens no corpo ou no URL.

Cada execução automática reserva até dez eventos e dez tentativas, com leases de 120 segundos. O serviço deixa de iniciar novas consultas após 45 segundos, permitindo terminar apenas a consulta já em curso. Itens reservados e ainda não consultados voltam a ficar disponíveis depois do lease. Falhas de processamento mantêm o evento pendente para nova tentativa; callbacks com identidade incompatível são encerrados como rejeitados, conservando o motivo.

### Activação e suspensão do piloto

1. Preparar o projecto Supabase de testes com a estrutura existente da MASSA e a migration `20261122120553_massa_appypay_sandbox.sql`. Não aplicar a migration em produção neste passo.
2. Criar os utilizadores de ensaio, perfis Angola e permissões de carteira necessários; configurar a lista restrita de UUIDs e os segredos apenas nesse projecto.
3. Disponibilizar o frontend de ensaio apontado ao projecto isolado e as funções `massa-appypay`, `massa-appypay-webhook` e `massa-appypay-reconcile`.
4. Configurar no portal AppyPay **sandbox** os callbacks das aplicações GPO e REF para a função de webhook desse projecto. Confirmar o modo de autenticação de callback com o fornecedor.
5. Executar os cenários de sandbox autorizados, com as credenciais do comerciante e os dados fictícios documentados. A aprovação de código ou os testes locais não iniciam cobranças.
6. Activar a reconciliação por um agendador de servidor com o token reservado. A migration não cria um cron nem inicia chamadas automaticamente.

Para suspender novas utilizações, remover `MASSA_APPYPAY_ENABLED=sandbox` torna os endpoints indisponíveis. Antes de desactivar toda a recepção/reconciliação, guardar os identificadores das tentativas pendentes e resolver os resultados incertos; desligar a interface não cancela cobranças já criadas no fornecedor. Uma limpeza de dados não é mecanismo de rollback de pagamentos.

## Contrato com o fornecedor

### Autenticação

O servidor obtém o token por `POST https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token`, com `Content-Type: application/x-www-form-urlencoded` e `grant_type=client_credentials`, `client_id`, `client_secret` e `resource`. Deve respeitar a validade devolvida em `expires_in`, renovar com margem e nunca devolver o token ao cliente.

O email de 16 de Julho inclui um exemplo `GET` para o token; a documentação actual de suporte especifica `POST`. Esta implementação segue a documentação actual. A configuração e os testes autorizados devem confirmar o contrato aceite no sandbox, sem alterar automaticamente o método de autenticação perante um erro.

### Criação e identificação

A operação externa é criada em `POST https://gwy-api-tst.appypay.co.ao/v2.0/charges`. O servidor controla o comerciante, o método, o valor, a moeda `AOA` e a ligação ao utilizador. A identificação compreende:

1. Identificador interno da operação MASSA, independente do fornecedor.
2. Chave de idempotência do pedido do utilizador, estável em tentativas repetidas.
3. `merchantTransactionId` persistido antes da chamada externa, com no máximo 15 caracteres alfanuméricos.
4. `id` da charge AppyPay, guardado após uma resposta válida ou recuperado através de uma consulta autenticada e da correlação completa.

Não se deve usar um UUID completo no campo de 15 caracteres nem gerar uma nova referência para resolver um timeout. A AppyPay documenta HTTP 409 para referências duplicadas, mas não uma garantia de repetição idempotente da criação nem um header `Idempotency-Key`.

GPO utiliza `paymentInfo.phoneNumber`. A documentação actual lista números de testes com nove dígitos (`900000000` a `900000003`); o email inicial apresenta o prefixo `244`. A implementação aceita exclusivamente os quatro números de nove dígitos. Se o sandbox provisionado exigir o prefixo, a alteração deve ser validada de forma coerente no frontend, adaptador e base de dados. Números reais são recusados.

Para a aplicação REF provisionada, o sandbox confirmou a criação com referência automática, sem `paymentInfo`, em 24 de Novembro de 2026. A API devolveu HTTP 202 e código 101 com o número da referência e a entidade. A documentação pública descreve também o formato em que o comerciante fornece a referência. Se o gateway rejeitar um pedido, não há repetição automática com outro formato. A entidade e o número mostrados ao utilizador devem resultar de uma resposta validada da cobrança. Datas sem fuso explícito não são usadas para inferir expiração.

### Aceitação não é liquidação

A documentação de criação apresenta um exemplo com HTTP 200, `successful: true`, `status: "Success"` e código `101`, cuja mensagem indica apenas aceitação para processamento. O exemplo de pagamento confirmado apresenta código `100`.

Por isso, o estado da interface, HTTP 200, `successful` ou a palavra `Success` isoladamente não permitem creditar uma carteira. A confirmação depende de uma consulta autenticada ao gateway e da correspondência da charge, `merchantTransactionId`, comerciante/ambiente, canal, valor e moeda com o registo interno. A consulta de detalhe devolve o objecto `payment` com o estado e `transactionEvents` com o código do fornecedor. O adaptador exige que o estado `Success` coincida com o código 100 de um evento da mesma cobrança e do mesmo método. Campos contraditórios ou incompletos mantêm a operação por resolver.

### Webhooks e reconciliação

O webhook é um aviso para consultar o gateway. Não é autoridade para creditar saldo. A documentação pública consultada recomenda `GET /charges/{id}` e não especifica uma assinatura HMAC, header, timestamp ou segredo de assinatura que se possa pressupor implementado.

Eventos desconhecidos, repetidos ou falsificados não podem criar operações, alterar beneficiários ou fornecer um valor de crédito. O servidor só confirma uma cobrança correlacionada com uma operação interna previamente autorizada. A reconciliação utiliza a mesma validação, incluindo quando o webhook não chega ou a aplicação fica suspensa.

O worker também consulta a caixa de eventos ainda não processados. Isto é necessário quando a criação perdeu a resposta e o primeiro GET do callback falhou: o identificador da charge permanece no evento, sem ser vinculado definitivamente à carteira, até que uma consulta válida confirme a sua identidade. A duplicação de um evento por resolver permite nova consulta; a duplicação de um evento concluído não gera outro crédito. Identificadores desconhecidos/conflitantes são ignorados e a admissão de eventos conhecidos é limitada por tentativa.

Timeout de rede significa resultado desconhecido, não falha financeira. Uma tentativa incerta deve ser consultada antes de qualquer nova criação. Uma expiração visual ou um temporizador do telemóvel não prova expiração no gateway. Confirmações tardias devem ser tratadas de forma coerente e auditável, sem duplicar o crédito.

## Plano de validação

Os testes locais utilizam transportes simulados e uma base de dados isolada. Não contactam a AppyPay, não iniciam pagamentos e não demonstram aceitação real pelo fornecedor.

```sh
node --test --test-concurrency=1 tests/payment-point/ledger.test.mjs tests/massa-appypay/*.test.mjs
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=unit-test-key npm test -- src/features/payment-point
npm run build
```

Os testes do adaptador validam o contrato HTTP e monetário; os testes de handlers simulam callbacks hostis e falhas de transporte; os testes de integração ligam os handlers aos RPCs reais numa base PGlite, mantendo o gateway simulado. Esta última camada verifica também os nomes e argumentos dos RPCs usados em execução.

O workflow `MASSA AppyPay sandbox boundary` executa estas verificações com Node 24 nas pull requests que afectam a integração. Utiliza apenas permissão de leitura do repositório, sem segredos de pagamentos e sem passos de deploy. A passagem do CI não substitui os testes autorizados no sandbox do fornecedor.

### Verificação local em 22 de Novembro de 2026

- 72 testes Node passaram: 58 do novo adaptador/handlers/SQL/integração, oito da cadeia real da carteira no ensaio isolado e seis de regressão do ledger existente.
- 20 testes Vitest passaram na funcionalidade da carteira.
- TypeScript da aplicação e dos módulos independentes do backend, ESLint dos ficheiros afectados e `git diff --check` passaram.
- A aplicação compilou com sucesso. Mantêm-se os avisos existentes do build sobre imports mistos de traduções e tamanho de bundles.
- A verificação integral de tipos com Deno local ficou bloqueada pela impossibilidade de obter a dependência externa pela rede deste ambiente. Os módulos de negócio foram verificados separadamente com TypeScript e executados pelos testes Node. A compilação e execução das três funções foram posteriormente verificadas no runtime Supabase isolado, com a integração desligada.
- PGlite executa os RPCs e transacções reais, mas é uma engine de sessão única. A verificação multissessão foi feita adicionalmente no PostgreSQL do projecto isolado: duas preparações sobrepostas produziram uma única tentativa; duas confirmações que começaram com estado pendente produziram um journal, duas entradas equilibradas e um único crédito. Os PIDs, intervalos e resultados estão em [concurrency-evidence.json](../tests/massa-appypay/fixtures/concurrency-evidence.json).
- Nenhum destes testes executou OAuth, cobranças, mocks ou callbacks na AppyPay real. Os ensaios directos de 24 de Novembro confirmaram OAuth, GPO, REF e a consulta das cobranças no gateway de sandbox. A validação ponta a ponta pelo frontend de ensaio e a entrega de callbacks à função Supabase continuam pendentes.

O [workflow específico da integração](https://github.com/afrofintek-beep/yamilook-/actions/runs/45022597104) passou no commit `ccb8fc789e52af00aac0c9ea3fa89c3cacd50338`. O check global [Mobile controls](https://github.com/afrofintek-beep/yamilook-/actions/runs/45022597042) tem uma falha na partilha do cartão AFROLOC: o fixture não fornece um handle LOCACCESS válido. O [run do commit base exacto](https://github.com/afrofintek-beep/yamilook-/actions/runs/44997929481) apresenta a mesma falha; os ficheiros envolvidos não foram alterados por esta integração.

### Ambiente isolado preparado

Branch Supabase: `massa-appypay-sandbox-20261122`, referência `kvnbqqektpkeouyepyor`. As funções `massa-appypay`, `massa-appypay-webhook` e `massa-appypay-reconcile` foram publicadas nesse destino e mantidas desligadas. A consulta HTTP de capacidades devolveu `enabled: false`, `environment: sandbox`, `methods: []`; webhook e reconciliação devolveram `integration_disabled`. Nenhuma credencial AppyPay foi configurada ou utilizada.

O bootstrap automático da branch falhou antes da cadeia MASSA: a migration `20261022133534_single_use_invitations.sql` referencia `public.profiles`, ausente no histórico remoto. Esta limitação já está registada em [migration-history/README.md](./migration-history/README.md). Uma branch criada a partir desse histórico não equivale a uma cópia funcional da Yamilook. A reconstrução completa exige um baseline de schema revisto, com grants, políticas, triggers e funções, sem copiar dados de utilizadores ou segredos.

Para verificar o backend financeiro, foi instalado nesse destino um [pacote limitado de ensaio MASSA](../tests/massa-appypay/fixtures/README.md): dependências com proveniência verificada e as dez migrations reais da carteira, preservando papéis, acesso ao piloto e autorização dos débitos. O lote de assertions PostgreSQL terminou em rollback. A prova separada de concorrência usou apenas contas e identificadores sintéticos, sem contactar o fornecedor. O verificador Edge temporário foi substituído por uma resposta inerte após o ensaio. A limpeza SQL foi concluída e verificada: helper, contexto, administrador e acessos temporários removidos; duas identidades fictícias sem credenciais preservadas para a integridade do ledger. Este pacote não comprova signup, chat, aplicação completa ou equivalência à base de produção; a branch de ensaio não deve ser fundida no projecto de produção.

O conector disponível permite publicar funções e executar SQL, mas não disponibiliza a escrita de secrets; a CLI não tem sessão de gestão autenticada. A configuração das variáveis personalizadas necessita de uma sessão autorizada no [Dashboard do ambiente de teste](https://supabase.com/dashboard/project/kvnbqqektpkeouyepyor/functions/secrets) ou acesso Management API limitado à escrita de secrets desse projecto. As credenciais de Julho já constam da correspondência e não devem ser reproduzidas no chat, nos logs ou no repositório.

Casos necessários antes da activação do piloto:

- Pedido aceite com código `101` permanece sem crédito; código `100` contraditório também não confirma.
- Valor monetário é exacto em unidades mínimas e a moeda é `AOA`; valores fraccionários inválidos, `NaN`, overflow e IDs incompatíveis são recusados.
- Qualquer URL de produção, host imprevisto ou redireccionamento é recusado antes de expor credenciais.
- Token reutilizado dentro da validade e renovado antecipadamente; falhas de autenticação não são apresentadas com segredos.
- Timeout, resposta inválida ou HTTP 409 na criação preservam a incerteza e não causam outra criação automática.
- Webhook falsificado, duplicado ou fora de ordem não gera crédito sem consulta autenticada e correlação completa.
- Dois processos concorrentes, reenvio do formulário ou reconciliação repetida produzem, no máximo, um crédito e um lançamento contabilístico por cobrança confirmada.
- Utilizadores distintos não conseguem consultar nem confirmar cobranças uns dos outros.
- Estados da interface sobrevivem a recarga/regresso do telemóvel; a aplicação consulta o servidor para recuperar o estado.

No ensaio de sandbox autorizado, validar GPO com os quatro cenários publicados (sucesso, saldo insuficiente, timeout, rejeição) e REF com criação, espera, pagamento simulado, expiração, notificações duplicadas e perda da resposta. O mock REF `POST /v2.0/mocks/referenceProcessing` altera o estado no fornecedor e deve ser accionado apenas nesse ensaio, utilizando a entidade e referência retornadas para a cobrança.

## Persistência e fronteira de confiança

Os registos técnicos ficam no esquema privado `massa_gateway`:

| Tabela | Finalidade |
| --- | --- |
| `attempts` | Intenção, chave do pedido, dados esperados, identificadores do fornecedor e estado da tentativa. |
| `observations` | Evidência financeira acrescentada sem substituir o histórico. |
| `events` | Caixa de entrada durável de callbacks, com deduplicação por hash. |

O cliente não escreve directamente nestas tabelas. Os RPCs `massa_gateway_*` são reservados ao serviço do servidor. A autorização do utilizador e a correspondência da operação são verificadas antes de qualquer chamada privilegiada. A utilização de `service_role` não dispensa estas verificações.

| Estado interno | Significado |
| --- | --- |
| `submitting` | Pedido persistido; criação em curso ou resultado ainda não registado. |
| `pending` | Cobrança conhecida, sem confirmação final de pagamento. |
| `uncertain` | Resultado externo desconhecido; exige reconciliação. |
| `confirmed` | Evidência autoritativa validada e lançamento aplicado uma única vez. |
| `failed` | Resultado de falha confirmado segundo o contrato suportado. |
| `expired` | Cobrança expirada segundo evidência do fornecedor. |
| `review` | Divergência ou pagamento tardio que exige resolução; não é saldo disponível. |

Um pedido repetido com a mesma chave e os mesmos dados recupera a tentativa, sem repetir o `POST`. Dados diferentes com a mesma chave são recusados. Uma tentativa activa de uma ordem bloqueia uma segunda criação, incluindo quando chega com outra chave. O bloqueio também impede pagamento/cancelamento interno concorrente enquanto o resultado externo está por resolver.

O indicador `observed_paid` conserva a existência de evidência de pagamento mesmo se a aplicação automática ficar bloqueada por divergência ou atraso. Uma ordem paga externamente é identificada com `payment_provider='appypay'`; o reembolso interno simulado não é um reembolso no gateway e fica bloqueado para essa ordem.

## Confirmações pendentes com a AppyPay

1. Aplicações GPO/REF activas, permissões, validade das credenciais e associação ao comerciante correcto de sandbox.
2. Formato de telefone aceite: nove dígitos ou prefixo `244`.
3. Esquema completo de criação/consulta/webhook, códigos finais e transições; significado de `100` e `101`, expirações, reversões e reembolsos.
4. Consulta por `merchantTransactionId` quando a resposta de criação se perde, listagem/paginação e regras de recuperação.
5. Escopo e retenção de unicidade, comportamento de HTTP 409, suporte a repetição de pedidos e eventual header de idempotência.
6. Autenticação/assinatura suportada para callbacks, política de reenvios, timeout, ordem dos eventos e reenvio manual.
7. Para REF: quem gera o número, tamanho/formato, entidade, unicidade, `dueDate` e fuso horário, duração máxima e pagamentos tardios/parciais/em excesso.
8. Limites mínimos/máximos, quotas, rate limits, comissões, impostos, arredondamentos, liquidação, conta beneficiária e relatórios para conciliar bruto/taxas/líquido.
9. Escopo comercial: cobrança de vendas/serviços ou carregamento de carteira; autorização de liquidação a terceiros, subcomerciantes, reembolsos e eventuais levantamentos.

### UNITEL Money

A AppyPay anuncia UNITEL Money na oferta pública e refere aplicações UMM no guia de credenciais. Falta comprovar a activação para a YAMILOOK no sandbox, obter o `paymentMethod` e schema específicos, conhecer os números/cenários de teste, estados, expiração e destino dos fundos. A autorização PIN/USSD ocorre nos meios da UNITEL; a MASSA não deve recolher esse PIN. Não deduzir a integração a partir do rótulo de um botão ou do funcionamento de MCX.

### SWEG

O SWEG anuncia facturação com referências e confirmação automática AppyPay. A integração externa requer documentação API, ambiente de teste, autenticação, identificação por empresa/NIF, permissões de multiemitente, endpoints de facturas/recibos/notas de crédito, estados e eventos. Deve ficar definido quem cria a cobrança e emite cada documento. Uma factura SWEG e uma operação MASSA não devem desencadear duas cobranças para a mesma obrigação.

## Fontes técnicas

Consultadas em 22 de Novembro de 2026. Exemplos públicos contêm inconsistências; não copiar valores com aparência de credenciais.

- [AppyPay: autenticação OAuth](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385501-autenticac%C3%A3o-na-api-appypay-obtenc%C3%A3o-do-token-de-acesso-oauth2-client-credentials).
- [AppyPay: criação de cobranças GPO e REF](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385502-criar-uma-cobranca-charge-na-api-appypay-gpo-e-refer%C3%AAncia).
- [AppyPay: simulação de pagamentos](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385503-como-simular-pagamentos-no-ambiente-sandbox-gpo-e-refer%C3%AAncia-).
- [AppyPay: configuração de webhook](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385504-passo-a-passo-para-configurar-um-webhook-no-portal-appypay).
- [AppyPay: payloads e validação do webhook](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385505-como-validar-o-webhook-payloads).
- [AppyPay: credenciais de integração](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000417474-como-obter-as-credenciais-de-integrac%C3%A3o-client-id-client-secret-api-keys-e-resource-id).
- [AppyPay: oferta UNITEL Money](https://www.appypay.co.ao/unitel-money).
- [SWEG: facturação e pagamentos](https://sweg.ao/).
- [Supabase: segredos de Edge Functions](https://supabase.com/docs/guides/functions/secrets).
- [Supabase: autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth).
