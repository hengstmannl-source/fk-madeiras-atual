export type EntradaDiesel = {
  litros: string | number;
  valorTotal: string | number;
};

export type SaidaDiesel = {
  litros: string | number;
  custoTotal: string | number;
};

export type ResumoTanqueDiesel = {
  litrosEntrados: number;
  litrosAbastecidos: number;
  saldoLitros: number;
  valorNotas: number;
  custoApropriado: number;
  valorEstoque: number;
  custoMedioLitro: number;
};

export function validarExclusaoNotaDiesel(params: { possuiAbastecimentos: boolean; possuiBaixasAtivas: boolean }) {
  if (params.possuiAbastecimentos) {
    throw new Error("Não é possível excluir esta nota porque já existem abastecimentos registrados. Mantenha a nota para preservar o saldo e o custo médio do tanque.");
  }
  if (params.possuiBaixasAtivas) {
    throw new Error("Não é possível excluir esta nota porque seu pagamento possui baixa financeira ativa. Estorne ou exclua o pagamento antes.");
  }
}

const numero = (valor: string | number) => Number(String(valor).replace(",", ".")) || 0;
const arredondar = (valor: number, casas: number) => Number(valor.toFixed(casas));

/** Calcula o saldo físico e financeiro pelo método de custo médio móvel. */
export function calcularResumoTanqueDiesel(
  entradas: EntradaDiesel[],
  saidas: SaidaDiesel[],
): ResumoTanqueDiesel {
  const litrosEntrados = entradas.reduce((total, item) => total + numero(item.litros), 0);
  const valorNotas = entradas.reduce((total, item) => total + numero(item.valorTotal), 0);
  const litrosAbastecidos = saidas.reduce((total, item) => total + numero(item.litros), 0);
  const custoApropriado = saidas.reduce((total, item) => total + numero(item.custoTotal), 0);
  const saldoLitros = arredondar(litrosEntrados - litrosAbastecidos, 3);
  const valorEstoque = arredondar(valorNotas - custoApropriado, 2);

  return {
    litrosEntrados: arredondar(litrosEntrados, 3),
    litrosAbastecidos: arredondar(litrosAbastecidos, 3),
    saldoLitros,
    valorNotas: arredondar(valorNotas, 2),
    custoApropriado: arredondar(custoApropriado, 2),
    valorEstoque,
    custoMedioLitro: saldoLitros > 0 ? arredondar(valorEstoque / saldoLitros, 4) : 0,
  };
}

/** Determina o custo operacional do abastecimento sem criar uma segunda conta a pagar. */
export function calcularCustoAbastecimentoDiesel(
  resumo: ResumoTanqueDiesel,
  litros: string | number,
) {
  const quantidade = arredondar(numero(litros), 3);
  if (!(quantidade > 0)) throw new Error("Informe uma quantidade de litros válida");
  if (quantidade > resumo.saldoLitros) {
    throw new Error(`Saldo insuficiente no tanque. Disponível: ${resumo.saldoLitros.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`);
  }
  const custoUnitario = resumo.custoMedioLitro;
  return {
    litros: quantidade,
    custoUnitario,
    custoTotal: arredondar(quantidade * custoUnitario, 2),
  };
}
