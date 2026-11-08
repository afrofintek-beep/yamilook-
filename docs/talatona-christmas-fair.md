# Feira de Natal Solidário de Talatona

Implementação em `/feira-natalicia-talatona`, protegida por `VITE_SOCIAL_INITIATIVES_ENABLED=true`.
A pré-visualização anterior continua disponível em desenvolvimento ou com `VITE_TALATONA_FAIR_PREVIEW=true`.

## Inscrição e convites

Uma inscrição persistente por conta e iniciativa, com email confirmado, consentimento,
condomínio (ou outra zona) e endereço AFROLOC associado ao perfil. Um código digitado
não constitui prova: a organização verifica a residência, regista uma referência de
evidência e validade, e confirma o condomínio ou um grupo de proximidade geográfica.
Esta decisão comprova elegibilidade na campanha; não emite um certificado AFROLOC.
A integração automática com a autoridade AFROLOC continua dependente do serviço existente.

Após validação, cada participante pode emitir até cinco convites de utilização única,
com validade máxima de sete dias, limitada ao fim da campanha. Repetir o mesmo pedido
não consome outra vaga. Convites expirados continuam a contar para o limite de cinco.
O limite é imposto também no endpoint genérico de convites. Novos utilizadores podem
criar conta; utilizadores existentes podem aderir directamente. Criar conta não conclui
a inscrição na feira: é necessário associar endereço e confirmar a inscrição.

Uma adesão conta para a meta apenas após validar ambos os endereços e a correspondência
do condomínio confirmado ou do grupo de proximidade. Os grupos são definidos pela
organização com evidência externa; não se infere distância a partir do texto do endereço.
Uma alteração do endereço invalida a elegibilidade corrente até nova revisão.
A entrada livre no recinto mantém-se independente desta campanha digital.

## Distinção e perfil

A meta inicial é residência validada, cinco adesões elegíveis e participação confirmada.
O administrador pode configurar entre zero e cinco adesões e exigir participação;
os critérios ficam fixos após a primeira inscrição. A participação não pode ser
confirmada antes de 5 de Dezembro de 2026, no fuso Africa/Luanda.

Ao confirmar a última condição, o servidor atribui automaticamente uma distinção única
por pessoa e iniciativa. O perfil mostra iniciativas e total acumulado de distinções.
A visibilidade pública é uma escolha do titular, desligada por defeito; os totais
públicos contam apenas as iniciativas publicadas. Endereço e evidências não são públicos.

Uma distinção conquistada permanece histórica após mudança de residência ou expiração
da evidência. Uma correcção administrativa negativa recalcula a distinção da pessoa
afectada e do seu convidante, com auditoria. Uma revalidação repõe a mesma distinção.
Administradores não podem validar a sua própria residência ou participação.

## Administração e segurança

A área administrativa permite configurar período e capacidade, suspender/encerrar a
campanha, paginar inscrições, verificar residência e confirmar/corrigir participação.
Todas as decisões e atribuições ficam registadas em `social_initiative_audit`.
Tabelas com RLS sem acesso directo do cliente; operações passam por funções com
verificação de identidade, permissões e elegibilidade. Bloqueios de linha serializam
capacidade e quotas. A emissão e consumo reutilizam a infraestrutura de convites existente.

## Instalação e activação

1. Aplicar `supabase/migrations/20261108204823_social_initiatives.sql` depois das
   migrações de convites existentes, primeiro em ambiente de teste.
2. Publicar a função `social-initiatives` com a configuração presente em `config.toml`.
   A função valida o utilizador e executa o RPC com a sessão dele, sem contornar permissões.
3. Compilar com `VITE_SOCIAL_INITIATIVES_ENABLED=true`.
4. No painel administrativo, definir período de inscrições e capacidade e activar.
   A migração deixa a iniciativa em rascunho, sem inventar estes valores.
5. Verificar criação de conta, confirmação por email, inscrição de conta existente,
   validação por outro administrador, cinco convites e distinção no ambiente publicado.

Não foram aplicadas alterações à base de dados de produção nesta implementação.
Os testes locais PGlite exercitam funções SQL e o trigger de consumo de convite;
não substituem testes de concorrência com ligações PostgreSQL independentes nem
um ensaio completo de autenticação, email e AFROLOC no ambiente publicado.

## Dados que continuam por concluir

A feira realiza-se a 5 e 6 de Dezembro de 2026. Conforme solicitado, recinto, horários,
prazo de inscrição e capacidade permanecem por concluir no convite. Antes da activação,
preencher período e capacidade no painel e actualizar as informações públicas.
Confirmar a segunda parcela da restauração (o texto recebido indicava 5 de Novembro,
anterior à primeira parcela de 20 de Novembro) e os períodos dos preços de 5.000 e
15.000 Kz. A inscrição digital não reserva tendas nem processa pagamentos.

O catálogo preliminar contém 32 condomínios, com opção de outra zona. Rever nomes e
perímetros com a administração e gestores antes da abertura. Fontes da pesquisa inicial:
Angocasa, Ree-Gera, Imponente, Pactual Property Fund, Banco Económico e referências
locais do Patriota e do Governo Provincial de Luanda. A lista não prova residência.
Esta primeira interface está em português; a tradução nas dez línguas fica pendente.
