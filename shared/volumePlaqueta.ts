/** Volume para consulta por situação, sem alterar o saldo operacional. */
export function volumePlaquetaPorSituacao(plaqueta: {
  estado: string;
  volumeInicial?: string | number | null;
  volumeDisponivel?: string | number | null;
}) {
  const volume = Number(plaqueta.estado === "disponivel" ? plaqueta.volumeDisponivel : plaqueta.volumeInicial);
  return Number.isFinite(volume) ? volume : 0;
}
