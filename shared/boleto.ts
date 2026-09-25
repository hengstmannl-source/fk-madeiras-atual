export type DadosBoletoNormalizados = {
  codigoBarras: string | null;
  linhaDigitavel: string | null;
};

const TAMANHOS_VALIDOS = new Set([44, 47, 48]);

export function somenteDigitosBoleto(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

export function normalizarDadosBoleto(valor: string | null | undefined): DadosBoletoNormalizados | null {
  const digitos = somenteDigitosBoleto(valor);
  if (!TAMANHOS_VALIDOS.has(digitos.length)) return null;

  return {
    codigoBarras: digitos.length === 44 ? digitos : null,
    linhaDigitavel: digitos.length === 47 || digitos.length === 48 ? digitos : null,
  };
}

export function extrairDadosBoletoDeTexto(texto: string): DadosBoletoNormalizados | null {
  const candidatos = texto.match(/(?:\d[\s.\-]*){44,52}/g) ?? [];
  for (const candidato of candidatos) {
    const dados = normalizarDadosBoleto(candidato);
    if (dados) return dados;
  }
  return null;
}
