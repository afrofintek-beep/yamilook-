# Gestão de sessões da Academia

A lista principal apresenta sessões futuras e ao vivo. O organizador encontra as suas sessões em **As minhas sessões**, nos filtros **Próximas**, **Passadas**, **Canceladas** e **Arquivadas**. Administradores dispõem de **Gerir sessões** para todos os organizadores.

O botão **⋯** aparece nas sessões que o utilizador pode gerir e nos respetivos detalhes. Todas as ações pedem confirmação.

- **Arquivar**: apenas sessões passadas ou encerradas, sem inscrições por liquidar. Preserva materiais, reservas e avaliações. Sessões com inscrições pendentes devem ser concluídas ou canceladas primeiro.
- **Restaurar**: retira a marca de arquivo. Não reabre uma sessão cancelada ou passada.
- **Cancelar sessão**: apenas antes de começar, com motivo obrigatório. Mantém o histórico das reservas, reembolsa o saldo Kumbu efetivamente retido e cria um aviso privado para cada inscrito. Os avisos são apresentados na Academia; esta alteração não envia email ou push.
- **Eliminar**: apenas sessões agendadas/rascunhos sem inscrições, avaliações, movimentos de Kumbu ou avisos. A eliminação é lógica e oculta a sessão em todas as consultas da aplicação. O registo de auditoria fica conservado.

Sessões passadas agendadas não são automaticamente declaradas realizadas. A data, por si só, não prova a realização da sessão.

## Segurança e economia

As ações validam `auth.uid()` e a titularidade ou a função `admin` guardada no servidor. O histórico de ações só é legível pelos administradores. Os avisos estão protegidos por RLS para o respetivo destinatário, sem permissões de escrita do cliente.

Todas as operações de reserva, desistência, conclusão e gestão partilham o bloqueio da linha da sessão. O reembolso do organizador e o reembolso do aluno partilham o bloqueio do saldo antes da leitura do movimento líquido no ledger. Pedidos repetidos não repetem o crédito. O reembolso não aumenta os rendimentos nem o progresso vitalício do aluno.

As funções económicas existentes são preservadas em `private`, sem execução direta pelos clientes; wrappers públicos mantêm as assinaturas existentes. Um trigger impede que o cliente altere diretamente a titularidade ou os campos de gestão. Sessões eliminadas ficam ocultas por uma política RLS restritiva.

## Validação e publicação

A migração é `20261027032507_academia_session_management.sql`. Aplicar apenas esta migração, sem executar `db push` sobre o histórico legado.

O ensaio SQL foi executado no projeto Yamilook dentro de uma transação, junto com a migração, e revertido integralmente. A fixture usa identificadores existentes para respeitar as relações da base de dados; sessões de teste, reservas, movimentos, saldo, funções, tabelas e funções administrativas temporárias são revertidos por `ROLLBACK`.

Reprodução da validação SQL: `BEGIN;` + conteúdo da migração + `supabase/tests/academia_session_management.sql` + `ROLLBACK;`. Nunca executar a fixture sem a transação.

Validações de cliente: testes da Academia, suite Vitest, build Vite e ESLint dos ficheiros alterados. O resultado de `tsc --noEmit -p tsconfig.app.json` foi comparado com o commit de base e não acrescenta erros; o projeto já contém erros TypeScript fora desta alteração.

Não foram arquivadas, canceladas ou eliminadas sessões reais. A funcionalidade disponibiliza controlos para uma escolha explícita do organizador/administrador.
