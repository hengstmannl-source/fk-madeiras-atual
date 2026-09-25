import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Boxes, ClipboardCheck, Loader2, RotateCcw, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const numero = (valor: string | number | null | undefined) => Number(String(valor ?? 0).replace(",", ".")) || 0;
const formatarNumero = (valor: string | number, casas = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(numero(valor));
const formatarVolume = (valor: string | number) => `${formatarNumero(valor, 3)} m³`;
const medida = (linha: any) => `${formatarNumero(linha.espessura, 2)} × ${formatarNumero(linha.largura, 2)} × ${formatarNumero(linha.comprimento, 2)} m`;
const dataLocal = (data: Date) => data.toISOString().slice(0, 10);

function inicioPeriodoPadrao() {
  const data = new Date();
  data.setDate(data.getDate() - 89);
  return dataLocal(data);
}

const situacaoVisual = {
  rutura: { texto: "Rutura", classe: "border-red-200 bg-red-50 text-red-700" },
  critico: { texto: "Crítico", classe: "border-orange-200 bg-orange-50 text-orange-700" },
  baixo: { texto: "Baixo", classe: "border-amber-200 bg-amber-50 text-amber-800" },
  adequado: { texto: "Adequado", classe: "border-emerald-200 bg-emerald-50 text-emerald-700" },
} as const;

function SituacaoBadge({ situacao }: { situacao: keyof typeof situacaoVisual }) {
  const configuracao = situacaoVisual[situacao] ?? situacaoVisual.adequado;
  return <Badge variant="outline" className={configuracao.classe}>{configuracao.texto}</Badge>;
}

export default function InventarioPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [periodo, setPeriodo] = useState(() => ({ dataInicial: inicioPeriodoPadrao(), dataFinal: dataLocal(new Date()) }));
  const [linhaAjuste, setLinhaAjuste] = useState<any | null>(null);
  const [quantidadeContada, setQuantidadeContada] = useState("0");
  const [motivo, setMotivo] = useState("");
  const filtros = useMemo(() => ({ dataInicial: periodo.dataInicial || undefined, dataFinal: periodo.dataFinal || undefined }), [periodo]);
  const relatorio = trpc.producao.estoque.relatorio.useQuery(filtros);
  const ajustes = trpc.producao.estoque.ajustes.useQuery();
  const ajustar = trpc.producao.estoque.ajustar.useMutation();
  const podeAjustar = user?.role === "admin";
  const linhas = relatorio.data?.linhas ?? [];
  const resumo = relatorio.data?.resumo;
  const linhasRotacao = linhas.filter((linha: any) => linha.saidas > 0);
  const linhasRutura = linhas.filter((linha: any) => linha.situacao !== "adequado");

  const abrirAjuste = (linha: any) => {
    setLinhaAjuste(linha);
    setQuantidadeContada("0");
    setMotivo("");
  };

  const confirmarAjuste = () => {
    if (!linhaAjuste) return;
    const quantidade = Number(quantidadeContada);
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      toast.error("Informe uma contagem inteira igual ou superior a zero.");
      return;
    }
    ajustar.mutate({
      madeiraNome: linhaAjuste.madeiraNome,
      espessura: String(linhaAjuste.espessura),
      largura: String(linhaAjuste.largura),
      comprimento: String(linhaAjuste.comprimento),
      quantidadeContada: quantidade,
      motivo,
    }, {
      onSuccess: (resultado) => {
        toast.success(`Ajuste registado: ${resultado.saldoAnterior} → ${resultado.quantidadeContada} peça(s).`);
        setLinhaAjuste(null);
        utils.producao.estoque.relatorio.invalidate();
        utils.producao.estoque.resumo.invalidate();
        utils.producao.estoque.ajustes.invalidate();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 text-primary"><ClipboardCheck className="size-5" /><span className="text-sm font-semibold">Inventário serrado</span></div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Rotação, rutura e regularização</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Acompanhe a saída por essência e medida, identifique ruturas e corrija a contagem física sem alterar o histórico de produção, vendas ou entregas.</p>
      </div>
      <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[400px]">
        <div className="space-y-1.5"><Label htmlFor="data-inicial">De</Label><Input id="data-inicial" type="date" value={periodo.dataInicial} onChange={(evento) => setPeriodo((atual) => ({ ...atual, dataInicial: evento.target.value }))} /></div>
        <div className="space-y-1.5"><Label htmlFor="data-final">Até</Label><Input id="data-final" type="date" value={periodo.dataFinal} onChange={(evento) => setPeriodo((atual) => ({ ...atual, dataFinal: evento.target.value }))} /></div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saídas no período</p><p className="mt-1 text-2xl font-bold">{formatarNumero(resumo?.saidasNoPeriodo ?? 0)}</p><p className="text-xs text-muted-foreground">peças entregues</p></div><TrendingDown className="size-8 text-sky-600" /></CardContent></Card>
      <Card className="border-red-100"><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-red-700">Em rutura</p><p className="mt-1 text-2xl font-bold text-red-700">{formatarNumero(resumo?.itensEmRutura ?? 0)}</p><p className="text-xs text-muted-foreground">medidas sem saldo</p></div><AlertTriangle className="size-8 text-red-600" /></CardContent></Card>
      <Card className="border-amber-100"><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-amber-800">Atenção</p><p className="mt-1 text-2xl font-bold text-amber-800">{formatarNumero(resumo?.itensCriticos ?? 0)}</p><p className="text-xs text-muted-foreground">cobertura inferior a 30 dias</p></div><BarChart3 className="size-8 text-amber-600" /></CardContent></Card>
      <Card className="border-red-100"><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-red-700">Défice a regularizar</p><p className="mt-1 text-2xl font-bold text-red-700">{formatarNumero(resumo?.pecasEmDeficit ?? 0)}</p><p className="text-xs text-muted-foreground">peças em saldo negativo</p></div><Boxes className="size-8 text-red-600" /></CardContent></Card>
    </div>

    <Card>
      <CardContent className="space-y-1 p-5"><h2 className="font-semibold">Como ler os indicadores</h2><p className="text-sm leading-6 text-muted-foreground">A <strong>rotação</strong> divide as saídas pelo estoque médio estimado no período. A <strong>cobertura</strong> estima em quantos dias o saldo atual se esgota, usando o ritmo de saída selecionado. Sem saída registrada, a cobertura permanece sem estimativa.</p></CardContent>
    </Card>

    <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
      <Card className="min-w-0"><CardContent className="p-0"><div className="border-b border-border p-5"><h2 className="font-semibold">Rotação por essência e medida</h2><p className="mt-1 text-sm text-muted-foreground">Itens com entregas no intervalo selecionado.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Essência e medida</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Rotação</TableHead><TableHead className="text-right">Cobertura</TableHead></TableRow></TableHeader><TableBody>{relatorio.isLoading ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 size-4 animate-spin" />A calcular indicadores…</TableCell></TableRow> : linhasRotacao.length ? linhasRotacao.map((linha: any) => <TableRow key={linha.chave}><TableCell><p className="font-medium">{linha.madeiraNome}</p><p className="text-xs text-muted-foreground">{medida(linha)}</p></TableCell><TableCell className={`text-right font-medium ${linha.saldoAtual < 0 ? "text-red-700" : ""}`}>{formatarNumero(linha.saldoAtual)}</TableCell><TableCell className="text-right">{formatarNumero(linha.saidas)}</TableCell><TableCell className="text-right">{linha.rotacao === null ? "—" : `${formatarNumero(linha.rotacao, 2)}×`}</TableCell><TableCell className="text-right">{linha.coberturaDias === null ? "—" : `${formatarNumero(linha.coberturaDias, 1)} dias`}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">Ainda não há saídas de peças no período selecionado.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
      <Card className="min-w-0"><CardContent className="p-0"><div className="border-b border-border p-5"><h2 className="font-semibold">Rutura e baixo estoque</h2><p className="mt-1 text-sm text-muted-foreground">Prioridade para reposição ou conferência física.</p></div><div className="divide-y divide-border">{relatorio.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">A carregar alertas…</div> : linhasRutura.length ? linhasRutura.map((linha: any) => <div key={linha.chave} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{linha.madeiraNome}</p><SituacaoBadge situacao={linha.situacao} /></div><p className="mt-1 text-sm text-muted-foreground">{medida(linha)} · {formatarNumero(linha.saldoAtual)} peças · {formatarVolume(linha.volumeAtual)}</p></div>{podeAjustar && <Button variant="outline" size="sm" onClick={() => abrirAjuste(linha)}><RotateCcw className="mr-1.5 size-3.5" />Ajustar</Button>}</div>) : <div className="p-8 text-center text-sm text-muted-foreground">Não há ruturas ou níveis baixos neste período.</div>}</div></CardContent></Card>
    </section>

    <Card><CardContent className="p-0"><div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Histórico de ajustes</h2><p className="mt-1 text-sm text-muted-foreground">Cada regularização cria um lançamento independente, mantendo a auditoria completa.</p></div>{!podeAjustar && <Badge variant="outline">Somente administradores podem ajustar</Badge>}</div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Medida</TableHead><TableHead>Variação</TableHead><TableHead>Motivo</TableHead><TableHead>Responsável</TableHead></TableRow></TableHeader><TableBody>{ajustes.isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">A carregar ajustes…</TableCell></TableRow> : ajustes.data?.length ? ajustes.data.map((ajuste: any) => <TableRow key={ajuste.id}><TableCell className="whitespace-nowrap text-sm">{new Date(ajuste.createdAt).toLocaleString("pt-BR")}</TableCell><TableCell><p className="font-medium">{ajuste.madeiraNome}</p><p className="text-xs text-muted-foreground">{formatarNumero(ajuste.espessura, 2)} × {formatarNumero(ajuste.largura, 2)} × {formatarNumero(ajuste.comprimento, 2)} m</p></TableCell><TableCell className={ajuste.quantidade < 0 ? "font-medium text-red-700" : "font-medium text-emerald-700"}>{ajuste.quantidade > 0 ? "+" : ""}{formatarNumero(ajuste.quantidade)}</TableCell><TableCell className="min-w-[260px] whitespace-normal text-sm text-muted-foreground">{ajuste.motivo}</TableCell><TableCell className="text-sm">{ajuste.utilizador}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">Nenhum ajuste de inventário foi registado até agora.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>

    <Dialog open={Boolean(linhaAjuste)} onOpenChange={(aberto) => !aberto && setLinhaAjuste(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Regularizar contagem de inventário</DialogTitle><DialogDescription>{linhaAjuste ? `${linhaAjuste.madeiraNome} · ${medida(linhaAjuste)}` : ""}</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Saldo atual consolidado: <strong>{formatarNumero(linhaAjuste?.saldoAtual ?? 0)} peça(s)</strong>. A contagem informada será o novo saldo desta medida; a diferença ficará registada como ajuste auditável.</div><div className="space-y-1.5"><Label htmlFor="quantidade-contada">Contagem física</Label><Input id="quantidade-contada" type="number" min="0" step="1" value={quantidadeContada} onChange={(evento) => setQuantidadeContada(evento.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="motivo-ajuste">Motivo da regularização</Label><Textarea id="motivo-ajuste" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="Ex.: conferência de inventário do pátio" maxLength={1000} /></div></div><DialogFooter><Button variant="outline" onClick={() => setLinhaAjuste(null)} disabled={ajustar.isPending}>Cancelar</Button><Button onClick={confirmarAjuste} disabled={ajustar.isPending || motivo.trim().length < 3}>{ajustar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Confirmar ajuste</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
