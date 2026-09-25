import { normalizarCodigoPlaqueta } from "./producao.logic";

const CABECALHOS_OBRIGATORIOS = ["codigo", "essencia", "diametro_cm", "comprimento_m", "preco_m3"] as const;
const CABECALHO_OBSERVACOES = "observacoes";

export type LinhaImportacaoPlaquetaCarga = {
  numeroLinha: number;
  codigo: string;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  valorMetroCubico: string;
  observacoes: string | null;
};

function lerLinhasCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (entreAspas) {
      if (caractere === '"' && conteudo[indice + 1] === '"') { celula += '"'; indice += 1; }
      else if (caractere === '"') entreAspas = false;
      else celula += caractere;
      continue;
    }
    if (caractere === '"') { entreAspas = true; continue; }
    if (caractere === ";") { linha.push(celula); celula = ""; continue; }
    if (caractere === "\n") { linha.push(celula); linhas.push(linha); linha = []; celula = ""; continue; }
    if (caractere !== "\r") celula += caractere;
  }
  if (entreAspas) throw new Error("O arquivo CSV possui aspas sem fechamento");
  if (celula || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

function normalizarDecimal(valor: string, maxCasas = 3): string | null {
  const semEspacos = valor.trim().replace(/\s/g, "");
  const normalizado = semEspacos.includes(",") ? semEspacos.replace(/\./g, "").replace(",", ".") : semEspacos;
  const expressao = new RegExp(`^\\d+(?:\\.\\d{1,${maxCasas}})?$`);
  if (!expressao.test(normalizado) || Number(normalizado) <= 0) return null;
  return String(Number(normalizado));
}

export function criarModeloCsvPlaquetasCarga(): string {
  return `\uFEFF${[...CABECALHOS_OBRIGATORIOS, CABECALHO_OBSERVACOES].join(";")}\nPLQ-001;Cumaru;48;7,50;900,00;Tora conferida na descarga`;
}

export function validarCsvPlaquetasCarga(conteudo: string, maximoLinhas = 200): { linhas: LinhaImportacaoPlaquetaCarga[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { linhas: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { linhas: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indicesObrigatorios = CABECALHOS_OBRIGATORIOS.map((campo) => cabecalho.indexOf(campo));
  if (indicesObrigatorios.some((indice) => indice < 0)) return { linhas: [], erros: [`Use o modelo CSV com os cabeçalhos: ${[...CABECALHOS_OBRIGATORIOS, CABECALHO_OBSERVACOES].join(", ")}`] };
  const indiceObservacoes = cabecalho.indexOf(CABECALHO_OBSERVACOES);
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { linhas: [], erros: ["O arquivo CSV não possui toras para importar"] };
  if (dados.length > maximoLinhas) return { linhas: [], erros: [`O limite por importação é de ${maximoLinhas} toras`] };

  const linhas: LinhaImportacaoPlaquetaCarga[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2;
    const valor = (posicao: number) => (colunas[posicao] ?? "").trim();
    const codigoOriginal = valor(indicesObrigatorios[0]);
    const codigo = normalizarCodigoPlaqueta(codigoOriginal);
    const madeiraNome = valor(indicesObrigatorios[1]);
    const diametro = normalizarDecimal(valor(indicesObrigatorios[2]), 2);
    const comprimento = normalizarDecimal(valor(indicesObrigatorios[3]), 3);
    const valorMetroCubico = normalizarDecimal(valor(indicesObrigatorios[4]), 2);
    const observacoes = indiceObservacoes >= 0 ? valor(indiceObservacoes) : "";
    const problemas: string[] = [];
    if (codigo && (codigo.length < 2 || codigo.length > 80)) problemas.push("código deve ter de 2 a 80 caracteres quando informado");
    if (madeiraNome.length < 2 || madeiraNome.length > 200) problemas.push("essência obrigatória de 2 a 200 caracteres");
    if (!diametro) problemas.push("diâmetro deve ser positivo, em cm, com até 2 casas decimais");
    if (!comprimento) problemas.push("comprimento deve ser positivo, em m, com até 3 casas decimais");
    if (!valorMetroCubico) problemas.push("preço por m³ deve ser positivo, com até 2 casas decimais");
    if (observacoes.length > 1000) problemas.push("observações excedem 1.000 caracteres");
    if (problemas.length) { erros.push(`Linha ${numeroLinha}: ${problemas.join("; ")}`); return; }
    linhas.push({ numeroLinha, codigo, madeiraNome, diametro: diametro!, comprimento: comprimento!, valorMetroCubico: valorMetroCubico!, observacoes: observacoes || null });
  });
  return { linhas, erros };
}

export function prepararImportacaoPlaquetasCarga(input: { conteudo: string; codigosExistentes: Array<{ codigo: string }> }) {
  const validacao = validarCsvPlaquetasCarga(input.conteudo);
  if (validacao.erros.length) return { linhas: [], erros: validacao.erros, avisos: [] as string[] };
  const existentes = new Set(input.codigosExistentes.map((item) => normalizarCodigoPlaqueta(item.codigo)));
  const contagemNoArquivo = new Map<string, number>();
  validacao.linhas.forEach((linha) => {
    if (linha.codigo) contagemNoArquivo.set(linha.codigo, (contagemNoArquivo.get(linha.codigo) ?? 0) + 1);
  });
  const avisos: string[] = [];
  validacao.linhas.forEach((linha) => {
    if (!linha.codigo) avisos.push(`Linha ${linha.numeroLinha}: sem plaqueta física; o sistema criará uma identificação interna.`);
    else if (existentes.has(linha.codigo) || (contagemNoArquivo.get(linha.codigo) ?? 0) > 1) avisos.push(`Linha ${linha.numeroLinha}: plaqueta física "${linha.codigo}" duplicada; a tora ficará destacada e exigirá conferência manual na produção.`);
  });
  return { linhas: validacao.linhas, erros: [] as string[], avisos };
}
