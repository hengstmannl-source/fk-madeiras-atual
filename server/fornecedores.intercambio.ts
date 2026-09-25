const CABECALHOS_CSV_FORNECEDORES = ["nome", "contacto", "email", "documento", "endereco", "observacoes"] as const;

export type LinhaImportacaoFornecedor = {
  numeroLinha: number;
  nome: string;
  contacto: string | null;
  email: string | null;
  documento: string | null;
  endereco: string | null;
  observacoes: string | null;
};

export type FornecedorExistenteParaImportacao = {
  id: number;
  nome: string;
  email?: string | null;
  documento?: string | null;
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

function normalizarTexto(valor: string): string {
  return valor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function normalizarDocumento(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function chavesFornecedor(fornecedor: { nome: string; email?: string | null; documento?: string | null }): string[] {
  const chaves = [`nome:${normalizarTexto(fornecedor.nome)}`];
  if (fornecedor.email) chaves.push(`email:${fornecedor.email.trim().toLocaleLowerCase("pt-BR")}`);
  const documento = fornecedor.documento ? normalizarDocumento(fornecedor.documento) : "";
  if (documento) chaves.push(`documento:${documento}`);
  return chaves;
}

export function criarModeloCsvFornecedores(): string {
  return `\uFEFF${CABECALHOS_CSV_FORNECEDORES.join(";")}\nMadeireira Exemplo;(00) 00000-0000;contato@exemplo.com;00.000.000/0001-00;Rua das Madeiras, 100;Preencha esta linha apenas como exemplo`;
}

export function validarCsvFornecedores(conteudo: string, maximoLinhas = 1000): { linhas: LinhaImportacaoFornecedor[]; erros: string[] } {
  if (conteudo.length > 1_000_000) return { linhas: [], erros: ["O arquivo CSV excede o limite de 1 MB"] };
  let tabela: string[][];
  try { tabela = lerLinhasCsv(conteudo); } catch (erro) { return { linhas: [], erros: [erro instanceof Error ? erro.message : "Não foi possível ler o CSV"] }; }
  const cabecalho = (tabela.shift() ?? []).map((campo) => campo.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("pt-BR"));
  const indices = CABECALHOS_CSV_FORNECEDORES.map((campo) => cabecalho.indexOf(campo));
  if (indices.some((indice) => indice < 0)) return { linhas: [], erros: [`Use o modelo CSV com os cabeçalhos: ${CABECALHOS_CSV_FORNECEDORES.join(", ")}`] };
  const dados = tabela.filter((linha) => linha.some((campo) => campo.trim()));
  if (!dados.length) return { linhas: [], erros: ["O arquivo CSV não possui fornecedores para importar"] };
  if (dados.length > maximoLinhas) return { linhas: [], erros: [`O limite por importação é de ${maximoLinhas} fornecedores`] };

  const linhas: LinhaImportacaoFornecedor[] = [];
  const erros: string[] = [];
  dados.forEach((colunas, indiceLinha) => {
    const numeroLinha = indiceLinha + 2;
    const valor = (campo: typeof CABECALHOS_CSV_FORNECEDORES[number]) => (colunas[indices[CABECALHOS_CSV_FORNECEDORES.indexOf(campo)]] ?? "").trim();
    const nome = valor("nome");
    const contacto = valor("contacto");
    const email = valor("email");
    const documento = valor("documento");
    const endereco = valor("endereco");
    const observacoes = valor("observacoes");
    const problemas: string[] = [];
    if (nome.length < 2 || nome.length > 300) problemas.push("nome obrigatório entre 2 e 300 caracteres");
    if (contacto.length > 100) problemas.push("contacto excede 100 caracteres");
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 300)) problemas.push("e-mail inválido ou superior a 300 caracteres");
    if (documento.length > 30) problemas.push("documento excede 30 caracteres");
    if (endereco.length > 3000) problemas.push("endereço excede 3000 caracteres");
    if (observacoes.length > 4000) problemas.push("observações excedem 4000 caracteres");
    if (problemas.length) { erros.push(`Linha ${numeroLinha}: ${problemas.join("; ")}`); return; }
    linhas.push({ numeroLinha, nome, contacto: contacto || null, email: email || null, documento: documento || null, endereco: endereco || null, observacoes: observacoes || null });
  });
  return { linhas, erros };
}

export function prepararImportacaoFornecedores(input: { conteudo: string; fornecedoresExistentes: FornecedorExistenteParaImportacao[] }) {
  const validacao = validarCsvFornecedores(input.conteudo);
  if (validacao.erros.length) return { linhas: [], erros: validacao.erros };
  const chavesExistentes = new Set(input.fornecedoresExistentes.flatMap(chavesFornecedor));
  const chavesDoArquivo = new Set<string>();
  const erros: string[] = [];
  const linhas = validacao.linhas.filter((linha) => {
    const chaves = chavesFornecedor(linha);
    if (chaves.some((chave) => chavesExistentes.has(chave))) {
      erros.push(`Linha ${linha.numeroLinha}: fornecedor já cadastrado com o mesmo nome, e-mail ou documento`);
      return false;
    }
    if (chaves.some((chave) => chavesDoArquivo.has(chave))) {
      erros.push(`Linha ${linha.numeroLinha}: fornecedor duplicado dentro da própria planilha`);
      return false;
    }
    chaves.forEach((chave) => chavesDoArquivo.add(chave));
    return true;
  });
  return { linhas: erros.length ? [] : linhas, erros };
}
