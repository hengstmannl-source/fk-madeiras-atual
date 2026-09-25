# Validação visual — importação de toras

Em 12/08/2026, foi aberto o diálogo **Importar toras por planilha** no módulo autenticado de Estoque. A revisão confirmou a apresentação do botão de modelo CSV, os campos de data, frete por m³, origem, responsável, arquivo CSV e observações, além das ações de cancelar e importar.

O diálogo mantém os campos em duas colunas quando há espaço e se adapta ao conteúdo sem extravasar os controles. A validação de arquivo inválido será registrada separadamente, sem criar dados de teste no estoque real.

Foi selecionado um CSV de validação com diâmetro zero; o arquivo foi aceito pelo seletor e submetido somente para confirmar a recusa prévia à gravação. Nenhuma tora foi criada por essa verificação.

O retorno apresentou o alerta de recusa e o painel **Corrija a planilha antes de importar**, indicando a linha 2 e o erro de diâmetro não positivo. O diálogo permaneceu aberto com o arquivo selecionado para que a correção possa ser feita sem perda dos dados de cabeçalho.

O feedback de sucesso foi exercitado em teste de interface com um retorno validado do servidor: a tela chama a notificação de sucesso e fecha o diálogo após receber um romaneio sem erros. Essa verificação automatizada evita a criação de uma carga fictícia no estoque real.

Com autorização explícita do utilizador, o fluxo de sucesso também foi validado no navegador com a planilha `importacao_toras_validacao_sucesso.csv`. A aplicação fechou o diálogo, exibiu a notificação **CARGA-120001 criado com 1 tora(s)** e atualizou a listagem com a carga `CARGA-120001` e a plaqueta `VALID-IMPORT-0001`. Essa entrada é real e foi mantida no estoque por autorização do utilizador.
