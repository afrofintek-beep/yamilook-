# Campanhas de convite controladas — proposta de 7 de novembro de 2026

**Estado: patch para revisão. Não aplicado à produção.** Nenhuma campanha, participante, quota ou convite é criado pela migração. Base da análise: `27497e5f231739c7ef350faa73b12aeb8206a4ff` de `main`, complementada por consultas de leitura às funções, colunas, políticas e permissões da base de dados YAMILOOK.

## Arquitetura verificada

- `user_invitations` já guarda códigos individuais, emitente, destinatário opcional, datas de criação/utilização/expiração, utilizador que consumiu e identificador do pedido.
- `issue_user_invitation(email)` permite atualmente emissão por administradores ou pessoas em `invitation_permissions`. Reutiliza um convite pendente para o par emitente/email. Não possui quota por campanha.
- `issue_shareable_user_invitation(request_id)` emite códigos sem destinatário, válidos por sete dias, com idempotência e limite de 100 por emitente/24 horas. Esse limite não é a campanha inicial de 100 inscrições.
- `consume_user_invitation_before_signup` executa antes da criação em `auth.users`: bloqueia a linha, verifica utilização, autorização, email e expiração; consome na mesma transação. Um erro posterior na criação do perfil reverte o consumo.
- `validate_mvp_access_code` permite a pré-validação; a decisão definitiva permanece no trigger do servidor. O código individual é convertido no referral do emitente apenas dentro desse trigger para compatibilidade com `handle_new_user`.
- A produção tem também `mvp_campaign_deliveries` e `claim_mvp_campaign_invite`, um fluxo separado para as primeiras 100 inscrições, acessível apenas a `service_role`/proprietário. Essa função não estava no repositório analisado; foi inspecionada em leitura. Tem o seu próprio teto de 100, controlo de repetição e entrega.
- `profiles.is_verified`, os campos AFROLOC e a presença online não constituem, por si só, evidência suficiente para esta autorização. As políticas de perfil permitem atualizações do próprio titular. O patch não utiliza esses campos nem `user_metadata` como prova de presença.

Referências: [PR inicial #1](https://github.com/afrofintek-beep/yamilook-/pull/1), `src/lib/referral.ts`, `src/lib/invite-delivery.ts`, migrações `single_use_invitations`, `mvp_invitation_permissions` e `shareable_contact_invitations`.

## Comportamento proposto

| Controlo | Regra implementada |
|---|---|
| Ativação | Criação obrigatoriamente em rascunho; só administrador ativa, suspende ou encerra. |
| Período | Datas com fuso horário; início inclusivo, fim exclusivo; decisão pelo relógio do servidor. |
| Quota individual | Definida pelo administrador entre 1 e 10, por campanha. O valor 10 no formulário é uma sugestão de configuração, não um direito atribuído. |
| Teto total | Obrigatório, entre 1 e 100.000; inclui todas as emissões da campanha. |
| Elegibilidade | Participante autorizado nominalmente; referência da revisão de presença e validade; conta anterior à criação da campanha; antiguidade mínima; login recente; conta não apagada, banida ou anónima; email confirmado quando exigido. |
| Presença verificada | Atestação administrativa com referência de processo, autor, data e validade. Não é uma integração automática com AFROLOC/KYC. O administrador tem de rever a evidência fora deste formulário. Não incluir documentos sensíveis na referência. |
| Atividade | `auth.users.last_sign_in_at`, com janela configurável de 1–90 dias. É um critério conservador de login recente; não mede toda a atividade de quem permanece ligado durante semanas. |
| Expiração | Validade configurável de 1–168 horas, limitada ao fim da campanha. Reduzir a data final encurta convites pendentes; prolongá-la não estende nem ressuscita convites. |
| Suspensão | Bloqueia novas emissões e consumo de convites pendentes da campanha. Retomar não reinicia quotas nem validade. |
| Revogação | Retirar a autorização de um participante bloqueia a emissão e os seus convites da campanha ainda pendentes. |
| Encerramento | Definitivo. Mantém registos para consulta e auditoria. |
| Contagem | Convites usados, expirados e pendentes contam para a quota. Não existem reembolsos por expiração nem eliminação pelo utilizador. |
| Repetição | Mesmo emitente/pedido/payload devolve o mesmo convite disponível. Reutilizar o pedido com outra campanha ou email falha. |
| Duplicação | Email normalizado; mesmo destinatário na mesma campanha não recebe novo código. Um novo identificador de pedido para esse email é recusado; o convite pendente pode ser consultado no histórico. Emails de contas existentes e convites pendentes para o mesmo email são recusados. |
| Sem email | Ligação de utilização única: a primeira inscrição válida fica com o convite. Não é possível identificar antecipadamente pessoas duplicadas sem destinatário; cada ligação distinta consome quota. |
| Abuso | Limite adicional de 10 novas emissões por emitente/hora entre campanhas; autenticação obrigatória; não permite fornecer outro emitente; tabelas sem escrita direta; sem concessão automática de privilégios. |
| Consulta | Emitente vê os seus convites. Administrador vê os da campanha, participantes e histórico. Relatórios paginados, 50 linhas por lista; seleção apresenta as 100 campanhas mais recentes acessíveis, dimensão adequada ao MVP. |

A expiração da verificação de presença, a revogação ou o banimento do emitente também bloqueiam os seus convites da campanha pendentes. A falta de um novo login, isoladamente, não invalida convites já emitidos: atividade recente é avaliada na emissão.

## Base de dados e API

Migração: `supabase/migrations/20261107201231_controlled_invitation_campaigns.sql`.

Novas tabelas: `invitation_campaigns`, `invitation_campaign_members`, `invitation_campaign_audit`. Todas têm RLS e nenhum acesso direto de escrita para `anon`/`authenticated`. Os registos de auditoria são anexados pelas funções; não se assume resistência a alterações por superutilizadores da base de dados.

O `campaign_id` em `user_invitations` é opcional. Convites antigos ficam com `NULL`, sem reclassificação nem alteração em massa das suas datas. Os códigos continuam com 16 caracteres e utilizam o mesmo formulário de registo e links `/register?ref=...`.

| RPC pública | Responsabilidade |
|---|---|
| `save_invitation_campaign(p_id, p_config)` | Criar rascunho, alterar condições e transitar estado; exclusiva do administrador. |
| `set_campaign_member(p_campaign, p_email, p_allowed, p_reference, p_valid_until)` | Autorizar/revogar participante com evidência administrativa. |
| `issue_campaign_invitation(p_campaign, p_request_id, p_email)` | Emissão transacional, identidade derivada de `auth.uid()`, quota e elegibilidade no servidor. |
| `list_invitation_campaigns()` | Campanhas acessíveis, elegibilidade e contagem para o utilizador atual. |
| `campaign_report(p_campaign, p_offset)` | Totais e detalhes permitidos para o utilizador atual. |

As RPC novas são wrappers `SECURITY INVOKER` sobre funções restritas no esquema `private`. Os definer internos têm `search_path` fixo, validações de identidade/permissão e ACL explícita. A API pública anónima de validação continua disponível; não concede capacidade de emissão. Não há chaves privilegiadas no navegador.

A emissão obtém primeiro o bloqueio da linha da campanha; depois serializa o emitente entre campanhas e, quando aplicável, o destinatário. Contagens e inserção ocorrem na mesma transação. A suspensão, edição e revogação usam a mesma ordem de bloqueio. Cada emissão e alteração de autorização avança a versão da linha da campanha: uma transação com snapshot antigo em `REPEATABLE READ` falha com erro de serialização em vez de ultrapassar a quota. No MVP, serializar uma campanha inteira é uma escolha deliberada de simplicidade e segurança; crescimento substancial exigirá medição de contenção.

## Interface

- **Administração → Campanhas de convites controladas:** formulário de condições e datas, ativação/suspensão/encerramento, autorização com referência de presença, revogação, estatísticas, paginação e auditoria.
- **Definições → Convidar → Campanhas de convites:** seleção de campanha atribuída, quota utilizada/restante, geração individual, consulta de estado e partilha manual por WhatsApp/email.
- A mensagem usa a expiração devolvida pelo servidor. Não promete sempre sete dias.
- O novo fluxo não envia mensagens automaticamente. O envio automático já existente para o administrador e o fluxo inicial de 100 inscrições não são substituídos.
- O texto novo segue a interface portuguesa existente. Traduções adicionais não fazem parte deste patch.

## Compatibilidade e mudanças que exigem aprovação

1. **Convites individuais anteriores:** continuam a ser validados/consumidos pelas regras anteriores, incluindo eventual expiração e autorização legada. Não são abrangidos pela suspensão de uma nova campanha.
2. **Emissão antiga:** `issue_user_invitation` e `issue_shareable_user_invitation` passam a ser exclusivas do administrador. Delegados devem emitir pela RPC de campanha. As antigas permissões deixam de poder ser concedidas, mas podem ser retiradas para invalidar os convites individuais correspondentes.
3. **Códigos pessoais reutilizáveis de delegados:** deixam de servir para novas inscrições, pois contornariam as quotas. Os códigos individuais já emitidos são preservados. Códigos reutilizáveis do administrador e códigos MVP clássicos mantêm a compatibilidade. Este é um ponto de decisão explícita antes de produção.
4. **Campanha inicial de 100:** mantém as suas regras. Dois filtros passam a excluir tokens de novas campanhas das pesquisas/revalidações de convites administrativos. A migração adapta apenas os dois fragmentos inspecionados da função implantada; se a definição tiver mudado, aborta atomicamente e exige revisão. Não cria nem substitui esse serviço quando ausente.
5. **Clientes antigos:** um delegado ainda com a interface antiga recebe recusa do servidor ao tentar emitir; os links individuais já enviados continuam válidos nas condições acima. É necessário publicar a interface junto com a migração.

## Validação efetuada e limites

- 14 testes de integração num PostgreSQL 17.6 local, com ligações independentes: permissões, RLS/ACL, critérios de elegibilidade, datas, suspensão, revogação, limites, duplicação, email, expiração, rollback da inscrição, compatibilidade antiga, separação da campanha inicial e auditoria.
- Carga concorrente: 40 pedidos de dois utilizadores, limite individual 3 e global 5; exatamente 5 emissões e nenhum utilizador acima de 3. Dezasseis pedidos idempotentes produziram um só token. Oito inscrições simultâneas no mesmo token produziram uma inscrição. Teste adicional com oito snapshots `REPEATABLE READ` e quota 1.
- 63 testes Vitest da interface, mensagens de convite, links e compatibilidade de registo.
- TypeScript, ESLint dos ficheiros alterados e compilação Vite. A compilação mantém avisos existentes de bundles grandes.
- Novo workflow CI reproduz os testes em PostgreSQL 17.6 sem credenciais de produção.

Os testes PostgreSQL aplicam as três migrações de convites existentes e a nova migração a contratos mínimos de Auth/perfis. Incluem o `handle_new_user` real do repositório e uma fixture dos dois fragmentos da função inicial de 100. **Não equivalem a um restauro integral da produção**, nem validam GoTrue, confirmação real por email, conectividade PostgREST ou entrega em WhatsApp. Não foram consumidos convites reais, criadas contas de produção, aplicadas migrações remotas ou publicados frontends de produção.

## Sequência proposta para aplicação, sujeita a aprovação

1. Rever e aprovar especialmente a retirada de emissão legada e dos códigos reutilizáveis dos delegados, a suspensão do consumo e o modelo de atestação de presença.
2. Em staging com dados sintéticos: verificar os contratos atuais, `private` fora dos esquemas expostos, políticas/grants, migração completa e advisors de segurança. Testar duas contas reais de teste através de PostgREST/Auth, incluindo confirmação de email, uma emissão concorrente, expiração e um convite antigo. Não substituir a confirmação humana da presença por um badge do perfil.
3. Após aprovação explícita para produção: aplicar apenas esta migração revisada, verificar as RPC/grants/trigger e publicar o frontend. Não executar indiscriminadamente todas as migrações históricas do repositório; foi observado código remoto fora dele.
4. Criar uma campanha em rascunho; o administrador confirma datas, teto total, limite por participante e critérios; revê e autoriza nominalmente os participantes. Ativar constitui uma decisão posterior, separada da instalação do patch.
5. Monitorizar emissão/utilização/expiração e erros. A resposta operacional a um problema é suspender a campanha e conservar os registos. Não fazer rollback cego para as antigas funções de emissão ilimitada. Eventuais correções devem ser migrações progressivas que preservem `campaign_id` e o trigger capaz de consumir os tokens existentes.

Execução local/CI: PostgreSQL novo em `127.0.0.1`, base com nome começado por `invitation_campaign_test`, dependência `psycopg[binary]==3.2.12`; executar `python -m unittest discover -s tests/invitation-campaigns -v`. O harness recusa hosts remotos e outros nomes de base. Ver também `.github/workflows/invitation-campaigns.yml`.
