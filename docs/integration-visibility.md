# Dashboard de acessos e visibilidade

O painel em **`/admin/acessos`** reúne as políticas aplicadas na Yamilook e na KOSOLOLA. O menu **Gerir acessos** aparece apenas após a confirmação de uma conta administradora activa, nas definições das duas aplicações e na administração da Yamilook. Na KOSOLOLA, a ligação abre o painel central na Yamilook, onde é necessária a sessão habitual dessa aplicação.

## Âmbito de cada controlo

| Funcionalidade | Efeito da política |
| --- | --- |
| Google Maps | Visibilidade dos controlos de mapa e direcções em LOCACCESS, partilha de localização e cartões de localização das duas aplicações. |
| MAGUELA | Visibilidade dos controlos de recolha e de conta ligada. A gestão da identidade continua sujeita à configuração de disponibilização já existente. |
| Carteira, Kumbu e facturação | Elegibilidade central já utilizada pelos menus, rotas e operações protegidas da carteira MASSA, Kumbu, facturação, rankings e ferramentas de criadores. |
| Criação de negócios | Elegibilidade para registar novos negócios. Conserva a consulta pública, a titularidade e a gestão dos negócios existentes. |

Google Maps e MAGUELA são controlos de visibilidade. As permissões próprias de transporte, identidade, endereço e APIs relacionadas continuam em vigor. Esta política não impede uma pessoa de utilizar manualmente os serviços externos. Os controlos AFROLOC/NJILA e as mensagens de localização já enviadas são preservados.

**A carteira tem um efeito operacional:** suspender ou retirar o acesso pode encaminhar pagamentos pendentes confirmados pela AppyPay ou UNITEL para revisão (`wallet_access_changed`), antes do crédito automático. A interface apresenta essa informação tanto no editor da política como nas excepções individuais. As verificações de titularidade, débito e reconciliação existentes continuam em vigor.

O dashboard também reúne ligações aos gestores existentes de campanhas e convites, convites de confiança, mentores, certificações AFROLOC, serviços do bairro e Dangereux. Essas áreas conservam os seus próprios processos de aprovação, papéis e estados; não recebem interruptores genéricos que possam contornar esses processos.

## Utilização

O painel tem quatro separadores:

- **Funcionalidades:** activar ou pausar, escolher quem pode aceder e definir calendário e critérios.
- **Perfis:** pesquisar um perfil, permitir ou bloquear uma funcionalidade, definir a validade e o motivo da excepção, ou voltar a seguir a política. O botão **Verificar acesso** mostra a decisão efectiva e o motivo para as quatro funcionalidades, sem alterar o perfil.
- **Grupos:** criar grupos de acesso e adicionar ou retirar membros. Estes grupos são administrados neste painel.
- **Histórico:** consultar as 100 alterações mais recentes, com administrador, destino, data e valores antes/depois. A tabela privada conserva o histórico completo.

As políticas têm quatro modos: apenas administradores, perfis seleccionados, por critérios ou todos os utilizadores autenticados. Os administradores activos têm sempre acesso; o dashboard não atribui nem retira a função de administrador.

Os critérios disponíveis são a função do utilizador, a pertença a grupos escolhidos pelo administrador e a idade mínima da conta de autenticação. Os diferentes critérios combinam-se com **E**: todos têm de ser cumpridos. Dentro da lista de grupos basta pertencer a **um** dos seleccionados. Uma lista de grupos vazia não restringe por grupo. O modo por critérios exige pelo menos um critério efectivo. A função Utilizador significa que o perfil não é moderador nem administrador, mesmo quando não existe uma linha explícita de papel `user`.

Calendários e validades são apresentados e introduzidos na hora de **Luanda (UTC+1)**, independentemente do fuso do dispositivo, e guardados como instantes com fuso horário. Início e fim são opcionais; o fim tem de ser posterior ao início. A excepção individual pode ter uma validade futura ou não ter limite.

Cada alteração é gravada por uma acção explícita e confirmada pelo servidor. Rascunhos de políticas são preservados durante actualizações e mudanças de separador. Se outro administrador tiver alterado a política, a revisão é recusada até o operador actualizar e rever a versão actual; não há substituição silenciosa de políticas concorrentes.

## Ordem de decisão

1. Contas inactivas, inexistentes ou anónimas não são elegíveis.
2. Administradores activos têm acesso automático.
3. Para os outros perfis, a pausa e as datas da funcionalidade prevalecem sobre excepções e critérios.
4. O modo apenas administradores recusa os restantes perfis.
5. Uma excepção individual não expirada determina permitir ou bloquear. **Seguir a política** remove essa excepção; não equivale a bloquear.
6. O modo todos admite as contas autenticadas elegíveis. No modo seleccionado, um convite empresarial aprovado e consumido continua a permitir a criação de negócios, salvo bloqueio individual.
7. No modo por critérios, a conta tem de cumprir todos os critérios configurados.
8. Sem correspondência, o acesso é recusado.

Não são usados dados de perfil editáveis pelo próprio utilizador para conceder autorização. Funções, grupos e data de criação são verificados no servidor.

## Dados, compatibilidade e sessões

`public.access_dashboard_manage` é um RPC invoker sobre um dispatcher privado definer. O estado actual exige uma conta activa e uma sessão autenticada válida. Listar configurações, pesquisar perfis, simular decisões ou escrever exige também o papel de administrador. A resposta de estado inclui o ID da conta, validado pelo cliente.

Políticas, excepções, grupos, membros e histórico ficam num esquema privado, com RLS, política explícita de recusa e sem acesso directo dos clientes. O avaliador privado é partilhado pela pré-visualização, pelo estado dos menus, pela elegibilidade financeira e pela criação de negócios. As operações financeiras de serviço podem avaliar a conta de destino sem forjar uma sessão desse utilizador.

As migrações mantêm as permissões individuais já existentes de Google Maps/MAGUELA, carteira e registo empresarial. Todas as políticas começam activas em modo seleccionado. Não são escolhidos novos utilizadores nem activado o modo todos pela migração.

Os RPCs anteriores de integrações e carteira delegam neste mecanismo. A revogação legada grava um bloqueio explícito, para continuar a retirar acesso mesmo se a política passar a todos ou por critérios. As operações INSERT/DELETE nas antigas listas de carteira e registo empresarial têm um trigger de compatibilidade com verificação de conta administradora activa e sessão válida; manutenção de serviço sem `auth.uid()` mantém o fluxo habitual. As tabelas antigas deixam de ser fontes paralelas de decisões.

As páginas activas revalidam as permissões a cada 15 segundos e ao retomar a aplicação. Offline, os controlos ocultam-se até uma nova confirmação. Erros e mudanças de conta não reutilizam permissões anteriores. As respostas de GPS/Google/MAGUELA em curso são descartadas quando os controlos protegidos são desmontados após perda de permissão.

## Publicação

Aplicar, pela ordem indicada, antes de publicar o frontend:

1. `20261125135733_restricted_integration_access.sql`
2. `20261125152635_admin_visibility_dashboard.sql`

Até estar disponível o contrato completo das quatro funcionalidades, o frontend recusa permissões. A implementação e os testes locais não aplicam estas migrações ao serviço activo nem publicam a aplicação.

## Verificação

```sh
node tests/integration-access/database.cjs
node tests/access-dashboard/database.cjs
npm test -- --maxWorkers=2 src/features/access-dashboard src/features/integration-access src/features/payment-point/WalletAccess.test.tsx src/hooks/useBusinessRegistrationAccess.test.ts src/features/papos/PaposLogout.test.tsx src/features/locaccess/AccessVisit.test.tsx src/features/locaccess/PersonSearch.test.tsx src/features/locaccess/MaguelaPickup.test.tsx src/components/account-link/MaguelaIdentityManagement.test.tsx src/components/chat/LocationCard.test.tsx src/components/chat/EnhancedChatInput.test.tsx
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

As verificações SQL executam as migrações reais em PGlite (PostgreSQL local de teste), com as dependências mínimas de autenticação e os dados legados. Cobrem importações, sessão/conta/papel, acesso directo, pausa/calendário, critérios, excepções, grupos, concorrência, histórico, adaptadores e avaliação financeira de serviço. Os testes da interface cobrem os estados de autorização, gestão, rascunhos, simulador, conversão de horário, tradução e controlos das duas aplicações.

Verificação final sobre a base principal `6c09c1cb5c9030aaac636410e9a2c12d19348fb6`: 111 testes de interface/API e 154 verificações de base de dados aprovados, TypeScript sem erros e build de produção concluído. O dashboard tem 142 mensagens nos dez idiomas suportados. A inspecção visual em navegador não foi possível porque o Chromium local não conseguiu criar o socket necessário no executor; não foram realizados testes contra a produção.

Nota da base: `src/i18n/ui-source-coverage.test.ts` falha também no commit principal acima, com os mesmos 21 textos preexistentes sem cobertura. A comparação numa cópia limpa confirmou que este dashboard não acrescenta pendências a essa lista.
