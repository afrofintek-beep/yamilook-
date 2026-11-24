# Piloto de acesso por SMS na KOSOLOLA

O piloto começa com a associação e entrada por SMS em contas existentes.
Na versão de teste, definir `VITE_KOSOLOLA_PHONE_PILOT_ENABLED=true` no build
da KOSOLOLA. Com o valor em falta, o ecrã mantém o acesso por palavra-passe.
A opção de SMS aceita números móveis de Angola e usa a mesma conta Auth.
O fluxo de associação está em Definições. A palavra-passe continua
disponível no ecrã de entrada.

A criação de contas continua pelo percurso central de convites. Para testar
inscrições novas com número confirmado, usar o modo de confirmação de telefone
já previsto nos convites de confiança. Esse modo tem transporte próprio, hoje
configurado para Infobip no código, e precisa de validação separada. O piloto
não deve abrir a criação de contas directamente pela API pública de Auth.

## Preparação do ambiente de teste

1. Usar um projecto Auth isolado, sem dados de produção, com perfis de teste.
   Confirmar as migrações necessárias antes de ligar o frontend de teste.
2. Confirmar que a regra de criação de contas também é aplicada no servidor.
   Na configuração de Auth, compor `reject_phone_only_signup` com eventuais
   regras existentes antes de permitir pedidos de SMS.
3. Obter a documentação e as credenciais de teste do fornecedor, bem como
   aprovação do remetente KOSOLOLA. O fornecedor deve aceitar o envio do
   texto do código gerado pelo Supabase. Confirmar serviço, limites,
   formato da autenticação e semântica dos estados de envio e entrega.
4. Ligar um Send SMS Hook autenticado ao serviço no ambiente isolado.
   Verificar a entrega do código tanto no acesso como na associação do
   número. Manter a geração e a validação no Supabase Auth.
5. Usar cartões de teste autorizados da UNITEL, Africell e Movicel. Ensaiar
   a versão web móvel no iPhone e Android. Não registar códigos, números
   completos ou credenciais nos resultados.

## Validação do piloto

- A associação confirma o número na conta que iniciou a operação e a entrada
  abre a mesma conta com o perfil e o histórico de conversas.
- Uma tentativa com um número ainda não associado não cria uma conta.
- Um código incorrecto, expirado ou já utilizado não concede acesso.
- Testar número errado, reenvio, indisponibilidade do serviço SMS e
  recuperação por palavra-passe. Verificar se o SMS mostra o remetente
  aprovado e se o código chega antes de expirar.
- Para comparar as três redes, registar a proporção de entradas concluídas
  à primeira tentativa, o tempo de entrega e o custo por entrada concluída.
  Para o fluxo de convites, medir também o custo por inscrição concluída.
