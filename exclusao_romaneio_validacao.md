# Validação da exclusão de romaneio de carga

Em 12/08/2026, foi criada uma carga temporária autorizada, identificada como `CARGA-150001`, contendo a plaqueta `TEMP-EXCL-0001` disponível em estoque.

Pela tela de Estoque, o controle de exclusão abriu um diálogo de confirmação que identificava a carga e informava que a ação removeria somente plaquetas ainda disponíveis, preservando as já usadas na produção. Após a confirmação, a aplicação exibiu a mensagem `CARGA-150001 excluído com 1 plaqueta(s) removida(s)` e atualizou a listagem sem recarregamento manual: a carga e a plaqueta deixaram de aparecer, e os indicadores voltaram a 4 cargas e 95 toras disponíveis.
