import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownToLine, ArrowUpFromLine, CircleAlert, CircleDollarSign,
  ArrowRight, CalendarClock, WalletCards,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { useMemo } from "react";
import { saldoAbertoDashboard, resumirDashboardFinanceiro } from "@/lib/dashboardFinanceiro";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const titulos = trpc.financeiro.titulos.list.useQuery();
  const alertas = trpc.financeiro.alertas.list.useQuery();
  const isLoading = titulos.isLoading || alertas.isLoading;
  const resumo = useMemo(() => resumirDashboardFinanceiro(titulos.data ?? []), [titulos.data]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    { title: "A receber", value: formatCurrency(resumo.receber), icon: ArrowDownToLine, color: "text-emerald-700", bg: "bg-emerald-50", path: "/financeiro?tipo=receber" },
    { title: "A pagar", value: formatCurrency(resumo.pagar), icon: ArrowUpFromLine, color: "text-rose-700", bg: "bg-rose-50", path: "/financeiro?tipo=pagar" },
    { title: "Saldo projetado", value: formatCurrency(resumo.receber - resumo.pagar), icon: CircleDollarSign, color: "text-primary", bg: "bg-primary/10", path: "/financeiro" },
    { title: "Em atraso", value: formatCurrency(resumo.vencido), icon: CircleAlert, color: "text-amber-700", bg: "bg-amber-50", path: "/financeiro" },
  ];

  const proximosTitulos = (titulos.data ?? []).filter((titulo: any) => !["quitado", "cancelado"].includes(titulo.estado)).sort((a: any, b: any) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()).slice(0, 5);

  return (
    <div className="max-w-none space-y-7">
      <PageHeader icon={WalletCards} eyebrow="Visão executiva" title="Dashboard" description="Acompanhe compromissos, liquidez projetada e pontos de atenção da operação." />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="fk-kpi-card cursor-pointer transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md" onClick={() => setLocation(kpi.path)}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fk-eyebrow">{kpi.title}</p>
                  <p className="fk-kpi-value mt-1 text-2xl font-extrabold text-foreground">{kpi.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="fk-panel lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Próximos compromissos</CardTitle>
          <button onClick={() => setLocation("/financeiro")} className="text-sm text-primary hover:underline flex items-center gap-1">
            Ver financeiro <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </CardHeader>
        <CardContent>
          {proximosTitulos.length > 0 ? (
            <div className="space-y-2">
              {proximosTitulos.map((titulo: any) => (
                <div
                  key={titulo.id}
                  onClick={() => setLocation(titulo.tipo === "pagar" ? "/financeiro?tipo=pagar" : "/financeiro?tipo=receber")}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${titulo.tipo === "receber" ? "bg-emerald-50" : "bg-rose-50"}`}>
                      {titulo.tipo === "receber" ? <ArrowDownToLine className="h-4 w-4 text-emerald-700" /> : <ArrowUpFromLine className="h-4 w-4 text-rose-700" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{titulo.descricao}</p>
                      <p className="text-xs text-muted-foreground">Vence em {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(titulo.dataVencimento))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs ${titulo.tipo === "receber" ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}`}>{titulo.tipo === "receber" ? "Receber" : "Pagar"}</Badge>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(saldoAbertoDashboard(titulo))}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum compromisso financeiro em aberto.
            </div>
          )}
        </CardContent>
        </Card>
        <Card className="border border-amber-300/70 bg-amber-50/55 shadow-sm"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-950"><CalendarClock className="h-4 w-4 text-amber-700" />Alertas financeiros</CardTitle></CardHeader><CardContent>{alertas.data?.length ? <div className="space-y-3">{alertas.data.slice(0, 3).map((alerta: any) => <div key={alerta.id} className="rounded-lg border border-amber-200/90 bg-card p-3"><p className="text-sm font-medium text-amber-950">{alerta.mensagem}</p><p className="mt-1 text-xs text-amber-800">{formatCurrency(alerta.valorOriginal)}</p></div>)}</div> : <p className="py-8 text-center text-sm text-amber-800">Nenhum alerta financeiro ativo.</p>}</CardContent></Card>
      </div>
    </div>
  );
}
