export const CABECALHOS_CSV_LANCAMENTOS = [
  "referencia", "tipo", "descricao", "categoria", "centro_custo", "valor", "data_emissao", "data_vencimento", "competencia", "contraparte", "observacoes",
] as const;

export type LinhaImportacaoLancamento = {
  numeroLinha: number;
  referencia: string;
  tipo: "receber" | "pagar";
  descricao: string;
  categoria: string;
  centroCusto: string;
  valor: string;
  dataEmissao: string;
  dataVencimento: string;
  competencia: string | null;
  contraparte: string | null;
  observacoes: string | null;
};

export type CategoriaParaImportacao = { id: number; nome: string; tipo: "receita" | "despesa" | "ambos" };
export type CentroCustoParaImportacao = { id: number; nome: string; codigo: string; ativo?: boolean | number | null };
export type TituloExistenteParaImportacao = { id: number; chaveImportacao?: string | null };

type LinhaExportacaoLancamento = {
  id: number;
  chaveImportacao?: string | null;
  tipo: "receber" | "pagar";
  descricao: string;
  categoria: string;
  centroCusto?: string | null;
  valor: string | number;
  dataEmissao: Date | string;
  dataVencimento: Date | string;
  competencia?: Date | string | null;
  contraparte?: string | null;
  observacoes?: string | null;
};

function escaparCelulaCsv(valor: string | number | null | undefined): string {
  const texto = String(valor ?? "");
  const protegido = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return /[;"\n\r]/.test(protegido) ? `"${protegido.replace(/"/g, '""')}"` : protegido;
}

function dataParaCsv(valor: Date | string | null | undefined): string {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return `${String(data.getUTCDate()).padStart(2, "0")}/${String(data.getUTCMonth() + 1).padStart(2, "0")}/${data.getUTCFullYear()}`;
}

function moedaParaCsv(valor: string | number): string {
  return Number(valor).toFixed(2).replace(".", ",");
}

function lerLinhasCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  for (let i = 0; i < conteudo.length; i += 1) {
    const caractere = conteudo[i];
    if (entreAspas) {
      if (caractere === '"' && conteudo[i + 1] === '"') { celula += '"'; i += 1; }
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

function normalizarDataCsv(valor: string): string | null {
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!brasileira && !iso) return null;
  const [, primeiro, segundo, terceiro] = brasileira ?? iso!;
  const [ano, mes, dia] = brasileira
    ? [Number(terceiro), Number(segundo), Number(primeiro)]
    : [Number(primeiro), Number(segundo), Number(terceiro)];
  const data = new Date(ano, mes - 1, dia, 12);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function normalizarValor(valor: string): string | null {
  const semEspacos = valor.trim().replace(/\s/g, "");
  const normalizado = semEspacos.includes(",")
    ? semEspacos.replace(/\./g, "").replace(",", ".")
    : semEspacos;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizado) || Number(normalizado) <= 0) return null;
  return Number(normalizado).toFixed(2);
}

export function criarModeloCsvLancamentos(): string {
  return `\uFEFF${CABECALHOS_CSV_LANCAMENTOS.join(";")}\nEXEMPLO-001;receber;Venda avulsa;Receitas;Comercial;1250,00;01/08/2026;15/08/2026;01/08/2026;Cliente exemplo;Preencha esta linha como referência`;
}

export function exportarLancamentosCsv(lancamentos: LinhaExportacaoLancamento[]): string {
  const linhas = lancamentos.map((lancamento) => [
    lancamento.chaveImportacao || `FK-${lancamento.id}`,
    lancamento.tipo,
    lancamento.descricao,
    lancamento.categoria,
    lancamento.centroCusto,
    moedaParaCsv(lancamento.valor),
    dataParaCsv(lancamento.dataEmissao),
    dataParaCsv(lancamento.dataVencimento),
    dataParaCsv(lancamento.competencia),
    lancamento.contraparte,
    lancamento.observacoes,
  ].map(escaparCelulaCsv).join(";"));
  return `\uFEFF${CABECALHOS_CSV_LANCAMENTOS.join(";")}\n${linhas.join("\n")}`;
}

export function validarCsvLancamentos(conteudo: string, maximoLinhas = 1000): { linhas: LinhaImportacaoLancamento[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { linhas: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { linhas: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indices = CABECALHOS_CSV_LANCAMENTOS.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { linhas: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_LANCAMENTOS.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { linhas: [], erros: ["O arquivo CSV não possui lançamentos para importar"] };
  if (dados.length > maximoLinhas) return { linhas: [], erros: [`O limite por importação é de ${maximoLinhas} lançamentos`] };

  const referencias = new Set<string>();
  const linhas: LinhaImportacaoLancamento[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indiceLinha) => {
    const numeroLinha = indiceLinha + 2;
    const valor = (campo: typeof CABECALHOS_CSV_LANCAMENTOS[number]) => (colunas[indices[CABECALHOS_CSV_LANCAMENTOS.indexOf(campo)]] ?? "").trim();
    const referencia = valor("referencia");
    const tipo = valor("tipo").toLowerCase();
    const descricao = valor("descricao");
    const categoria = valor("categoria");
    const centroCusto = valor("centro_custo");
    const valorOriginal = normalizarValor(valor("valor"));
    const dataEmissao = normalizarDataCsv(valor("data_emissao"));
    const dataVencimento = normalizarDataCsv(valor("data_vencimento"));
    const competenciaOriginal = valor("competencia");
    const competencia = competenciaOriginal ? normalizarDataCsv(competenciaOriginal) : null;
    const problemas: string[] = [];
    if (!referencia || referencia.length > 120) problemas.push("referência obrigatória de até 120 caracteres");
    if (referencias.has(referencia)) problemas.push("referência duplicada no arquivo");
    else if (referencia) referencias.add(referencia);
    if (tipo !== "receber" && tipo !== "pagar") problemas.push("tipo deve ser receber ou pagar");
    if (descricao.length < 2 || descricao.length > 300) problemas.push("descrição deve ter entre 2 e 300 caracteres");
    if (!categoria || categoria.length > 150) problemas.push("categoria obrigatória de até 150 caracteres");
    if (!centroCusto || centroCusto.length > 150) problemas.push("centro_custo obrigatório de até 150 caracteres");
    if (!valorOriginal) problemas.push("valor deve ser positivo, com no máximo duas casas decimais");
    if (!dataEmissao) problemas.push("data_emissao inválida (DD/MM/AAAA)");
    if (!dataVencimento) problemas.push("data_vencimento inválida (DD/MM/AAAA)");
    if (competenciaOriginal && !competencia) problemas.push("competencia inválida (DD/MM/AAAA)");
    if (valor("contraparte").length > 300) problemas.push("contraparte excede 300 caracteres");
    if (valor("observacoes").length > 4000) problemas.push("observações excedem 4000 caracteres");
    if (problemas.length) { erros.push(`Linha ${numeroLinha}: ${problemas.join("; ")}`); return; }
    linhas.push({ numeroLinha, referencia, tipo: tipo as "receber" | "pagar", descricao, categoria, centroCusto, valor: valorOriginal!, dataEmissao: dataEmissao!, dataVencimento: dataVencimento!, competencia, contraparte: valor("contraparte") || null, observacoes: valor("observacoes") || null });
  });
  return { linhas, erros };
}

export function prepararImportacaoLancamentos(input: {
  conteudo: string;
  categorias: CategoriaParaImportacao[];
  centrosCusto: CentroCustoParaImportacao[];
  titulosExistentes: TituloExistenteParaImportacao[];
}) {
  const validacao = validarCsvLancamentos(input.conteudo);
  if (validacao.erros.length) return { linhas: [], erros: validacao.erros };
  const categoriasPorNome = new Map(input.categorias.map((categoria) => [categoria.nome.trim().toLocaleLowerCase("pt-BR"), categoria]));
  const centrosPorIdentificador = new Map(input.centrosCusto.flatMap((centro) => [
    [centro.nome.trim().toLocaleLowerCase("pt-BR"), centro],
    [centro.codigo.trim().toLocaleLowerCase("pt-BR"), centro],
  ]));
  const referenciasExistentes = new Set(input.titulosExistentes.map((titulo) => titulo.chaveImportacao || `FK-${titulo.id}`));
  const erros: string[] = [];
  const linhas = validacao.linhas.map((linha) => {
    const categoria = categoriasPorNome.get(linha.categoria.toLocaleLowerCase("pt-BR"));
    if (!categoria) { erros.push(`Linha ${linha.numeroLinha}: categoria "${linha.categoria}" não encontrada`); return null; }
    const centroCusto = centrosPorIdentificador.get(linha.centroCusto.toLocaleLowerCase("pt-BR"));
    if (!centroCusto || !Boolean(centroCusto.ativo ?? true)) { erros.push(`Linha ${linha.numeroLinha}: centro de custo ativo "${linha.centroCusto}" não encontrado`); return null; }
    const tipoPermitido = categoria.tipo === "ambos" || (linha.tipo === "receber" && categoria.tipo === "receita") || (linha.tipo === "pagar" && categoria.tipo === "despesa");
    if (!tipoPermitido) { erros.push(`Linha ${linha.numeroLinha}: a categoria "${linha.categoria}" não é compatível com ${linha.tipo}`); return null; }
    if (referenciasExistentes.has(linha.referencia)) { erros.push(`Linha ${linha.numeroLinha}: a referência "${linha.referencia}" já foi importada ou exportada anteriormente`); return null; }
    return { ...linha, categoriaId: categoria.id, centroCustoId: centroCusto.id };
  }).filter(Boolean) as Array<LinhaImportacaoLancamento & { categoriaId: number; centroCustoId: number }>;
  return { linhas: erros.length ? [] : linhas, erros };
}
