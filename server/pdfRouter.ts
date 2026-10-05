import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";
import { dataCalendarioValida } from "../shared/validacaoData";
import { getRelatorioRomaneiosCarga } from "./db";
import { getEmpresaUnica, getEmpresaConfiguracao, getOrcamentoWithItems, getRomaneioCargaComPlaquetas, getRomaneioProducaoComItens, getUserById, listClientes } from "./db";
import { COOKIE_SESSAO_LOCAL, lerSessaoLocal } from "./autenticacao-local";
import { storageGetSignedUrl } from "./storage";
import { etiquetaPlaqueta } from "../shared/plaquetas";
import { calcularAproveitamentoPorEssencia } from "../shared/aproveitamentoPorEssencia";
import { resumirPecasPdfPorEssencia, type GrupoBitolaPdfProducao, type ResumoEssenciaPdfProducao } from "./pdf.producao.logic";

const A4: [number, number] = [595, 842];
const MARGEM_LATERAL = 48;
const LIMITE_INFERIOR_CONTEUDO = 66;
const COR_MARROM = rgb(0.22, 0.16, 0.08);
const COR_TEXTO_SECUNDARIO = rgb(0.35, 0.35, 0.35);
const COR_CINZA_CLARO = rgb(0.55, 0.55, 0.55);
const COR_LINHA = rgb(0.72, 0.67, 0.58);

function formatBRL(value: string | number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0,00";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function formatDimensionCm(valueInMillimeters: string | number | null | undefined): string {
  const num = Number(valueInMillimeters);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num / 10);
}

function formatMeasurement(value: string | number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(num);
}

function formatPercentage(value: string | number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(num);
}

function formatDate(value: Date | string | null | undefined, utc = false): string {
  if (!value) return "Não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informada";
  return date.toLocaleDateString("pt-BR", utc ? { timeZone: "UTC" } : undefined);
}

function formatFormaPagamento(formaPagamento?: string | null): string {
  const formas: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito",
    transferencia: "Transferência bancária",
    boleto: "Boleto",
    outro: "Outro",
  };
  return formas[formaPagamento ?? ""] ?? "Não informada";
}

function normalizarTexto(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function larguraTexto(font: any, texto: string, tamanho: number): number {
  if (typeof font?.widthOfTextAtSize === "function") return font.widthOfTextAtSize(texto, tamanho);
  return texto.length * tamanho * 0.52;
}

function resumirVolumePorEssencia(plaquetas: Array<{ madeiraNome?: unknown; volumeInicial?: string | number | null }>) {
  const porEssencia = new Map<string, { essencia: string; volume: number }>();

  for (const plaqueta of plaquetas) {
    const essencia = normalizarTexto(plaqueta.madeiraNome) || "Essência não informada";
    const chave = essencia.toLocaleUpperCase("pt-BR");
    const volume = Number(plaqueta.volumeInicial);
    if (!Number.isFinite(volume)) continue;

    const atual = porEssencia.get(chave);
    if (atual) atual.volume += volume;
    else porEssencia.set(chave, { essencia, volume });
  }

  return Array.from(porEssencia.values()).sort((a, b) => a.essencia.localeCompare(b.essencia, "pt-BR"));
}

/** Encurta conteúdo de célula antes de desenhá-lo, evitando invadir a coluna seguinte. */
function truncarTexto(font: any, texto: unknown, larguraMaxima: number, tamanho: number): string {
  const original = normalizarTexto(texto) || "—";
  if (larguraTexto(font, original, tamanho) <= larguraMaxima) return original;

  let resultado = original;
  while (resultado.length > 1 && larguraTexto(font, `${resultado}…`, tamanho) > larguraMaxima) resultado = resultado.slice(0, -1);
  return resultado.length ? `${resultado}…` : "…";
}

function quebrarTexto(font: any, texto: unknown, larguraMaxima: number, tamanho: number): string[] {
  const conteudo = normalizarTexto(texto);
  if (!conteudo) return [];
  const palavras = conteudo.split(" ");
  const linhas: string[] = [];
  let linha = "";

  const adicionarPalavraLonga = (palavra: string) => {
    let restante = palavra;
    while (restante && larguraTexto(font, restante, tamanho) > larguraMaxima) {
      let limite = restante.length - 1;
      while (limite > 1 && larguraTexto(font, `${restante.slice(0, limite)}-`, tamanho) > larguraMaxima) limite -= 1;
      linhas.push(`${restante.slice(0, limite)}-`);
      restante = restante.slice(limite);
    }
    return restante;
  };

  for (const palavraOriginal of palavras) {
    const palavra = adicionarPalavraLonga(palavraOriginal);
    const candidata = linha ? `${linha} ${palavra}` : palavra;
    if (linha && larguraTexto(font, candidata, tamanho) > larguraMaxima) {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = candidata;
    }
  }
  if (linha) linhas.push(linha);
  return linhas;
}

function desenharTextoAjustado(page: any, font: any, texto: unknown, x: number, y: number, larguraMaxima: number, tamanho: number, opcoes: Record<string, unknown> = {}) {
  page.drawText(truncarTexto(font, texto, larguraMaxima, tamanho), { x, y, size: tamanho, font, ...opcoes });
}

async function getEmpresaPdfAtiva(req: any, res: any): Promise<number | null> {
  try {
    let user: { id: number } | null = null;
    const sessao = lerSessaoLocal(req.headers?.cookie?.split(";").map((parte: string) => parte.trim()).find((parte: string) => parte.startsWith(`${COOKIE_SESSAO_LOCAL}=`))?.slice(COOKIE_SESSAO_LOCAL.length + 1));
    if (sessao) user = (await getUserById(sessao.usuarioId)) ?? null;
    if (user) return (await getEmpresaUnica()).id;
  } catch {
    // A mesma resposta é usada para sessão ausente ou inválida.
  }
  res.status(401).json({ error: "Autenticação necessária para aceder a este documento" });
  return null;
}

/** Mantém o documento inline para a pré-visualização e usa anexo somente após confirmação do utilizador. */
function responderPdf(req: any, res: any, bytes: Uint8Array, nomeArquivo: string) {
  const baixar = String(req.query?.download ?? "") === "1";
  const nomeSeguro = nomeArquivo.replace(/[\\"\r\n]/g, "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${baixar ? "attachment" : "inline"}; filename="${nomeSeguro}"`);
  res.send(Buffer.from(bytes));
}

async function loadCompanyLogo(pdfDoc: PDFDocument, empresaId: number) {
  const configuracao = await getEmpresaConfiguracao();
  if (!configuracao?.logoKey || !configuracao.logoMimeType) return undefined;

  try {
    const signedUrl = await storageGetSignedUrl(configuracao.logoKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`Falha ao obter logótipo (${response.status})`);
    const image = await response.arrayBuffer();
    return configuracao.logoMimeType === "image/png"
      ? await pdfDoc.embedPng(image)
      : await pdfDoc.embedJpg(image);
  } catch (error) {
    console.warn("[PDF] Não foi possível incluir o logótipo da empresa:", error);
    return undefined;
  }
}

type LayoutPdf = ReturnType<typeof criarLayoutPdf>;

/**
 * Mantém uma área de conteúdo segura: cada página recebe cabeçalho e rodapé
 * próprios, e nenhum bloco é desenhado dentro da área reservada do rodapé.
 */
function criarLayoutPdf(pdfDoc: any, font: any, boldFont: any, logo: any, tituloDocumento: string) {
  const largura = A4[0];
  const altura = A4[1];
  const logoDimensoes = logo?.scaleToFit?.(108, 50);
  let page: any;
  let y = 0;

  const rodape = () => {
    const numeroPagina = typeof pdfDoc.getPageCount === "function" ? pdfDoc.getPageCount() : 1;
    page.drawLine({
      start: { x: MARGEM_LATERAL, y: 50 },
      end: { x: largura - MARGEM_LATERAL, y: 50 },
      thickness: 0.45,
      color: rgb(0.86, 0.84, 0.79),
    });
    page.drawText("FK Madeiras — Documento gerado eletronicamente", { x: MARGEM_LATERAL, y: 35, size: 7.5, font, color: COR_CINZA_CLARO });
    const pagina = `Página ${numeroPagina}`;
    page.drawText(pagina, { x: largura - MARGEM_LATERAL - larguraTexto(font, pagina, 7.5), y: 35, size: 7.5, font, color: COR_CINZA_CLARO });
  };

  const cabecalho = (continuacao: boolean) => {
    if (logoDimensoes) {
      page.drawImage(logo, {
        x: MARGEM_LATERAL,
        y: altura - 50 - logoDimensoes.height,
        width: logoDimensoes.width,
        height: logoDimensoes.height,
      });
    }
    const xTitulo = logoDimensoes ? MARGEM_LATERAL + logoDimensoes.width + 14 : MARGEM_LATERAL;
    page.drawText("FK MADEIRAS", { x: xTitulo, y: altura - 55, size: 21, font: boldFont, color: COR_MARROM });
    desenharTextoAjustado(
      page,
      font,
      continuacao ? `${tituloDocumento} — continuação` : tituloDocumento,
      xTitulo,
      altura - 72,
      largura - xTitulo - MARGEM_LATERAL,
      9.5,
      { color: rgb(0.4, 0.4, 0.4) },
    );
  };

  const novaPagina = (continuacao = true) => {
    page = pdfDoc.addPage(A4);
    cabecalho(continuacao);
    rodape();
    y = altura - 110;
  };

  const garantirEspaco = (alturaNecessaria: number) => {
    if (y - alturaNecessaria < LIMITE_INFERIOR_CONTEUDO) novaPagina(true);
  };

  const escreverParagrafo = (texto: unknown, x: number, larguraMaxima: number, tamanho = 8.5, opcoes: Record<string, unknown> = {}, alturaLinha = tamanho + 4) => {
    const linhas = quebrarTexto(font, texto, larguraMaxima, tamanho);
    for (const linha of linhas) {
      garantirEspaco(alturaLinha);
      page.drawText(linha, { x, y, size: tamanho, font, ...opcoes });
      y -= alturaLinha;
    }
    return linhas.length;
  };

  novaPagina(false);
  return {
    get page() { return page; },
    get y() { return y; },
    get width() { return largura; },
    get height() { return altura; },
    get bottom() { return LIMITE_INFERIOR_CONTEUDO; },
    setY: (novoY: number) => { y = novoY; },
    mover: (distancia: number) => { y -= distancia; },
    garantirEspaco,
    temEspaco: (alturaNecessaria: number) => y - alturaNecessaria >= LIMITE_INFERIOR_CONTEUDO,
    novaPagina,
    escreverParagrafo,
  };
}

export function desenharRelatorioRomaneiosCarga(
  pdfDoc: PDFDocument, font: any, boldFont: any, logo: any,
  dados: Awaited<ReturnType<typeof getRelatorioRomaneiosCarga>>,
  filtros: { dataInicial?: string; dataFinal?: string; origem?: string; ids?: number[] },
) {
  const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Relatório de romaneios de carga");
  const largura = layout.width - MARGEM_LATERAL * 2;
  const escrever = (texto: string, destaque = false) => layout.escreverParagrafo(texto, MARGEM_LATERAL, largura, 9, destaque ? { font: boldFont, color: COR_MARROM } : {}, 15);
  const dataFiltro = (data?: string) => data ? data.split("-").reverse().join("/") : "Sem limite";
  escrever(`Período considerado: ${dataFiltro(filtros.dataInicial)} a ${dataFiltro(filtros.dataFinal)}`);
  escrever(`Origem pesquisada: ${filtros.origem || "Todas"}`);
  escrever(filtros.ids ? "Escopo: romaneios selecionados que correspondem aos filtros." : "Escopo: todos os romaneios dos resultados filtrados.");
  escrever("Volumes de entrada das plaquetas (volume inicial), independentemente do consumo posterior.");
  layout.mover(10);
  escrever(`ROMANEIOS INCLUÍDOS (${dados.cargas.length})`, true);
  for (const carga of dados.cargas) {
    escrever(`${carga.numero} | ${formatDate(carga.dataCarga, true)} | Origem: ${carga.origem || "Não informada"}`);
  }
  layout.mover(12);
  const cabecalho = () => {
    layout.garantirEspaco(45);
    escrever("TOTAIS POR ESSÊNCIA", true);
    desenharTextoAjustado(layout.page, boldFont, "Essência", MARGEM_LATERAL, layout.y, 280, 9);
    desenharTextoAjustado(layout.page, boldFont, "Toras/plaquetas", 340, layout.y, 95, 9);
    desenharTextoAjustado(layout.page, boldFont, "Volume (m³)", 450, layout.y, 97, 9);
    layout.mover(19);
  };
  cabecalho();
  for (const item of dados.essencias) {
    const linhas = quebrarTexto(font, item.essencia, 280, 9);
    for (let indice = 0; indice < linhas.length; indice++) {
      if (!layout.temEspaco(18)) { layout.novaPagina(true); cabecalho(); }
      layout.page.drawText(linhas[indice], { x: MARGEM_LATERAL, y: layout.y, size: 9, font });
      if (indice === 0) {
        layout.page.drawText(String(item.quantidade), { x: 340, y: layout.y, size: 9, font });
        desenharTextoAjustado(layout.page, font, formatMeasurement(item.volume), 450, layout.y, 97, 9);
      }
      layout.mover(18);
    }
  }
  layout.garantirEspaco(45);
  layout.mover(10);
  escrever(`TOTAL GERAL: ${dados.totalPlaquetas} toras/plaquetas | ${formatMeasurement(dados.volumeTotal)} m³`, true);
}

export async function registerPdfRoutes(app: any) {
  app.get("/api/pdf/relatorio-romaneios-carga", async (req: any, res: any) => {
    try {
      const empresaId = await getEmpresaPdfAtiva(req, res);
      if (!empresaId) return;
      const dataSchema = z.string().refine(dataCalendarioValida, "Data inválida").optional();
      const parametros = z.object({
        dataInicial: dataSchema, dataFinal: dataSchema,
        origem: z.string().trim().max(200).optional(),
        ids: z.string().max(60000).regex(/^[1-9]\d*(,[1-9]\d*)*$/).transform(valor => Array.from(new Set(valor.split(",").map(Number)))).refine(ids => ids.every(Number.isSafeInteger)).optional(),
      }).refine(valor => !valor.dataInicial || !valor.dataFinal || valor.dataInicial <= valor.dataFinal).safeParse(req.query ?? {});
      if (!parametros.success) return res.status(400).json({ error: "Filtros do relatório inválidos" });
      const filtros = parametros.data;
      // Mesma conversão de datas usada na rota de listagem de cargas.
      const dataLocal = (valor?: string) => {
        if (!valor) return undefined;
        const [ano, mes, dia] = valor.split("-").map(Number);
        return new Date(ano, mes - 1, dia, 12, 0, 0);
      };
      const dados = await getRelatorioRomaneiosCarga({ ...filtros, dataInicial: dataLocal(filtros.dataInicial), dataFinal: dataLocal(filtros.dataFinal) });
      if (!dados.cargas.length) return res.status(404).json({ error: "Nenhum romaneio encontrado para os filtros e a seleção informados" });
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc, empresaId);
      desenharRelatorioRomaneiosCarga(pdfDoc, font, boldFont, logo, dados, filtros);
      responderPdf(req, res, await pdfDoc.save(), "relatorio-romaneios-carga.pdf");
    } catch (err) {
      console.error("Relatório de cargas PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar relatório de romaneios de carga" });
    }
  });
  app.get("/api/pdf/orcamento/:id", async (req: any, res: any) => {
    try {
      const empresaId = await getEmpresaPdfAtiva(req, res);
      if (!empresaId) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const data = await getOrcamentoWithItems(id);
      if (!data) return res.status(404).json({ error: "Orçamento não encontrado" });

      const clientes = await listClientes();
      const cliente = clientes.find((item: any) => item.id === data.orcamento.clienteId);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc, empresaId);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Venda");
      const { width } = layout;

      layout.garantirEspaco(80);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 50, width: width - (MARGEM_LATERAL * 2), height: 62, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText(`VENDA ${data.orcamento.numero ?? "EM ANÁLISE"}`, { x: 62, y: layout.y - 7, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Emissão: ${formatDate(data.orcamento.createdAt)}`, { x: 62, y: layout.y - 27, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      const estado = `Estado: ${normalizarTexto(data.orcamento.estado) || "Não informado"}`;
      layout.page.drawText(estado, { x: width - 62 - larguraTexto(font, estado, 9), y: layout.y - 18, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      layout.mover(78);

      if (cliente) {
        const camposCliente = [
          ["Nome", cliente.nome],
          ["Contacto", cliente.contacto],
          ["E-mail", cliente.email],
          ["Morada", cliente.morada],
          ["NIF", cliente.nif],
        ].filter(([, valor]) => Boolean(normalizarTexto(valor)));
        layout.garantirEspaco(28);
        layout.page.drawText("DADOS DO CLIENTE", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        for (const [rotulo, valor] of camposCliente) layout.escreverParagrafo(`${rotulo}: ${valor}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 9, { color: COR_TEXTO_SECUNDARIO }, 13);
        layout.mover(10);
      }

      const itensRomaneados = (data.itens ?? []).filter((item: any) => {
        if ((item.tipoComercializacao ?? "metro_cubico") !== "metro_cubico") return false;
        const medidas = [item.espessura, item.largura, item.comprimento].map(Number);
        return medidas.every((medida) => Number.isFinite(medida) && medida > 0);
      });
      const itensComerciaisAvulsos = (data.itens ?? []).filter((item: any) => !itensRomaneados.includes(item));
      const gruposPorMadeira = Array.from(itensRomaneados.reduce((madeiras: Map<string, any>, item: any) => {
        const madeiraNome = normalizarTexto(item.madeiraNome) || "Madeira não informada";
        const chaveMadeira = madeiraNome.toLocaleLowerCase("pt-BR");
        const madeira = madeiras.get(chaveMadeira) ?? { madeiraNome, bitolas: new Map<string, any>() };
        const espessura = Number(item.espessura);
        const largura = Number(item.largura);
        const comprimento = Number(item.comprimento);
        const quantidade = Number(item.quantidade);
        const chaveBitola = `${espessura}|${largura}`;
        const bitola = madeira.bitolas.get(chaveBitola) ?? { espessura, largura, comprimentos: new Map<number, number>() };
        bitola.comprimentos.set(comprimento, (bitola.comprimentos.get(comprimento) ?? 0) + (Number.isFinite(quantidade) ? quantidade : 0));
        madeira.bitolas.set(chaveBitola, bitola);
        madeiras.set(chaveMadeira, madeira);
        return madeiras;
      }, new Map<string, any>()).values()).map((madeira: any) => ({
        ...madeira,
        bitolas: Array.from(madeira.bitolas.values()).sort((a: any, b: any) => a.espessura - b.espessura || a.largura - b.largura),
      })).sort((a: any, b: any) => a.madeiraNome.localeCompare(b.madeiraNome, "pt-BR"));

      // A grade do romaneio usa margens próprias, menores que o corpo do documento,
      // para aproveitar a largura total da folha sem comprometer cabeçalho e rodapé.
      const margemGradeVenda = 24;
      const larguraGradeVenda = width - (margemGradeVenda * 2);
      const larguraComprimentoVenda = 60;
      const desenharGradeVenda = (madeira: any, bitolas: any[], sufixo = "", continuacao = false) => {
        layout.garantirEspaco(62);
        const titulo = `GRADE DE PEÇAS VENDIDAS — ${madeira.madeiraNome}${sufixo}`;
        desenharTextoAjustado(layout.page, boldFont, continuacao ? `${titulo} — CONTINUAÇÃO` : titulo, margemGradeVenda, layout.y, larguraGradeVenda, 10, { color: COR_MARROM });
        layout.mover(17);
        const larguraBitola = (larguraGradeVenda - larguraComprimentoVenda) / Math.max(bitolas.length, 1);
        const cabecalhos = ["Comp.", ...bitolas.map((bitola: any) => `${formatDimensionCm(bitola.espessura)} × ${formatDimensionCm(bitola.largura)} cm`)];
        const larguras = [larguraComprimentoVenda, ...bitolas.map(() => larguraBitola)];
        let x = margemGradeVenda;
        cabecalhos.forEach((cabecalho, indice) => {
          layout.page.drawRectangle({ x, y: layout.y - 12, width: larguras[indice], height: 17, color: rgb(0.91, 0.89, 0.84) });
          desenharTextoAjustado(layout.page, boldFont, cabecalho, x + 3, layout.y - 1, larguras[indice] - 6, bitolas.length > 10 ? 6.3 : 7, { color: COR_MARROM });
          x += larguras[indice];
        });
        layout.mover(20);
      };

      const desenharRomaneioEmGrade = () => {
        if (!gruposPorMadeira.length) return;
        // O romaneio inicia depois do acerto comercial e do resumo, em uma página exclusiva.
        layout.novaPagina(true);
        gruposPorMadeira.forEach((madeira: any, indiceMadeira: number) => {
          // Cada essência ocupa uma página própria, com todas as bitolas lado a lado.
          // Assim, o romaneio deixa de fragmentar a leitura por conjuntos de medidas.
          if (indiceMadeira > 0) layout.novaPagina(true);
          const comprimentos = Array.from(new Set(madeira.bitolas.flatMap((bitola: any) => Array.from(bitola.comprimentos.keys())))).sort((a: any, b: any) => a - b) as number[];
          const bitolas = madeira.bitolas;
          desenharGradeVenda(madeira, bitolas);
          const larguraBitola = (larguraGradeVenda - larguraComprimentoVenda) / Math.max(bitolas.length, 1);
          const larguras = [larguraComprimentoVenda, ...bitolas.map(() => larguraBitola)];
          const alturaLinha = Math.max(11, Math.min(18, Math.floor((layout.y - layout.bottom - 2) / Math.max(comprimentos.length, 1))));
          const tamanhoTexto = bitolas.length > 10 ? 6.7 : 7.5;

          comprimentos.forEach((comprimento, indiceComprimento) => {
            if (!layout.temEspaco(alturaLinha)) {
              layout.novaPagina(true);
              desenharGradeVenda(madeira, bitolas, "", true);
            }
            if (indiceComprimento % 2 === 0) layout.page.drawRectangle({ x: margemGradeVenda, y: layout.y - (alturaLinha - 1), width: larguraGradeVenda, height: alturaLinha, color: rgb(0.975, 0.97, 0.94) });
            const valores = [`${formatMeasurement(comprimento)} m`, ...bitolas.map((bitola: any) => {
              const quantidade = bitola.comprimentos.get(comprimento) ?? 0;
              return quantidade ? formatMeasurement(quantidade) : "—";
            })];
            let x = margemGradeVenda;
            valores.forEach((valor, posicao) => {
              desenharTextoAjustado(layout.page, posicao === 0 ? boldFont : font, valor, x + 3, layout.y - 1, larguras[posicao] - 6, tamanhoTexto, posicao === 0 ? { color: COR_MARROM } : {});
              x += larguras[posicao];
            });
            layout.mover(alturaLinha);
          });
        });
      };

      const desenharItensComerciaisAvulsos = () => {
        if (!itensComerciaisAvulsos.length) return;
        const colunas = [135, 125, 48, 72, 72, 59];
        const rotulos = ["Produto", "Tipo / composição", "Qtd.", "Preço base", "Valor unit.", "Total"];
        const desenharItensComerciais = (continuacao = false) => {
          layout.garantirEspaco(42);
          layout.page.drawText(continuacao ? "OUTROS ITENS COMERCIAIS — CONTINUAÇÃO" : "OUTROS ITENS COMERCIAIS", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
          layout.mover(17);
          let x = MARGEM_LATERAL;
          rotulos.forEach((rotulo, indice) => {
            desenharTextoAjustado(layout.page, boldFont, rotulo, x, layout.y, colunas[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
            x += colunas[indice];
          });
          layout.mover(15);
        };
        desenharItensComerciais();
        for (const item of itensComerciaisAvulsos) {
          const tipoComercializacao = item.tipoComercializacao ?? "metro_cubico";
          const componentesPacote = item.componentesPacote ?? [];
          const composicaoPacote = componentesPacote.map((componente: any) => {
            const medidas = componente.espessura && componente.largura && componente.comprimento
              ? ` (${formatDimensionCm(componente.espessura)} × ${formatDimensionCm(componente.largura)} cm × ${formatMeasurement(componente.comprimento)} m)`
              : "";
            return `${componente.quantidadePorPacote} × ${normalizarTexto(componente.descricao) || normalizarTexto(componente.madeiraNome) || "item"}${medidas}`;
          }).join(" · ");
          if (!layout.temEspaco(16)) {
            layout.novaPagina(true);
            desenharItensComerciais(true);
          }
          const valores = [
            item.madeiraNome,
            tipoComercializacao === "unidade" ? "Venda por unidade" : tipoComercializacao === "pacote" ? "Venda por pacote" : "Medidas não informadas",
            String(item.quantidade),
            `R$ ${formatBRL(item.precoM3)}`,
            `R$ ${formatBRL(item.valorPeca)}`,
            `R$ ${formatBRL(item.valorTotal)}`,
          ];
          let x = MARGEM_LATERAL;
          valores.forEach((valor, indice) => {
            desenharTextoAjustado(layout.page, indice === valores.length - 1 ? boldFont : font, valor, x, layout.y, colunas[indice] - 4, 7.5);
            x += colunas[indice];
          });
          layout.mover(16);
          if (tipoComercializacao === "pacote" && composicaoPacote) {
            layout.escreverParagrafo(`Composição por pacote: ${composicaoPacote}`, MARGEM_LATERAL + 8, width - (MARGEM_LATERAL * 2) - 8, 7.4, { color: COR_TEXTO_SECUNDARIO }, 10);
            layout.mover(4);
          }
        }
      };

      const resumoPorBitola = Array.from((data.itens ?? []).reduce((grupos: Map<string, { descricao: string; quantidadePecas: number; volume: number }>, item: any) => {
        if ((item.tipoComercializacao ?? "metro_cubico") !== "metro_cubico") return grupos;
        const espessura = Number(item.espessura);
        const largura = Number(item.largura);
        const comprimento = Number(item.comprimento);
        const quantidade = Number(item.quantidade);
        if (![espessura, largura, comprimento, quantidade].every(Number.isFinite) || espessura <= 0 || largura <= 0 || comprimento <= 0 || quantidade <= 0) return grupos;

        const chave = `${espessura}|${largura}`;
        const grupo = grupos.get(chave) ?? {
          descricao: `${formatDimensionCm(espessura)} × ${formatDimensionCm(largura)} cm`,
          quantidadePecas: 0,
          volume: 0,
        };
        grupo.quantidadePecas += quantidade;
        grupo.volume += (espessura / 1000) * (largura / 1000) * comprimento * quantidade;
        grupos.set(chave, grupo);
        return grupos;
      }, new Map<string, { descricao: string; quantidadePecas: number; volume: number }>()).values()).sort((a, b) => b.volume - a.volume || a.descricao.localeCompare(b.descricao, "pt-BR"));
      const volumeTotalPorBitola = resumoPorBitola.reduce((total, bitola) => total + bitola.volume, 0);

      if (resumoPorBitola.length > 0) {
        const desenharCabecalhoResumoBitola = (continuacao = false) => {
          layout.garantirEspaco(43);
          layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.7, color: COR_LINHA });
          layout.mover(18);
          layout.page.drawText(continuacao ? "RESUMO DE PEÇAS POR BITOLA — CONTINUAÇÃO" : "RESUMO DE PEÇAS POR BITOLA", { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: boldFont, color: COR_MARROM });
          layout.mover(15);
          const colunasBitola = [205, 95, 112, 87];
          const rotulosBitola = ["Bitola", "Peças", "Volume", "% do volume"];
          let x = MARGEM_LATERAL;
          rotulosBitola.forEach((rotulo, indice) => {
            desenharTextoAjustado(layout.page, boldFont, rotulo, x, layout.y, colunasBitola[indice] - 4, 7.4, { color: COR_CINZA_CLARO });
            x += colunasBitola[indice];
          });
          layout.mover(14);
        };

        desenharCabecalhoResumoBitola();
        for (const bitola of resumoPorBitola) {
          if (!layout.temEspaco(15)) {
            layout.novaPagina(true);
            desenharCabecalhoResumoBitola(true);
          }
          const percentual = volumeTotalPorBitola > 0 ? (bitola.volume / volumeTotalPorBitola) * 100 : 0;
          const valoresBitola = [
            bitola.descricao,
            String(bitola.quantidadePecas),
            `${formatMeasurement(bitola.volume)} m³`,
            `${formatPercentage(percentual)}%`,
          ];
          const colunasBitola = [205, 95, 112, 87];
          let x = MARGEM_LATERAL;
          valoresBitola.forEach((valor, indice) => {
            desenharTextoAjustado(layout.page, indice === 0 ? font : boldFont, valor, x, layout.y, colunasBitola[indice] - 4, 8);
            x += colunasBitola[indice];
          });
          layout.mover(15);
        }
      }

      const taxasAdicionais = (data.taxasAdicionais?.length ?? 0) > 0
        ? data.taxasAdicionais
        : (normalizarTexto(data.orcamento.taxaDescricao) ? [{
          descricao: data.orcamento.taxaDescricao,
          tipo: data.orcamento.taxaTipo,
          valor: data.orcamento.taxaValor,
          calculado: data.orcamento.taxaCalculada,
        }] : []);
      const possuiAcertoComercial = Number(data.orcamento.abatimentoFrete ?? 0) > 0
        || Number(data.orcamento.comissaoCalculada ?? 0) > 0
        || taxasAdicionais.length > 0;
      const alturaResumo = possuiAcertoComercial ? 175 + (taxasAdicionais.length * 14) : 126;
      layout.garantirEspaco(alturaResumo);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.8, color: COR_LINHA });
      layout.mover(19);
      layout.page.drawText("RESUMO", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
      layout.mover(18);
      const resumo = [
        [`Subtotal bruto: R$ ${formatBRL(data.orcamento.subtotal)}`, font, undefined],
        [`Desconto: -R$ ${formatBRL(data.orcamento.desconto)}`, font, rgb(0.7, 0.2, 0.2)],
        [`Frete: +R$ ${formatBRL(data.orcamento.frete)}`, font, undefined],
      ];
      resumo.forEach(([texto, fonte, cor], indice) => {
        layout.page.drawText(texto, { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: fonte, ...(cor ? { color: cor } : {}) });
        layout.mover(14);
      });
      if (possuiAcertoComercial) {
        layout.mover(3);
        layout.page.drawText("ACERTO COMERCIAL", { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: boldFont, color: COR_MARROM });
        layout.mover(15);
        const fretePorTonelada = Number(data.orcamento.fretePorTonelada ?? 0);
        const pesoCarga = Number(data.orcamento.pesoCargaToneladas ?? 0);
        const detalhesAcerto = [
          [`Frete: R$ ${formatBRL(fretePorTonelada)}/t × ${formatMeasurement(pesoCarga)} t`, `-R$ ${formatBRL(data.orcamento.abatimentoFrete)}`],
          ["Base após frete", `R$ ${formatBRL(data.orcamento.baseAposFrete)}`],
          [`Comissão (${data.orcamento.comissaoTipo === "fixo" ? "valor fixo" : `${formatMeasurement(data.orcamento.comissaoValor)}%`})`, `-R$ ${formatBRL(data.orcamento.comissaoCalculada)}`],
        ];
        for (const [rotulo, valor] of detalhesAcerto) {
          layout.page.drawText(rotulo, { x: MARGEM_LATERAL, y: layout.y, size: 8.7, font, color: COR_TEXTO_SECUNDARIO });
          layout.page.drawText(valor, { x: width - MARGEM_LATERAL - larguraTexto(boldFont, valor, 8.7), y: layout.y, size: 8.7, font: boldFont });
          layout.mover(13);
        }
        for (const taxa of taxasAdicionais) {
          const tipo = taxa.tipo === "fixo" ? "valor fixo" : `${formatMeasurement(taxa.valor)}%`;
          const rotulo = `Taxa · ${normalizarTexto(taxa.descricao)} (${tipo})`;
          const valor = `+R$ ${formatBRL(taxa.calculado)}`;
          desenharTextoAjustado(layout.page, font, rotulo, MARGEM_LATERAL, layout.y, width - (MARGEM_LATERAL * 2) - 105, 8.7, { color: COR_TEXTO_SECUNDARIO });
          layout.page.drawText(valor, { x: width - MARGEM_LATERAL - larguraTexto(boldFont, valor, 8.7), y: layout.y, size: 8.7, font: boldFont });
          layout.mover(13);
        }
      }
      layout.mover(4);
      const totalTexto = `Valor final: R$ ${formatBRL(data.orcamento.total)}`;
      layout.page.drawText(totalTexto, { x: MARGEM_LATERAL, y: layout.y, size: 13, font: boldFont, color: COR_MARROM });
      layout.mover(19);
      layout.page.drawText(`Total de itens: ${data.orcamento.totalPecas}`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });
      layout.mover(12);
      layout.page.drawText(`Total em metros lineares: ${formatMeasurement(data.orcamento.totalMetroLinear)} m`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });
      layout.mover(12);
      layout.page.drawText(`Volume total: ${formatMeasurement(data.orcamento.totalVolume)} m³`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });

      if (normalizarTexto(data.orcamento.observacoes)) {
        layout.mover(18);
        layout.garantirEspaco(26);
        layout.page.drawText("OBSERVAÇÕES", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        layout.escreverParagrafo(data.orcamento.observacoes, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      }

      desenharRomaneioEmGrade();
      desenharItensComerciaisAvulsos();

      const pdfBytes = await pdfDoc.save();
      responderPdf(req, res, pdfBytes, `venda-${data.orcamento.numero ?? data.orcamento.id}.pdf`);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  });

  app.get("/api/pdf/recibo/:id", async (req: any, res: any) => {
    try {
      const empresaId = await getEmpresaPdfAtiva(req, res);
      if (!empresaId) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const data = await getOrcamentoWithItems(id);
      if (!data) return res.status(404).json({ error: "Orçamento não encontrado" });
      if (!data.orcamento.pago || !data.orcamento.pagoEm) return res.status(400).json({ error: "O recibo só está disponível para vendas quitadas" });

      const clientes = await listClientes();
      const cliente = clientes.find((item: any) => item.id === data.orcamento.clienteId);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc, empresaId);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Comprovante de quitação");
      const { width } = layout;
      const numeroVenda = data.orcamento.numero ?? data.orcamento.id;

      layout.garantirEspaco(90);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 54, width: width - (MARGEM_LATERAL * 2), height: 64, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText("RECIBO DE PAGAMENTO", { x: 64, y: layout.y - 4, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Referente à venda ${numeroVenda}`, { x: 64, y: layout.y - 24, size: 9.5, font, color: COR_TEXTO_SECUNDARIO });
      layout.page.drawText(`Recibo nº REC-${numeroVenda}`, { x: 64, y: layout.y - 42, size: 8.5, font, color: COR_CINZA_CLARO });
      layout.mover(92);

      const nomeCliente = normalizarTexto(cliente?.nome) || "Cliente";
      layout.page.drawText("DECLARAÇÃO DE QUITAÇÃO", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
      layout.mover(20);
      layout.escreverParagrafo(`Recebemos de ${nomeCliente} o valor abaixo indicado, referente à venda mencionada.`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 10, {}, 15);
      layout.mover(24);
      layout.garantirEspaco(52);
      layout.page.drawText("VALOR RECEBIDO", { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font: boldFont, color: COR_CINZA_CLARO });
      layout.mover(22);
      layout.page.drawText(`R$ ${formatBRL(data.orcamento.total)}`, { x: MARGEM_LATERAL, y: layout.y, size: 23, font: boldFont, color: rgb(0.15, 0.42, 0.26) });
      layout.mover(52);

      layout.garantirEspaco(126);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.7, color: rgb(0.82, 0.79, 0.73) });
      layout.mover(25);
      const dados = [
        ["Cliente", nomeCliente],
        ["Forma de pagamento", formatFormaPagamento(data.orcamento.formaPagamento)],
        ["Data de pagamento", formatDate(data.orcamento.pagoEm)],
      ];
      for (const [rotulo, valor] of dados) {
        layout.page.drawText(rotulo, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font: boldFont, color: COR_CINZA_CLARO });
        desenharTextoAjustado(layout.page, font, valor, 180, layout.y, width - 180 - MARGEM_LATERAL, 9.5);
        layout.mover(25);
      }
      layout.mover(28);
      layout.garantirEspaco(34);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: 270, y: layout.y }, thickness: 0.7, color: rgb(0.5, 0.5, 0.5) });
      layout.mover(16);
      layout.page.drawText("FK Madeiras", { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: COR_CINZA_CLARO });

      const pdfBytes = await pdfDoc.save();
      responderPdf(req, res, pdfBytes, `recibo-${numeroVenda}.pdf`);
    } catch (err: any) {
      console.error("Receipt PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar recibo de pagamento" });
    }
  });

  app.get("/api/pdf/romaneio/:id", async (req: any, res: any) => {
    try {
      const empresaId = await getEmpresaPdfAtiva(req, res);
      if (!empresaId) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const data = await getRomaneioProducaoComItens(id);
      if (!data) return res.status(404).json({ error: "Romaneio não encontrado" });

      const torasParaResumo = data.toras.length
        ? data.toras
        : [{ madeiraNome: data.romaneio.madeiraTora ?? "Não informada", volume: data.romaneio.volumeTora ?? "0" }];
      const aproveitamentosManuais = data.aproveitamentos ?? [];
      const volumeAproveitamento = Number(data.romaneio.volumeAproveitamento ?? aproveitamentosManuais.reduce((total: number, item: any) => total + Number(item.volume ?? 0), 0));
      const incluirAproveitamentoNoRendimento = Boolean(data.romaneio.incluirAproveitamentoNoRendimento);
      const resumoPorEssencia = calcularAproveitamentoPorEssencia(torasParaResumo, data.itens).map((resumo) => {
        const volumeAproveitamentoEssencia = aproveitamentosManuais
          .filter((item: any) => String(item.madeiraNome ?? "").localeCompare(resumo.essencia, "pt-BR", { sensitivity: "accent" }) === 0)
          .reduce((total: number, item: any) => total + Number(item.volume ?? 0), 0);
        const volumeParaRendimento = resumo.volumeProduzido + (incluirAproveitamentoNoRendimento ? volumeAproveitamentoEssencia : 0);
        const aproveitamento = resumo.volumeToras > 0 ? (volumeParaRendimento / resumo.volumeToras) * 100 : 0;
        return {
          ...resumo,
          volumeAproveitamento: Number(volumeAproveitamentoEssencia.toFixed(6)),
          aproveitamento: Number(aproveitamento.toFixed(2)),
          perdaVolume: Number((resumo.volumeToras - volumeParaRendimento).toFixed(6)),
          perdaPercentual: Number((100 - aproveitamento).toFixed(2)),
        };
      });

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc, empresaId);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Romaneio de produção");
      const { width } = layout;
      const torasSerradas = data.toras.length
        ? data.toras
        : [{ codigo: data.romaneio.plaquetaCodigo ?? "Não informada", madeiraNome: data.romaneio.madeiraTora ?? "Não informada", diametro: null, comprimento: data.romaneio.comprimentoTora, volume: data.romaneio.volumeTora ?? "0" }];

      layout.garantirEspaco(80);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 50, width: width - (MARGEM_LATERAL * 2), height: 62, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText(normalizarTexto(data.romaneio.numero) || "ROMANEIO", { x: 62, y: layout.y - 7, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Produção em ${formatDate(data.romaneio.dataProducao, true)}`, { x: 62, y: layout.y - 27, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      const aproveitamentoTexto = `Aproveitamento: ${formatPercentage(data.romaneio.aproveitamento)}%`;
      layout.page.drawText(aproveitamentoTexto, { x: width - 62 - larguraTexto(boldFont, aproveitamentoTexto, 10), y: layout.y - 16, size: 10, font: boldFont, color: rgb(0.12, 0.42, 0.25) });
      const regraRendimento = incluirAproveitamentoNoRendimento ? "Rendimento inclui aproveitamento" : "Rendimento considera apenas peças";
      layout.page.drawText(regraRendimento, { x: width - 62 - larguraTexto(font, regraRendimento, 7), y: layout.y - 30, size: 7, font, color: COR_TEXTO_SECUNDARIO });
      layout.mover(78);

      const desenharTituloToras = (continuacao = false) => {
        layout.garantirEspaco(32);
        layout.page.drawText(continuacao ? `TORAS SERRADAS (${torasSerradas.length}) — CONTINUAÇÃO` : `TORAS SERRADAS (${torasSerradas.length})`, { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(18);
      };
      desenharTituloToras();
      for (const tora of torasSerradas) {
        const linhaIdentificacao = `Plaqueta: ${normalizarTexto(tora.codigo) || "Não informada"}   •   Essência: ${normalizarTexto(tora.madeiraNome) || "Não informada"}`;
        const linhaMedidas = `Diâmetro: ${formatMeasurement(tora.diametro)} cm   •   Comprimento: ${formatMeasurement(tora.comprimento)} m   •   Volume efetivo: ${formatMeasurement(tora.volume)} m³`;
        const alturaTora = (quebrarTexto(font, linhaIdentificacao, width - (MARGEM_LATERAL * 2), 8.5).length * 12) + (quebrarTexto(font, linhaMedidas, width - (MARGEM_LATERAL * 2), 8).length * 11) + 5;
        if (!layout.temEspaco(alturaTora)) {
          layout.novaPagina(true);
          desenharTituloToras(true);
        }
        layout.escreverParagrafo(linhaIdentificacao, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, {}, 12);
        layout.escreverParagrafo(linhaMedidas, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8, { color: COR_TEXTO_SECUNDARIO }, 11);
        layout.mover(5);
      }

      layout.garantirEspaco(50);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.6, color: COR_LINHA });
      layout.mover(15);
      layout.escreverParagrafo(`Volume de toras: ${formatMeasurement(data.romaneio.volumeTora)} m³   •   Fita/Linha: ${normalizarTexto(data.romaneio.fita) || "Não informada"}   •   Responsável: ${normalizarTexto(data.romaneio.responsavel) || "Não informado"}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      layout.mover(12);

      const resumosPecasPorEssencia = resumirPecasPdfPorEssencia(data.itens ?? []);
      const totalPecas = resumosPecasPorEssencia.reduce((total, resumo) => total + resumo.totalPecas, 0);
      const totalMetros = resumosPecasPorEssencia.reduce((total, resumo) => total + resumo.totalMetros, 0);
      const totalVolume = resumosPecasPorEssencia.reduce((total, resumo) => total + resumo.totalVolume, 0);
      const larguraGrade = width - (MARGEM_LATERAL * 2);
      const larguraComprimento = 48;
      const maximoBitolasPorPagina = 7;
      const separarBitolasPorPagina = (gruposPorBitola: GrupoBitolaPdfProducao[]) => gruposPorBitola.reduce((blocos: GrupoBitolaPdfProducao[][], grupo, indice) => {
        const bloco = Math.floor(indice / maximoBitolasPorPagina);
        if (!blocos[bloco]) blocos[bloco] = [];
        blocos[bloco].push(grupo);
        return blocos;
      }, []);
      const desenharGradePecas = (resumo: ResumoEssenciaPdfProducao, bitolas: GrupoBitolaPdfProducao[], totalBlocos: number, continuacao = false) => {
        layout.garantirEspaco(50);
        const sufixo = totalBlocos > 1 ? ` — BITOLAS ${resumo.gruposPorBitola.indexOf(bitolas[0]) + 1}–${resumo.gruposPorBitola.indexOf(bitolas.at(-1)!) + 1}` : "";
        const titulo = `GRADE DE PRODUÇÃO POR BITOLA — ${resumo.essencia}${sufixo}`;
        layout.page.drawText(continuacao ? `${titulo} — CONTINUAÇÃO` : titulo, { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        const larguraBitola = (larguraGrade - larguraComprimento) / Math.max(bitolas.length, 1);
        const cabecalhos = ["Comp.", ...bitolas.map((grupo) => `${formatMeasurement(grupo.espessura)} × ${formatMeasurement(grupo.largura)} cm`)];
        const larguras = [larguraComprimento, ...bitolas.map(() => larguraBitola)];
        let x = MARGEM_LATERAL;
        cabecalhos.forEach((cabecalho, indice) => {
          layout.page.drawRectangle({ x, y: layout.y - 12, width: larguras[indice], height: 17, color: rgb(0.91, 0.89, 0.84) });
          desenharTextoAjustado(layout.page, boldFont, cabecalho, x + 3, layout.y - 1, larguras[indice] - 6, 7, { color: COR_MARROM });
          x += larguras[indice];
        });
        layout.mover(20);
      };
      // Cada essência recebe uma grade própria; uma bitola nunca soma volumes de essências distintas.
      resumosPecasPorEssencia.forEach((resumo, indiceEssencia) => {
        const blocosBitola = separarBitolasPorPagina(resumo.gruposPorBitola);
        blocosBitola.forEach((bitolas, indiceBloco) => {
          layout.novaPagina(indiceEssencia > 0 || indiceBloco > 0);
          desenharGradePecas(resumo, bitolas, blocosBitola.length, indiceBloco > 0);
          const larguraBitola = (larguraGrade - larguraComprimento) / Math.max(bitolas.length, 1);
          resumo.comprimentos.forEach((comprimento, indiceComprimento) => {
            if (!layout.temEspaco(18)) {
              layout.novaPagina(true);
              desenharGradePecas(resumo, bitolas, blocosBitola.length, true);
            }
            const valores = [`${formatMeasurement(comprimento)} m`, ...bitolas.map((grupo) => {
              const quantidade = grupo.comprimentos.get(comprimento) ?? 0;
              return quantidade ? formatMeasurement(quantidade) : "—";
            })];
            const larguras = [larguraComprimento, ...bitolas.map(() => larguraBitola)];
            if (indiceComprimento % 2 === 0) layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 12, width: larguraGrade, height: 17, color: rgb(0.975, 0.97, 0.94) });
            let x = MARGEM_LATERAL;
            valores.forEach((valor, posicao) => {
              desenharTextoAjustado(layout.page, posicao === 0 ? boldFont : font, valor, x + 3, layout.y - 1, larguras[posicao] - 6, 7.5, posicao === 0 ? { color: COR_MARROM } : {});
              x += larguras[posicao];
            });
            layout.mover(18);
          });

          layout.garantirEspaco(44);
          let xResumo = MARGEM_LATERAL;
          const largurasResumo = [larguraComprimento, ...bitolas.map(() => larguraBitola)];
          ["Resumo", ...bitolas.map((grupo) => ({
            pecas: `${formatMeasurement(grupo.totalPecas)} peças`,
            volume: `${formatMeasurement(grupo.volume)} m³`,
            percentual: `${formatPercentage(grupo.percentualDaEssencia)}% da produção`,
          }))].forEach((valor, indice) => {
            layout.page.drawRectangle({ x: xResumo, y: layout.y - 28, width: largurasResumo[indice], height: 34, color: rgb(0.93, 0.96, 0.92) });
            if (typeof valor === "string") {
              desenharTextoAjustado(layout.page, boldFont, valor, xResumo + 4, layout.y - 3, largurasResumo[indice] - 8, 7.5, { color: COR_MARROM });
            } else {
              desenharTextoAjustado(layout.page, boldFont, valor.pecas, xResumo + 4, layout.y - 2, largurasResumo[indice] - 8, 7, { color: rgb(0.12, 0.42, 0.25) });
              desenharTextoAjustado(layout.page, font, valor.volume, xResumo + 4, layout.y - 12, largurasResumo[indice] - 8, 7, { color: COR_TEXTO_SECUNDARIO });
              desenharTextoAjustado(layout.page, font, valor.percentual, xResumo + 4, layout.y - 22, largurasResumo[indice] - 8, 7, { color: COR_TEXTO_SECUNDARIO });
            }
            xResumo += largurasResumo[indice];
          });
          layout.mover(38);
        });
      });

      layout.garantirEspaco(78);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.8, color: COR_LINHA });
      layout.mover(17);
      layout.page.drawText(`Total de peças: ${formatMeasurement(totalPecas)}`, { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Metros lineares: ${formatMeasurement(totalMetros)} m`, { x: 210, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Peças romaneadas: ${formatMeasurement(totalVolume)} m³`, { x: 370, y: layout.y, size: 9.5, font: boldFont });
      layout.mover(16);
      layout.page.drawText(`Aproveitamento manual: ${formatMeasurement(volumeAproveitamento)} m³`, { x: MARGEM_LATERAL, y: layout.y, size: 8.5, font, color: rgb(0.55, 0.33, 0.05) });
      layout.page.drawText(`Produção total: ${formatMeasurement(totalVolume + volumeAproveitamento)} m³`, { x: 290, y: layout.y, size: 8.5, font: boldFont, color: rgb(0.12, 0.42, 0.25) });
      if (aproveitamentosManuais.length) {
        layout.mover(18);
        layout.escreverParagrafo(`Aproveitamento por essência: ${aproveitamentosManuais.map((item: any) => `${item.madeiraNome} ${formatMeasurement(item.volume)} m³`).join(" · ")}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8, { color: COR_TEXTO_SECUNDARIO }, 11);
      }

      const colunasResumo = [148, 70, 76, 80, 83];
      const labelsResumo = ["Essência", "Toras", "Produção", "Aproveit.", "Perda"];
      const desenharResumoEssencia = (continuacao = false) => {
        layout.garantirEspaco(42);
        layout.page.drawText(continuacao ? "APROVEITAMENTO POR ESSÊNCIA — CONTINUAÇÃO" : "APROVEITAMENTO POR ESSÊNCIA", { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
        layout.mover(17);
        let x = MARGEM_LATERAL;
        labelsResumo.forEach((label, indice) => {
          desenharTextoAjustado(layout.page, boldFont, label, x, layout.y, colunasResumo[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
          x += colunasResumo[indice];
        });
        layout.mover(15);
      };
      if (resumoPorEssencia.length) {
        desenharResumoEssencia();
        for (const resumo of resumoPorEssencia) {
          if (!layout.temEspaco(16)) {
            layout.novaPagina(true);
            desenharResumoEssencia(true);
          }
          const valores = [
            resumo.essencia,
            `${formatMeasurement(resumo.volumeToras)} m³`,
            `${formatMeasurement(resumo.volumeProduzido)} m³`,
            `${formatPercentage(resumo.aproveitamento)}%`,
            `${formatMeasurement(resumo.perdaVolume)} m³ (${formatPercentage(resumo.perdaPercentual)}%)`,
          ];
          let x = MARGEM_LATERAL;
          valores.forEach((valor, indice) => {
            const cor = indice === 3 ? rgb(0.12, 0.42, 0.25) : indice === 4 ? rgb(0.66, 0.38, 0.04) : undefined;
            desenharTextoAjustado(layout.page, indice === 3 ? boldFont : font, valor, x, layout.y, colunasResumo[indice] - 4, 7.5, cor ? { color: cor } : {});
            x += colunasResumo[indice];
          });
          layout.mover(16);
        }
      }

      if (normalizarTexto(data.romaneio.observacoes)) {
        layout.mover(12);
        layout.garantirEspaco(26);
        layout.page.drawText("OBSERVAÇÕES", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        layout.escreverParagrafo(data.romaneio.observacoes, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      }

      const bytes = await pdfDoc.save();
      responderPdf(req, res, bytes, `romaneio-${data.romaneio.numero}.pdf`);
    } catch (err) {
      console.error("Romaneio PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar PDF do romaneio" });
    }
  });

  app.get("/api/pdf/romaneio-carga/:id", async (req: any, res: any) => {
    try {
      const empresaId = await getEmpresaPdfAtiva(req, res);
      if (!empresaId) return;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      const data = await getRomaneioCargaComPlaquetas(id);
      if (!data) return res.status(404).json({ error: "Romaneio de carga não encontrado" });

      const volumeCarga = Number(data.carga.volumeTotal ?? 0);
      const freteTotal = Number(data.carga.frete ?? 0);
      const fretePorMetroCubico = Number(data.carga.fretePorMetroCubico ?? 0) || (volumeCarga ? freteTotal / volumeCarga : 0);
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await loadCompanyLogo(pdfDoc, empresaId);
      const layout = criarLayoutPdf(pdfDoc, font, boldFont, logo, "Romaneio de carga");
      const { width } = layout;

      layout.garantirEspaco(80);
      layout.page.drawRectangle({ x: MARGEM_LATERAL, y: layout.y - 50, width: width - (MARGEM_LATERAL * 2), height: 62, color: rgb(0.95, 0.93, 0.89) });
      layout.page.drawText(normalizarTexto(data.carga.numero) || "ROMANEIO", { x: 62, y: layout.y - 7, size: 16, font: boldFont, color: COR_MARROM });
      layout.page.drawText(`Recebimento em ${formatDate(data.carga.dataCarga, true)}`, { x: 62, y: layout.y - 27, size: 9, font, color: COR_TEXTO_SECUNDARIO });
      const volumeTexto = `Volume: ${formatMeasurement(data.carga.volumeTotal)} m³`;
      layout.page.drawText(volumeTexto, { x: width - 62 - larguraTexto(boldFont, volumeTexto, 9.5), y: layout.y - 15, size: 9.5, font: boldFont, color: rgb(0.12, 0.42, 0.25) });
      const freteTexto = `Frete: R$ ${formatBRL(fretePorMetroCubico)}/m³`;
      layout.page.drawText(freteTexto, { x: width - 62 - larguraTexto(font, freteTexto, 8), y: layout.y - 30, size: 8, font, color: COR_TEXTO_SECUNDARIO });
      layout.mover(78);
      layout.escreverParagrafo(`Origem: ${normalizarTexto(data.carga.origem) || "Não informada"}   •   Responsável: ${normalizarTexto(data.carga.responsavel) || "Não informado"}`, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      layout.mover(12);

      const colunas = [76, 92, 56, 61, 65, 73, 74];
      const labels = ["Código", "Essência", "Diâm.", "Comp.", "Volume", "R$/m³", "Valor"];
      const desenharTabelaCarga = (continuacao = false) => {
        layout.garantirEspaco(28);
        if (continuacao) {
          layout.page.drawText("PLAQUETAS — CONTINUAÇÃO", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
          layout.mover(15);
        }
        let x = MARGEM_LATERAL;
        labels.forEach((label, indice) => {
          desenharTextoAjustado(layout.page, boldFont, label, x, layout.y, colunas[indice] - 4, 7.5, { color: rgb(0.42, 0.42, 0.42) });
          x += colunas[indice];
        });
        layout.mover(15);
      };
      layout.garantirEspaco(28);
      layout.page.drawText(`PLAQUETAS (${data.plaquetas.length})`, { x: MARGEM_LATERAL, y: layout.y, size: 10, font: boldFont, color: COR_MARROM });
      layout.mover(17);
      desenharTabelaCarga();

      for (const plaqueta of data.plaquetas ?? []) {
        if (!layout.temEspaco(16)) {
          layout.novaPagina(true);
          desenharTabelaCarga(true);
        }
        // A identificação interna pode ser longa quando a tora chegou sem plaqueta física.
        // Ela é truncada dentro da sua célula, preservando a leitura das demais medidas.
        const valores = [
          etiquetaPlaqueta(plaqueta),
          plaqueta.madeiraNome,
          `${formatMeasurement(plaqueta.diametro)} cm`,
          `${formatMeasurement(plaqueta.comprimento)} m`,
          `${formatMeasurement(plaqueta.volumeInicial)} m³`,
          `R$ ${formatBRL(plaqueta.valorMetroCubico)}`,
          `R$ ${formatBRL(plaqueta.valorTotal)}`,
        ];
        let x = MARGEM_LATERAL;
        valores.forEach((valor, indice) => {
          desenharTextoAjustado(layout.page, indice === valores.length - 1 ? boldFont : font, valor, x, layout.y, colunas[indice] - 4, 7.5);
          x += colunas[indice];
        });
        layout.mover(16);
      }

      const volumePorEssencia = resumirVolumePorEssencia(data.plaquetas ?? []);
      if (volumePorEssencia.length) {
        layout.garantirEspaco(38);
        layout.page.drawText("SALDO TOTAL POR ESSÊNCIA", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        const resumo = volumePorEssencia
          .map(({ essencia, volume }) => `${essencia}: ${formatMeasurement(volume)} m³`)
          .join("   •   ");
        layout.escreverParagrafo(resumo, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
        layout.mover(8);
      }

      layout.garantirEspaco(96);
      layout.page.drawLine({ start: { x: MARGEM_LATERAL, y: layout.y }, end: { x: width - MARGEM_LATERAL, y: layout.y }, thickness: 0.8, color: COR_LINHA });
      layout.mover(19);
      layout.page.drawText(`Plaquetas: ${data.carga.totalPlaquetas}`, { x: MARGEM_LATERAL, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Toras: R$ ${formatBRL(data.carga.valorProdutos)}`, { x: 190, y: layout.y, size: 9.5, font: boldFont });
      layout.page.drawText(`Frete/m³: R$ ${formatBRL(fretePorMetroCubico)}`, { x: 350, y: layout.y, size: 9.5, font: boldFont });
      layout.mover(18);
      layout.page.drawText(`Frete total: R$ ${formatBRL(freteTotal)}`, { x: 350, y: layout.y, size: 8.5, font });
      layout.mover(23);
      layout.page.drawText(`VALOR TOTAL DA CARGA: R$ ${formatBRL(data.carga.valorTotal)}`, { x: MARGEM_LATERAL, y: layout.y, size: 13, font: boldFont, color: rgb(0.12, 0.42, 0.25) });

      if (normalizarTexto(data.carga.observacoes)) {
        layout.mover(22);
        layout.garantirEspaco(26);
        layout.page.drawText("OBSERVAÇÕES", { x: MARGEM_LATERAL, y: layout.y, size: 9, font: boldFont, color: COR_MARROM });
        layout.mover(14);
        layout.escreverParagrafo(data.carga.observacoes, MARGEM_LATERAL, width - (MARGEM_LATERAL * 2), 8.5, { color: COR_TEXTO_SECUNDARIO }, 12);
      }

      const bytes = await pdfDoc.save();
      responderPdf(req, res, bytes, `romaneio-carga-${data.carga.numero}.pdf`);
    } catch (err) {
      console.error("Carga PDF generation error:", err);
      res.status(500).json({ error: "Erro ao gerar PDF do romaneio de carga" });
    }
  });
}
