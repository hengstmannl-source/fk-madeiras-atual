import { decimalParaNumero, saldoAbertoTitulo } from "./financeiro.logic";

export type PedidoPerfilCliente = {
  id: number;
  numero: string | null;
  estado: "rascunho" | "enviado" | "aprovado" | "rejeitado";
  total: string | number;
  pago: boolean | number;
  entregue: boolean | number;
  dataVencimento: Date | null;
  createdAt: Date;
};

export type TituloPerfilCliente = {
  id: number;
  descricao: string;
  origem: string;
  orcamentoId: number | null;
  valorOriginal: string | number;
  desconto: string | number;
  juros: string | number;
  valorBaixado: string | number;
  dataVencimento: Date;
  estado: "aberto" | "parcial" | "quitado" | "vencido" | "cancelado";
};

export function montarPerfilCliente<TCliente>(cliente: TCliente, pedidos: PedidoPerfilCliente[], titulos: TituloPerfilCliente[]) {
  const historicoPedidos = pedidos.map((pedido) => ({
    ...pedido,
    total: decimalParaNumero(pedido.total),
  }));
  const pedidosConfirmados = historicoPedidos.filter((pedido) => pedido.estado === "aprovado");
  const titulosAbertos = titulos
    .filter((titulo) => titulo.estado !== "quitado" && titulo.estado !== "cancelado")
    .map((titulo) => ({
      ...titulo,
      valorOriginal: decimalParaNumero(titulo.valorOriginal),
      valorBaixado: decimalParaNumero(titulo.valorBaixado),
      saldoAberto: saldoAbertoTitulo(titulo.valorOriginal, titulo.desconto, titulo.juros, titulo.valorBaixado),
    }));

  return {
    cliente,
    resumo: {
      totalComprado: pedidosConfirmados.reduce((soma, pedido) => soma + pedido.total, 0),
      pedidosConfirmados: pedidosConfirmados.length,
      pedidosRegistrados: historicoPedidos.length,
      titulosEmAberto: titulosAbertos.length,
      totalEmAberto: titulosAbertos.reduce((soma, titulo) => soma + titulo.saldoAberto, 0),
    },
    ultimosPedidos: historicoPedidos.slice(0, 5),
    historicoPedidos,
    titulosAbertos,
  };
}
