# Certificação AFROLOC: revisão de 25-10-2026

## Resultado e limites

Não está demonstrada uma identidade comum nem um contrato oficial de certificação entre AFROLOC e Yamilook/KOSOLOLA. Esta alteração suspende a certificação automática na Edge Function, sem alterar contas, perfis, mensagens, contactos ou decisões históricas. Conversas e chamadas não dependem desta verificação. A revisão manual existente permanece um processo local; não comprova certificação pelo serviço AFROLOC.

A função de produção consultada era `afroloc-verify` v13, com atualização em julho de 2026: ainda lia `profiles.phone_number`, aceitava um booleano do parceiro e podia substituir o código declarado. A PR #19 no GitHub não tinha atualizado essa função. A nova função autentica com `getUser`, exige consentimento e código, responde `integration_pending` e não dispõe de cliente privilegiado nem de chamadas ao parceiro. Não existe flag que ative inadvertidamente o contrato antigo.

O módulo `verification.ts` mantém os testes da fronteira anterior e acrescenta consentimento vinculado ao código, revalidação de identidade e erros sem detalhes privados. **Não é o contrato oficial nem é invocado pela função suspensa.** Antes de reutilizá-lo, substituir a resposta booleana por evidência autorizada com ciclo de vida, e tornar a persistência da identidade/endereço/evidência atómica.

## Evidência de identificação do serviço

| Origem inspecionada | Evidência | Conclusão permitida |
| --- | --- | --- |
| Yamilook Supabase `rfayqekonkovfbkwjjum` | 109 contas, zero telefones Auth, zero confirmações, zero mudanças pendentes | Não habilitar certificação por telefone de perfil |
| `app-builder-buddy-192` | API `api-v1` sem rota `partners/certification-status`; projeto referido no contrato anterior `rxhtdejvjgopfseysuhl` não aparece nos projetos acessíveis | Implementação candidata antiga, não confirmada como oficial |
| `AFROLOC_2026`, árvore `0fbaeb90be6a0e79f911430808c5dbe27ec639c9` | Cliente usa variáveis Vite; documentação prevê modo demo; única função listada `send-sms` | Não fornece o endpoint parceiro requerido |
| `AFROLOC_2026` migração `0001_init.sql` | Proprietário pode inserir/atualizar a própria linha `addresses`, incluindo `status`, `validator`, `verified_at` | Esse esquema isolado não é uma fonte segura de certificação por autoridade; verificar restrições adicionais no deployment oficial |
| Supabase `ljcxqwjvjgobhisqkujr` (`afroc_app26`) | Consulta às tabelas candidatas encontrou `profiles`, mas não `addresses` | Nome semelhante não estabelece correspondência com o código |
| Vercel | Listagem mostra `afroloc` e `afroloc_2026`; inspeção de `afroloc` por nome e ID devolve 404 | Associação domínio → deployment → repositório → Supabase continua por demonstrar |

Nenhum telefone, email, token ou endereço pessoal foi extraído nas consultas agregadas. Não se chamou o parceiro com dados de utilizadores.

## Associação de telefone sem perda de dados

Recomendação condicionada à validação do Auth: dentro da sessão existente, `auth.updateUser({phone})`, seguido de `verifyOtp({phone, token, type: 'phone_change'})`. Nunca usar `signUp`, `signInWithOtp` ou confirmação administrativa para simular associação. Preservar o UUID de `auth.users` e todas as relações existentes; manter email/palavra-passe. Não fundir duas contas por coincidência de telefone.

Bloqueios antes de expor o fluxo:

1. Fornecedor SMS, países/cobertura, custos e limites de envio aprovados e testados. Não se confirmou configuração operacional do fornecedor nesta revisão.
2. Supabase documenta ambiguidade quando várias contas têm o mesmo `phone_change`. Confirmar a versão/correção do servidor e testar duas sessões concorrentes antes da ativação. Uma leitura antes/depois no frontend não resolve uma corrida no servidor. Não alterar diretamente `auth.users` como atalho.
3. Demonstrar vinculação do desafio ao UUID autenticado, número, finalidade e validade; consumo único, expiração, limitação de tentativas/reenvios e resposta genérica para duplicados.
4. Confirmar que UUID antes/depois é idêntico; sessão diferente deve interromper o processo, nunca importar a sessão devolvida de outro utilizador. Testar recuperação, número reciclado e troca de SIM.
5. Consentimento para SMS é distinto da autorização para consultar AFROLOC. Confirmar telefone não certifica residência, identidade civil ou titularidade de endereço.

Alternativas:

- **Confirmação nativa na conta existente:** preferida após resolver os pontos acima; sem migração de histórico.
- **Ligação autorizada no próprio AFROLOC:** autorização de curta duração e uso único emitida após login no serviço oficial, ligada ao utilizador local e ao código. Evita transmitir telefone, mas exige endpoint oficial e protocolo de troca.
- **Verificação manual documentada:** alternativa operacional separada; não alterar `phone_confirmed_at` nem marcar certificação externa sem evidência da autoridade.

Fontes técnicas consultadas: https://supabase.com/docs/guides/auth/phone-login e https://supabase.com/docs/guides/troubleshooting/unexpected-behavior-with-authupdateuser-phone-phone-linked-to-incorrect-user-id-45368f . A consulta ao changelog por web falhou por formato não suportado; não se confirmou uma correção dessa limitação.

## Contrato a acordar com a autoridade (proposta, não contrato confirmado)

- Identificação do serviço oficial, domínio, projeto Supabase e revisão de código; responsável pela certificação.
- Autenticação de parceiro com permissões mínimas e rotação de chaves; autorização do titular para aquele destinatário, finalidade e código.
- Preferir identificador opaco ligado por autorização explícita. Telefone, se utilizado, não é chave de fusão e deve ser confirmado nos dois lados.
- Pedido vinculado a código exato, nonce/desafio, utilizador local e consentimento. Não enviar GPS, mensagens ou lista de contactos.
- Resposta com versão, emissor, destinatário, sujeito autorizado, código exato, vínculo de titularidade/direito de uso, identificador da evidência, emissão, expiração, estado/revogação e nonce. Validar assinatura ou canal autenticado conforme protocolo acordado.
- Negativas devem evitar enumeração de contas. Timeout, redirecionamento, resposta inválida, sujeito errado, expiração ou revogação não certificam.
- Persistir evidência e auditoria mínima com acesso restrito, revogação e expiração aplicadas também no consumo; não guardar indefinidamente um booleano `certified`.
- Autoridade impede que cidadãos alterem campos de certificação. Revalidar permissões de tabela, RPCs e triggers no serviço oficial.

## Critério de ativação

Duas contas de ensaio distintas e autorizadas, fluxo de associação sem alteração de UUID, negação de acesso ao endereço alheio, consentimento recusado/alterado, mudança simultânea de telefone/endereço, resposta expirada/revogada, repetição do desafio e indisponibilidade do parceiro. Só depois substituir a suspensão da função e publicar uma alteração revista. Não remover a suspensão apenas por haver uma URL ou chave.

## Validação desta alteração

32 testes locais das fronteiras de autorização, consentimento, correspondência, persistência simulada, identidade alterada, erros e suspensão passaram. Esses testes usam fixtures e não demonstram certificação entre serviços reais. Estado da publicação da função e da compilação deve ser consultado na PR/resultado desta tarefa.

### Resultado final da verificação

- Função publicada e relida no Supabase: `afroloc-verify`, versão **14**, estado **ACTIVE**; ficheiros `index.ts` e `handler.ts`.
- Pedido HTTP sem autenticação ao endpoint real: **401**, `{"certified":false,"reason":"unauthorized"}`.
- Suite completa com URL/chave fictícias de teste: **455 testes, 67 ficheiros, todos passaram**. A primeira execução sem variáveis falhou na importação de duas suites alheias a esta alteração; não foi uma falha de autorização.
- Compilação de produção passou; aviso existente de chunks grandes.
- Não foram usados acessos de utilizadores para testar o fluxo autenticado alojado nem houve certificação real.
- Permissões consultadas de `profiles`: `authenticated` não tem UPDATE na coluna de certificação, mas tem INSERT. Isso não prova explorabilidade por si só; rever políticas de INSERT e criação de perfil antes de ativar um novo emissor de certificados.
