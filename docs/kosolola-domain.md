# kosolola.com — ligação do domínio

Preparado em 25 de outubro de 2026. Registo mantido na Network Solutions; alojamento no projeto Vercel `yamilook` (`prj_IyDoxFZG3rT1MBfHyZUj58a2UymM`). A aplicação e o backend continuam partilhados com o repositório Yamilook. Domínio próprio não implica infraestrutura, contas ou dados separados.

## Percurso e compatibilidade

- `https://kosolola.com/` redireciona temporariamente (307) para `/papos-app/`, somente neste hostname. A raiz da Yamilook não muda.
- `www.kosolola.com` está associado na Vercel com redirecionamento 308 para `kosolola.com`.
- Mantêm-se `id`, `start_url` e `scope` do manifesto em `/papos-app/`, resolvidos dentro da origem onde a aplicação é instalada. Os ícones e o service worker mantêm os caminhos existentes. Não são necessários dois builds nem um segundo backend.
- A PWA instalada em Yamilook não migra automaticamente. Uma instalação a partir do novo domínio é outra instalação; necessita de autenticação própria, mas usa a mesma conta e histórico do servidor. Não copiar tokens entre origens.
- Registo, recuperação de palavra-passe, termos, privacidade e edição de perfil apontam explicitamente para `https://www.yamilook.com`. Esses serviços continuam centrais. Após concluir essas operações, regressar à KOSOLOLA. Esta etapa não introduz SSO nem recuperação de conta com identidade visual própria.
- Login atual por email/palavra-passe usa o mesmo Supabase. Não foi acrescentado callback OAuth nem ampliada a lista de redirecionamentos Auth. Caso OAuth/OTP por link seja introduzido, configurar e validar URLs exatos por ambiente antes de o ativar.

## DNS confirmado pela Vercel

`get_domain_config` devolveu os seguintes valores recomendados para este projeto/domínio. Reconsultar antes de executar se houver mudança de projeto.

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | @ | 216.198.79.1 |
| A | @ | 64.29.17.1 |
| CNAME | www | 50c664de9fb8d3e0.vercel-dns-017.com |

Os servidores autoritativos observados são `ns99.worldnic.com` e `ns100.worldnic.com`; mantê-los. O valor A observado antes da mudança é `74.91.138.141`. Substituir apenas os registos web incompatíveis em `@` e `www`, depois de rever a zona completa. Preservar MX, SPF, DKIM, DMARC, TXT e outros serviços. Não colocar CNAME no apex. TTL: manter o permitido pelo fornecedor, preferencialmente curto durante a passagem. Não usar encaminhamento mascarado/iframe.

Na Network Solutions: Domains → kosolola.com → DNS → editar A/CNAME. A ligação autenticada à conta é necessária para efetuar e conferir a alteração. A propriedade validada na Vercel não prova que o DNS já aponta para a Vercel ou que o HTTPS já está pronto.

## Ordem de ativação

1. Integrar esta alteração e confirmar o deployment de produção associado ao projeto certo.
2. Conferir na Vercel os dois domínios e os destinos DNS. A associação dos domínios foi efetuada; DNS estava ainda incorreto na consulta posterior.
3. Rever e alterar apenas os registos web na Network Solutions.
4. Confirmar propagação, emissão de certificado e acesso HTTPS aos dois nomes. Verificar `/` → `/papos-app/` → `/papos-app/login` sem sessão, sem regressão em `www.yamilook.com`.
5. Validar manifesto, MIME JavaScript do service worker, ícones, deep links e atualização da PWA. Em conta de teste autorizada, verificar login/logout, histórico, anexos, microfone/câmara, chamadas e recuperação de conta.
6. Testar instalação e retomada em iPhone e Android reais. Build e Vercel Ready não comprovam estes percursos.

## Reversão

Se o deployment falhar antes do DNS, não mudar os registos. Se o DNS já tiver mudado, restaurar os registos web previamente exportados, sem tocar no email. A instalação antiga em Yamilook permanece disponível; não a remover antes de validar a nova. A reversão do DNS não transfere sessões entre origens.
