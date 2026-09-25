import { describe, expect, it, vi } from "vitest";
import { dashboardMenuItems, dashboardNavigation, getNavigationPresentation, gruposExpandidosIniciais, handleNavigationItemClick, isItemActive } from "../client/src/components/DashboardLayout";

describe("navegação principal", () => {
  it("não apresenta o cadastro de madeiras como aba lateral", () => {
    expect(dashboardMenuItems.map((item) => item.label)).not.toContain("Madeiras");
    expect(dashboardMenuItems.map((item) => item.path)).not.toContain("/madeiras");
  });

  it("organiza financeiro e vendas com as opções prioritárias", () => {
    expect(dashboardNavigation.financeiro.map((item) => item.label)).toEqual(["Financeiro", "Contas a pagar", "Contas a receber", "Contas pagas", "Contas recebidas", "Caixa Cheque", "Conciliação bancária", "Rentabilidade da madeira"]);
    expect(dashboardNavigation.vendas.map((item) => item.label)).toEqual(["Vendas", "Aprovados", "Pagas", "Entregues", "Concluídas", "Acerto comercial"]);
    expect(dashboardNavigation.producao.map((item) => item.label)).toEqual(["Produção", "Estoque", "Relatório de plaquetas", "Inventário"]);
    expect(dashboardNavigation.producao.every((item) => !item.disabled)).toBe(true);
    expect(dashboardNavigation.combustivel.map((item) => item.label)).toEqual(["Diesel"]);
    expect(dashboardNavigation.combustivel.every((item) => !item.disabled)).toBe(true);
  });

  it("navega diretamente para o módulo Diesel disponível", () => {
    const navigate = vi.fn();
    const notify = vi.fn();
    for (const item of dashboardNavigation.combustivel) handleNavigationItemClick(item, navigate, notify);
    expect(navigate).toHaveBeenCalledWith("/diesel");
    expect(notify).not.toHaveBeenCalled();
  });

  it("leva os atalhos financeiros diretamente às listas corretas e os destaca pela URL", () => {
    const [, contasPagar, contasReceber, contasPagas, contasRecebidas] = dashboardNavigation.financeiro;
    expect(contasPagar.path).toBe("/financeiro?tipo=pagar");
    expect(contasReceber.path).toBe("/financeiro?tipo=receber");
    expect(contasPagas.path).toBe("/financeiro?tipo=pagas");
    expect(contasRecebidas.path).toBe("/financeiro?tipo=recebidas");
    expect(isItemActive(contasPagar, "/financeiro", "?tipo=pagar")).toBe(true);
    expect(isItemActive(contasPagar, "/financeiro", "?tipo=receber")).toBe(false);
    expect(isItemActive(contasReceber, "/financeiro", "?tipo=receber")).toBe(true);
    expect(isItemActive(contasPagas, "/financeiro", "?tipo=pagas")).toBe(true);
    expect(isItemActive(contasRecebidas, "/financeiro", "?tipo=recebidas")).toBe(true);
    expect(isItemActive(dashboardNavigation.financeiro[0], "/financeiro", "?tipo=receber")).toBe(true);
    expect(dashboardNavigation.financeiro[5].path).toBe("/financeiro/caixa-cheque");
    expect(isItemActive(dashboardNavigation.financeiro[5], "/financeiro/caixa-cheque", "")).toBe(true);
  });

  it("mantém todos os grupos expandidos por padrão e respeita grupos recolhidos salvos", () => {
    expect(gruposExpandidosIniciais(null)).toMatchObject({ Financeiro: true, Vendas: true, Gestão: true, Produção: true, Combustível: true });
    expect(gruposExpandidosIniciais(JSON.stringify({ Financeiro: false, Produção: false }))).toMatchObject({ Financeiro: false, Vendas: true, Produção: false });
    expect(gruposExpandidosIniciais("invalido")).toMatchObject({ Financeiro: true, Produção: true });
  });

  it("mantém a barra lateral recolhível no desktop e ativa o cabeçalho de navegação no mobile", () => {
    expect(getNavigationPresentation(false)).toMatchObject({ collapsible: "icon", showMobileHeader: false });
    expect(getNavigationPresentation(true)).toMatchObject({ collapsible: "icon", showMobileHeader: true });
  });
});
