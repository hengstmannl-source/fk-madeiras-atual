import type { LinhaComprimentoVenda } from "./vendaItemGroup";

export type EstoqueSerradoDisponivel = {
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeDisponivel: number;
};

function numeroMedida(valor: string) {
  return Number(valor.replace(",", "."));
}

function normalizarMadeira(valor: string) {
  return valor.trim().toLocaleUpperCase("pt-BR");
}

export function disponibilidadeEstoqueVenda(input: {
  estoque: EstoqueSerradoDisponivel[];
  madeiraNome: string;
  espessuraCm: string;
  larguraCm: string;
  comprimento: string;
}) {
  const espessura = numeroMedida(input.espessuraCm);
  const largura = numeroMedida(input.larguraCm);
  const comprimento = numeroMedida(input.comprimento);
  if (!input.madeiraNome || !Number.isFinite(espessura) || espessura <= 0 || !Number.isFinite(largura) || largura <= 0 || !Number.isFinite(comprimento) || comprimento <= 0) return null;
  return input.estoque.find((item) => (
    normalizarMadeira(item.madeiraNome) === normalizarMadeira(input.madeiraNome)
    && Math.abs(Number(item.espessura) - espessura) < 0.0001
    && Math.abs(Number(item.largura) - largura) < 0.0001
    && Math.abs(Number(item.comprimento) - comprimento) < 0.0001
  ))?.quantidadeDisponivel ?? 0;
}

export function prepararModeloMedida(input: {
  nome: string;
  madeiraNome: string;
  precoM3: string;
  espessuraCm: string;
  larguraCm: string;
  linhas: LinhaComprimentoVenda[];
}) {
  const nome = input.nome.trim();
  const comprimentos = input.linhas.filter((linha) => linha.comprimento.trim() && linha.quantidade.trim())
    .map(({ comprimento, quantidade }) => ({ comprimento: comprimento.trim(), quantidade: quantidade.trim() }));
  if (!nome) return { erro: "Dê um nome ao modelo", comprimentos: [] };
  if (input.linhas.some((linha) => Boolean(linha.comprimento.trim()) !== Boolean(linha.quantidade.trim()))) {
    return { erro: "Preencha os comprimentos e as quantidades de cada linha", comprimentos: [] };
  }
  if (!input.madeiraNome || !input.precoM3 || !input.espessuraCm || !input.larguraCm || !comprimentos.length) {
    return { erro: "Preencha madeira, preço, medida e ao menos um comprimento antes de guardar o modelo", comprimentos: [] };
  }
  return { nome, comprimentos };
}
