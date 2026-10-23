# Papos — aplicação independente (MVP)

Entrada: https://www.yamilook.com/papos-app/
Instalação: https://www.yamilook.com/papos-app/install

O Papos tem uma entrada Vite, manifesto, ícones, router e service worker próprios.
O `id`, `start_url` e `scope` são `/papos-app/`, distintos do manifesto Yamilook `/`.
O motor de mensagens, contactos, presença e chamadas é reutilizado, sem duplicar contas,
conversas, participantes, anexos, políticas RLS ou dados de produção.
O mesmo utilizador pode conversar entre Papos e Yamilook. O Papos usa uma chave local
de sessão própria e pede autenticação na primeira entrada. Uma instalação iOS nova pode
pedir autenticação novamente; isso não cria uma segunda conta nem um histórico novo.

## Experiência

- Navegação própria: Papos, Contactos, Chamadas e Definições.
- Mensagens, grupos, anexos e estados usam os componentes comuns existentes.
- Perfis próprios com ligação explícita ao perfil e Muxi da Yamilook.
- Inscrição, recuperação de palavra-passe e edição do perfil permanecem no serviço
  central Yamilook. A inscrição por convite e os dados obrigatórios são preservados.
- As preferências de privacidade são comuns à conta e dizem-no na interface.
- Links de convite criados no Papos conservam o prefixo `/papos-app/join/`.
- O ícone pode ser instalado separadamente da Yamilook no ecrã principal.

Sair no Papos revoga apenas a sua sessão local. A ação global de saída da conta na
Yamilook mantém o comportamento anterior e pode revogar sessões noutros dispositivos.

## Cache e atualizações

O build segue apenas as dependências do entry Papos para preparar o shell offline.
O worker só interceta navegações `/papos-app/` e assets estáticos do mesmo domínio.
Não guarda respostas Supabase, tokens, mensagens, contactos, URLs assinados ou anexos.
O modo offline abre o shell; envio e leitura atualizada continuam dependentes de rede.
O rascunho em memória permanece nos envios falhados, como no motor comum atual.

Os caches `papos-app-assets-*` são separados dos caches Yamilook. A recuperação de
chunks só remove o worker e os caches da aplicação escolhida. São retidas duas gerações
Papos de assets para permitir transições de versão sem apagar os chunks da janela aberta.
Uma atualização é apresentada ao utilizador; não força a interrupção de chamadas para recarregar.

## Verificação da entrega

- Instalação: um manifesto por HTML, ícones PNG 192/512, scopes e identidades distintos.
- Routing: `/papos-app/chat/:id`, contactos, chamadas, perfil, definições e convites.
- Autenticação: mantém o destino da conversa ao pedir login; usa a conta existente;
  conserva a verificação do onboarding e não revela mensagens antes de autenticar.
- Regressão: navegação Yamilook continua com cinco destinos; Papos usa quatro.
- Worker: fallback offline próprio, assets do mensageiro, sem captura de APIs privadas.
- Produção: verificar HTML, manifesto, JS do worker e imagens com os MIME corretos,
  além da publicação Vercel e do login/instalação no browser.

## Etapas seguintes

1. Testes reais de imagem, som, chamadas e sincronização com dois dispositivos e duas contas.
2. Web Push e chamadas recebidas com a app fechada, com permissões e entrega verificadas.
3. Fila offline de mensagens e recuperação de sessão por dispositivo, com política de retenção.
4. Desenho, implementação e auditoria de encriptação de ponta a ponta e gestão de chaves.
5. Targets nativos Papos Android/iOS, credenciais de assinatura, push nativo e publicação nas lojas.

Este MVP não declara encriptação de ponta a ponta nem equivalência de segurança ao Signal.
Não publica aplicações nas lojas nem assume notificações com a aplicação encerrada.
