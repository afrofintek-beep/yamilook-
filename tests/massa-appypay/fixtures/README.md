# Ensaio isolado da base MASSA

Este conjunto verifica a fronteira real entre autorização, carteira, tentativas externas e ledger. O único destino remoto deste ensaio é o branch Supabase `kvnbqqektpkeouyepyor`. Não é uma baseline completa da Yamilook nem uma reparação do histórico de migrations da aplicação.

O branch novo estava sem tabelas da aplicação e sem utilizadores. O bootstrap automático tinha falhado ao criar `user_invitations`, porque a tabela `public.profiles` ainda não existia. Aplicar apenas a migration AppyPay sobre esse estado também não seria possível: depende da carteira e dos seus controlos de acesso.

## Ficheiros e proveniência

O nome `20261122123828_massa_appypay_test_harness.sql` foi criado com `supabase migration new massa_appypay_test_harness`, CLI 3.2.0, e o ficheiro foi imediatamente movido para esta pasta. **Não deve entrar em `supabase/migrations` nem ser aplicado a produção.** Contém apenas as dependências mínimas e as guardas do ensaio.

| Origem em `supabase/migrations` | Conteúdo incluído | Exclusões deliberadas |
| --- | --- | --- |
| `20260110013758_08af1c74-443f-4992-a6aa-489a71519a77.sql` | Enums iniciais e definição completa de `profiles`, com tipos, defaults e FKs reais | Tabelas sociais, signup trigger, `user_settings` e restantes funcionalidades |
| `20260205031858_8a568fee-2606-4177-87e5-6a0f59dfd0d9.sql` | Migration completa das colunas de localização e índice | Nenhuma |
| `20260110230052_45eeb5a2-0eca-4745-8f24-631876f34014.sql` | `app_role`, tabela `user_roles`, função real `has_role` e políticas RLS | DML histórico que promovia um endereço de teste a administrador |
| `20260710290000_kumbu_purchases.sql` | Tabela completa `kumbu_purchases`, índice e política de leitura própria | Alteração de `kumbu_ledger` e função `fulfill_kumbu_purchase`, que dependem de outro subsistema |

`kumbu_purchases` é necessária porque a migration real do piloto instala nela um trigger de autorização. Não é instalado qualquer checkout KUMBU ou gateway legado. As funções `has_role`, `has_wallet_access` e `wallet_access_allowed` consultam as tabelas reais; não existem stubs que concedam acesso incondicional.

`harness.sources.json` guarda SHA-256 dos ficheiros de origem, fronteiras dos excertos e hashes dos excertos. O commit de origem é `ccb8fc789e52af00aac0c9ea3fa89c3cacd50338`; a migration AppyPay inclui também a clarificação posterior, apenas em comentário, de que a caixa de callbacks guarda indícios não fiáveis. O hash do manifesto identifica exactamente essa versão.

Na dependência de localização é removido apenas um espaço no fim da linha `ALTER TABLE public.profiles`. O manifesto declara `strip_trailing_whitespace` e guarda o hash do excerto normalizado; o hash do ficheiro histórico completo permanece inalterado. Nenhuma migration histórica foi modificada.

O helper `harness.mjs` valida essa proveniência e lê as seguintes **10 migrations originais completas**, em ordem, sem as duplicar neste directório:

1. `20261118163926_payment_point_sandbox.sql`
2. `20261118164605_payment_point_function_hardening.sql`
3. `20261118170009_payment_point_angola.sql`
4. `20261118193500_payment_point_balance_rls.sql`
5. `20261119011000_wallet_private_pilot.sql`
6. `20261119011500_wallet_pilot_recipient.sql`
7. `20261119020500_wallet_movement_summary.sql`
8. `20261119040000_wallet_passkey_state.sql`
9. `20261119235000_wallet_debit_authorization.sql`
10. `20261122120553_massa_appypay_sandbox.sql`

Ficam fora do ensaio o chat/Kosolola, convites, signup, perfis sociais, billing, Pro, a economia KUMBU antiga e outros serviços. Nenhum resultado destes testes demonstra o funcionamento da aplicação inteira ou de um pagamento AppyPay.

## Guardas e diferenças explícitas do ensaio

O baseline exige opt-in `massa.harness_project=kvnbqqektpkeouyepyor`, fundação Supabase já existente (`auth.users`, `auth.uid`, `auth.jwt`, papéis `anon`, `authenticated`, `service_role`), ausência de utilizadores e schema de aplicação vazio. Também rejeita os schemas privados da carteira se já existirem. Falha antes de criar objectos se alguma precondição não for satisfeita.

O opt-in é uma confirmação operacional, não prova de identidade do servidor. O executor tem de fixar **também** o `project_id`/destino da ligação. O marcador privado `massa_test_harness.installation` permite aos testes seguintes rejeitar uma base não preparada. Não contém credenciais.

A RLS de `profiles` é explícita e permite apenas leitura do próprio perfil a `authenticated`. As tabelas auxiliares `profiles`, `user_roles` e `kumbu_purchases` não recebem permissões de escrita directa para clientes ou `service_role`. A função real `has_role` continua disponível aos papéis que dela precisam. Estas ACLs são intencionalmente mais estreitas do que os fluxos sociais e de administração da aplicação completa. As funções reais da carteira continuam a ler essas tabelas por `SECURITY DEFINER`.

O baseline não cria contas, administradores, convites piloto, saldos, agendamentos ou credenciais de gateway. Os utilizadores fictícios existem apenas nos scripts de verificação posteriores.

## Preparação e validação local

Na raiz do repositório:

```sh
node --test tests/massa-appypay/harness.test.mjs
```

Foram aprovados 8 testes locais: proveniência, guardas, instalação integral, rollback do script PostgreSQL, papéis e concessões reais do piloto, ACL/RLS sob permissões públicas amplas de origem, Angola e preservação da autorização de débitos/ledger.

PGlite emula apenas a fundação de autenticação hospedada e trabalha com uma sessão PostgreSQL. Não verifica assinaturas JWT, WebAuthn no navegador ou concorrência entre processos. O teste confirma que a RPC de débito recusa uma operação sem aprovação e que as aprovações continuam privadas; não alega uma cerimónia WebAuthn de ponta a ponta.

Para revisão, `readHarnessParts()` devolve os 11 ficheiros e os seus hashes; `buildHarnessSql()` monta uma única transacção em memória. O helper não tem cliente HTTP, ligação a base de dados, credenciais ou comando de deploy. Excertos históricos não devem ser registados como se as respectivas migrations completas tivessem sido aplicadas.

O executor aplicou os 11 ficheiros no branch dedicado sob o nome de ensaio `massa_appypay_isolated_test_harness`. Isto não corrige o estado de migração automática do branch nem a baseline global da aplicação.

## Verificação em PostgreSQL hospedado

`postgres-rollback.sql` foi executado com sucesso no destino dedicado em 22/11/2026. A resposta final foi `MASSA rollback verification passed`. O script:

- Exige o marcador do ensaio e ausência de contas preexistentes.
- Cria contas e papéis exclusivamente fictícios dentro da transacção.
- Testa recusa a não convidados, concessão/revogação por um administrador real, ACLs de clientes e `service_role`, RLS de perfis/carteira, Angola do pagador e destinatário, chave obrigatória e bloqueio de saídas.
- Testa a reserva de uma cobrança activa, idempotência, confirmação, replay, ledger equilibrado, impossibilidade de apagar entradas e recusa do reembolso interno de pagamento externo.
- Confirma que um sucesso tardio fica em `review`, com prova de pagamento observada e sem crédito.
- Força os checks diferidos antes de terminar em `ROLLBACK`.

A consulta posterior verificou zero contas, papéis, concessões piloto, carteiras, tentativas, observações e entradas de ledger. As assertions são funções temporárias `SECURITY INVOKER`, removidas pelo rollback. Nenhum gateway, email, função Edge ou scheduler é invocado pelo SQL.

### Concorrência comprovada entre duas sessões

`remote-checks.mjs` gera UUIDs aleatórios para um ensaio separado e SQL para preparação, duas chamadas, inspecção e limpeza. Não executa SQL automaticamente. As duas chamadas devem ser feitas por ligações simultâneas ao mesmo branch, e o relatório tem de mostrar `pg_backend_pid()` distintos **e intervalos sobrepostos**. PIDs diferentes, por si sós, não provam concorrência.

O teste estrito passou em 22/11/2026, com PIDs **11181 e 11182** e intervalos sobrepostos. O resultado integral está em [concurrency-evidence.json](./concurrency-evidence.json).

| Fase | PID | Início UTC | Regresso da RPC UTC | Fim UTC | Resultado |
| --- | --- | --- | --- | --- | --- |
| Preparação | 11181 | 13:09:39.254314 | 13:09:39.264240 | 13:09:41.270821 | `submit: true` |
| Preparação | 11182 | 13:09:39.281578 | 13:09:41.273572 | 13:09:43.277036 | `submit: false`, mesma tentativa |
| Confirmação | 11181 | 13:09:43.599238 | 13:09:43.608923 | 13:09:45.611004 | `pending` → `confirmed` |
| Confirmação | 11182 | 13:09:43.622040 | 13:09:45.617197 | 13:09:47.618878 | `pending` → `confirmed`, sem novo crédito |

As duas preparações produziram uma tentativa. As duas confirmações começaram por observar estado pendente e produziram **um journal, duas entradas, soma contabilística zero e incremento único de 4.321 cêntimos** na carteira sintética. O lock real da carteira foi observado nas quatro chamadas. Este caso mede a primeira confirmação concorrente, além da repetição já confirmada.

O executor temporário `concurrency-probe.ts` fez as chamadas com `Promise.all` dentro do runtime Supabase. A chave de serviço injectada pela plataforma permaneceu no servidor; o endpoint exigiu um token aleatório, comparado com um hash SHA-256, e validou o URL exacto do projecto. O SQL temporário ficou reservado a `service_role`, com contexto privado, expiração, uso único e identificadores exclusivamente fictícios.

O helper não adquire locks antes da RPC financeira. Só retém a transacção por dois segundos depois do regresso da RPC, prolongando o lock que a implementação real já adquiriu. Assim, a prova não acrescenta uma serialização artificial que esconda um defeito da implementação.

As tentativas anteriores pelo conector foram executadas em sequência, mesmo com PIDs distintos e uma janela de vinte segundos. Comprovam apenas replay sequencial e não são contabilizadas como prova de concorrência. O teste estrito criou outro pedido fictício para começar com uma primeira confirmação pendente.

Depois do resultado, o executor Edge foi substituído pela versão 2, sem cliente ou acesso à base de dados, com resposta inerte e verificação JWT activada. O token temporário foi eliminado. Os scripts do probe e de limpeza ficam nesta pasta exclusivamente para auditoria do ensaio; não integram as migrations de produção.

### Limpeza e evidência persistente

O ensaio multissessão requer fixtures confirmadas visíveis a ambas as sessões; por isso não pode ser integralmente revertido com o rollback de uma única sessão. O ledger e as observações são imutáveis por desenho.

O SQL de limpeza só elimina identidades com UUIDs e endereços sintéticos exactos do ensaio, revoga os seus acessos piloto e remove o papel/conta de administrador temporário. Pagador e destinatário referenciados pelas tentativas, pedidos e ledger podem permanecer. Não se desactivam triggers, não se forçam cascatas e não se alteram restrições para remover essa evidência.

**Limpeza concluída e verificada:** uma primeira confirmação do conector expirou sem aplicar a operação. Depois de renovar essa confirmação, `20261122130903_massa_test_concurrency_cleanup.sql` foi aplicado com sucesso **apenas** no projecto `kvnbqqektpkeouyepyor`. A consulta posterior confirmou ausência da RPC e do contexto do probe, zero administradores e zero contas com acesso ao piloto. Permanecem duas identidades fictícias sem email, password, telefone ou identidade OAuth, necessárias à integridade referencial dos registos; os dois journals e as quatro entradas contabilísticas sintéticas foram preservados. O executor Edge já tinha sido retirado e o token temporário eliminado. Nenhuma credencial de gateway foi configurada ou utilizada.

## Advisors e privilégios herdados

A revisão remota após DDL não reportou alertas de nível ERROR. Reportou políticas ausentes nas tabelas privadas `massa_gateway`, marcador, journals e `wallet_pilot_access`; nestes casos a ausência de políticas é uma negação de acesso intencional, complementada pelas ACLs. As RPCs AppyPay estão limitadas a `service_role` e as tabelas privadas recusam acesso directo mesmo a esse papel.

Os avisos das funções existentes `has_role`, `has_wallet_access`, `payment_point_action`, `wallet_begin`, `wallet_pilot_manage` e `wallet_preferences` reflectem as concessões e `SECURITY DEFINER` da cadeia real. `has_wallet_access` tem execução por `anon` para devolver o estado de acesso. As quatro tabelas em `wallet_security` mantêm a configuração de origem, sem RLS e protegidas por schema/ACL privados. Não foram alteradas automaticamente para silenciar o linter. Estes factos não equivalem a um relatório sem avisos e devem acompanhar a avaliação dos testes de autorização.

Referências do linter: [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [execução anónima de SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [execução autenticada de SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
