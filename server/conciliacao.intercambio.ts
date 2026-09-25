export type TipoMovimentoBancario = "entrada" | "saida";

export type LinhaExtratoBancario = {
  numeroLinha: number;
  dataMovimento: string;
  descricao: string;
  tipo: TipoMovimentoBancario;
  valor: string;
  identificadorExterno: string | null;
  memoOriginal: string | null;
  numeroDocumento: string | null;
  saldoAposMovimento: string | null;
  chaveBase: string;
};

export type ResultadoImportacaoExtrato = {
  linhas: LinhaExtratoBancario[];
  erros: string[];
  saldoFinalBanco: string | null;
  dataSaldoFinalBanco: string | null;
};

const CABECALHOS_CSV = ["data", "descricao", "valor", "tipo", "identificador"] as const;

function normalizarTexto(valor: string): string {
  return valor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function lerCsv(conteudo: string, separador: string): string[][] {
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
    if (caractere === separador) { linha.push(celula); celula = ""; continue; }
    if (caractere === "\n") { linha.push(celula); linhas.push(linha); linha = []; celula = ""; continue; }
    if (caractere !== "\r") celula += caractere;
  }
  if (entreAspas) throw new Error("O arquivo CSV possui aspas sem fechamento");
  if (celula || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

function converterValor(valor: string): number | null {
  const texto = valor.replace(/[R$\s]/g, "").trim();
  if (!texto) return null;
  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");
  const normalizado = ultimaVirgula > ultimoPonto
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto.replace(/,/g, "");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function dataValida(valor: string): string | null {
  const texto = valor.trim();
  const compacta = texto.replace(/[^0-9]/g, "");
  let ano: number;
  let mes: number;
  let dia: number;
  if (/^\d{4}(?:[-/]?\d{2}){2}/.test(texto)) {
    ano = Number(compacta.slice(0, 4)); mes = Number(compacta.slice(4, 6)); dia = Number(compacta.slice(6, 8));
  } else {
    const partes = texto.split(/[\/-]/).map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
    [dia, mes, ano] = partes;
  }
  const data = new Date(ano, mes - 1, dia, 12, 0, 0);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return `${ano.toString().padStart(4, "0")}-${mes.toString().padStart(2, "0")}-${dia.toString().padStart(2, "0")}`;
}

function tipoMovimento(valor: string, valorNumerico: number): TipoMovimentoBancario | null {
  const tipo = normalizarTexto(valor);
  if (["entrada", "credito", "crédito", "c", "credit"].includes(tipo)) return "entrada";
  if (["saida", "saída", "debito", "débito", "d", "debit"].includes(tipo)) return "saida";
  if (!tipo) return valorNumerico >= 0 ? "entrada" : "saida";
  return null;
}

function linhaNormalizada(
  numeroLinha: number,
  data: string,
  descricao: string,
  valorBruto: string,
  tipoBruto: string,
  identificador: string,
  metadados: { memoOriginal?: string; numeroDocumento?: string; saldoAposMovimento?: string } = {},
): { linha?: LinhaExtratoBancario; erro?: string } {
  const dataMovimento = dataValida(data);
  const valorNumerico = converterValor(valorBruto);
  const descricaoLimpa = descricao.trim();
  const tipo = valorNumerico === null ? null : tipoMovimento(tipoBruto, valorNumerico);
  if (!dataMovimento) return { erro: `Linha ${numeroLinha}: data inválida` };
  if (!descricaoLimpa || descricaoLimpa.length > 500) return { erro: `Linha ${numeroLinha}: descrição obrigatória de até 500 caracteres` };
  if (valorNumerico === null || valorNumerico === 0) return { erro: `Linha ${numeroLinha}: valor deve ser diferente de zero` };
  if (!tipo) return { erro: `Linha ${numeroLinha}: tipo deve ser entrada ou saída` };
  const valor = Math.abs(valorNumerico).toFixed(2);
  const identificadorExterno = identificador.trim().slice(0, 300) || null;
  const memoOriginal = metadados.memoOriginal?.trim().slice(0, 500) || null;
  const numeroDocumento = metadados.numeroDocumento?.trim().slice(0, 160) || null;
  const saldoAposMovimentoNumerico = metadados.saldoAposMovimento ? converterValor(metadados.saldoAposMovimento) : null;
  const saldoAposMovimento = saldoAposMovimentoNumerico === null ? null : saldoAposMovimentoNumerico.toFixed(2);
  const chaveBase = identificadorExterno
    ? `id:${normalizarTexto(identificadorExterno)}`
    : `${dataMovimento}|${tipo}|${valor}|${normalizarTexto(descricaoLimpa)}`;
  return {
    linha: {
      numeroLinha,
      dataMovimento,
      descricao: descricaoLimpa,
      tipo,
      valor,
      identificadorExterno,
      memoOriginal,
      numeroDocumento,
      saldoAposMovimento,
      chaveBase,
    },
  };
}

function resultadoVazio(erro: string): ResultadoImportacaoExtrato {
  return { linhas: [], erros: [erro], saldoFinalBanco: null, dataSaldoFinalBanco: null };
}

export function criarModeloCsvExtratoBancario(): string {
  return `\uFEFF${CABECALHOS_CSV.join(";")}\n2026-09-01;PIX recebido de Cliente Exemplo;1250,00;entrada;EXTR-0001\n2026-09-02;Pagamento fornecedor;850,00;saida;EXTR-0002`;
}

export function prepararImportacaoCsvExtrato(conteudo: string, maximoLinhas = 2000): ResultadoImportacaoExtrato {
  if (conteudo.length > 1_000_000) return resultadoVazio("O arquivo CSV excede o limite de 1 MB");
  let tabela: string[][];
  try {
    const primeiraLinha = conteudo.split(/\r?\n/, 1)[0] ?? "";
    tabela = lerCsv(conteudo, primeiraLinha.split(";").length >= primeiraLinha.split(",").length ? ";" : ",");
  } catch (erro) {
    return resultadoVazio(erro instanceof Error ? erro.message : "Não foi possível ler o CSV");
  }
  const cabecalho = (tabela.shift() ?? []).map((campo) => normalizarTexto(campo.replace(/^\uFEFF/, "")));
  const aliases: Record<(typeof CABECALHOS_CSV)[number], string[]> = {
    data: ["data", "data movimento", "date", "dt lancamento"],
    descricao: ["descricao", "descrição", "historico", "histórico", "memo", "description"],
    valor: ["valor", "amount", "value"],
    tipo: ["tipo", "type", "natureza"],
    identificador: ["identificador", "id", "fitid", "documento", "numero documento"],
  };
  const indice = (campo: keyof typeof aliases) => cabecalho.findIndex((item) => aliases[campo].includes(item));
  const obrigatorios = ["data", "descricao", "valor"] as const;
  if (obrigatorios.some((campo) => indice(campo) < 0)) return resultadoVazio("O CSV deve conter as colunas data, descricao e valor");
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return resultadoVazio("O arquivo CSV não possui movimentos para importar");
  if (dados.length > maximoLinhas) return resultadoVazio(`O limite por importação é de ${maximoLinhas} movimentos`);
  const linhas: LinhaExtratoBancario[] = [];
  const erros: string[] = [];
  const chaves = new Set<string>();
  dados.forEach((colunas, indiceLinha) => {
    const valor = (campo: keyof typeof aliases) => {
      const posicao = indice(campo);
      return posicao >= 0 ? (colunas[posicao] ?? "") : "";
    };
    const resultado = linhaNormalizada(indiceLinha + 2, valor("data"), valor("descricao"), valor("valor"), valor("tipo"), valor("identificador"));
    if (resultado.erro) { erros.push(resultado.erro); return; }
    if (chaves.has(resultado.linha!.chaveBase)) { erros.push(`Linha ${indiceLinha + 2}: movimento duplicado dentro do arquivo`); return; }
    chaves.add(resultado.linha!.chaveBase);
    linhas.push(resultado.linha!);
  });
  return { linhas: erros.length ? [] : linhas, erros, saldoFinalBanco: null, dataSaldoFinalBanco: null };
}

function tagOfx(bloco: string, tag: string): string {
  return new RegExp(`<${tag}>([^<\r\n]+)`, "i").exec(bloco)?.[1]?.trim() ?? "";
}

export function prepararImportacaoOfxExtrato(conteudo: string, maximoLinhas = 2000): ResultadoImportacaoExtrato {
  if (conteudo.length > 1_000_000) return resultadoVazio("O arquivo OFX excede o limite de 1 MB");
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1);
  if (!blocos.length) return resultadoVazio("O OFX não possui movimentos bancários reconhecíveis");
  if (blocos.length > maximoLinhas) return resultadoVazio(`O limite por importação é de ${maximoLinhas} movimentos`);
  const linhas: LinhaExtratoBancario[] = [];
  const erros: string[] = [];
  const chaves = new Set<string>();
  blocos.forEach((bloco, indice) => {
    const numeroLinha = indice + 1;
    const memo = tagOfx(bloco, "MEMO");
    const nome = tagOfx(bloco, "NAME");
    const resultado = linhaNormalizada(
      numeroLinha,
      tagOfx(bloco, "DTPOSTED"),
      memo || nome || "Movimento OFX",
      tagOfx(bloco, "TRNAMT"),
      "",
      tagOfx(bloco, "FITID") || tagOfx(bloco, "CHECKNUM"),
      { memoOriginal: memo || nome, numeroDocumento: tagOfx(bloco, "CHECKNUM") || tagOfx(bloco, "REFNUM") },
    );
    if (resultado.erro) { erros.push(`Movimento ${numeroLinha}: ${resultado.erro.replace(/^Linha \d+: /, "")}`); return; }
    if (chaves.has(resultado.linha!.chaveBase)) { erros.push(`Movimento ${numeroLinha}: movimento duplicado dentro do arquivo`); return; }
    chaves.add(resultado.linha!.chaveBase);
    linhas.push(resultado.linha!);
  });
  const saldoFinal = converterValor(tagOfx(conteudo, "BALAMT"));
  return {
    linhas: erros.length ? [] : linhas,
    erros,
    saldoFinalBanco: saldoFinal === null ? null : saldoFinal.toFixed(2),
    dataSaldoFinalBanco: dataValida(tagOfx(conteudo, "DTASOF")),
  };
}

export function prepararImportacaoExtrato(conteudo: string, formato: "csv" | "ofx"): ResultadoImportacaoExtrato {
  return formato === "ofx" ? prepararImportacaoOfxExtrato(conteudo) : prepararImportacaoCsvExtrato(conteudo);
}
