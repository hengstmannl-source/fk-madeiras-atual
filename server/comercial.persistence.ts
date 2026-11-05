import type {
  InsertAproveitamentoOrcamento,
  InsertComponentePacoteOrcamento,
  InsertItemOrcamento,
  InsertOrcamento,
  InsertTaxaAdicionalOrcamento,
} from "../drizzle/schema";
import type { ResultadoAdaptadorComercial } from "./comercial.adapter";

/** Metadados exclusivos de uma nova operação, sem identidade ou estado histórico. */
export type MetadadosNovaOperacaoComercial = Pick<
  InsertOrcamento,
  | "empresaId"
  | "criadoPor"
  | "estado"
  | "observacoes"
  | "vendedor"
  | "dataValidade"
  | "dataVencimento"
  | "competencia"
>;

export type ItemComercialParaPersistencia = Omit<
  InsertItemOrcamento,
  "empresaId" | "orcamentoId"
> & {
  componentesPacote: Array<Omit<
    InsertComponentePacoteOrcamento,
    "empresaId" | "itemOrcamentoId"
  >>;
};

export type AproveitamentoComercialParaPersistencia = Omit<
  InsertAproveitamentoOrcamento,
  "empresaId" | "orcamentoId" | "createdAt"
>;

export type TaxaComercialParaPersistencia = Omit<
  InsertTaxaAdicionalOrcamento,
  "empresaId" | "orcamentoId" | "createdAt"
>;

export type PersistenciaNovaOperacaoComercial = {
  cabecalho: InsertOrcamento;
  itens: ItemComercialParaPersistencia[];
  aproveitamentos: AproveitamentoComercialParaPersistencia[];
  taxasAdicionais: TaxaComercialParaPersistencia[];
};

function centavos(valor: string, campo: string): bigint {
  const correspondencia = /^(-?)(\d+)\.(\d{2})$/.exec(valor);
  if (!correspondencia) throw new Error(`${campo}: valor monetário preparado inválido`);
  const centavoAbsoluto = BigInt(`${correspondencia[2]}${correspondencia[3]}`);
  return correspondencia[1] === "-" ? -centavoAbsoluto : centavoAbsoluto;
}

/**
 * Converte a saída autoritativa do adaptador em valores de INSERT para uma
 * operação nova. Não lê/escreve banco e não recalcula nenhum valor comercial.
 * Itens e componentes permanecem aninhados e ordenados para que o repository
 * associe os componentes ao ID do item gerado durante a transação.
 */
export function prepararPersistenciaNovaOperacaoComercial(
  calculo: ResultadoAdaptadorComercial,
  metadados: MetadadosNovaOperacaoComercial,
): PersistenciaNovaOperacaoComercial {
  const somaLinhasEmCentavos = calculo.itens.reduce(
    (soma, item, indice) => soma + centavos(item.valorTotal, `Item ${indice + 1}`),
    BigInt(0),
  ) + calculo.aproveitamentos.reduce(
    (soma, item, indice) => soma + centavos(item.valorTotal, `Aproveitamento ${indice + 1}`),
    BigInt(0),
  );
  if (somaLinhasEmCentavos !== centavos(calculo.cabecalho.subtotal, "Subtotal")) {
    throw new Error("Subtotal preparado não corresponde à soma das linhas comerciais");
  }

  return {
    cabecalho: {
      ...calculo.cabecalho,
      numero: null,
      empresaId: metadados.empresaId,
      criadoPor: metadados.criadoPor,
      estado: metadados.estado,
      observacoes: metadados.observacoes,
      vendedor: metadados.vendedor,
      dataValidade: metadados.dataValidade,
      dataVencimento: metadados.dataVencimento,
      competencia: metadados.competencia,
      versaoCalculoComercial: 1,
    },
    itens: calculo.itens.map(({ componentesPacote, ...item }) => ({
      ...item,
      componentesPacote: componentesPacote.map(({ quantidade, ...componente }) => ({
        ...componente,
        quantidadePorPacote: quantidade,
      })),
    })),
    // Preserve valorTotal calculado pelo motor; não usar Number/toFixed aqui.
    aproveitamentos: calculo.aproveitamentos.map((aproveitamento) => ({ ...aproveitamento })),
    taxasAdicionais: calculo.taxasAdicionais.map((taxa) => ({ ...taxa })),
  };
}
