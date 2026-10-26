# Diagnóstico do feed no próprio aparelho

Este modo é opt-in: acrescentar `?diagnostico=1` ao endereço do feed autenticado. Só estará disponível num deployment que inclua esta alteração. Não constitui uma medição já realizada em produção.

## Recolha

1. No telemóvel físico, abrir o feed autenticado com o parâmetro, usando a rede a avaliar. Anotar separadamente modelo, navegador, Wi-Fi/4G/5G e modo navegador/PWA. O relatório não identifica o aparelho nem consegue comprovar o tipo de rede.
2. Recarregar a página, manter a aplicação em primeiro plano e deslizar até carregar outra página de publicações durante 30 segundos.
3. Tocar em **Guardar relatório** e partilhar o JSON para análise. A aplicação não envia o relatório automaticamente.
4. Repetir três vezes na mesma rede, identificando a primeira execução e as repetições. Repetir no desktop. Não chamar “cache fria” a estas execuções sem limpar/controlar a cache.
5. Retirar o parâmetro para desativar. Nenhuma alteração ao carregamento de anúncios ou imagens é efetuada pelo diagnóstico.

## Interpretação

- `observerStartedMsAfterNavigation` indica quando o componente de diagnóstico, carregado sob pedido, começou a observar. Somar este valor aos tempos relativos da primeira publicação/foto para obter a observação desde a navegação. Não subtrair este arranque ao tempo de abertura do feed.
- A presença de um artigo no viewport e a conclusão de uma imagem são observadas a cada 100 ms. São aproximações DOM; não medem pintura, LCP nem garantem ausência de sobreposição por outros elementos. Uma publicação já presente ao iniciar o observador não tem o instante original reconstruído. `null` significa não observado.
- `resources` contém Resource Timing, categorizado e sem URLs, identificadores, consultas, cabeçalhos ou conteúdo. Os pedidos de posts com cursor são classificados como paginação; a descoberta pelo ordenamento de likes recebe categoria própria. Estes rótulos dependem dos padrões atuais de pedidos.
- Os pedidos a anúncios e posts podem ser comparados na mesma linha temporal. Isto ajuda a verificar se um artigo foi observado antes de um anúncio terminar; não prova causalidade sozinho.
- São exportadas até 1000 entradas disponíveis e dimensões/estado de até 100 imagens presentes no fim. Entradas muito precoces podem ter sido descartadas pelo buffer do navegador. Recursos ainda pendentes ao terminar não aparecem. Não são capturados códigos HTTP, corpos de resposta, retries internos, nem um HAR completo.
- Tamanhos zero podem significar cache ou restrições de Resource Timing entre origens. Não os interpretar como transferência nula. A dimensão natural/renderizada identifica candidatos a imagens excessivas, não prova o custo de transferência.
- `articles` regista contagens observadas, úteis para correlacionar paginação; não identifica publicações. `hiddenDuringCapture` sinaliza uma captura interrompida por segundo plano.
- Os testes automatizados usam dados sintéticos locais. Não comprovam desempenho de rede móvel real.

O relatório permanece em memória até ser guardado localmente ou a página ser fechada/recarregada. A instrumentação acrescenta algum trabalho à sessão de diagnóstico e deve ser considerada ao interpretar resultados.
