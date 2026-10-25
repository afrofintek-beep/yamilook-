# KOSOLOLA e ecossistema AfroFinTek

Estado em 25 de outubro de 2026. Este documento distingue implementação observada, correções deste ramo e dependências por validar. Não constitui certificação de produção.

## Responsabilidades

| Aplicação | Responsabilidade | Regra de integração |
| --- | --- | --- |
| KOSOLOLA | Conversas, contactos e chamadas | Comunicar sem exigir um endereço certificado; partilha de localização apenas por ação explícita |
| Yamilook | Comunidade e perfil atualmente partilhado com KOSOLOLA | Preservar os identificadores e o histórico existentes; sessões locais separadas |
| AFROLOC | Endereços, direitos de utilização e certificação | Autoridade sobre códigos e evidência; declaração, presença GPS e certificação são estados distintos |
| YAMIOO | Descoberta de lugares e ofertas | Encaminhar com contexto autorizado, sem expor endereço privado ou credenciais |
| SUMBA | Comércio | Pedidos e pagamentos pertencem ao serviço comercial; conversar não confirma pagamento |
| NJILA | Mapas e mobilidade | Uma viagem ou chegada não muda a residência nem certifica um endereço |

As responsabilidades de SUMBA/NJILA são requisitos de produto neste documento; os seus percursos completos não foram auditados nesta alteração. A origem em Lingala orienta a identidade, sem limitar o serviço à RDC.

## Evidência consultada

- Yamilook/KOSOLOLA, base `2bdea0dd67211f73147533d752f5b8fe5e417ad7`: `PaposLogin.tsx` usa email/palavra-passe; `app-auth.ts` separa armazenamento local de sessão. O backend configurado é `rfayqekonkovfbkwjjum`.
- Consulta agregada, apenas de leitura, em `auth.users`: 109 contas; zero com telefone em Auth e zero com `phone_confirmed_at`. Não foram extraídos números, emails ou tokens. Isto não prova que nunca tenha existido outra verificação externa; prova que a confirmação nativa exigida pelo novo adaptador ainda não está disponível.
- YAMIOO, `supabase/config.toml`, blob `94abfea685d13f46f7ffce6b275ea304131342d6`: projeto distinto `oltqppftxvhnkzqshsqx`. `verify-otp/index.ts`, blob `81a7d53df7ad7139e8fbe2aa73918cfc956914c5`: OTP personalizado com sessões baseadas em email interno; não é automaticamente Supabase Phone Auth nem identidade comum.
- AFROLOC, repositório acessível `app-builder-buddy-192`: configuração blob `79029c1039256b9f1f0c8df4ce2fbfaed085f124`, projeto `rxhtdejvjgopfseysuhl`; `phone-login/index.ts` implementa OTP personalizado. A correspondência deste repositório com o deployment AFROLOC oficial precisa de confirmação.
- Nesse repositório, `api-v1/index.ts`, blob `93e40504dc2260723bbe54040b9aecc748785567`, não expõe `/partners/certification-status`, embora a Yamilook espere essa rota. Não substituir por pesquisa pública por telefone ou por código: é necessário um contrato autenticado que comprove a relação utilizador/endereço.
- Não foi demonstrada federação de identidade entre estes projetos. Não ativar a expressão “conta única AfroFinTek” na interface até essa ligação ser validada. AFROLOC_2026/NJILA não forneceram os ficheiros de configuração pedidos; SUMBA não foi inspecionada.

## Implementado neste ramo

`afroloc-verify` usa `auth.getUser(token)` e aceita somente o telefone confirmado em Auth. Não usa `profiles.phone_number` ou `user_metadata` como prova de posse. Preserva indicativos internacionais (incluindo +243 RDC, +242 República do Congo e +244 Angola), sem presumir Angola para números locais.

A certificação automática requer endereço já declarado, resposta HTTP bem-sucedida, booleano `certified: true`, código não vazio e correspondência exata com a declaração. Não inventa, reformata ou substitui códigos AFROLOC. A atualização filtra pelo utilizador e pelo código esperado e confirma o registo devolvido antes de indicar sucesso. Erros, resposta malformada, código diferente ou gravação sem registo não certificam. O pedido ao parceiro usa HTTPS, não segue redirecionamentos e tem timeout de 10 segundos.

A interface informa que a consulta envia o telefone confirmado ao AFROLOC e apresenta motivos de falha, mantendo o pedido de validação manual. Nenhuma certificação histórica foi apagada ou revalidada em massa. Os estados anteriores podem requerer auditoria própria; esta correção não prova a sua validade atual.

## Dependências para conta comum e telefone

1. Identificar o serviço de identidade comum e os responsáveis por cada deployment. Definir identificador estável por pessoa e vínculo por aplicação. O número de telefone é um identificador mutável; nunca fundir contas automaticamente apenas por coincidência do número.
2. Associar telefone a contas existentes dentro de uma sessão autenticada, com OTP e tratamento explícito de duplicados, mudança de SIM/número, recuperação e revogação. Preservar IDs de mensagens e contactos. Manter acesso anterior durante a transição.
3. Configurar fornecedor SMS e testar entrega/custos/cobertura para RDC, Angola e restantes mercados; limites de tentativas, intervalo de reenvio, expiração, consumo único e proteção contra enumeração. Não copiar o OTP personalizado de outra aplicação sem auditoria.
4. Se houver federação, utilizar um protocolo de autenticação documentado e tokens com emissor, destinatário e validade verificados. Nunca copiar sessões entre domínios nem transportar tokens/telefones em URLs de navegação.
5. Confirmar o endpoint parceiro AFROLOC, autenticação entre serviços, autorização do titular e esquema de resposta. Adicionar emissão, expiração, revogação e identificação da evidência antes de usar certificação como garantia duradoura. Não declarar o regex local de entrada como validador oficial de endereço.
6. Definir links entre aplicações com destinos autorizados, retorno ao contexto original e indicação de mudança de aplicação. KOSOLOLA continua uma PWA em `/papos-app/`, não um domínio independente.

## Privacidade e adaptação local

Localização para conversa, residência declarada e endereço certificado não se substituem. Pedidos GPS devem ser explícitos e a ausência de GPS/endereço não deve impedir mensagens. Arredondar para uma célula de 10 m reduz precisão mas não anonimiza uma localização residencial.

Partilha temporária/revogável exige autorização no servidor, prazo e revogação efetivos; um texto ou coordenada enviados na conversa não passam a ter essas propriedades por usar a marca AFROLOC. Não anunciar esse controlo até existir implementação e testes.

A RDC usa país CD e indicativo +243; não confundir com CG/+242. Validar português, francês, inglês e Lingala com revisão linguística, sem traduzir nomes de pessoas ou códigos de endereço. A presença de Lingala na lista de idiomas não demonstra cobertura completa de traduções. Requisitos de conectividade fraca: reenvio sem duplicação, estado de envio explícito e retomada após interrupção.

## Critérios de validação e publicação

- Testes automatizados da fronteira de certificação: identidade não confirmada, dados editáveis, falha do parceiro, booleano inválido, código divergente, falha de persistência e preservação de indicativos.
- Testes de declaração existente: confirmar mais tarde sem GPS e não tratar declaração como certificado.
- Compilação frontend não valida a Edge Function alojada. Publicar `afroloc-verify` no Supabase é um passo separado da integração/Vercel; não realizado neste ramo.
- Antes da ativação: duas contas autorizadas com telefone confirmado, endereço legítimo, parceiro real, rejeição de acesso alheio e certificação revogada/expirada. Não usar dados reais de terceiros como fixtures.
- Testar iPhone e Android instalados, sessão expirada, perda de rede, entrada por telefone, ligação às outras aplicações e recuperação sem perda do histórico. Testes locais e estados Vercel não substituem estas provas.

Resultado desta etapa: fronteira de certificação reforçada e dependências identificadas. Conta única, SMS universal, domínio próprio e partilha AFROLOC revogável ainda não estão implementados.
