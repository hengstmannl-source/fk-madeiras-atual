import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type LinhaMargemParaExportacao = {
  numero: string | null;
  clienteNome: string | null;
  vendedor: string | null;
  createdAt: Date | string;
  subtotal: number;
  abatimentoFrete: number;
  comissao: number;
  totalTaxas: number;
  valorLiquido: number;
  margemPercentual: number;
  taxas: Array<{ descricao: string; tipo: "percentual" | "fixo"; valor: string | number; calculado: string | number }>;
};

export type FiltrosMargemParaExportacao = {
  busca: string;
  dataInicial: string;
  dataFinal: string;
  vendedor: string;
  tipoTaxa: string;
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function dataBr(data: Date | string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function filtrosTexto(filtros: FiltrosMargemParaExportacao) {
  const valores: string[] = [];
  if (filtros.busca.trim()) valores.push(`Pesquisa: ${filtros.busca.trim()}`);
  if (filtros.dataInicial) valores.push(`De: ${dataBr(`${filtros.dataInicial}T12:00:00`)}`);
  if (filtros.dataFinal) valores.push(`Até: ${dataBr(`${filtros.dataFinal}T12:00:00`)}`);
  if (filtros.vendedor) valores.push(`Vendedor: ${filtros.vendedor}`);
  if (filtros.tipoTaxa === "percentual") valores.push("Taxa: percentual");
  if (filtros.tipoTaxa === "fixo") valores.push("Taxa: valor fixo");
  if (filtros.tipoTaxa === "sem_taxa") valores.push("Sem taxa adicional");
  return valores.length ? valores.join(" · ") : "Sem filtros adicionais";
}

export function linhasMargemParaPlanilha(vendas: LinhaMargemParaExportacao[]) {
  return vendas.map((venda) => ({
    "Venda": venda.numero ?? `Venda #${venda.clienteNome ?? ""}`,
    "Cliente": venda.clienteNome ?? "Cliente não localizado",
    "Vendedor": venda.vendedor?.trim() || "Não informado",
    "Data": dataBr(venda.createdAt),
    "Subtotal (R$)": venda.subtotal,
    "Frete abatido (R$)": venda.abatimentoFrete,
    "Comissão (R$)": venda.comissao,
    "Taxas adicionadas (R$)": venda.totalTaxas,
    "Valor final (R$)": venda.valorLiquido,
    "Margem (%)": venda.margemPercentual,
    "Taxas aplicadas": venda.taxas.length
      ? venda.taxas.map((taxa) => `${taxa.descricao} (${taxa.tipo === "fixo" ? "R$ fixo" : "%"}): ${moeda.format(Number(taxa.calculado))}`).join(" · ")
      : "Sem taxa adicional",
  }));
}

/** Gera o PDF do relatório usando exatamente a mesma lista filtrada que está visível na tela. */
export async function exportarRelatorioMargemPdf(input: {
  vendas: LinhaMargemParaExportacao[];
  filtros: FiltrosMargemParaExportacao;
}) {
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await documento.embedFont(StandardFonts.HelveticaBold);
  const largura = 842;
  const altura = 595;
  const margem = 32;
  const larguraUtil = largura - margem * 2;
  const colunas = [76, 122, 100, 70, 84, 84, 84, 92, 74];
  const inferior = 54;
  let pagina!: ReturnType<typeof documento.addPage>;
  let y = 0;
  const somas = input.vendas.reduce((total, venda) => ({
    subtotal: total.subtotal + venda.subtotal,
    frete: total.frete + venda.abatimentoFrete,
    comissao: total.comissao + venda.comissao,
    taxas: total.taxas + venda.totalTaxas,
    final: total.final + venda.valorLiquido,
  }), { subtotal: 0, frete: 0, comissao: 0, taxas: 0, final: 0 });
  const larguraTexto = (texto: string, tamanho: number) => fonte.widthOfTextAtSize(texto, tamanho);
  const truncar = (texto: string, limite: number, tamanho = 7) => {
    if (larguraTexto(texto, tamanho) <= limite) return texto;
    let resultado = texto;
    while (resultado.length > 1 && larguraTexto(`${resultado}…`, tamanho) > limite) resultado = resultado.slice(0, -1);
    return `${resultado}…`;
  };
  const escrever = (texto: string, x: number, posicaoY: number, tamanho = 7, negrito = false, cor = rgb(0.13, 0.16, 0.18)) => {
    pagina.drawText(texto, { x, y: posicaoY, size: tamanho, font: negrito ? fonteNegrito : fonte, color: cor });
  };
  const rodape = () => {
    pagina.drawLine({ start: { x: margem, y: 38 }, end: { x: largura - margem, y: 38 }, thickness: 0.45, color: rgb(0.72, 0.76, 0.73) });
    escrever("FK Madeiras — Acerto comercial por venda", margem, 23, 7, false, rgb(0.35, 0.4, 0.42));
    const paginaTexto = `Página ${documento.getPageCount()}`;
    escrever(paginaTexto, largura - margem - larguraTexto(paginaTexto, 7), 23, 7, false, rgb(0.35, 0.4, 0.42));
  };
  const cabecalhoTabela = () => {
    pagina.drawRectangle({ x: margem, y: y - 14, width: larguraUtil, height: 18, color: rgb(0.08, 0.28, 0.20) });
    ["Venda", "Cliente", "Vendedor", "Data", "Subtotal", "Frete", "Comissão", "Taxas +", "Final"].forEach((titulo, indice) => {
      const x = margem + colunas.slice(0, indice).reduce((soma, coluna) => soma + coluna, 0) + 4;
      escrever(titulo, x, y - 7, 7, true, rgb(1, 1, 1));
    });
    y -= 23;
  };
  const novaPagina = (inicial: boolean) => {
    pagina = documento.addPage([largura, altura]);
    y = altura - 38;
    escrever("FK MADEIRAS", margem, y, 15, true, rgb(0.08, 0.28, 0.20));
    escrever(inicial ? "ACERTO COMERCIAL POR VENDA" : "ACERTO COMERCIAL POR VENDA — CONTINUAÇÃO", margem, y - 19, 10, true);
    if (inicial) {
      escrever(`Emitido em ${dataBr(new Date())}`, margem, y - 33, 7.5, false, rgb(0.35, 0.4, 0.42));
      escrever(`Filtros: ${truncar(filtrosTexto(input.filtros), larguraUtil, 7.5)}`, margem, y - 45, 7.5, false, rgb(0.35, 0.4, 0.42));
      y -= 64;
    } else y -= 42;
    rodape();
    cabecalhoTabela();
  };

  novaPagina(true);
  input.vendas.forEach((venda, indice) => {
    if (y - 18 < inferior) novaPagina(false);
    if (indice % 2 === 0) pagina.drawRectangle({ x: margem, y: y - 11, width: larguraUtil, height: 17, color: rgb(0.965, 0.975, 0.965) });
    const valores = [
      venda.numero ?? "—", venda.clienteNome ?? "Cliente não localizado", venda.vendedor?.trim() || "—", dataBr(venda.createdAt),
      moeda.format(venda.subtotal), `− ${moeda.format(venda.abatimentoFrete)}`, `− ${moeda.format(venda.comissao)}`,
      `+ ${moeda.format(venda.totalTaxas)}`, moeda.format(venda.valorLiquido),
    ];
    valores.forEach((valor, coluna) => {
      const x = margem + colunas.slice(0, coluna).reduce((soma, larguraColuna) => soma + larguraColuna, 0) + 4;
      escrever(truncar(valor, colunas[coluna] - 8), x, y - 1);
    });
    y -= 17;
  });
  if (y - 32 < inferior) novaPagina(false);
  pagina.drawLine({ start: { x: margem, y: y - 2 }, end: { x: margem + larguraUtil, y: y - 2 }, thickness: 0.6, color: rgb(0.6, 0.65, 0.62) });
  escrever(`${input.vendas.length} venda(s) · Subtotal: ${moeda.format(somas.subtotal)} · Frete: − ${moeda.format(somas.frete)} · Comissão: − ${moeda.format(somas.comissao)}`, margem, y - 15, 7.5, true);
  const totais = `Taxas: + ${moeda.format(somas.taxas)} · Final: ${moeda.format(somas.final)}`;
  escrever(totais, largura - margem - fonteNegrito.widthOfTextAtSize(totais, 7.5), y - 15, 7.5, true, rgb(0.08, 0.28, 0.20));
  const bytes = await documento.save();
  const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { url: URL.createObjectURL(new Blob([dados], { type: "application/pdf" })), nomeArquivo: `acerto-comercial-vendas-${new Date().toISOString().slice(0, 10)}.pdf` };
}
