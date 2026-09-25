import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, CircleDollarSign, Download, FileSpreadsheet, FileText, FilterX, Loader2, Search, TrendingDown, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { exportarRelatorioMargemPdf, linhasMargemParaPlanilha } from "@/lib/relatorioMargemExport";

const formatarMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatarPercentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function formatarData(data: Date | string | null | undefined) {
  if (!data) return "—";
  const valor = new Date(data);
  return Number.isNaN(valor.getTime()) ? "—" : valor.toLocaleDateString("pt-BR");
}

export default function RelatorioMargemVendasPage() {
  const relatorio = trpc.orcamento.relatorioMargem.useQuery();
  const [busca, setBusca] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [tipoTaxaFiltro, setTipoTaxaFiltro] = useState("todos");
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const vendedores = useMemo(() => Array.from(new Set((relatorio.data ?? []).map((venda) => venda.vendedor?.trim()).filter((vendedor): vendedor is string => Boolean(vendedor)))).sort((a, b) => a.localeCompare(b, "pt-BR")), [relatorio.data]);

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const inicio = dataInicial ? new Date(`${dataInicial}T00:00:00`) : null;
    const fim = dataFinal ? new Date(`${dataFinal}T23:59:59.999`) : null;
    return (relatorio.data ?? []).filter((venda) => {
      const dataVenda = new Date(venda.createdAt);
      const textoVenda = `${venda.numero ?? ""} ${venda.clienteNome ?? ""}`.toLocaleLowerCase("pt-BR");
      const tiposDeTaxa = venda.taxas.map((taxa) => taxa.tipo);
      const possuiTaxa = tiposDeTaxa.length > 0;
      return (!termo || textoVenda.includes(termo))
        && (!inicio || dataVenda >= inicio)
        && (!fim || dataVenda <= fim)
        && (vendedorFiltro === "todos" || venda.vendedor?.trim() === vendedorFiltro)
        && (tipoTaxaFiltro === "todos" || (tipoTaxaFiltro === "sem_taxa" ? !possuiTaxa : tiposDeTaxa.includes(tipoTaxaFiltro as "percentual" | "fixo")));
    });
  }, [busca, dataFinal, dataInicial, relatorio.data, tipoTaxaFiltro, vendedorFiltro]);

  const resumo = useMemo(() => vendasFiltradas.reduce((acumulado, venda) => ({
    subtotal: acumulado.subtotal + venda.subtotal,
    frete: acumulado.frete + venda.abatimentoFrete,
    comissao: acumulado.comissao + venda.comissao,
    taxas: acumulado.taxas + venda.totalTaxas,
    liquido: acumulado.liquido + venda.valorLiquido,
  }), { subtotal: 0, frete: 0, comissao: 0, taxas: 0, liquido: 0 }), [vendasFiltradas]);
  const margemMediaPonderada = resumo.subtotal > 0 ? (resumo.liquido / resumo.subtotal) * 100 : 0;

  const limparFiltros = () => { setBusca(""); setDataInicial(""); setDataFinal(""); setVendedorFiltro("todos"); setTipoTaxaFiltro("todos"); };
  const exportarExcel = () => {
    const planilha = XLSX.utils.json_to_sheet(linhasMargemParaPlanilha(vendasFiltradas));
    planilha["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 13 }, { wch: 16 }, { wch: 17 }, { wch: 15 }, { wch: 19 }, { wch: 17 }, { wch: 13 }, { wch: 50 }];
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Acerto comercial");
    XLSX.writeFileXLSX(livro, `acerto-comercial-vendas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportarPdf = async () => {
    setExportandoPdf(true);
    try {
      const arquivo = await exportarRelatorioMargemPdf({ vendas: vendasFiltradas, filtros: { busca, dataInicial, dataFinal, vendedor: vendedorFiltro === "todos" ? "" : vendedorFiltro, tipoTaxa: tipoTaxaFiltro === "todos" ? "" : tipoTaxaFiltro } });
      const link = document.createElement("a"); link.href = arquivo.url; link.download = arquivo.nomeArquivo; link.click(); window.setTimeout(() => URL.revokeObjectURL(arquivo.url), 1_000);
    } finally { setExportandoPdf(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary"><BarChart3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Vendas</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Acerto comercial por venda</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Acompanhe a composição comercial do pedido após descontos, frete, comissão e taxas. O índice comercial compara o valor final ao subtotal bruto, sem apurar custo ou lucro.</p>
      </div>
      <Badge variant="outline" className="h-auto max-w-md whitespace-normal border-amber-300 bg-amber-50 px-3 py-2 text-left text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">Este é o acerto do valor comercial. Não inclui custo das peças, matéria-prima ou rateios; para rentabilidade por custo, use Financeiro → Rentabilidade da madeira.</Badge>
    </div>

    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Filtros do relatório</h2></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <div className="space-y-2"><Label htmlFor="busca-margem">Venda ou cliente</Label><Input id="busca-margem" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Número da venda ou cliente" /></div>
          <div className="space-y-2"><Label htmlFor="margem-inicial">Data inicial</Label><Input id="margem-inicial" type="date" value={dataInicial} onChange={(evento) => setDataInicial(evento.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="margem-final">Data final</Label><Input id="margem-final" type="date" value={dataFinal} onChange={(evento) => setDataFinal(evento.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="margem-vendedor">Vendedor</Label><select id="margem-vendedor" value={vendedorFiltro} onChange={(evento) => setVendedorFiltro(evento.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="todos">Todos os vendedores</option>{vendedores.map((vendedor) => <option key={vendedor} value={vendedor}>{vendedor}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="margem-taxa">Tipo de taxa</Label><select id="margem-taxa" value={tipoTaxaFiltro} onChange={(evento) => setTipoTaxaFiltro(evento.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="todos">Todos os tipos</option><option value="percentual">Percentual (%)</option><option value="fixo">Valor fixo (R$)</option><option value="sem_taxa">Sem taxa adicional</option></select></div>
          <Button variant="outline" onClick={limparFiltros}><FilterX className="mr-2 h-4 w-4" />Limpar</Button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />O período considera a data de criação das vendas aprovadas.</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={exportarPdf} disabled={exportandoPdf || vendasFiltradas.length === 0}>{exportandoPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Exportar PDF</Button><Button size="sm" onClick={exportarExcel} disabled={vendasFiltradas.length === 0}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar Excel<Download className="ml-1.5 h-3.5 w-3.5" /></Button></div></div>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="border-border/60"><CardHeader className="pb-2"><CardDescription>Subtotal bruto</CardDescription><CardTitle className="text-lg">{formatarMoeda.format(resumo.subtotal)}</CardTitle></CardHeader></Card>
      <Card className="border-border/60"><CardHeader className="pb-2"><CardDescription>Frete abatido</CardDescription><CardTitle className="text-lg text-rose-700 dark:text-rose-300">− {formatarMoeda.format(resumo.frete)}</CardTitle></CardHeader></Card>
      <Card className="border-border/60"><CardHeader className="pb-2"><CardDescription>Comissões</CardDescription><CardTitle className="text-lg text-rose-700 dark:text-rose-300">− {formatarMoeda.format(resumo.comissao)}</CardTitle></CardHeader></Card>
      <Card className="border-border/60"><CardHeader className="pb-2"><CardDescription>Taxas adicionadas</CardDescription><CardTitle className="text-lg text-emerald-700 dark:text-emerald-300">+ {formatarMoeda.format(resumo.taxas)}</CardTitle></CardHeader></Card>
      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"><CardHeader className="pb-2"><CardDescription>Valor final · índice comercial</CardDescription><CardTitle className="flex items-center gap-2 text-lg text-emerald-800 dark:text-emerald-200"><CircleDollarSign className="h-4 w-4" />{formatarMoeda.format(resumo.liquido)}</CardTitle><p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{formatarPercentual.format(margemMediaPonderada)}%</p></CardHeader></Card>
    </div>

    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base">Vendas aprovadas</CardTitle><CardDescription>{vendasFiltradas.length} venda(s) no relatório.</CardDescription></CardHeader>
      <CardContent className="p-0">
        {relatorio.isLoading ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Carregando relatório...</div>
          : vendasFiltradas.length === 0 ? <div className="p-12 text-center text-muted-foreground"><TrendingDown className="mx-auto mb-2 h-6 w-6" />Nenhuma venda aprovada foi encontrada para os filtros informados.</div>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Venda</TableHead><TableHead>Cliente</TableHead><TableHead>Vendedor</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Frete</TableHead><TableHead className="text-right">Comissão</TableHead><TableHead className="text-right">Taxas</TableHead><TableHead className="text-right">Valor final</TableHead><TableHead className="text-right">Índice comercial</TableHead></TableRow></TableHeader>
            <TableBody>{vendasFiltradas.map((venda) => <TableRow key={venda.id} className="hover:bg-muted/30"><TableCell className="font-semibold text-primary">{venda.numero ?? `Venda #${venda.id}`}</TableCell><TableCell>{venda.clienteNome ?? "Cliente não localizado"}</TableCell><TableCell className="text-muted-foreground">{venda.vendedor?.trim() || "—"}</TableCell><TableCell className="text-muted-foreground">{formatarData(venda.createdAt)}</TableCell><TableCell className="text-right">{formatarMoeda.format(venda.subtotal)}</TableCell><TableCell className="text-right text-rose-700 dark:text-rose-300">− {formatarMoeda.format(venda.abatimentoFrete)}</TableCell><TableCell className="text-right text-rose-700 dark:text-rose-300">− {formatarMoeda.format(venda.comissao)}</TableCell><TableCell className="text-right text-emerald-700 dark:text-emerald-300">+ {formatarMoeda.format(venda.totalTaxas)}</TableCell><TableCell className="text-right font-semibold">{formatarMoeda.format(venda.valorLiquido)}</TableCell><TableCell className="text-right"><Badge variant="outline" className={venda.margemPercentual >= 80 ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}><TrendingUp className="mr-1 h-3.5 w-3.5" />{formatarPercentual.format(venda.margemPercentual)}%</Badge></TableCell></TableRow>)}</TableBody></Table></div>}
      </CardContent>
    </Card>
  </div>;
}
