import { normalizarCodigoPlaqueta } from "./producao.logic";

export const CABECALHOS_CSV_TORAS_PRODUCAO = ["plaqueta", "essencia", "diametro_cm", "comprimento_m", "volume_m3"] as const;
export const CABECALHOS_CSV_TORAS_SERRAGEM_TERCEIROS = ["referencia", "essencia", "diametro_cm", "comprimento_m"] as const;
export const CABECALHOS_CSV_PECAS_PRODUCAO = ["essencia", "espessura_cm", "largura_cm", "comprimento_m", "quantidade"] as const;
export const COLUNAS_MODELO_MATRIZ_PECAS = ["2,3x5", "2,3x10", "2,3x15", "2,3x20", "2,3x25", "2,3x30", "5x11", "5x5"] as const;

export type LinhaImportacaoToraProducao = {
  codigo: string;
  madeiraNome?: string;
  diametro?: string;
  comprimento?: string;
  volume?: string;
};

export type LinhaImportacaoPecaProducao = {
  madeiraNome: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
};

type PlaquetaDisponivel = {
  id: number;
  codigo: string;
  estado: "disponivel" | "consumida" | "cancelada";
  madeiraNome: string;
  diametro?: string | number | null;
  comprimento?: string | number | null;
  volumeDisponivel: string | number;
};

export type ToraPreparadaImportacao = {
  plaquetaId?: number;
  novaPlaqueta?: { codigo: string };
  codigo: string;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  volume: string;
  origem: "estoque" | "entrada_imediata";
};

function lerLinhasCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (caractere === '"') {
      if (entreAspas && conteudo[indice + 1] === '"') { celula += '"'; indice += 1; }
      else entreAspas = !entreAspas;
    } else if (caractere === ";" && !entreAspas) { linha.push(celula); celula = ""; }
    else if (caractere === "\n" && !entreAspas) { linha.push(celula); linhas.push(linha); linha = []; celula = ""; }
    else if (caractere !== "\r") celula += caractere;
  }
  if (entreAspas) throw new Error("O arquivo CSV possui aspas sem fechamento");
  if (celula || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

function decimalOpcional(valor: string, campo: string, linha: number): string | undefined {
  const texto = valor.trim();
  if (!texto) return undefined;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`Linha ${linha}: informe ${campo} como número positivo`);
  return String(numero);
}

export function criarModeloCsvTorasProducao(): string {
  return `\uFEFF${CABECALHOS_CSV_TORAS_PRODUCAO.join(";")}\nTOR-0001;;;;`;
}

export function criarModeloCsvTorasSerragemTerceiros(): string {
  return `\uFEFF${CABECALHOS_CSV_TORAS_SERRAGEM_TERCEIROS.join(";")}\n-;Cedrinho;32;4,0\nTOR-002;Cedrinho;36;4,5`;
}

export function criarModeloCsvPecasProducao(): string {
  return `\uFEFFessencia;comprimento_m;${COLUNAS_MODELO_MATRIZ_PECAS.join(";")}\nCedrinho;2,0;35;36;17;3;7;2;0;0\nCedrinho;2,5;18;29;5;8;5;0;2;0\nCedrinho;3,0;17;29;13;14;5;23;3;0`;
}

export function validarCsvTorasProducao(conteudo: string, maximoLinhas = 200): { linhas: LinhaImportacaoToraProducao[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { linhas: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { linhas: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indices = CABECALHOS_CSV_TORAS_PRODUCAO.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { linhas: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_TORAS_PRODUCAO.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { linhas: [], erros: ["O arquivo CSV não possui plaquetas para importar"] };
  if (dados.length > maximoLinhas) return { linhas: [], erros: [`O limite por importação é de ${maximoLinhas} plaquetas`] };
  const codigos = new Set<string>();
  const linhas: LinhaImportacaoToraProducao[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2;
    const valor = (campo: typeof CABECALHOS_CSV_TORAS_PRODUCAO[number]) => (colunas[indices[CABECALHOS_CSV_TORAS_PRODUCAO.indexOf(campo)]] ?? "").trim();
    const codigo = normalizarCodigoPlaqueta(valor("plaqueta"));
    if (codigo.length < 2) { erros.push(`Linha ${numeroLinha}: informe a plaqueta`); return; }
    if (codigos.has(codigo)) { erros.push(`Linha ${numeroLinha}: a plaqueta ${codigo} está repetida na planilha`); return; }
    codigos.add(codigo);
    try {
      linhas.push({
        codigo,
        madeiraNome: valor("essencia") || undefined,
        diametro: decimalOpcional(valor("diametro_cm"), "o diâmetro", numeroLinha),
        comprimento: decimalOpcional(valor("comprimento_m"), "o comprimento", numeroLinha),
        volume: decimalOpcional(valor("volume_m3"), "o volume", numeroLinha),
      });
    } catch (erro) { erros.push(erro instanceof Error ? erro.message : `Linha ${numeroLinha}: dados inválidos`); }
  });
  return erros.length ? { linhas: [], erros } : { linhas, erros: [] };
}

export function validarCsvTorasSerragemTerceiros(conteudo: string, maximoLinhas = 500): { toras: Array<{ referencia: string; madeiraNome: string; diametro: string; comprimento: string }>; erros: string[] } {
  if (conteudo.length > 1_000_000) return { toras: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { toras: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indices = CABECALHOS_CSV_TORAS_SERRAGEM_TERCEIROS.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { toras: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_TORAS_SERRAGEM_TERCEIROS.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { toras: [], erros: ["O arquivo CSV não possui toras para importar"] };
  if (dados.length > maximoLinhas) return { toras: [], erros: [`O limite por importação é de ${maximoLinhas} toras`] };
  const referencias = new Set<string>();
  const toras: Array<{ referencia: string; madeiraNome: string; diametro: string; comprimento: string }> = [];
  const erros: string[] = [];
  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2;
    const valor = (campo: typeof CABECALHOS_CSV_TORAS_SERRAGEM_TERCEIROS[number]) => (colunas[indices[CABECALHOS_CSV_TORAS_SERRAGEM_TERCEIROS.indexOf(campo)]] ?? "").trim();
    const referencia = valor("referencia") || "-";
    const madeiraNome = valor("essencia");
    const referenciaNormalizada = referencia.toLocaleUpperCase("pt-BR");
    if (referencia !== "-" && referencias.has(referenciaNormalizada)) { erros.push(`Linha ${numeroLinha}: a referência ${referencia} está repetida na planilha`); return; }
    if (referencia !== "-") referencias.add(referenciaNormalizada);
    if (madeiraNome.length < 2) { erros.push(`Linha ${numeroLinha}: informe a essência`); return; }
    try {
      const diametro = decimalOpcional(valor("diametro_cm"), "o diâmetro", numeroLinha);
      const comprimento = decimalOpcional(valor("comprimento_m"), "o comprimento", numeroLinha);
      if (!diametro || !comprimento) throw new Error(`Linha ${numeroLinha}: informe o diâmetro e o comprimento`);
      toras.push({ referencia, madeiraNome, diametro, comprimento });
    } catch (erro) { erros.push(erro instanceof Error ? erro.message : `Linha ${numeroLinha}: dados inválidos`); }
  });
  return erros.length ? { toras: [], erros } : { toras, erros: [] };
}

function validarFormatoLongoPecas(tabela: string[][], maximoLinhas: number): { itens: LinhaImportacaoPecaProducao[]; erros: string[] } {
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indices = CABECALHOS_CSV_PECAS_PRODUCAO.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { itens: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_PECAS_PRODUCAO.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { itens: [], erros: ["O arquivo CSV não possui peças para importar"] };
  if (dados.length > maximoLinhas) return { itens: [], erros: [`O limite por importação é de ${maximoLinhas} peças`] };
  const itens: LinhaImportacaoPecaProducao[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2;
    const valor = (campo: typeof CABECALHOS_CSV_PECAS_PRODUCAO[number]) => (colunas[indices[CABECALHOS_CSV_PECAS_PRODUCAO.indexOf(campo)]] ?? "").trim();
    const madeiraNome = valor("essencia");
    if (madeiraNome.length < 2) { erros.push(`Linha ${numeroLinha}: informe a essência`); return; }
    try {
      const espessura = decimalOpcional(valor("espessura_cm"), "a espessura", numeroLinha);
      const largura = decimalOpcional(valor("largura_cm"), "a largura", numeroLinha);
      const comprimento = decimalOpcional(valor("comprimento_m"), "o comprimento", numeroLinha);
      const quantidade = Number(valor("quantidade").replace(",", "."));
      if (!espessura || !largura || !comprimento) throw new Error(`Linha ${numeroLinha}: informe todas as medidas da peça`);
      if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error(`Linha ${numeroLinha}: informe a quantidade como número inteiro positivo`);
      itens.push({ madeiraNome, espessura, largura, comprimento, quantidade });
    } catch (erro) { erros.push(erro instanceof Error ? erro.message : `Linha ${numeroLinha}: dados inválidos`); }
  });
  return erros.length ? { itens: [], erros } : { itens, erros: [] };
}

function lerBitolaMatriz(coluna: string): { espessura: string; largura: string } | null {
  const partes = coluna.trim().toLowerCase().replace(/\s+/g, "").split(/[x×]/);
  if (partes.length !== 2) return null;
  const espessura = decimalOpcional(partes[0], "a espessura", 1);
  const largura = decimalOpcional(partes[1], "a largura", 1);
  return espessura && largura ? { espessura, largura } : null;
}

function validarMatrizPecas(tabela: string[][], maximoLinhas: number): { itens: LinhaImportacaoPecaProducao[]; erros: string[] } {
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim());
  const indiceEssencia = cabecalho.findIndex((campo) => campo.toLowerCase() === "essencia");
  const indiceComprimento = cabecalho.findIndex((campo) => campo.toLowerCase() === "comprimento_m");
  if (indiceEssencia < 0 || indiceComprimento < 0) return { itens: [], erros: ["Use o modelo matricial com as colunas essencia, comprimento_m e as bitolas no formato espessuraxlargura (ex.: 2,3x5)"] };
  const bitolas = cabecalho.map((coluna, indice) => ({ indice, coluna, medida: indice === indiceEssencia || indice === indiceComprimento ? null : lerBitolaMatriz(coluna) }));
  const invalidas = bitolas.filter((bitola) => bitola.indice !== indiceEssencia && bitola.indice !== indiceComprimento && !bitola.medida);
  if (invalidas.length) return { itens: [], erros: [`Cabeçalho inválido: use bitolas no formato espessuraxlargura. Problema em: ${invalidas.map((bitola) => bitola.coluna || "coluna vazia").join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { itens: [], erros: ["O arquivo CSV não possui peças para importar"] };
  const itens: LinhaImportacaoPecaProducao[] = [];
  const erros: string[] = [];
  dados.forEach((linha, indice) => {
    const numeroLinha = indice + 2;
    const madeiraNome = (linha[indiceEssencia] ?? "").trim();
    if (madeiraNome.length < 2) { erros.push(`Linha ${numeroLinha}: informe a essência`); return; }
    let comprimento: string | undefined;
    try { comprimento = decimalOpcional(linha[indiceComprimento] ?? "", "o comprimento", numeroLinha); } catch (erro) { erros.push(erro instanceof Error ? erro.message : `Linha ${numeroLinha}: comprimento inválido`); return; }
    if (!comprimento) { erros.push(`Linha ${numeroLinha}: informe o comprimento`); return; }
    bitolas.filter((bitola) => bitola.medida).forEach((bitola) => {
      const textoQuantidade = (linha[bitola.indice] ?? "").trim();
      if (!textoQuantidade) return;
      const quantidade = Number(textoQuantidade.replace(",", "."));
      if (!Number.isInteger(quantidade) || quantidade < 0) { erros.push(`Linha ${numeroLinha}, bitola ${bitola.coluna}: informe uma quantidade inteira igual ou maior que zero`); return; }
      if (quantidade > 0) itens.push({ madeiraNome, espessura: bitola.medida!.espessura, largura: bitola.medida!.largura, comprimento, quantidade });
    });
  });
  if (itens.length > maximoLinhas) erros.push(`O limite por importação é de ${maximoLinhas} registros de bitolas`);
  if (!itens.length && !erros.length) erros.push("A matriz não possui quantidades de peças maiores que zero");
  return erros.length ? { itens: [], erros } : { itens, erros: [] };
}

export function validarCsvPecasProducao(conteudo: string, maximoLinhas = 1000): { itens: LinhaImportacaoPecaProducao[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { itens: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { itens: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela[0] ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  return CABECALHOS_CSV_PECAS_PRODUCAO.every((campo) => cabecalho.includes(campo))
    ? validarFormatoLongoPecas(tabela, maximoLinhas)
    : validarMatrizPecas(tabela, maximoLinhas);
}

export function prepararImportacaoTorasProducao(input: { conteudo: string; plaquetas: PlaquetaDisponivel[] }) {
  const validacao = validarCsvTorasProducao(input.conteudo);
  if (validacao.erros.length) return { toras: [] as ToraPreparadaImportacao[], erros: validacao.erros };
  const porCodigo = new Map(input.plaquetas.map((plaqueta) => [normalizarCodigoPlaqueta(plaqueta.codigo), plaqueta]));
  const erros: string[] = [];
  const toras: ToraPreparadaImportacao[] = validacao.linhas.flatMap((linha): ToraPreparadaImportacao[] => {
    const plaqueta = porCodigo.get(linha.codigo);
    if (!plaqueta) {
      if (!linha.madeiraNome || !linha.volume) {
        erros.push(`Linha da plaqueta ${linha.codigo}: informe essência e volume para registrar uma nova entrada na Produção`);
        return [];
      }
      return [{
        novaPlaqueta: { codigo: linha.codigo },
        codigo: linha.codigo,
        madeiraNome: linha.madeiraNome,
        diametro: linha.diametro ?? "",
        comprimento: linha.comprimento ?? "",
        volume: linha.volume,
        origem: "entrada_imediata" as const,
      }];
    }
    if (plaqueta.estado !== "disponivel") { erros.push(`A plaqueta ${linha.codigo} não está disponível para produção`); return []; }
    const volume = linha.volume ?? String(plaqueta.volumeDisponivel ?? "");
    if (Number(volume) <= 0) { erros.push(`A plaqueta ${linha.codigo} não possui volume disponível válido`); return []; }
    return [{
      plaquetaId: plaqueta.id,
      codigo: plaqueta.codigo,
      madeiraNome: linha.madeiraNome ?? plaqueta.madeiraNome,
      diametro: linha.diametro ?? String(plaqueta.diametro ?? ""),
      comprimento: linha.comprimento ?? String(plaqueta.comprimento ?? ""),
      volume,
      origem: "estoque" as const,
    }];
  });
  return erros.length ? { toras: [] as typeof toras, erros } : { toras, erros: [] as string[] };
}
