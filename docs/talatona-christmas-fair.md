# Feira de Natal Solidário de Talatona

O rascunho em português está disponível em `/feira-natalicia-talatona` durante o desenvolvimento.
Para revisão num ambiente de pré-visualização, compilar com `VITE_TALATONA_FAIR_PREVIEW=true`.
A escolha do condomínio é temporária. O link AFROLOC abre o serviço sem parâmetros.
A página não recebe inscrições, credenciais, códigos de endereço ou contactos.

## Antes de abrir as inscrições

1. A feira realiza-se a 5 e 6 de Dezembro de 2026, com entrada livre. Por indicação do
   organizador, deixar por concluir o recinto exacto, o horário de cada dia, o prazo
   de inscrição e o limite de participantes.
   O prazo recebido para a segunda parcela da restauração foi 5 de Novembro de 2026 às
   20h00, anterior ao prazo da primeira parcela, 20 de Novembro de 2026. A data da segunda
   parcela fica por confirmar. Confirmar também se os valores de 5.000 Kz e 15.000 Kz
   dos expositores se aplicam por dia ou à reserva completa.
2. Rever o catálogo preliminar com a administração local e os gestores. A lista veio da
   Angocasa, das imobiliárias Ree-Gera e Imponente, do Pactual Property Fund, do
   Banco Económico, de referências locais no Patriota e do Governo Provincial de Luanda.
   O Vale do Talatona está listado no Patriota. A delimitação da Rua do Dangereux
   não comprova a existência ou localização de condomínios no bairro.
3. Definir no servidor a regra de proximidade e confirmar os perímetros que serão usados.
   Quem não vive num condomínio, ou mora num condomínio por cadastrar, pode seguir pela
   regra de proximidade desde que o endereço seja elegível.
4. Integrar o fluxo autorizado de criação ou associação do endereço AFROLOC. O titular
   autoriza a consulta e o servidor confirma titularidade, estado e elegibilidade.
   Uma escolha no formulário ou um código digitado não comprova residência.
   A YAMILOOK recebe apenas a evidência e o resultado necessários para a campanha.
5. Usar uma campanha própria com quota de 5. Confirmar no servidor a elegibilidade
   da pessoa que convida e a do convidado ao aceitar. Aceitar quando existir correspondência
   de condomínio verificado ou proximidade dentro do limite aprovado. Cada pessoa pode
   aderir uma vez. A emissão e o consumo devem ser atómicos e os convites devem expirar.
   Registar a decisão e o estado do convite sem incluir coordenadas, moradas ou documentos
   no histórico apresentado aos participantes.
6. Validar com duas contas de teste e incluir os casos de convite repetido, sexto convite,
   morada fora da área, endereço revogado e falha de comunicação entre serviços.
   Preparar as dez línguas antes de abrir a campanha pública.

As campanhas actuais controlam a quota e o registo YAMILOOK. A inscrição na feira
também precisa de aceitar vizinhos que já têm conta e de validar a residência de
cada convidado. O consumo do código no registo de conta não conclui a inscrição na feira.

## Embaixador Social YAMILOOK

A distinção reconhece metas cumpridas em iniciativas sociais, comunitárias, educativas
ou noutras iniciativas aprovadas pela YAMILOOK. O título aparece no perfil a partir da
primeira distinção válida. Cada iniciativa possui uma insígnia própria, com o nome,
a edição e as metas que a justificam. Cada utilizador recebe essa insígnia uma única vez.
Uma nova edição pode originar outra distinção se for registada como iniciativa própria.

O perfil terá uma área «Iniciativas e impacto social», que aproveita a apresentação
existente de conquistas e insígnias. O titular acompanha as iniciativas em que participa,
o progresso por meta, os prazos, as validações pendentes e as distinções conquistadas.
Cada distinção mostra a iniciativa, a edição, as metas concluídas e a data de atribuição.
A visibilidade pública fica ao critério do titular. Evidências e dados de residência
ficam no processo de validação, com acesso limitado ao titular e aos validadores autorizados.

O total de distinções corresponde ao número de iniciativas diferentes com distinção
válida atribuída à pessoa. O total de iniciativas participadas é apresentado separadamente.
Concluir três metas da mesma iniciativa contribui com uma distinção para o total.
Um prémio ocultado pelo titular mantém-se no total pessoal. A apresentação pública
conta apenas as distinções que o titular escolheu tornar públicas.

### Proposta para a Feira de Natal Solidário de Talatona

As metas sugeridas para revisão pela organização são a confirmação do endereço AFROLOC
do participante, a participação na feira confirmada pela organização e a adesão concluída
de cinco vizinhos elegíveis. Cada vizinho conta uma vez, e apenas para a pessoa cujo convite
aceitou. O próprio participante e os convites ainda pendentes não contam para esta meta.
A conquista é opcional e a participação na feira segue as condições de inscrição.
As metas e o prazo precisam de ser publicados antes da abertura da iniciativa.

### Implementação pendente

Esta alteração acrescenta ao convite a proposta e um exemplo explícito de apresentação
no perfil. A atribuição real, o histórico de iniciativas no perfil e os totais persistentes
dependem da implementação seguinte.

- O administrador cria a iniciativa com metas mensuráveis, unidades, prazos, condições
  de elegibilidade e método de validação. Após a abertura, preservar a versão dos critérios
  aplicável a quem já aderiu, com qualquer correcção registada e comunicada.
- Reutilizar os eventos confirmados de cada módulo. Convites, participação e tarefas
  concluídas precisam de validação na origem. Acções manuais são confirmadas por
  um validador autorizado, diferente do beneficiário.
- Registar adesão e progresso uma vez por pessoa e iniciativa. Atribuir a distinção
  apenas quando todas as metas aplicáveis estiverem cumpridas. Usar uma restrição única
  por utilizador e iniciativa e consumir cada evento de forma idempotente.
- Calcular o total a partir das distinções válidas, respeitando a visibilidade. Uma repetição
  de pedido ou de evento não pode aumentar a contagem. Uma correcção ou revogação fica
  registada e actualiza a distinção existente e o total, sem criar um segundo prémio.
- Proteger a atribuição no servidor e impedir a edição pelo titular. Reutilizar a
  autenticação, as permissões, a auditoria e as componentes de perfil existentes.
- Preparar as dez línguas e testar metas parciais, cumprimento completo, duplicações,
  concorrência, revogação e visibilidade antes da publicação.

## Preparação do endereço no convite

Após escolher o condomínio, a pré-visualização apresenta a etapa de residência.
Quem já tem sessão pode abrir o formulário de residência existente. Guardar esse
formulário actualiza a residência no perfil, sujeito às regras existentes de mudança.
A ligação autorizada ao AFROLOC usa o componente existente e depende da activação
explícita do serviço. A troca de conta reinicia o formulário e a escolha do condomínio.
Visitantes recebem o acesso ao login e orientação para usar o convite YAMILOOK.

A consulta da estrutura de produção em 8 de Novembro de 2026 confirmou a existência
 de residence_declarations e a ausência de afroloc_link_requests. A inscrição da feira,
 a persistência do condomínio e a verificação da sua área continuam pendentes. A edição
 da residência e a observação de um certificado não concluem uma inscrição na feira.
