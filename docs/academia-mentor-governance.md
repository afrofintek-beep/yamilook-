# Gestão de mentores da Academia

## Comportamento

- `/admin/mentors`: pesquisa por nome, utilizador ou especialidade, filtros por estado, aprovação/rejeição, suspensão/reactivação, verificação para cobrança, desactivação, eliminação de perfis sem histórico e histórico das decisões.
- A candidatura pede especialidade (2–120 caracteres), biografia e experiência (10–2000 caracteres cada). Os textos podem ser editados pelo titular, sem alterar a decisão administrativa.
- Estados: `pending`, `review_required`, `active`, `rejected`, `suspended`, `inactive`. Aprovar/reactivar exige apresentação completa. Aprovação não atribui o selo de cobrança. Reactivar exige nova verificação antes de cobrar.
- Mentores existentes passam a `review_required`. O selo anterior fica registado na auditoria, mas não concede aprovação automática. Mantêm-se as sessões, reservas, pagamentos, avaliações e planos existentes. Podem cumprir sessões já agendadas; novas publicações, turmas e atribuições de mentor exigem aprovação. Novas reservas pagas exigem aprovação e selo. Reservas já pagas mantêm o tratamento financeiro existente.
- A suspensão bloqueia novas reservas e o início de sessões; não encerra uma sala já em curso nem cancela/reembolsa automaticamente compromissos. O administrador deve tratar as sessões pelo fluxo existente de cancelamento/conclusão.
- A desactivação preserva a conta e o histórico, e exige resolver sessões agendadas/em curso, reservas pendentes, planos pedidos/activos e turmas abertas.
- A eliminação afecta apenas perfis pendentes, rejeitados ou desactivados sem sessões, avaliações, planos, turmas ou rendimentos de mentoria. A conta YAMILOOK e o registo da decisão mantêm-se. Um perfil com histórico só pode ser desactivado.
- O titular pode pedir desactivação; o administrador vê o pedido e o motivo. Recandidaturas não contornam suspensões.

## Avaliações e presença

A conclusão financeira de uma sessão já podia marcar todas as reservas como `attended`. Esse campo não constitui prova de presença. A nova tabela `academia_attendance` só é escrita pela operação de confirmação, autorizada ao mentor da sessão ou administrador, com autor e data registados. Nesta versão a confirmação é **manual**, não inferida de uma ligação LiveKit.

A avaliação exige inscrição válida, presença confirmada, sessão terminada e utilizador diferente do mentor. As mesmas regras aplicam-se à actualização. Não é possível transferir uma avaliação para outra sessão/mentor/autor. Uma avaliação por participante/sessão é mantida pelo índice único existente. As avaliações históricas são preservadas; não são retroactivamente certificadas como presença comprovada.

Cartão e perfil usam a mesma agregação PostgreSQL de **todas** as avaliações. A lista do perfil continua a apresentar as últimas 20, com indicação dessa limitação. A média e o total não estão limitados a 20 nem ao limite de linhas do cliente.

## Segurança

Escritas directas em `mentor_profiles` são revogadas para `anon`/`authenticated`. As operações passam por wrappers invoker e implementações privadas com autenticação, autorização, limites e transições explícitas. As decisões requerem motivo. O endpoint antigo de verificação é compatível, mas também exige mentor activo e gera auditoria.

Triggers protegem publicações, alteração de preços/agendamento, novas reservas e novas atribuições de mentor, incluindo chamadas por RPCs privilegiadas antigas. Políticas restritivas de avaliação complementam quaisquer políticas permissivas existentes em produção. Presença e auditoria têm RLS e não aceitam escritas directas do cliente.

## Publicação

1. Rever e aplicar `20261031165824_academia_mentor_governance.sql` à base de dados YAMILOOK **antes de publicar este frontend**. A migração depende das migrações existentes de gestão de sessões, percursos e comunidades. Confirmar contagens e permissões depois da aplicação e executar os advisors.
2. Publicar o frontend da mesma PR na mesma janela. O frontend antigo deixa de poder criar directamente perfis de mentor após a revogação de escrita; evitar intervalo prolongado entre os dois passos.
3. Em duas contas de ensaio e uma administrativa, validar candidatura → edição → aprovação → sessão gratuita → verificação → sessão paga; confirmar presença de um participante e testar avaliação permitida/negada.
4. Rever os mentores existentes individualmente. Preencher biografia/experiência antes de aprovar. Não aprovar em massa apenas por terem sido mentores anteriormente.

Não executar a migração inversa automaticamente: restaurar permissões antigas reabriria as falhas. Em caso de problema, corrigir adiante e conservar a auditoria.

## Validação

- `node --test scripts/test-mentor-governance.mjs`: PostgreSQL isolado (PGlite), permissões reais de `authenticated`/`anon`, transições, bloqueio de auto-verificação, cobrança, presença, actualização das avaliações, desactivação e eliminação sem afectar a conta.
- `npx vitest run src/features/academia src/pages/AdminMentors.test.tsx`: componentes, formulários, restrição administrativa, confirmação com motivo, filtros, falhas de carregamento e regressões da Academia.
- `npx tsc --noEmit -p tsconfig.app.json` e `npm run build`.
- `npx playwright test -c playwright.academia.config.ts e2e/mentor-governance.spec.ts`: interface WebKit móvel com transporte simulado; não substitui o ensaio em produção após a publicação.
