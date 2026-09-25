# Validação visual de relatórios PDF

## 18/08/2026 — Produção Diária

A página de Produção carregou com dois romaneios diários reais, cada um com ação **PDF**, confirmando que há documentos disponíveis para o fluxo de pré-visualização. A lista exibe os volumes de toras, a contagem de peças e o rendimento por romaneio. A validação funcional automatizada cobre a abertura do diálogo e a confirmação do download; a renderização da grade compacta é coberta pelo cenário de múltiplas toras e peças no teste do gerador PDF.

Ao acionar **PDF** no romaneio `ROM-120001`, o navegador abriu um diálogo modal com o título do romaneio, a mensagem de conferência, a área de visualização integrada e os controles separados **Voltar** e **Confirmar download**. Nenhum download foi iniciado ao abrir a prévia.

Após o carregamento, o visualizador integrado exibiu o romaneio em **duas páginas**. A primeira permanece dedicada às toras, e a segunda reúne a nova grade de peças por bitola com a consolidação prevista, mantendo o comando de download separado da visualização. O diálogo foi fechado pelo botão **Voltar**, sem baixar o arquivo.

Na nova validação do leitor ampliado com o romaneio `ROM-120001`, o diálogo ocupou a área de leitura corretamente e não mostrou miniaturas. Contudo, a renderização permaneceu em carregamento, com contador `— / —` e sem desenhar a página. A publicação ficará bloqueada até corrigir a inicialização do renderizador no navegador.

Na sequência, o leitor foi migrado para as entradas modernas de PDF e trabalhador web compatível. A página de Produção continua oferecendo o romaneio `ROM-120001` pela ação **PDF**; a abertura final após a troca da biblioteca ainda será validada antes da publicação.

O leitor foi então reestruturado para carregar o documento uma única vez e redesenhar somente a página selecionada após a área de leitura estar dimensionada. A validação seguirá usando a página de Produção do ambiente de desenvolvimento e a ação **PDF** do romaneio `ROM-120001`.

O renderizador em canvas continuou a concluir apenas parcialmente a primeira página em documentos reais. Ele foi removido em favor do leitor nativo do navegador, agora dentro de um diálogo quase integral, com o painel de miniaturas desativado e a opção adicional **Abrir em tela cheia**. Isso preserva a fidelidade do PDF e elimina a etapa instável de conversão para canvas.

Na validação seguinte do romaneio real `ROM-120001`, o leitor nativo carregou corretamente no diálogo amplo: o documento ocupou a área central, sem painel de miniaturas, e a primeira página pôde ser lida em tamanho útil. A conversão para canvas deixou de fazer parte do fluxo. A navegação interna das páginas é fornecida pelo visualizador do próprio navegador, mantendo o PDF fiel ao arquivo baixado.

Na validação posterior da lista de Produção, os rendimentos dos romaneios `ROM-120001` e `ROM-090001` foram exibidos como `64%` e `62%`, respectivamente, confirmando a apresentação sem casas decimais nos percentuais de tabela.

Na pré-visualização do `ROM-120001`, o leitor nativo amplo carregou o documento e apresentou a primeira página com o cabeçalho e as toras serradas. O indicador de aproveitamento também apareceu arredondado como `64%`.
