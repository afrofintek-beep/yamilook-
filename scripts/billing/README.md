# Integrações de facturação em ensaio
Aplicar as duas migrações billing por ordem num projecto Supabase de ensaio. Entrar com uma conta convidada em Carteira → Negócios → Facturação de teste.

## Emissão
O consumidor do motor certificado lê billing_fiscal_requests em pending e associa o emissor pelo NIF da venda. Usar sale_id como chave idempotente. Antes de repetir uma submissão consultar o motor pela mesma referência. Guardar provider_document e accepted apenas após aceitação pelo motor de ensaio. O formato de submissão, a série, os códigos fiscais e os campos de identificação do adquirente dependem do contrato de homologação. Nunca encaminhar vendas do piloto à produção.

## Contabilidade
O diário em JSON usa papéis de contas. O contabilista deve mapeá-los para as contas do negócio no ERP e integrar os restantes movimentos do exercício. Para verificar o XML emitido pelo ERP, instalar lxml e executar python scripts/billing/validate_saft.py ficheiro.xml esquema-oficial.xsd. O XSD deve provir do pacote oficial da versão alvo. A validação estrutural não testa saldos de abertura nem completude do exercício.

## Cobranças
MASSA representa kwanzas. Os movimentos virtuais KUMBU ficam fora dos recebimentos monetários. Em AppyPay, o criador de cobranças de confiança insere em billing_collection_links a venda, provider appypay, a chave do comerciante, o UUID da charge de sandbox e o valor em cêntimos. Um consumidor de eventos pode invocar python scripts/billing/reconcile_appypay.py UUID com APPYPAY_SANDBOX_TOKEN, APPYPAY_SANDBOX_MERCHANT, BILLING_SANDBOX_SUPABASE_URL e BILLING_SANDBOX_SERVICE_KEY no servidor. Configurar token e identificador do mesmo comerciante. Confirmar a resposta GET com credenciais de ensaio, incluindo currency AOA. Divergências ficam pendentes. O consumidor de eventos, o provisionamento de credenciais e o tratamento de reembolsos e comissões aguardam integração.

## Impostos
A referência de teste e o montante são introduzidos pelo operador. A acção de pagamento grava o pedido. O futuro conector de tesouraria deve confirmar NIF, referência, montante e estado com o canal autorizado antes de gravar confirmed_at e confirmed_reference com privilégio de servidor. O pedido não movimenta fundos.

## Aplicações do ecossistema
Em ensaio, provisionar billing_app_access para uma identidade de servidor autenticada por aplicação, com comerciante, NIF e permissão de criação explícitos. Nunca distribuir a chave service_role às aplicações. SUMBA chama o RPC billing_open_order com uma referência de encomenda estável. A mesma referência com os mesmos dados devolve o mesmo UUID e pedido fiscal. Partilhar o UUID com aplicações autorizadas e consultar billing_order_balance. O acesso ao saldo é opcional. NJILA e AFROLOC podem receber apenas a referência logística sem acesso financeiro. Provisionar novos produtos apenas para os comerciantes e operações acordados.
