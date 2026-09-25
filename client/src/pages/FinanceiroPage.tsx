import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { formatCurrency, formatReceivableSaleReference } from "@/lib/utils";
import { exportarListaFinanceiraPdf } from "@/lib/financeiroPdf";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Building2, CalendarClock, CheckCircle2,
  CircleAlert, CircleDollarSign, Copy, Download, Eye, FileSpreadsheet, Landmark, Loader2, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, ScanLine, Search, Tags, Trash2, Upload, WalletCards, X,
} from "lucide-react";
import { toast } from "sonner";

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => {
  const data = new Date();
  data.setDate(1);
  return data.toISOString().slice(0, 10);
};
const dataHaDias = (dias: number) => {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
};

export function abaFinanceiraDaUrl(search: string): "fluxo" | "lancamentos" | "recorrencias" | "fornecedores" | "categorias" | "contas" | "transferencias" {
  const aba = new URLSearchParams(search).get("aba");
  return ["fluxo", "recorrencias", "fornecedores", "categorias", "contas", "transferencias"].includes(aba ?? "") ? aba as "fluxo" | "lancamentos" | "recorrencias" | "fornecedores" | "categorias" | "contas" | "transferencias" : "lancamentos";
}
const valorInicialLancamento = () => ({
  tipo: "receber" as "receber" | "pagar",
  descricao: "",
  categoriaId: "",
  centroCustoId: "",
  valorOriginal: "",
  dataEmissao: hoje(),
  dataVencimento: hoje(),
  clienteId: "",
  fornecedorId: "",
  contraparteNome: "",
  desconto: "0",
  juros: "0",
  parcelar: false,
  quantidadeParcelas: "2",
  observacoes: "",
});

const valorInicialRecorrencia = () => ({
  tipo: "pagar" as "receber" | "pagar",
  descricao: "",
  categoriaId: "",
  centroCustoId: "",
  valor: "",
  frequencia: "mensal" as "semanal" | "mensal" | "trimestral" | "semestral" | "anual",
  proximoVencimento: hoje(),
  dataFim: "",
  clienteId: "",
  fornecedorId: "",
  contraparteNome: "",
  observacoes: "",
});

const valorInicialConta = () => ({
  nome: "",
  tipo: "caixa" as "caixa" | "caixa_cheque" | "banco" | "carteira" | "outro",
  banco: "",
  agencia: "",
  numeroConta: "",
  dataInicio: "",
  saldoInicial: "0",
  observacoes: "",
});

const valorInicialTransferencia = () => ({
  contaOrigemId: "",
  contaDestinoId: "",
  valor: "",
  dataTransferencia: hoje(),
  descricao: "",
});

const estadoLabels: Record<string, string> = {
  aberto: "Aberto", parcial: "Parcial", quitado: "Quitado", vencido: "Vencido", cancelado: "Cancelado",
};

type EntidadeContextual = "cliente" | "fornecedor" | "categoria" | "conta" | "centroCusto";
type DestinoContextual = "lancamento" | "recorrencia" | "baixa" | "cheque" | "edicaoLote";
type VisaoFinanceira = "pagar" | "receber" | "pagas" | "recebidas";
type ChequeRecebidoForm = { referencia: string; valor: string; clienteId: string; dataCompensacao: string };
type TituloFinanceiro = RouterOutputs["financeiro"]["titulos"]["list"][number];
type FornecedorFinanceiro = RouterOutputs["financeiro"]["fornecedores"]["list"][number];
type ClienteFinanceiro = RouterOutputs["cliente"]["list"][number];
type ContaFinanceira = RouterOutputs["financeiro"]["contas"]["list"][number];
type ChequeDisponivel = RouterOutputs["financeiro"]["cheques"]["list"][number];
type FluxoGerencial = RouterOutputs["financeiro"]["relatorios"]["fluxoGerencial"];
type ContaOperacional = RouterOutputs["financeiro"]["contasOperacionais"]["list"]["itens"][number];
type ResultadoContasOperacionais = RouterOutputs["financeiro"]["contasOperacionais"]["list"];

const opcoesVisaoFinanceira: Array<{ id: VisaoFinanceira; label: string; descricao: string }> = [
  { id: "pagar", label: "Contas a pagar", descricao: "Compromissos em aberto e em atraso" },
  { id: "receber", label: "Contas a receber", descricao: "Recebimentos previstos e em atraso" },
  { id: "pagas", label: "Contas pagas", descricao: "Histórico de pagamentos concluídos" },
  { id: "recebidas", label: "Contas recebidas", descricao: "Histórico de recebimentos concluídos" },
];

const valorInicialFiltrosFinanceiros = () => ({ descricao: "", valorMinimo: "", valorMaximo: "", dataInicio: "", dataFim: "", clienteId: "", categoriaId: "", centroCustoId: "", origem: "todas" });
const valorInicialFiltrosOperacionais = () => ({ situacao: "todas", aging: "todas", estado: "todos", fornecedorId: "", origem: "todas", contaFinanceiraId: "todas", ordenar: "prioridade" as "prioridade" | "vencimento_asc" | "vencimento_desc" | "saldo_desc" | "contraparte" });

function saldoTitulo(titulo: TituloFinanceiro): number {
  return Math.max(0,
    Number(titulo.valorOriginal || 0) - Number(titulo.desconto || 0) + Number(titulo.juros || 0) - Number(titulo.valorBaixado || 0),
  );
}

function formatarDataFinanceira(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function dataChaveFinanceira(value?: string | Date | null): string {
  if (!value) return "";
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? "" : data.toISOString().slice(0, 10);
}

function valorTotalTitulo(titulo: TituloFinanceiro): number {
  return Number(titulo.valorOriginal || 0) - Number(titulo.desconto || 0) + Number(titulo.juros || 0);
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    aberto: "bg-sky-50 text-sky-700 border-sky-200",
    parcial: "bg-amber-50 text-amber-700 border-amber-200",
    quitado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    vencido: "bg-rose-50 text-rose-700 border-rose-200",
    cancelado: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return <Badge variant="outline" className={styles[estado] ?? ""}>{estadoLabels[estado] ?? estado}</Badge>;
}

function FluxoGerencialPainel({
  fluxo,
  carregando,
  atualizando,
  periodo,
  contaSelecionada,
  contas,
  onPeriodo,
  onConta,
  onAtualizar,
}: {
  fluxo?: FluxoGerencial;
  carregando: boolean;
  atualizando: boolean;
  periodo: { dataInicio: string; dataFim: string };
  contaSelecionada: string;
  contas: ContaFinanceira[];
  onPeriodo: (periodo: { dataInicio: string; dataFim: string }) => void;
  onConta: (contaId: string) => void;
  onAtualizar: () => void;
}) {
  const aplicarPeriodo = (dias: number | "mes" | "hoje") => {
    const agora = new Date();
    const fim = agora.toISOString().slice(0, 10);
    if (dias === "hoje") return onPeriodo({ dataInicio: fim, dataFim: fim });
    if (dias === "mes") {
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
      return onPeriodo({ dataInicio: inicio, dataFim: fim });
    }
    const inicio = new Date(agora);
    inicio.setDate(agora.getDate() - dias + 1);
    onPeriodo({ dataInicio: inicio.toISOString().slice(0, 10), dataFim: fim });
  };
  const cartoes = fluxo ? [
    { titulo: "Saldo atual", valor: fluxo.saldoAtual, texto: "Posição patrimonial até hoje", classe: "text-slate-700 bg-slate-100", icone: <Landmark className="h-4 w-4" /> },
    { titulo: "Entradas realizadas", valor: fluxo.entradasRealizadas, texto: "Baixas efetivadas no período", classe: "text-emerald-700 bg-emerald-50", icone: <ArrowDownToLine className="h-4 w-4" /> },
    { titulo: "Saídas realizadas", valor: fluxo.saidasRealizadas, texto: "Pagamentos efetivados no período", classe: "text-rose-700 bg-rose-50", icone: <ArrowUpFromLine className="h-4 w-4" /> },
    { titulo: "Previsto líquido", valor: fluxo.entradasPrevistas - fluxo.saidasPrevistas, texto: "Saldos em aberto e baixas agendadas", classe: "text-amber-700 bg-amber-50", icone: <CalendarClock className="h-4 w-4" /> },
    { titulo: "Saldo projetado", valor: fluxo.saldoProjetado, texto: "Ao final do período selecionado", classe: fluxo.saldoProjetado < 0 ? "text-rose-700 bg-rose-50" : "text-primary bg-primary/10", icone: <WalletCards className="h-4 w-4" /> },
  ] : [];
  return (
    <section className="mx-5 mt-5 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.025]">
      <div className="grid gap-5 border-b border-primary/15 px-5 py-5 xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.35fr)] xl:items-end">
        <div className="self-center"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Fluxo de caixa gerencial</h2><Badge variant="outline" className="border-primary/30 text-primary">Realizado + previsto</Badge></div><p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">As baixas formam o realizado; apenas o saldo residual de títulos em aberto entra na previsão. Transferências aparecem somente na visão de cada conta.</p></div>
        <div className="space-y-3 xl:border-l xl:border-primary/15 xl:pl-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(260px,1.15fr)]">
            <div className="space-y-1"><Label className="text-xs">Conta</Label><Select value={contaSelecionada} onValueChange={onConta}><SelectTrigger className="h-9 w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Consolidado — todas as contas</SelectItem>{contas.map((conta) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label className="text-xs">Início</Label><Input className="h-9 w-full bg-white" type="date" value={periodo.dataInicio} onChange={(event) => onPeriodo({ ...periodo, dataInicio: event.target.value })} /></div><div className="space-y-1"><Label className="text-xs">Fim</Label><Input className="h-9 w-full bg-white" type="date" value={periodo.dataFim} onChange={(event) => onPeriodo({ ...periodo, dataFim: event.target.value })} /></div></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 pt-3"><span className="text-xs font-medium text-muted-foreground">Atalhos de período</span><div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={() => aplicarPeriodo("hoje")}>Hoje</Button><Button size="sm" variant="outline" onClick={() => aplicarPeriodo(7)}>7 dias</Button><Button size="sm" variant="outline" onClick={() => aplicarPeriodo("mes")}>Este mês</Button><Button size="sm" onClick={onAtualizar} disabled={atualizando} aria-label="Atualizar fluxo de caixa">{atualizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</Button></div></div>
        </div>
      </div>
      {carregando ? <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Compondo visão gerencial...</div> : fluxo ? <div className="space-y-5 p-5">
        {(fluxo.possuiAlertaSaldoNegativo || fluxo.movimentosBancariosNaoConciliados > 0) && <div className="grid gap-2 md:grid-cols-2">{fluxo.possuiAlertaSaldoNegativo && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><CircleAlert className="mr-1 inline h-4 w-4" />Projeção negativa: {formatCurrency(fluxo.menorSaldoProjetado)}{fluxo.dataMenorSaldoProjetado ? ` em ${formatarDataFinanceira(fluxo.dataMenorSaldoProjetado)}` : ""}.</div>}{fluxo.movimentosBancariosNaoConciliados > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><CircleAlert className="mr-1 inline h-4 w-4" />{fluxo.movimentosBancariosNaoConciliados} movimento(s) bancário(s) aguardam conciliação.</div>}</div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cartoes.map((cartao) => <div key={cartao.titulo} className="rounded-lg border bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{cartao.titulo}</p><p className={`mt-1 text-xl font-bold ${cartao.valor < 0 ? "text-rose-700" : ""}`}>{formatCurrency(cartao.valor)}</p><p className="mt-1 text-[11px] text-muted-foreground">{cartao.texto}</p></div><span className={`rounded-md p-2 ${cartao.classe}`}>{cartao.icone}</span></div></div>)}</div>
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-lg border bg-white"><div className="border-b bg-muted/20 px-4 py-3"><h3 className="text-sm font-semibold">Fluxo diário e saldo acumulado</h3><p className="text-xs text-muted-foreground">Realizado e previsto ficam separados; transferências não alteram o consolidado.</p></div><div className="max-h-[360px] overflow-auto"><Table><TableHeader className="sticky top-0 bg-white"><TableRow><TableHead>Data</TableHead><TableHead className="text-right">Realizado</TableHead><TableHead className="text-right">Previsto</TableHead>{contaSelecionada !== "todas" && <TableHead className="text-right">Transferências</TableHead>}<TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{fluxo.dias.map((dia) => { const realizado = dia.entradasRealizadas - dia.saidasRealizadas; const previsto = dia.entradasPrevistas - dia.saidasPrevistas; const transferencia = dia.transferenciasEntrada - dia.transferenciasSaida; return <TableRow key={String(dia.data)} className={dia.saldoProjetado < 0 ? "bg-rose-50/50" : ""}><TableCell className="whitespace-nowrap text-xs">{formatarDataFinanceira(dia.data)}</TableCell><TableCell className={`text-right text-sm ${realizado < 0 ? "text-rose-700" : "text-emerald-700"}`}>{realizado === 0 ? "—" : `${realizado > 0 ? "+" : ""}${formatCurrency(realizado)}`}</TableCell><TableCell className={`text-right text-sm ${previsto < 0 ? "text-rose-700" : "text-amber-700"}`}>{previsto === 0 ? "—" : `${previsto > 0 ? "+" : ""}${formatCurrency(previsto)}`}</TableCell>{contaSelecionada !== "todas" && <TableCell className="text-right text-sm text-muted-foreground">{transferencia === 0 ? "—" : `${transferencia > 0 ? "+" : ""}${formatCurrency(transferencia)}`}</TableCell>}<TableCell className={`text-right font-semibold ${dia.saldoProjetado < 0 ? "text-rose-700" : "text-primary"}`}>{formatCurrency(dia.saldoProjetado)}</TableCell></TableRow>; })}</TableBody></Table></div></div>
          <div className="overflow-hidden rounded-lg border bg-white"><div className="border-b bg-muted/20 px-4 py-3"><h3 className="text-sm font-semibold">Por categoria e origem</h3><p className="text-xs text-muted-foreground">Transferências são excluídas deste resumo.</p></div>{fluxo.porCategoria.length ? <Table><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead></TableRow></TableHeader><TableBody>{fluxo.porCategoria.slice(0, 8).map((categoria) => <TableRow key={categoria.nome}><TableCell><p className="text-sm font-medium">{categoria.nome}</p><p className="text-xs text-muted-foreground">{categoria.quantidade} item(ns)</p></TableCell><TableCell className="text-right text-sm text-emerald-700">{formatCurrency(categoria.entradas)}</TableCell><TableCell className="text-right text-sm text-rose-700">{formatCurrency(categoria.saidas)}</TableCell></TableRow>)}</TableBody></Table> : <p className="px-4 py-10 text-center text-sm text-muted-foreground">Sem movimentos para classificar neste período.</p>}</div>
        </div>
      </div> : null}
    </section>
  );
}

export default function FinanceiroPage() {
  const utils = trpc.useUtils();
  const search = useSearch();
  const [aba, setAba] = useState<"lancamentos" | "fluxo" | "recorrencias" | "fornecedores" | "categorias" | "contas" | "transferencias">(() => abaFinanceiraDaUrl(search));
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [fornecedorAberto, setFornecedorAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<FornecedorFinanceiro | null>(null);
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [centroCustoAberto, setCentroCustoAberto] = useState(false);
  const [centroCusto, setCentroCusto] = useState({ nome: "", tipo: "industrial" as "industrial" | "comercial_administrativo" | "nao_apropriavel", observacoes: "" });
  const [contaAberta, setContaAberta] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaFinanceira | null>(null);
  const [clienteAberto, setClienteAberto] = useState(false);
  const [contextoCriacao, setContextoCriacao] = useState<{ entidade: EntidadeContextual; destino: DestinoContextual } | null>(null);
  const [indiceChequeCliente, setIndiceChequeCliente] = useState<number | null>(null);
  const [visaoFinanceira, setVisaoFinanceira] = useState<VisaoFinanceira>(() => {
    const tipo = new URLSearchParams(search).get("tipo");
    return tipo === "receber" ? "receber" : "pagar";
  });
  const [filtrosFinanceiros, setFiltrosFinanceiros] = useState(valorInicialFiltrosFinanceiros);
  const [filtrosAplicados, setFiltrosAplicados] = useState<ReturnType<typeof valorInicialFiltrosFinanceiros> | null>(null);
  const [filtrosOperacionais, setFiltrosOperacionais] = useState(valorInicialFiltrosOperacionais);
  const [tituloOperacionalSelecionado, setTituloOperacionalSelecionado] = useState<ContaOperacional | null>(null);
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false);
  const [tituloSelecionado, setTituloSelecionado] = useState<TituloFinanceiro | null>(null);
  const [tituloParaEditar, setTituloParaEditar] = useState<TituloFinanceiro | null>(null);
  const [titulosSelecionados, setTitulosSelecionados] = useState<number[]>([]);
  const [edicaoLoteAberta, setEdicaoLoteAberta] = useState(false);
  const [edicaoLote, setEdicaoLote] = useState({ descricao: "", categoriaId: "", centroCustoId: "", dataVencimento: "", observacoes: "" });
  const [lancamentoEditado, setLancamentoEditado] = useState(valorInicialLancamento);
  const [tituloBaixas, setTituloBaixas] = useState<TituloFinanceiro | null>(null);
  const [tituloParaExcluir, setTituloParaExcluir] = useState<TituloFinanceiro | null>(null);
  const [baixaParaEstornar, setBaixaParaEstornar] = useState<any>(null);
  const [contaParaExcluir, setContaParaExcluir] = useState<ContaFinanceira | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [periodoFluxo, setPeriodoFluxo] = useState({ dataInicio: primeiroDiaDoMes(), dataFim: hoje() });
  const [contaFluxoGerencial, setContaFluxoGerencial] = useState("todas");
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [importacaoFornecedoresAberta, setImportacaoFornecedoresAberta] = useState(false);
  const [arquivoFornecedores, setArquivoFornecedores] = useState<File | null>(null);
  const [conteudoImportacaoFornecedores, setConteudoImportacaoFornecedores] = useState("");
  const [preparoFornecedores, setPreparoFornecedores] = useState<{ linhas: Array<{ numeroLinha: number; nome: string; contacto: string | null; email: string | null; documento: string | null }>; erros: string[] } | null>(null);
  const [anexosLancamento, setAnexosLancamento] = useState<File[]>([]);
  const [codigoBoletoLancamento, setCodigoBoletoLancamento] = useState("");
  const [anexoParaVisualizar, setAnexoParaVisualizar] = useState<{ nomeArquivo: string; url: string; mimeType: string } | null>(null);
  const [relatorioPdfParaVisualizar, setRelatorioPdfParaVisualizar] = useState<{ url: string; nomeArquivo: string } | null>(null);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);
  const [transferencia, setTransferencia] = useState(valorInicialTransferencia);
  const [contaFiltroTransferencias, setContaFiltroTransferencias] = useState("todas");
  const [transferenciaParaEstornar, setTransferenciaParaEstornar] = useState<number | null>(null);
  const [motivoEstornoTransferencia, setMotivoEstornoTransferencia] = useState("");

  const copiarCodigoBoleto = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código do boleto copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar o código. Selecione os dígitos manualmente.");
    }
  };

  useEffect(() => {
    setAba(abaFinanceiraDaUrl(search));
  }, [search]);
  const [lancamento, setLancamento] = useState(valorInicialLancamento);
  const [baixa, setBaixa] = useState({ contaFinanceiraId: "", valor: "", dataBaixa: hoje(), formaPagamento: "pix", observacoes: "" });
  const [chequesRecebidos, setChequesRecebidos] = useState<ChequeRecebidoForm[]>([]);
  const [chequesSelecionados, setChequesSelecionados] = useState<number[]>([]);
  const [fornecedor, setFornecedor] = useState({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" });
  const [categoria, setCategoria] = useState({ nome: "", tipo: "ambos" as "receita" | "despesa" | "ambos" });
  const [conta, setConta] = useState(valorInicialConta);
  const [cliente, setCliente] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" });
  const [recorrencia, setRecorrencia] = useState(valorInicialRecorrencia);
  const tipoConsulta = new URLSearchParams(search).get("tipo");
  const tipoAtalho: VisaoFinanceira | null = ["pagar", "receber", "pagas", "recebidas"].includes(tipoConsulta ?? "")
    ? tipoConsulta as VisaoFinanceira
    : null;
  const acessoDiretoLista = tipoAtalho !== null;

  useEffect(() => {
    if (tipoAtalho) setVisaoFinanceira(tipoAtalho);
  }, [tipoAtalho]);

  const titulos = trpc.financeiro.titulos.list.useQuery();
  const categorias = trpc.financeiro.categorias.list.useQuery();
  const centrosCusto = trpc.financeiro.centrosCusto.list.useQuery({ incluirInativos: true });
  const fornecedores = trpc.financeiro.fornecedores.list.useQuery();
  const contas = trpc.financeiro.contas.list.useQuery();
  const transferencias = trpc.financeiro.transferencias.list.useQuery(
    contaFiltroTransferencias === "todas"
      ? { incluirEstornadas: true }
      : { contaFinanceiraId: Number(contaFiltroTransferencias), incluirEstornadas: true },
  );
  const contaBaixa = (contas.data ?? []).find((item) => String(item.id) === baixa.contaFinanceiraId);
  const caixaChequeSelecionado = contaBaixa?.tipo === "caixa_cheque";
  const chequesDisponiveis = trpc.financeiro.cheques.list.useQuery(
    { contaFinanceiraId: Number(baixa.contaFinanceiraId || 0), estado: "disponivel" },
    { enabled: caixaChequeSelecionado && Boolean(baixa.contaFinanceiraId) && tituloSelecionado?.tipo === "pagar" },
  );
  const recorrencias = trpc.financeiro.recorrencias.list.useQuery();
  const alertas = trpc.financeiro.alertas.list.useQuery();
  const fluxoCaixa = trpc.financeiro.relatorios.fluxoCaixa.useQuery(periodoFluxo);
  const fluxoGerencial = trpc.financeiro.relatorios.fluxoGerencial.useQuery({
    ...periodoFluxo,
    ...(contaFluxoGerencial === "todas" ? {} : { contaFinanceiraId: Number(contaFluxoGerencial) }),
  });
  const previsaoSemanal = trpc.financeiro.relatorios.previsaoSemanal.useQuery({ semanas: 8 });
  const modeloImportacao = trpc.financeiro.intercambios.modeloLancamentosCsv.useQuery(undefined, { enabled: false });
  const modeloFornecedores = trpc.financeiro.fornecedores.modeloCsv.useQuery(undefined, { enabled: false });
  const exportacaoLancamentos = trpc.financeiro.intercambios.exportarLancamentosCsv.useQuery(
    visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? { tipo: "pagar" } : { tipo: "receber" },
    { enabled: false },
  );
  const baixasTitulo = trpc.financeiro.titulos.baixas.useQuery(
    { tituloId: tituloBaixas?.id ?? 0 },
    { enabled: Boolean(tituloBaixas) },
  );
  const clientes = trpc.cliente.list.useQuery();
  const visaoOperacionalAberta = visaoFinanceira === "pagar" || visaoFinanceira === "receber";
  const consultaOperacional = useMemo(() => {
    if (!visaoOperacionalAberta) return undefined;
    const valorMinimo = filtrosFinanceiros.valorMinimo ? Number(filtrosFinanceiros.valorMinimo.replace(",", ".")) : undefined;
    const valorMaximo = filtrosFinanceiros.valorMaximo ? Number(filtrosFinanceiros.valorMaximo.replace(",", ".")) : undefined;
    return {
      tipo: visaoFinanceira,
      ...(filtrosFinanceiros.descricao.trim() ? { descricao: filtrosFinanceiros.descricao.trim() } : {}),
      ...(Number.isFinite(valorMinimo) ? { valorMinimo } : {}),
      ...(Number.isFinite(valorMaximo) ? { valorMaximo } : {}),
      ...(filtrosFinanceiros.dataInicio ? { dataInicio: filtrosFinanceiros.dataInicio } : {}),
      ...(filtrosFinanceiros.dataFim ? { dataFim: filtrosFinanceiros.dataFim } : {}),
      ...(filtrosFinanceiros.clienteId ? { clienteId: Number(filtrosFinanceiros.clienteId) } : {}),
      ...(filtrosFinanceiros.categoriaId ? { categoriaId: Number(filtrosFinanceiros.categoriaId) } : {}),
      ...(filtrosOperacionais.fornecedorId ? { fornecedorId: Number(filtrosOperacionais.fornecedorId) } : {}),
      ...(filtrosOperacionais.origem !== "todas" ? { origem: filtrosOperacionais.origem as "orcamento" | "romaneio_carga" | "nota_diesel" | "serragem_terceiros" | "folha_pagamento" | "manual" | "recorrencia" } : {}),
      ...(filtrosOperacionais.contaFinanceiraId !== "todas" ? { contaFinanceiraId: Number(filtrosOperacionais.contaFinanceiraId) } : {}),
      ...(filtrosOperacionais.situacao !== "todas" ? { situacao: filtrosOperacionais.situacao as "vencido" | "vence_hoje" | "proximos_7_dias" | "proximos_30_dias" | "a_vencer" } : {}),
      ...(filtrosOperacionais.aging !== "todas" ? { aging: filtrosOperacionais.aging as "a_vencer" | "vence_hoje" | "1_7" | "8_30" | "31_60" | "61_90" | "mais_90" } : {}),
      ...(filtrosOperacionais.estado !== "todos" ? { estado: filtrosOperacionais.estado as "aberto" | "parcial" } : {}),
      ordenar: filtrosOperacionais.ordenar,
    };
  }, [filtrosFinanceiros, filtrosOperacionais, visaoFinanceira, visaoOperacionalAberta]);
  const contasOperacionais = trpc.financeiro.contasOperacionais.list.useQuery(consultaOperacional ?? { tipo: "pagar" }, { enabled: Boolean(consultaOperacional) });
  const filtrosConsultaTitulos = useMemo(() => {
    if (!filtrosAplicados) return undefined;
    const valorMinimo = filtrosAplicados.valorMinimo ? Number(filtrosAplicados.valorMinimo.replace(",", ".")) : undefined;
    const valorMaximo = filtrosAplicados.valorMaximo ? Number(filtrosAplicados.valorMaximo.replace(",", ".")) : undefined;
    const historico = visaoFinanceira === "pagas" || visaoFinanceira === "recebidas";
    return {
      ...(filtrosAplicados.descricao.trim() ? { descricao: filtrosAplicados.descricao.trim() } : {}),
      ...(Number.isFinite(valorMinimo) ? { valorMinimo } : {}),
      ...(Number.isFinite(valorMaximo) ? { valorMaximo } : {}),
      ...(filtrosAplicados.dataInicio ? { dataInicio: new Date(`${filtrosAplicados.dataInicio}T00:00:00`) } : {}),
      ...(filtrosAplicados.dataFim ? { dataFim: new Date(`${filtrosAplicados.dataFim}T23:59:59.999`) } : {}),
      ...(filtrosAplicados.clienteId ? { clienteId: Number(filtrosAplicados.clienteId) } : {}),
      ...(filtrosAplicados.categoriaId ? { categoriaId: Number(filtrosAplicados.categoriaId) } : {}),
      ...(filtrosAplicados.centroCustoId ? { centroCustoId: Number(filtrosAplicados.centroCustoId) } : {}),
      ...(filtrosAplicados.origem !== "todas" ? { origem: filtrosAplicados.origem as "orcamento" | "romaneio_carga" | "nota_diesel" | "serragem_terceiros" | "folha_pagamento" | "manual" | "recorrencia" } : {}),
      criterioData: historico ? "baixa" as const : "vencimento" as const,
    };
  }, [filtrosAplicados, visaoFinanceira]);
  const titulosPesquisados = trpc.financeiro.titulos.list.useQuery(filtrosConsultaTitulos, { enabled: Boolean(filtrosConsultaTitulos) });
  const criarLancamento = trpc.financeiro.titulos.createManual.useMutation();
  const criarLancamentoParcelado = trpc.financeiro.titulos.createParcelado.useMutation();
  const atualizarTitulo = trpc.financeiro.titulos.update.useMutation();
  const atualizarTitulosEmLote = trpc.financeiro.titulos.updateEmLote.useMutation();
  const registrarBaixa = trpc.financeiro.titulos.baixar.useMutation();
  const criarFornecedor = trpc.financeiro.fornecedores.create.useMutation();
  const atualizarFornecedor = trpc.financeiro.fornecedores.update.useMutation();
  const criarCategoria = trpc.financeiro.categorias.create.useMutation();
  const criarCentroCusto = trpc.financeiro.centrosCusto.create.useMutation();
  const criarConta = trpc.financeiro.contas.create.useMutation();
  const atualizarConta = trpc.financeiro.contas.update.useMutation();
  const excluirConta = trpc.financeiro.contas.delete.useMutation();
  const criarTransferencia = trpc.financeiro.transferencias.create.useMutation();
  const estornarTransferencia = trpc.financeiro.transferencias.estornar.useMutation();
  const criarCliente = trpc.cliente.create.useMutation();
  const criarRecorrencia = trpc.financeiro.recorrencias.create.useMutation();
  const conciliarBaixa = trpc.financeiro.titulos.conciliarBaixa.useMutation();
  const estornarBaixa = trpc.financeiro.titulos.estornarBaixa.useMutation();
  const excluirTitulo = trpc.financeiro.titulos.delete.useMutation();
  const importarLancamentos = trpc.financeiro.intercambios.importarLancamentosCsv.useMutation();
  const prepararImportacaoFornecedores = trpc.financeiro.fornecedores.prepararImportacaoCsv.useMutation();
  const importarFornecedores = trpc.financeiro.fornecedores.importarCsv.useMutation();
  const enviarAnexoFinanceiro = trpc.financeiro.anexos.upload.useMutation();
  const atualizarBoletoFinanceiro = trpc.financeiro.anexos.atualizarBoleto.useMutation();
  const anexosTituloEditado = trpc.financeiro.anexos.list.useQuery(
    { tituloId: tituloParaEditar?.id ?? 0 },
    { enabled: Boolean(tituloParaEditar) },
  );
  const removerAnexoFinanceiro = trpc.financeiro.anexos.remove.useMutation();
  const maiorFluxoDiario = useMemo(() => Math.max(...(fluxoCaixa.data?.dias ?? []).flatMap((dia) => [Number(dia.entradas), Number(dia.saidas)]), 1), [fluxoCaixa.data]);
  const totalChequesRecebidos = useMemo(() => chequesRecebidos.reduce((total, cheque) => total + Number(cheque.valor.replace(",", ".") || 0), 0), [chequesRecebidos]);
  const totalChequesSelecionados = useMemo(() => (chequesDisponiveis.data ?? [])
    .filter((cheque: ChequeDisponivel) => chequesSelecionados.includes(cheque.id))
    .reduce((total, cheque: ChequeDisponivel) => total + Number(cheque.valor), 0), [chequesDisponiveis.data, chequesSelecionados]);

  const resumo = useMemo(() => {
    const dados = titulos.data ?? [];
    return dados.reduce((acumulado, titulo) => {
      if (titulo.estado === "cancelado" || titulo.estado === "quitado") return acumulado;
      const saldo = saldoTitulo(titulo);
      if (titulo.tipo === "receber") acumulado.receber += saldo;
      if (titulo.tipo === "pagar") acumulado.pagar += saldo;
      if (titulo.estado === "vencido") acumulado.vencidos += saldo;
      return acumulado;
    }, { receber: 0, pagar: 0, vencidos: 0 });
  }, [titulos.data]);

  const compromissos = useMemo(() => {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    const emAberto = (titulos.data ?? []).filter((titulo) => !["quitado", "cancelado"].includes(titulo.estado));
    return {
      vencidos: emAberto.filter((titulo) => titulo.estado === "vencido"),
      proximos: emAberto.filter((titulo) => {
        const vencimento = new Date(titulo.dataVencimento);
        return vencimento >= hoje && vencimento <= limite;
      }).sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()),
    };
  }, [titulos.data]);

  const titulosExibidos = useMemo(() => {
    if (!filtrosAplicados) return [];
    const tipo = visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? "pagar" : "receber";
    const quitado = visaoFinanceira === "pagas" || visaoFinanceira === "recebidas";
    return (titulosPesquisados.data ?? []).filter((titulo) => {
      if (titulo.tipo !== tipo || titulo.estado === "cancelado") return false;
      if (quitado ? titulo.estado !== "quitado" : ["quitado", "cancelado"].includes(titulo.estado)) return false;
      return true;
    });
  }, [titulosPesquisados.data, visaoFinanceira, filtrosAplicados]);
  const tituloLancamentos = opcoesVisaoFinanceira.find((item) => item.id === visaoFinanceira)!;
  const titulosHoje = useMemo(() => titulosExibidos.filter((titulo) => dataChaveFinanceira(titulo.dataVencimento) === hoje()), [titulosExibidos]);
  const totaisPesquisa = useMemo(() => {
    const quitados = visaoFinanceira === "pagas" || visaoFinanceira === "recebidas";
    return (titulosPesquisados.data ?? []).reduce((acumulado, titulo) => {
      if (titulo.estado === "cancelado" || (quitados ? titulo.estado !== "quitado" : titulo.estado === "quitado")) return acumulado;
      const valor = quitados ? Number(titulo.valorBaixado || valorTotalTitulo(titulo)) : saldoTitulo(titulo);
      if (titulo.tipo === "receber") acumulado.receber += valor;
      if (titulo.tipo === "pagar") acumulado.pagar += valor;
      return acumulado;
    }, { receber: 0, pagar: 0 });
  }, [titulosPesquisados.data, visaoFinanceira]);

  const invalidarFinanceiro = () => {
    utils.financeiro.titulos.list.invalidate();
    utils.financeiro.contasOperacionais.list.invalidate();
    utils.financeiro.categorias.list.invalidate();
    utils.financeiro.centrosCusto.list.invalidate();
    utils.financeiro.fornecedores.list.invalidate();
    utils.financeiro.contas.list.invalidate();
    utils.financeiro.transferencias.list.invalidate();
    utils.financeiro.transferencias.movimentosPorConta.invalidate();
    utils.financeiro.cheques.list.invalidate();
    utils.financeiro.cheques.resumo.invalidate();
    utils.financeiro.recorrencias.list.invalidate();
    utils.financeiro.alertas.list.invalidate();
    utils.financeiro.relatorios.fluxoCaixa.invalidate();
    utils.financeiro.relatorios.previsaoSemanal.invalidate();
    if (tituloBaixas) utils.financeiro.titulos.baixas.invalidate({ tituloId: tituloBaixas.id });
  };

  const abrirNovaTransferencia = () => {
    setTransferencia(valorInicialTransferencia());
    setTransferenciaAberta(true);
  };

  const confirmarTransferencia = () => {
    const contaOrigemId = Number(transferencia.contaOrigemId);
    const contaDestinoId = Number(transferencia.contaDestinoId);
    const valor = Number(transferencia.valor.replace(",", "."));
    if (!contaOrigemId || !contaDestinoId || !Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe as duas contas e um valor positivo para transferir.");
      return;
    }
    if (contaOrigemId === contaDestinoId) {
      toast.error("Selecione contas de origem e destino diferentes.");
      return;
    }
    criarTransferencia.mutate({
      contaOrigemId,
      contaDestinoId,
      valor: transferencia.valor.replace(",", "."),
      dataTransferencia: transferencia.dataTransferencia,
      ...(transferencia.descricao.trim() ? { descricao: transferencia.descricao.trim() } : {}),
    }, {
      onSuccess: () => {
        toast.success("Transferência interna registrada sem criar título financeiro.");
        setTransferenciaAberta(false);
        setTransferencia(valorInicialTransferencia());
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarEstornoTransferencia = () => {
    if (!transferenciaParaEstornar) return;
    if (motivoEstornoTransferencia.trim().length < 3) {
      toast.error("Informe um motivo de ao menos 3 caracteres para o estorno.");
      return;
    }
    estornarTransferencia.mutate({ id: transferenciaParaEstornar, motivo: motivoEstornoTransferencia.trim() }, {
      onSuccess: () => {
        toast.success("Estorno registrado como uma nova transferência inversa.");
        setTransferenciaParaEstornar(null);
        setMotivoEstornoTransferencia("");
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const pesquisarTitulos = () => {
    const possuiFiltro = Object.values(filtrosFinanceiros).some((valor) => valor.trim().length > 0);
    if (!possuiFiltro) {
      toast.message("Informe pelo menos um filtro para pesquisar os lançamentos.");
      return;
    }
    setTitulosSelecionados([]);
    setFiltrosAplicados({ ...filtrosFinanceiros });
  };

  const limparFiltrosTitulos = () => {
    setFiltrosFinanceiros(valorInicialFiltrosFinanceiros());
    setFiltrosAplicados(null);
    setTitulosSelecionados([]);
  };

  const aplicarPeriodoRapido = (periodo: "hoje" | "seteDias" | "mes") => {
    const dataFim = hoje();
    const dataInicio = periodo === "hoje" ? dataFim : periodo === "seteDias" ? dataHaDias(6) : primeiroDiaDoMes();
    const proximosFiltros = { ...filtrosFinanceiros, dataInicio, dataFim };
    setFiltrosFinanceiros(proximosFiltros);
    setFiltrosAplicados(proximosFiltros);
    setTitulosSelecionados([]);
  };

  const selecionarEntidadeCriada = (entidade: EntidadeContextual, id: number) => {
    if (contextoCriacao?.entidade !== entidade) return;
    const valor = String(id);
    if (contextoCriacao.destino === "lancamento") {
      setLancamento((atual) => ({
        ...atual,
        ...(entidade === "categoria" ? { categoriaId: valor } : {}),
        ...(entidade === "cliente" ? { clienteId: valor } : {}),
        ...(entidade === "fornecedor" ? { fornecedorId: valor } : {}),
      }));
    }
    if (contextoCriacao.destino === "recorrencia") {
      setRecorrencia((atual) => ({
        ...atual,
        ...(entidade === "categoria" ? { categoriaId: valor } : {}),
        ...(entidade === "cliente" ? { clienteId: valor } : {}),
        ...(entidade === "fornecedor" ? { fornecedorId: valor } : {}),
      }));
    }
    if (contextoCriacao.destino === "baixa" && entidade === "conta") {
      setBaixa((atual) => ({ ...atual, contaFinanceiraId: valor }));
    }
    if (contextoCriacao.destino === "cheque" && entidade === "cliente" && indiceChequeCliente !== null) {
      setChequesRecebidos((atuais) => atuais.map((cheque, indice) => indice === indiceChequeCliente ? { ...cheque, clienteId: valor } : cheque));
      setIndiceChequeCliente(null);
    }
    if (contextoCriacao.destino === "edicaoLote" && entidade === "centroCusto") {
      setEdicaoLote((atual) => ({ ...atual, centroCustoId: valor }));
    }
    setContextoCriacao(null);
  };

  const abrirCriacaoContextual = (entidade: EntidadeContextual, destino: DestinoContextual) => {
    setContextoCriacao({ entidade, destino });
    if (entidade === "fornecedor") { setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); setFornecedorAberto(true); }
    if (entidade === "categoria") { setCategoria({ nome: "", tipo: destino === "lancamento" ? (lancamento.tipo === "receber" ? "receita" : "despesa") : (recorrencia.tipo === "receber" ? "receita" : "despesa") }); setCategoriaAberta(true); }
    if (entidade === "conta") { setContaEditando(null); setConta(valorInicialConta()); setContaAberta(true); }
    if (entidade === "cliente") { setCliente({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); setClienteAberto(true); }
    if (entidade === "centroCusto") { setCentroCusto({ nome: "", tipo: "industrial", observacoes: "" }); setCentroCustoAberto(true); }
  };

  const arquivoParaBase64 = (arquivo: File) => new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });

  const selecionarAnexosLancamento = (arquivos: FileList | null) => {
    const permitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const novos = Array.from(arquivos ?? []);
    const invalidos = novos.filter((arquivo) => !permitidos.includes(arquivo.type) || arquivo.size > 8 * 1024 * 1024);
    if (invalidos.length) toast.error("Envie apenas PDF, JPG, PNG ou WEBP de até 8 MB.");
    setAnexosLancamento((atuais) => [...atuais, ...novos.filter((arquivo) => permitidos.includes(arquivo.type) && arquivo.size <= 8 * 1024 * 1024)].slice(0, 6));
  };

  const detectarCodigoDeImagem = async () => {
    const imagem = anexosLancamento.find((arquivo) => arquivo.type.startsWith("image/"));
    const Detector = (globalThis as any).BarcodeDetector;
    if (!imagem) { toast.error("Anexe uma imagem do boleto antes de tentar a leitura."); return; }
    if (!Detector) { toast.message("A leitura automática não está disponível neste navegador. Informe a linha digitável manualmente."); return; }
    try {
      const detector = new Detector({ formats: ["i25", "code_128", "interleaved_2_of_5"] });
      const resultado = await detector.detect(await createImageBitmap(imagem));
      const codigo = resultado[0]?.rawValue?.replace(/\D/g, "") ?? "";
      if (!codigo) { toast.error("Não foi possível ler o código. Confira a imagem ou informe a linha digitável."); return; }
      setCodigoBoletoLancamento(codigo);
      toast.success("Código identificado. Confira os dígitos antes de salvar.");
    } catch { toast.error("Não foi possível ler o código nesta imagem. Informe a linha digitável."); }
  };

  const anexarDocumentosAoTitulo = async (arquivos: FileList | null) => {
    const tituloId = tituloParaEditar?.id;
    if (!tituloId) return;
    const permitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const validos = Array.from(arquivos ?? []).filter((arquivo) => permitidos.includes(arquivo.type) && arquivo.size <= 8 * 1024 * 1024);
    if (!validos.length) { toast.error("Envie apenas PDF, JPG, PNG ou WEBP de até 8 MB."); return; }
    try {
      await Promise.all(validos.slice(0, 6).map(async (arquivo) => enviarAnexoFinanceiro.mutateAsync({
        tituloId,
        nomeArquivo: arquivo.name,
        mimeType: arquivo.type,
        tamanhoBytes: arquivo.size,
        tipo: arquivo.type === "application/pdf" && /boleto/i.test(arquivo.name) ? "boleto" : arquivo.type === "application/pdf" ? "nota_fiscal" : "outro",
        base64: await arquivoParaBase64(arquivo),
      })));
      toast.success(validos.length === 1 ? "Documento anexado" : "Documentos anexados");
      await anexosTituloEditado.refetch();
    } catch (erro: any) { toast.error(erro.message || "Não foi possível anexar o documento."); }
  };

  const salvarLancamento = () => {
    if (!lancamento.categoriaId || !lancamento.centroCustoId) { toast.error("Selecione uma categoria financeira e um centro de custo"); return; }
    const { parcelar, quantidadeParcelas, ...dadosLancamento } = lancamento;
    const dados = {
      ...dadosLancamento,
      categoriaId: Number(lancamento.categoriaId),
      centroCustoId: Number(lancamento.centroCustoId),
      clienteId: lancamento.clienteId ? Number(lancamento.clienteId) : null,
      fornecedorId: lancamento.fornecedorId ? Number(lancamento.fornecedorId) : null,
      contraparteNome: lancamento.contraparteNome || null,
      observacoes: lancamento.observacoes || null,
    };
    const concluir = async (resultado: any) => {
      const tituloId = resultado?.id ?? resultado?.titulos?.[0]?.id;
      try {
        if (tituloId) {
          await Promise.all(anexosLancamento.map(async (arquivo) => enviarAnexoFinanceiro.mutateAsync({
            tituloId,
            nomeArquivo: arquivo.name,
            mimeType: arquivo.type,
            tamanhoBytes: arquivo.size,
            tipo: arquivo.type === "application/pdf" && /boleto/i.test(arquivo.name) ? "boleto" : arquivo.type === "application/pdf" ? "nota_fiscal" : "outro",
            base64: await arquivoParaBase64(arquivo),
          })));
          if (codigoBoletoLancamento.trim()) await atualizarBoletoFinanceiro.mutateAsync({ tituloId, codigo: codigoBoletoLancamento });
        }
      } catch (erro: any) { toast.error(`Lançamento criado, mas não foi possível concluir um anexo: ${erro.message}`); }
      toast.success(parcelar ? "Lançamento parcelado criado" : "Lançamento não programado criado");
      invalidarFinanceiro();
      setLancamentoAberto(false);
      setLancamento(valorInicialLancamento());
      setAnexosLancamento([]);
      setCodigoBoletoLancamento("");
    };
    if (parcelar) {
      criarLancamentoParcelado.mutate({ ...dados, quantidadeParcelas: Number(quantidadeParcelas) }, {
        onSuccess: (resultado) => { void concluir(resultado); },
        onError: (erro) => toast.error(erro.message),
      });
    } else {
      criarLancamento.mutate(dados, {
        onSuccess: (resultado) => { void concluir(resultado); },
        onError: (erro) => toast.error(erro.message),
      });
    }
  };

  const abrirBaixa = (titulo: any) => {
    if (!contas.data?.length) { toast.error("Cadastre uma conta financeira antes de registrar uma baixa"); setAba("contas"); return; }
    setTituloSelecionado(titulo);
    const contaInicial = contas.data[0];
    setBaixa({ contaFinanceiraId: String(contaInicial.id), valor: saldoTitulo(titulo).toFixed(2), dataBaixa: hoje(), formaPagamento: contaInicial.tipo === "caixa_cheque" ? "cheque" : "pix", observacoes: "" });
    setChequesRecebidos([{ referencia: "", valor: saldoTitulo(titulo).toFixed(2), clienteId: titulo.clienteId ? String(titulo.clienteId) : "", dataCompensacao: "" }]);
    setChequesSelecionados([]);
    setBaixaAberta(true);
  };

  const abrirEdicaoAgendamento = (titulo: any) => {
    setTituloParaEditar(titulo);
    setLancamentoEditado({
      tipo: titulo.tipo,
      descricao: titulo.descricao ?? "",
      categoriaId: titulo.categoriaId ? String(titulo.categoriaId) : "",
      centroCustoId: titulo.centroCustoId ? String(titulo.centroCustoId) : "",
      valorOriginal: String(titulo.valorOriginal ?? ""),
      dataEmissao: dataChaveFinanceira(titulo.dataEmissao),
      dataVencimento: dataChaveFinanceira(titulo.dataVencimento),
      clienteId: titulo.clienteId ? String(titulo.clienteId) : "",
      fornecedorId: titulo.fornecedorId ? String(titulo.fornecedorId) : "",
      contraparteNome: titulo.contraparteNome ?? "",
      desconto: String(titulo.desconto ?? "0"),
      juros: String(titulo.juros ?? "0"),
      parcelar: false,
      quantidadeParcelas: "2",
      observacoes: titulo.observacoes ?? "",
    });
  };

  const salvarAgendamento = () => {
    if (!tituloParaEditar || !lancamentoEditado.categoriaId) {
      toast.error("Selecione uma categoria financeira");
      return;
    }
    atualizarTitulo.mutate({
      id: tituloParaEditar.id,
      tipo: lancamentoEditado.tipo,
      descricao: lancamentoEditado.descricao,
      categoriaId: Number(lancamentoEditado.categoriaId),
      ...(lancamentoEditado.centroCustoId ? { centroCustoId: Number(lancamentoEditado.centroCustoId) } : {}),
      valorOriginal: lancamentoEditado.valorOriginal,
      dataEmissao: lancamentoEditado.dataEmissao,
      dataVencimento: lancamentoEditado.dataVencimento,
      clienteId: lancamentoEditado.clienteId ? Number(lancamentoEditado.clienteId) : null,
      fornecedorId: lancamentoEditado.fornecedorId ? Number(lancamentoEditado.fornecedorId) : null,
      contraparteNome: lancamentoEditado.contraparteNome || null,
      desconto: lancamentoEditado.desconto || "0",
      juros: lancamentoEditado.juros || "0",
      observacoes: lancamentoEditado.observacoes || null,
    }, {
      onSuccess: () => {
        toast.success("Lançamento atualizado com sucesso");
        setTituloParaEditar(null);
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const salvarCentroCusto = () => {
    if (centroCusto.nome.trim().length < 2) {
      toast.error("Informe um nome para o Centro de Custo.");
      return;
    }
    criarCentroCusto.mutate({
      nome: centroCusto.nome.trim(),
      tipo: centroCusto.tipo,
      observacoes: centroCusto.observacoes.trim() || null,
    }, {
      onSuccess: (resultado) => {
        toast.success("Centro de Custo criado com sucesso.");
        setCentroCustoAberto(false);
        invalidarFinanceiro();
        selecionarEntidadeCriada("centroCusto", resultado.id);
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const salvarEdicaoEmLote = () => {
    if (!titulosSelecionados.length) return;
    const dados: Record<string, unknown> = { ids: titulosSelecionados };
    if (edicaoLote.descricao.trim()) dados.descricao = edicaoLote.descricao.trim();
    if (edicaoLote.categoriaId) dados.categoriaId = Number(edicaoLote.categoriaId);
    if (edicaoLote.centroCustoId) dados.centroCustoId = Number(edicaoLote.centroCustoId);
    if (edicaoLote.dataVencimento) dados.dataVencimento = edicaoLote.dataVencimento;
    if (edicaoLote.observacoes.trim()) dados.observacoes = edicaoLote.observacoes.trim();
    if (Object.keys(dados).length === 1) { toast.error("Informe pelo menos um campo para atualizar"); return; }
    atualizarTitulosEmLote.mutate(dados as any, {
      onSuccess: (resultado: any) => {
        toast.success(`${resultado.atualizados} lançamento(s) atualizado(s)`);
        setEdicaoLoteAberta(false);
        setTitulosSelecionados([]);
        setEdicaoLote({ descricao: "", categoriaId: "", centroCustoId: "", dataVencimento: "", observacoes: "" });
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const salvarBaixa = () => {
    if (!tituloSelecionado || !baixa.contaFinanceiraId) return;
    if (caixaChequeSelecionado && baixa.formaPagamento !== "cheque") { toast.error("A conta Caixa Cheque exige a forma de pagamento Cheque"); return; }
    if (caixaChequeSelecionado && tituloSelecionado.tipo === "receber" && !chequesRecebidos.length) { toast.error("Informe pelo menos um cheque recebido"); return; }
    if (caixaChequeSelecionado && tituloSelecionado.tipo === "pagar" && !chequesSelecionados.length) { toast.error("Selecione os cheques que serão usados neste pagamento"); return; }
    registrarBaixa.mutate({
      tituloId: tituloSelecionado.id,
      contaFinanceiraId: Number(baixa.contaFinanceiraId),
      valor: baixa.valor,
      dataBaixa: baixa.dataBaixa,
      formaPagamento: baixa.formaPagamento as "pix" | "dinheiro" | "cheque" | "cartao_credito" | "cartao_debito" | "transferencia" | "boleto" | "outro",
      observacoes: baixa.observacoes || undefined,
      chequesRecebidos: caixaChequeSelecionado && tituloSelecionado.tipo === "receber"
        ? chequesRecebidos.map((cheque) => ({ referencia: cheque.referencia, valor: cheque.valor, ...(cheque.clienteId ? { clienteId: Number(cheque.clienteId) } : {}), ...(cheque.dataCompensacao ? { dataCompensacao: cheque.dataCompensacao } : {}) }))
        : undefined,
      chequeIdsUtilizados: caixaChequeSelecionado && tituloSelecionado.tipo === "pagar" ? chequesSelecionados : undefined,
    }, {
      onSuccess: () => { toast.success("Baixa registrada com sucesso"); invalidarFinanceiro(); setBaixaAberta(false); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarExclusaoTitulo = () => {
    if (!tituloParaExcluir) return;
    excluirTitulo.mutate({ id: tituloParaExcluir.id }, {
      onSuccess: () => {
        toast.success("Lançamento excluído com sucesso");
        setTituloParaExcluir(null);
        invalidarFinanceiro();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarExclusaoConta = () => {
    if (!contaParaExcluir) return;
    excluirConta.mutate({ id: contaParaExcluir.id }, {
      onSuccess: () => {
        toast.success("Conta financeira excluída");
        utils.financeiro.contas.list.invalidate();
        setContaParaExcluir(null);
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarEstorno = () => {
    if (!baixaParaEstornar || motivoEstorno.trim().length < 3) {
      toast.error("Informe o motivo do estorno");
      return;
    }
    estornarBaixa.mutate({ id: baixaParaEstornar.id, motivo: motivoEstorno.trim() }, {
      onSuccess: () => {
        toast.success("Baixa estornada e título recalculado com sucesso");
        setBaixaParaEstornar(null);
        setMotivoEstorno("");
        invalidarFinanceiro();
        baixasTitulo.refetch();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const baixarModeloImportacao = async () => {
    const resposta = await modeloImportacao.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo CSV"); return; }
    baixarCsv(resposta.data, "modelo-lancamentos-fk-madeiras.csv");
    toast.success("Modelo CSV baixado");
  };

  const exportarLancamentos = async () => {
    const resposta = await exportacaoLancamentos.refetch();
    if (!resposta.data) { toast.error("Não foi possível exportar os lançamentos"); return; }
    baixarCsv(resposta.data, `lancamentos-fk-madeiras-${hoje()}.csv`);
    toast.success("Lançamentos exportados em CSV");
  };

  const importarArquivo = async () => {
    if (!arquivoImportacao) { toast.error("Selecione um arquivo CSV para importar"); return; }
    try {
      const conteudo = await arquivoImportacao.text();
      importarLancamentos.mutate({ conteudo }, {
        onSuccess: (resultado) => {
          if (resultado.erros.length) { setErrosImportacao(resultado.erros); toast.error("A importação foi recusada. Revise as linhas indicadas."); return; }
          toast.success(`${resultado.importados} lançamento(s) importado(s) com sucesso`);
          setArquivoImportacao(null);
          setErrosImportacao([]);
          setImportacaoAberta(false);
          invalidarFinanceiro();
        },
        onError: (erro) => toast.error(erro.message),
      });
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };

  const limparImportacaoFornecedores = () => {
    setArquivoFornecedores(null);
    setConteudoImportacaoFornecedores("");
    setPreparoFornecedores(null);
  };

  const baixarModeloFornecedores = async () => {
    const resposta = await modeloFornecedores.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo CSV de fornecedores"); return; }
    baixarCsv(resposta.data, "modelo-fornecedores-fk-madeiras.csv");
    toast.success("Modelo de fornecedores baixado");
  };

  const selecionarArquivoFornecedores = async (arquivo: File | null) => {
    setArquivoFornecedores(arquivo);
    setConteudoImportacaoFornecedores("");
    setPreparoFornecedores(null);
    if (!arquivo) return;
    try {
      const conteudo = await arquivo.text();
      setConteudoImportacaoFornecedores(conteudo);
      prepararImportacaoFornecedores.mutate({ conteudo }, {
        onSuccess: (resultado) => setPreparoFornecedores(resultado),
        onError: (erro) => { setPreparoFornecedores({ linhas: [], erros: [erro.message] }); toast.error("Não foi possível validar a planilha"); },
      });
    } catch {
      setPreparoFornecedores({ linhas: [], erros: ["Não foi possível ler o arquivo selecionado"] });
    }
  };

  const confirmarImportacaoFornecedores = () => {
    if (!conteudoImportacaoFornecedores || !preparoFornecedores || preparoFornecedores.erros.length) return;
    importarFornecedores.mutate({ conteudo: conteudoImportacaoFornecedores }, {
      onSuccess: (resultado) => {
        if (resultado.erros.length) { setPreparoFornecedores({ linhas: [], erros: resultado.erros }); toast.error("A importação foi recusada. Revise os dados indicados."); return; }
        toast.success(`${resultado.importados} fornecedor(es) importado(s) com sucesso`);
        utils.financeiro.fornecedores.list.invalidate();
        limparImportacaoFornecedores();
        setImportacaoFornecedoresAberta(false);
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const salvarFornecedor = () => {
    const dados = { ...fornecedor, email: fornecedor.email || null, contacto: fornecedor.contacto || null, documento: fornecedor.documento || null, endereco: fornecedor.endereco || null, observacoes: fornecedor.observacoes || null };
    if (fornecedorEditando) {
      atualizarFornecedor.mutate({ id: fornecedorEditando.id, ...dados }, {
        onSuccess: () => { toast.success("Fornecedor atualizado"); utils.financeiro.fornecedores.list.invalidate(); setFornecedorAberto(false); setFornecedorEditando(null); setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); },
        onError: (erro) => toast.error(erro.message),
      });
      return;
    }
    criarFornecedor.mutate(dados, {
      onSuccess: (criado) => { toast.success("Fornecedor cadastrado"); utils.financeiro.fornecedores.list.invalidate(); selecionarEntidadeCriada("fornecedor", criado.id); setFornecedorAberto(false); setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const abrirEdicaoFornecedor = (item: any) => {
    setFornecedorEditando(item);
    setFornecedor({ nome: item.nome ?? "", contacto: item.contacto ?? "", email: item.email ?? "", documento: item.documento ?? "", endereco: item.endereco ?? "", observacoes: item.observacoes ?? "" });
    setFornecedorAberto(true);
  };

  const salvarCategoria = () => criarCategoria.mutate(categoria, {
    onSuccess: (criada) => { toast.success("Categoria criada"); utils.financeiro.categorias.list.invalidate(); selecionarEntidadeCriada("categoria", criada.id); setCategoriaAberta(false); setCategoria({ nome: "", tipo: "ambos" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const dadosConta = () => ({
    ...conta,
    banco: conta.banco.trim() || null,
    agencia: conta.agencia.trim() || null,
    numeroConta: conta.numeroConta.trim() || null,
    dataInicio: conta.dataInicio || null,
    observacoes: conta.observacoes || null,
  });

  const fecharDialogoConta = () => {
    setContaAberta(false);
    setContaEditando(null);
    setConta(valorInicialConta());
  };

  const abrirNovaConta = () => {
    setContaEditando(null);
    setConta(valorInicialConta());
    setContaAberta(true);
  };

  const abrirEdicaoConta = (item: ContaFinanceira) => {
    setContaEditando(item);
    setConta({
      nome: item.nome ?? "",
      tipo: item.tipo,
      banco: item.banco ?? "",
      agencia: item.agencia ?? "",
      numeroConta: item.numeroConta ?? "",
      dataInicio: dataChaveFinanceira(item.dataInicio),
      saldoInicial: String(item.saldoInicial ?? "0"),
      observacoes: item.observacoes ?? "",
    });
    setContaAberta(true);
  };

  const salvarConta = () => {
    const dados = dadosConta();
    if (contaEditando) {
      atualizarConta.mutate({ id: contaEditando.id, ...dados }, {
        onSuccess: () => { toast.success("Dados da conta atualizados"); utils.financeiro.contas.list.invalidate(); fecharDialogoConta(); },
        onError: (erro) => toast.error(erro.message),
      });
      return;
    }
    criarConta.mutate(dados, {
      onSuccess: (criada) => { toast.success("Conta financeira cadastrada"); utils.financeiro.contas.list.invalidate(); selecionarEntidadeCriada("conta", criada.id); fecharDialogoConta(); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const salvarCliente = () => criarCliente.mutate({ ...cliente, contacto: cliente.contacto || undefined, email: cliente.email || undefined, morada: cliente.morada || undefined, nif: cliente.nif || undefined, observacoes: cliente.observacoes || undefined }, {
    onSuccess: (criado) => { toast.success("Cliente cadastrado"); utils.cliente.list.invalidate(); selecionarEntidadeCriada("cliente", criado.id!); setClienteAberto(false); setCliente({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); },
    onError: (erro) => toast.error(erro.message),
  });

  const salvarRecorrencia = () => {
    if (!recorrencia.categoriaId || !recorrencia.centroCustoId) { toast.error("Selecione uma categoria financeira e um centro de custo"); return; }
    criarRecorrencia.mutate({
      ...recorrencia,
      categoriaId: Number(recorrencia.categoriaId),
      centroCustoId: Number(recorrencia.centroCustoId),
      clienteId: recorrencia.clienteId ? Number(recorrencia.clienteId) : null,
      fornecedorId: recorrencia.fornecedorId ? Number(recorrencia.fornecedorId) : null,
      contraparteNome: recorrencia.contraparteNome || null,
      dataFim: recorrencia.dataFim || null,
      observacoes: recorrencia.observacoes || null,
    }, {
      onSuccess: () => { toast.success("Recorrência financeira criada"); invalidarFinanceiro(); setRecorrenciaAberta(false); setRecorrencia(valorInicialRecorrencia()); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const exportarListaFiltradaPdf = async () => {
    if (!titulosExibidos.length) {
      toast.error("Não há títulos visíveis para exportar");
      return;
    }
    try {
      const relatorioPdf = await exportarListaFinanceiraPdf({
        titulo: tituloLancamentos.label,
        filtros: filtrosFinanceiros,
        titulos: titulosExibidos,
      });
      setRelatorioPdfParaVisualizar(relatorioPdf);
      toast.success("PDF financeiro pronto para conferência");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gerar o PDF");
    }
  };

  const carregando = titulos.isLoading || categorias.isLoading || contas.isLoading || fornecedores.isLoading || recorrencias.isLoading;
  const tituloBaseOperacional = useMemo(() => (titulos.data ?? []).find((titulo) => titulo.id === tituloOperacionalSelecionado?.id) ?? null, [titulos.data, tituloOperacionalSelecionado?.id]);
  const abas = [
    ["lancamentos", "Lançamentos", WalletCards], ["fluxo", "Fluxo de caixa", CircleDollarSign], ["fornecedores", "Fornecedores", Building2],
    ["recorrencias", "Recorrências", RefreshCw], ["categorias", "Categorias", Tags], ["contas", "Contas", Landmark], ["transferencias", "Transferências", ArrowLeftRight],
  ] as const;

  return (
    <div className="max-w-none space-y-6">
      <PdfPreviewDialog open={Boolean(relatorioPdfParaVisualizar)} onOpenChange={(aberto) => {
        if (!aberto && relatorioPdfParaVisualizar) {
          URL.revokeObjectURL(relatorioPdfParaVisualizar.url);
          setRelatorioPdfParaVisualizar(null);
        }
      }} url={relatorioPdfParaVisualizar?.url ?? null} title="Relatório financeiro" description="Confira a relação filtrada antes de confirmar o download." downloadFileName={relatorioPdfParaVisualizar?.nomeArquivo} />
      <PageHeader icon={WalletCards} eyebrow="Gestão financeira" title="Financeiro" description="Controle contas, liquidações, recorrências e movimentações da empresa em um único lugar." actions={<><Button variant="outline" onClick={() => setImportacaoAberta(true)}><Upload className="mr-2 h-4 w-4" />Importar CSV</Button><Button onClick={() => setLancamentoAberto(true)}><Plus className="h-4 w-4 mr-2" />Novo lançamento</Button></>} />

      {!acessoDiretoLista && <div className="grid gap-4 md:grid-cols-3">
        <ResumoCard label="A receber" valor={resumo.receber} icon={<ArrowDownToLine className="h-5 w-5" />} color="text-emerald-700 bg-emerald-50" />
        <ResumoCard label="A pagar" valor={resumo.pagar} icon={<ArrowUpFromLine className="h-5 w-5" />} color="text-rose-700 bg-rose-50" />
        <ResumoCard label="Saldo projetado" valor={resumo.receber - resumo.pagar} icon={<CircleDollarSign className="h-5 w-5" />} color="text-primary bg-primary/10" descricao={resumo.vencidos > 0 ? `${formatCurrency(resumo.vencidos)} em atraso` : "Nenhum título vencido"} />
      </div>}

      {!acessoDiretoLista && <div className="grid gap-4 lg:grid-cols-2">
        <ListaCompromissos titulo="Títulos vencidos" descricao="Pendências que exigem atenção" titulos={compromissos.vencidos} classe="border-rose-200" vazio="Nenhum título vencido" />
        <ListaCompromissos titulo="Próximos 30 dias" descricao="Vencimentos previstos para o período" titulos={compromissos.proximos} classe="border-amber-200" vazio="Nenhum compromisso próximo" />
      </div>}

      {!acessoDiretoLista && alertas.data?.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm overflow-hidden"><div className="flex items-center gap-2 border-b border-amber-200 px-5 py-4"><CircleAlert className="h-5 w-5 text-amber-700" /><div><h2 className="font-semibold text-sm text-amber-950">Alertas automáticos</h2><p className="text-xs text-amber-800">Gerados diariamente a partir dos vencimentos em aberto.</p></div><Badge className="ml-auto bg-amber-100 text-amber-800 hover:bg-amber-100">{alertas.data.length}</Badge></div><div className="divide-y divide-amber-100">{alertas.data.slice(0, 5).map((alerta: any) => <div key={alerta.id} className="flex items-center justify-between gap-4 px-5 py-3"><div><p className="text-sm font-medium text-amber-950">{alerta.mensagem}</p><p className="mt-0.5 text-xs text-amber-800">{alerta.tipo === "vencido" ? "Vencido" : "Próximo do vencimento"} · {formatCurrency(alerta.valorOriginal)}</p></div><Badge variant="outline" className="border-amber-300 bg-white text-amber-800">{alerta.tipo === "vencido" ? "Atenção" : "Acompanhar"}</Badge></div>)}</div></section> : null}

      <div className="fk-compact-tabs flex items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card p-1 shadow-sm" aria-label="Seções do Financeiro">
        {abas.map(([id, label, Icon]) => <button key={id} onClick={() => setAba(id)} className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${aba === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {aba === "lancamentos" && (
        <>
        {visaoOperacionalAberta && (contasOperacionais.isLoading ? <div className="rounded-xl border bg-white p-12 text-center text-muted-foreground shadow-sm"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Carregando contas operacionais...</div> : contasOperacionais.data ? <PainelContasOperacionais dados={contasOperacionais.data} tipo={visaoFinanceira} filtros={filtrosOperacionais} clientes={clientes.data ?? []} clienteId={filtrosFinanceiros.clienteId} fornecedores={fornecedores.data ?? []} contas={contas.data ?? []} onFiltros={(parcial) => setFiltrosOperacionais((atuais) => ({ ...atuais, ...parcial }))} onFiltrarCliente={(clienteId) => setFiltrosFinanceiros((atuais) => ({ ...atuais, clienteId: clienteId ? String(clienteId) : "" }))} onAbrir={setTituloOperacionalSelecionado} onIrFluxo={(dataVencimento) => { const data = dataChaveFinanceira(dataVencimento); setPeriodoFluxo({ dataInicio: data, dataFim: data }); setAba("fluxo"); }} /> : null)}
        <section className={`${visaoOperacionalAberta ? "hidden" : ""} fk-panel overflow-hidden`}>
          <div className="border-b bg-muted/25 px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="fk-eyebrow">Consulta e tratamento</p><h2 className="font-semibold">Gestão de títulos</h2><p className="text-xs text-muted-foreground mt-0.5">Pesquisa orientada a situação, período, origem e contraparte.</p></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={baixarModeloImportacao} disabled={modeloImportacao.isFetching}><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />Modelo CSV</Button><Button size="sm" variant="outline" onClick={exportarLancamentos} disabled={exportacaoLancamentos.isFetching}><Download className="mr-1.5 h-3.5 w-3.5" />Exportar CSV</Button><Button size="sm" variant="outline" onClick={exportarListaFiltradaPdf} disabled={!titulosExibidos.length}><Download className="mr-1.5 h-3.5 w-3.5" />Exportar PDF</Button></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{opcoesVisaoFinanceira.map((item) => <button key={item.id} aria-label={`Visão financeira: ${item.label}`} aria-pressed={visaoFinanceira === item.id} onClick={() => setVisaoFinanceira(item.id)} className={`min-w-max rounded-lg border px-3 py-2 text-left transition-colors ${visaoFinanceira === item.id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}><span className="block text-sm font-semibold">{item.label}</span><span className={`block text-[11px] ${visaoFinanceira === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.descricao}</span></button>)}</div></div>
          <div className="border-b bg-primary/[0.025] px-5 py-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><div className="mt-0.5 rounded-md bg-primary/10 p-1.5"><CalendarClock className="h-3.5 w-3.5 text-primary" /></div><div><p className="text-sm font-semibold">{visaoFinanceira === "recebidas" ? "Recebimentos efetivados" : visaoFinanceira === "pagas" ? "Pagamentos efetivados" : "Agenda financeira"}</p><p className="text-xs text-muted-foreground">{visaoFinanceira === "recebidas" || visaoFinanceira === "pagas" ? "O período pesquisa a data efetiva da baixa, e não o vencimento original." : "O período pesquisa o vencimento previsto e prioriza contas que exigem atenção."}</p></div></div><Badge variant="outline" className="w-fit border-primary/25 bg-white text-primary">{visaoFinanceira === "recebidas" || visaoFinanceira === "pagas" ? "Data efetiva" : "Data de vencimento"}</Badge></div></div>
          <div className="grid gap-3 border-b bg-card px-5 py-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1 lg:col-span-2"><Label htmlFor="filtro-descricao" className="text-xs">Descrição ou contraparte</Label><Input id="filtro-descricao" value={filtrosFinanceiros.descricao} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, descricao: event.target.value })} placeholder="Pesquisar por descrição" /></div><div className="space-y-1"><Label htmlFor="filtro-valor-minimo" className="text-xs">Valor mínimo</Label><Input id="filtro-valor-minimo" inputMode="decimal" value={filtrosFinanceiros.valorMinimo} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, valorMinimo: event.target.value })} placeholder="R$ 0,00" /></div><div className="space-y-1"><Label htmlFor="filtro-valor-maximo" className="text-xs">Valor máximo</Label><Input id="filtro-valor-maximo" inputMode="decimal" value={filtrosFinanceiros.valorMaximo} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, valorMaximo: event.target.value })} placeholder="Sem limite" /></div><div className="space-y-1"><Label htmlFor="filtro-data-inicio" className="text-xs">Data inicial</Label><Input id="filtro-data-inicio" type="date" value={filtrosFinanceiros.dataInicio} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, dataInicio: event.target.value })} /></div><div className="space-y-1"><Label htmlFor="filtro-data-fim" className="text-xs">Data final</Label><Input id="filtro-data-fim" type="date" value={filtrosFinanceiros.dataFim} onChange={(event) => setFiltrosFinanceiros({ ...filtrosFinanceiros, dataFim: event.target.value })} /></div><div className="space-y-1"><Label className="text-xs">Cliente</Label><Select value={filtrosFinanceiros.clienteId || "todos"} onValueChange={(clienteId) => setFiltrosFinanceiros({ ...filtrosFinanceiros, clienteId: clienteId === "todos" ? "" : clienteId })}><SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os clientes</SelectItem>{(clientes.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Origem</Label><Select value={filtrosFinanceiros.origem} onValueChange={(origem) => setFiltrosFinanceiros({ ...filtrosFinanceiros, origem })}><SelectTrigger><SelectValue placeholder="Todas as origens" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as origens</SelectItem><SelectItem value="orcamento">Vendas</SelectItem><SelectItem value="serragem_terceiros">Serviço de serragem</SelectItem><SelectItem value="manual">Lançamento manual</SelectItem><SelectItem value="recorrencia">Recorrência</SelectItem><SelectItem value="romaneio_carga">Romaneio de carga</SelectItem><SelectItem value="nota_diesel">Nota de diesel</SelectItem><SelectItem value="folha_pagamento">Folha de pagamento</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Categoria</Label><Select value={filtrosFinanceiros.categoriaId || "todas"} onValueChange={(categoriaId) => setFiltrosFinanceiros({ ...filtrosFinanceiros, categoriaId: categoriaId === "todas" ? "" : categoriaId })}><SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{(categorias.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Centro de custo</Label><Select value={filtrosFinanceiros.centroCustoId || "todos"} onValueChange={(centroCustoId) => setFiltrosFinanceiros({ ...filtrosFinanceiros, centroCustoId: centroCustoId === "todos" ? "" : centroCustoId })}><SelectTrigger><SelectValue placeholder="Todos os centros" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os centros</SelectItem>{(centrosCusto.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}{item.ativo ? "" : " · Inativo"}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end gap-2"><Button className="flex-1" onClick={pesquisarTitulos}><Search className="mr-1.5 h-3.5 w-3.5" />Pesquisar</Button><Button variant="ghost" onClick={limparFiltrosTitulos}>Limpar</Button></div><div className="sm:col-span-2 lg:col-span-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Atalhos:</span><Button size="sm" variant="outline" onClick={() => aplicarPeriodoRapido("hoje")}>Hoje</Button><Button size="sm" variant="outline" onClick={() => aplicarPeriodoRapido("seteDias")}>Últimos 7 dias</Button><Button size="sm" variant="outline" onClick={() => aplicarPeriodoRapido("mes")}>Este mês</Button><Button size="sm" variant={filtrosFinanceiros.origem === "serragem_terceiros" ? "default" : "outline"} onClick={() => setFiltrosFinanceiros((atual) => ({ ...atual, origem: atual.origem === "serragem_terceiros" ? "todas" : "serragem_terceiros" }))}>Serviços de serragem</Button></div><p className="mt-2 text-xs text-muted-foreground">A lista permanece vazia até que você aplique pelo menos um filtro. {visaoFinanceira === "recebidas" || visaoFinanceira === "pagas" ? "Para históricos, o período considera a data de recebimento ou pagamento." : "Para contas abertas, o período considera o vencimento."}</p></div></div>
          <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-5 py-3"><div><p className="font-semibold text-sm">{tituloLancamentos.label}</p><p className="text-xs text-muted-foreground">{filtrosAplicados ? `${titulosExibidos.length} títulos encontrados` : "Defina um filtro para consultar os lançamentos"}</p></div><div className="flex items-center gap-2">{titulosSelecionados.length > 0 && <Button size="sm" variant="outline" onClick={() => setEdicaoLoteAberta(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar {titulosSelecionados.length} em lote</Button>}{titulosHoje.length > 0 && <Badge className={visaoFinanceira === "pagar" ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-emerald-100 text-emerald-900 hover:bg-emerald-100"}>{titulosHoje.length} {visaoFinanceira === "pagar" ? "vencem" : "recebem"} hoje</Badge>}</div></div>
          {carregando || titulosPesquisados.isFetching ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando financeiro...</div> : !filtrosAplicados ? <EstadoVazio icon={<Search className="h-9 w-9" />} texto="Use os filtros acima para consultar lançamentos financeiros." /> : <><div className="grid gap-3 border-b bg-muted/10 px-5 py-4 sm:grid-cols-2"><ResumoCard label={visaoFinanceira === "pagas" || visaoFinanceira === "recebidas" ? "Total pago" : "Total a pagar"} valor={totaisPesquisa.pagar} icon={<ArrowUpFromLine className="h-5 w-5" />} color="text-rose-700 bg-rose-50" descricao="No resultado pesquisado" /><ResumoCard label={visaoFinanceira === "pagas" || visaoFinanceira === "recebidas" ? "Total recebido" : "Total a receber"} valor={totaisPesquisa.receber} icon={<ArrowDownToLine className="h-5 w-5" />} color="text-emerald-700 bg-emerald-50" descricao="No resultado pesquisado" /></div><TabelaTitulosFinanceiros titulos={titulosExibidos} historico={visaoFinanceira === "pagas" || visaoFinanceira === "recebidas"} tipo={visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? "pagar" : "receber"} selecionados={titulosSelecionados} onSelecionar={(id) => setTitulosSelecionados((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id])} onBaixas={setTituloBaixas} onEditar={abrirEdicaoAgendamento} onBaixar={abrirBaixa} onExcluir={setTituloParaExcluir} /></>}
        </section>
        </>
      )}

      <Dialog open={Boolean(tituloOperacionalSelecionado)} onOpenChange={(aberto) => { if (!aberto) setTituloOperacionalSelecionado(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {tituloOperacionalSelecionado && <><DialogHeader><DialogTitle>Detalhe da conta {tituloOperacionalSelecionado.tipo === "pagar" ? "a pagar" : "a receber"}</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border bg-muted/30 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-semibold">{tituloOperacionalSelecionado.descricao}</p><p className="mt-1 text-sm text-muted-foreground">{tituloOperacionalSelecionado.contraparte} · {rotuloOrigemOperacional[tituloOperacionalSelecionado.origem] ?? tituloOperacionalSelecionado.origem}</p></div><Badge variant="outline" className={tituloOperacionalSelecionado.prioridade === "vencido" ? "w-fit border-rose-200 bg-rose-50 text-rose-700" : tituloOperacionalSelecionado.prioridade === "vence_hoje" ? "w-fit border-amber-200 bg-amber-50 text-amber-800" : "w-fit border-slate-200 bg-slate-50 text-slate-700"}>{rotuloPrioridadeOperacional[tituloOperacionalSelecionado.prioridade]}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">{formatarDataFinanceira(tituloOperacionalSelecionado.dataVencimento)}</p></div><div><p className="text-xs text-muted-foreground">Competência</p><p className="font-medium">{tituloOperacionalSelecionado.competencia ? formatarDataFinanceira(tituloOperacionalSelecionado.competencia) : "Não informada"}</p></div><div><p className="text-xs text-muted-foreground">Parcela</p><p className="font-medium">{tituloOperacionalSelecionado.numeroParcela ? `${tituloOperacionalSelecionado.numeroParcela}/${tituloOperacionalSelecionado.totalParcelas}` : "Única"}</p></div></div></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Valor devido</p><p className="mt-1 font-semibold">{formatCurrency(tituloOperacionalSelecionado.valorDevido)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Já {tituloOperacionalSelecionado.tipo === "pagar" ? "pago" : "recebido"}</p><p className="mt-1 font-semibold">{formatCurrency(tituloOperacionalSelecionado.valorBaixado)}</p></div><div className="rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Saldo em aberto</p><p className="mt-1 font-semibold text-primary">{formatCurrency(tituloOperacionalSelecionado.saldoAberto)}</p></div></div><div className="rounded-lg border"><div className="border-b px-3 py-2"><p className="text-sm font-medium">Baixas e conciliação</p></div>{tituloOperacionalSelecionado.baixas.length ? <div className="divide-y">{tituloOperacionalSelecionado.baixas.map((baixa) => <div key={baixa.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{formatCurrency(Number(baixa.valor))} · {baixa.contaNome}</p><p className="text-xs text-muted-foreground">{formatarDataFinanceira(baixa.dataBaixa)}{baixa.estornada ? " · Estornada" : baixa.conciliada ? " · Conciliada" : " · Pendente de conciliação"}</p></div>{baixa.conciliada && <a className="text-sm font-medium text-primary underline underline-offset-4" href="/conciliacao-bancaria">Ver conciliação</a>}</div>)}</div> : <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhuma baixa registrada para este título.</p>}</div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => { const data = dataChaveFinanceira(tituloOperacionalSelecionado.dataVencimento); setPeriodoFluxo({ dataInicio: data, dataFim: data }); setTituloOperacionalSelecionado(null); setAba("fluxo"); }}>Ver no Fluxo de caixa</Button>{tituloBaseOperacional && <><Button variant="outline" onClick={() => { setTituloOperacionalSelecionado(null); abrirEdicaoAgendamento(tituloBaseOperacional); }}>Editar</Button>{tituloOperacionalSelecionado.baixas.some((baixa) => !baixa.estornada) && <Button variant="outline" onClick={() => { setTituloOperacionalSelecionado(null); setTituloBaixas(tituloBaseOperacional); }}>Baixas</Button>}<Button onClick={() => { setTituloOperacionalSelecionado(null); abrirBaixa(tituloBaseOperacional); }}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{tituloOperacionalSelecionado.tipo === "pagar" ? "Pagar" : "Receber"}</Button></>}</div></div></>}
        </DialogContent>
      </Dialog>

      {aba === "fluxo" && (
        <>
        <FluxoGerencialPainel
          fluxo={fluxoGerencial.data}
          carregando={fluxoGerencial.isLoading}
          atualizando={fluxoGerencial.isFetching}
          periodo={periodoFluxo}
          contaSelecionada={contaFluxoGerencial}
          contas={contas.data ?? []}
          onPeriodo={setPeriodoFluxo}
          onConta={setContaFluxoGerencial}
          onAtualizar={() => fluxoGerencial.refetch()}
        />
        <section className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b bg-muted/20 px-5 py-4 md:flex-row md:items-end md:justify-between">
            <div><h2 className="font-semibold">Relatório de fluxo de caixa</h2><p className="mt-0.5 text-xs text-muted-foreground">Movimentações efetivadas por baixas, organizadas pelo período selecionado.</p><p className="mt-1 text-xs text-muted-foreground">O saldo de abertura incorpora o saldo inicial e as movimentações efetivadas antes da data inicial.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end"><div className="space-y-1"><Label htmlFor="fluxo-inicio" className="text-xs">Data inicial</Label><Input id="fluxo-inicio" aria-label="Data inicial do fluxo de caixa" type="date" value={periodoFluxo.dataInicio} onChange={(e) => setPeriodoFluxo({ ...periodoFluxo, dataInicio: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="fluxo-fim" className="text-xs">Data final</Label><Input id="fluxo-fim" aria-label="Data final do fluxo de caixa" type="date" value={periodoFluxo.dataFim} onChange={(e) => setPeriodoFluxo({ ...periodoFluxo, dataFim: e.target.value })} /></div><Button variant="outline" onClick={() => fluxoCaixa.refetch()} disabled={fluxoCaixa.isFetching}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${fluxoCaixa.isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div>
          </div>
          {fluxoCaixa.isLoading ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Calculando fluxo de caixa...</div> : fluxoCaixa.data ? <div className="space-y-6 p-5"><section className="overflow-hidden rounded-lg border border-primary/20 bg-primary/[0.03]"><div className="flex flex-col gap-3 border-b border-primary/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold">Previsão semanal de caixa</h3><p className="text-xs text-muted-foreground">Projeção dos próximos 8 períodos baseada apenas nos títulos ainda em aberto.</p></div><Badge variant="outline" className="w-fit border-primary/30 text-primary">Títulos projetados</Badge></div>{previsaoSemanal.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Calculando previsão semanal...</div> : previsaoSemanal.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-primary/5"><TableHead>Semana</TableHead><TableHead className="text-right text-emerald-700">Entradas</TableHead><TableHead className="text-right text-rose-700">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead><TableHead className="text-right">Saldo projetado</TableHead></TableRow></TableHeader><TableBody>{previsaoSemanal.data.map((semana: any) => <TableRow key={semana.inicioSemana} className={semana.saldoProjetado < 0 ? "bg-rose-50/60" : ""}><TableCell><p className="font-medium text-sm">{formatarDataFinanceira(semana.inicioSemana)} – {formatarDataFinanceira(semana.fimSemana)}</p><p className="text-xs text-muted-foreground">{semana.quantidadeTitulos} título(s) previsto(s)</p></TableCell><TableCell className="text-right font-medium text-emerald-700">{formatCurrency(semana.entradas)}</TableCell><TableCell className="text-right font-medium text-rose-700">{formatCurrency(semana.saidas)}</TableCell><TableCell className={`text-right font-semibold ${semana.saldoLiquido >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{semana.saldoLiquido >= 0 ? "+" : ""}{formatCurrency(semana.saldoLiquido)}</TableCell><TableCell className={`text-right font-bold ${semana.saldoProjetado >= 0 ? "text-primary" : "text-rose-700"}`}>{formatCurrency(semana.saldoProjetado)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="p-8 text-center text-sm text-muted-foreground">Não há títulos em aberto para projetar nas próximas semanas.</p>}</section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><ResumoCard label="Saldo de abertura" valor={fluxoCaixa.data.saldoAbertura} icon={<Landmark className="h-5 w-5" />} color="text-slate-700 bg-slate-100" descricao="Antes do período, com histórico anterior" /><ResumoCard label="Entradas" valor={fluxoCaixa.data.entradas} icon={<ArrowDownToLine className="h-5 w-5" />} color="text-emerald-700 bg-emerald-50" descricao="Recebimentos efetivados" /><ResumoCard label="Saídas" valor={fluxoCaixa.data.saidas} icon={<ArrowUpFromLine className="h-5 w-5" />} color="text-rose-700 bg-rose-50" descricao="Pagamentos efetivados" /><ResumoCard label="Resultado líquido" valor={fluxoCaixa.data.saldoLiquido} icon={<CircleDollarSign className="h-5 w-5" />} color={fluxoCaixa.data.saldoLiquido >= 0 ? "text-primary bg-primary/10" : "text-rose-700 bg-rose-50"} descricao="Entradas menos saídas" /><ResumoCard label="Saldo final" valor={fluxoCaixa.data.saldoFinal} icon={<WalletCards className="h-5 w-5" />} color="text-primary bg-primary/10" descricao="Após as movimentações" /></div><div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]"><div className="rounded-lg border bg-muted/10 p-4"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Evolução diária</h3><p className="text-xs text-muted-foreground">Entradas e saídas efetivadas a cada dia.</p></div><Badge variant="outline">{fluxoCaixa.data.quantidadeMovimentos} movimentações</Badge></div><div className="space-y-3">{fluxoCaixa.data.dias.map((dia: any) => <div key={dia.data} className="grid grid-cols-[74px_1fr_96px] items-center gap-3 text-xs"><span className="text-muted-foreground">{formatarDataFinanceira(dia.data)}</span><div className="space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(Number(dia.entradas) / maiorFluxoDiario) * 100}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-rose-500" style={{ width: `${(Number(dia.saidas) / maiorFluxoDiario) * 100}%` }} /></div></div><span className={`text-right font-medium ${dia.saldoLiquido >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{dia.saldoLiquido >= 0 ? "+" : ""}{formatCurrency(dia.saldoLiquido)}</span></div>)}</div></div><div className="overflow-hidden rounded-lg border"><div className="border-b bg-muted/30 px-4 py-3"><h3 className="text-sm font-semibold">Movimentações do período</h3></div>{fluxoCaixa.data.movimentos.length ? <Table><TableHeader><TableRow className="bg-muted/20"><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{fluxoCaixa.data.movimentos.map((movimento: any) => <TableRow key={movimento.id}><TableCell className="whitespace-nowrap text-xs">{formatarDataFinanceira(movimento.dataBaixa)}</TableCell><TableCell><p className="text-sm font-medium">{movimento.descricao}</p><p className="text-xs text-muted-foreground">{movimento.formaPagamento}</p>{movimento.origem === "nota_diesel" && <p className="mt-1 text-xs font-medium text-sky-700">Compra para estoque do tanque — saída de caixa; o custo é apropriado nos abastecimentos.</p>}</TableCell><TableCell className="text-sm text-muted-foreground">{movimento.contaNome ?? "—"}</TableCell><TableCell className={`text-right font-semibold ${movimento.tipo === "receber" ? "text-emerald-700" : "text-rose-700"}`}>{movimento.tipo === "receber" ? "+" : "−"}{formatCurrency(movimento.valor)}</TableCell></TableRow>)}</TableBody></Table> : <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma baixa efetivada no período selecionado.</p>}</div></div></div> : null}
        </section>
        </>
      )}

      {aba === "recorrencias" && (
        <section className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20"><div><h2 className="font-semibold">Lançamentos recorrentes</h2><p className="text-xs text-muted-foreground mt-0.5">O sistema gera os próximos títulos diariamente, respeitando a regra configurada.</p></div><Button size="sm" onClick={() => setRecorrenciaAberta(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Nova recorrência</Button></div>
          {carregando ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando recorrências...</div> : recorrencias.data?.length ? <Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Frequência</TableHead><TableHead>Próximo vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{recorrencias.data.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.descricao}</TableCell><TableCell className={item.tipo === "receber" ? "text-emerald-700" : "text-rose-700"}>{item.tipo === "receber" ? "Receber" : "Pagar"}</TableCell><TableCell className="capitalize">{item.frequencia}</TableCell><TableCell>{formatarDataFinanceira(item.proximoVencimento)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(item.valor)}</TableCell><TableCell><Badge variant="outline" className={item.ativa ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}>{item.ativa ? "Ativa" : "Pausada"}</Badge></TableCell></TableRow>)}</TableBody></Table> : <EstadoVazio icon={<RefreshCw className="h-8 w-8" />} texto="Nenhuma recorrência cadastrada" acao={() => setRecorrenciaAberta(true)} labelAcao="Criar recorrência" />}
        </section>
      )}

      {aba === "fornecedores" && <section className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 className="h-5 w-5" /></div><div><h2 className="font-semibold">Fornecedores</h2><p className="mt-0.5 text-xs text-muted-foreground">Cadastre, importe e mantenha atualizados os fornecedores utilizados em contas a pagar.</p></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setImportacaoFornecedoresAberta(true)}><Upload className="mr-1.5 h-3.5 w-3.5" />Importar planilha</Button><Button size="sm" onClick={() => { setFornecedorEditando(null); setFornecedor({ nome: "", contacto: "", email: "", documento: "", endereco: "", observacoes: "" }); setFornecedorAberto(true); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo fornecedor</Button></div></div>{fornecedores.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Fornecedor</TableHead><TableHead>Contato</TableHead><TableHead>E-mail</TableHead><TableHead>Documento</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{fornecedores.data.map((item: any) => <TableRow key={item.id}><TableCell className="font-medium">{item.nome}</TableCell><TableCell>{item.contacto || "—"}</TableCell><TableCell>{item.email || "—"}</TableCell><TableCell>{item.documento || "—"}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => abrirEdicaoFornecedor(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button></TableCell></TableRow>)}</TableBody></Table></div> : <EstadoVazio icon={<Building2 className="h-8 w-8" />} texto="Nenhum fornecedor cadastrado" acao={() => { setFornecedorEditando(null); setFornecedorAberto(true); }} labelAcao="Novo fornecedor" />}</section>}
      {aba === "categorias" && <CadastroTabela titulo="Categorias financeiras" descricao="Classifique receitas e despesas para os relatórios financeiros." icone={<Tags className="h-5 w-5" />} botao="Nova categoria" aoCriar={() => setCategoriaAberta(true)} colunas={["Categoria", "Aplicação"]} linhas={(categorias.data ?? []).map((item: any) => [item.nome, item.tipo === "ambos" ? "Receita e despesa" : item.tipo === "receita" ? "Receita" : "Despesa"])} vazio="Nenhuma categoria cadastrada" />}
      {aba === "contas" && <section className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Landmark className="h-5 w-5" /></div><div><h2 className="font-semibold">Contas financeiras</h2><p className="mt-0.5 text-xs text-muted-foreground">Defina onde os valores entram e saem: caixa, bancos e carteiras.</p></div></div><Button size="sm" onClick={abrirNovaConta}><Plus className="mr-1.5 h-3.5 w-3.5" />Nova conta</Button></div>{contas.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Conta</TableHead><TableHead>Tipo</TableHead><TableHead>Dados bancários</TableHead><TableHead className="text-right">Saldo inicial</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{contas.data.map((item: any) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.nome}</p>{item.dataInicio && <p className="mt-0.5 text-xs text-muted-foreground">Desde {formatarDataFinanceira(item.dataInicio)}</p>}</TableCell><TableCell className="capitalize">{item.tipo.replace("_", " ")}</TableCell><TableCell className="text-sm text-muted-foreground">{item.banco || item.agencia || item.numeroConta ? <><p>{item.banco || "Banco não informado"}</p><p className="text-xs">{[item.agencia && `Ag. ${item.agencia}`, item.numeroConta && `C/C ${item.numeroConta}`].filter(Boolean).join(" · ")}</p></> : "—"}</TableCell><TableCell className="text-right">{formatCurrency(item.saldoInicial)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => abrirEdicaoConta(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setContaParaExcluir(item)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div></TableCell></TableRow>)}</TableBody></Table></div> : <EstadoVazio icon={<Landmark className="h-8 w-8" />} texto="Nenhuma conta financeira cadastrada" acao={abrirNovaConta} labelAcao="Nova conta" />}</section>}

      <Dialog open={importacaoAberta} onOpenChange={(aberto) => { setImportacaoAberta(aberto); if (!aberto) { setArquivoImportacao(null); setErrosImportacao([]); } }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Importar lançamentos financeiros</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="font-medium">Importação segura por CSV</p><p className="mt-1 text-sky-900">Use o modelo disponibilizado e preencha as datas como DD/MM/AAAA. O sistema valida todo o arquivo antes de gravar: se houver alguma linha inválida ou referência duplicada, nenhum lançamento será criado.</p></div><div className="space-y-2"><Label htmlFor="arquivo-importacao">Arquivo CSV *</Label><Input id="arquivo-importacao" aria-label="Arquivo CSV para importação" type="file" accept=".csv,text/csv" onChange={(evento) => { setArquivoImportacao(evento.target.files?.[0] ?? null); setErrosImportacao([]); }} /><p className="text-xs text-muted-foreground">Limite de 1.000 lançamentos e 1 MB por arquivo.</p></div>{arquivoImportacao && <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="truncate">{arquivoImportacao.name}</span></div>}{errosImportacao.length > 0 && <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="font-medium">O arquivo não foi importado:</p>{errosImportacao.map((erro, indice) => <p key={`${erro}-${indice}`} className="text-xs">• {erro}</p>)}</div>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={baixarModeloImportacao} disabled={modeloImportacao.isFetching}><Download className="mr-1.5 h-4 w-4" />Baixar modelo</Button><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setImportacaoAberta(false)} disabled={importarLancamentos.isPending}>Cancelar</Button><Button onClick={importarArquivo} disabled={!arquivoImportacao || importarLancamentos.isPending}>{importarLancamentos.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar arquivo</Button></div></div></div></DialogContent></Dialog>
      <Dialog open={importacaoFornecedoresAberta} onOpenChange={(aberto) => { setImportacaoFornecedoresAberta(aberto); if (!aberto) limparImportacaoFornecedores(); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Importar fornecedores por planilha</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="font-medium">Importação segura com pré-visualização</p><p className="mt-1 text-sky-900">Use o modelo CSV. Todos os dados e duplicidades são validados antes da confirmação.</p></div><div className="space-y-2"><Label htmlFor="arquivo-fornecedores">Arquivo CSV *</Label><Input id="arquivo-fornecedores" aria-label="Arquivo CSV de fornecedores" type="file" accept=".csv,text/csv" onChange={(evento) => selecionarArquivoFornecedores(evento.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">Limite de 1.000 fornecedores e 1 MB por arquivo.</p></div>{arquivoFornecedores && <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="truncate">{arquivoFornecedores.name}</span>{prepararImportacaoFornecedores.isPending && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}</div>}{preparoFornecedores?.erros.length ? <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="font-medium">Corrija a planilha antes de importar:</p>{preparoFornecedores.erros.map((erro, indice) => <p key={`${erro}-${indice}`} className="text-xs">• {erro}</p>)}</div> : null}{preparoFornecedores && !preparoFornecedores.erros.length ? <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><p className="text-sm font-medium text-emerald-900">{preparoFornecedores.linhas.length} fornecedor(es) prontos para importar</p><div className="mt-2 max-h-40 overflow-y-auto rounded border bg-background"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Contacto</TableHead><TableHead>E-mail</TableHead><TableHead>Documento</TableHead></TableRow></TableHeader><TableBody>{preparoFornecedores.linhas.slice(0, 20).map((linha) => <TableRow key={linha.numeroLinha}><TableCell className="font-medium">{linha.nome}</TableCell><TableCell>{linha.contacto || "—"}</TableCell><TableCell>{linha.email || "—"}</TableCell><TableCell>{linha.documento || "—"}</TableCell></TableRow>)}</TableBody></Table></div>{preparoFornecedores.linhas.length > 20 && <p className="mt-2 text-xs text-muted-foreground">A pré-visualização mostra os primeiros 20 fornecedores.</p>}</div> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={baixarModeloFornecedores} disabled={modeloFornecedores.isFetching}><Download className="mr-1.5 h-4 w-4" />Baixar modelo</Button><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setImportacaoFornecedoresAberta(false)} disabled={importarFornecedores.isPending}>Cancelar</Button><Button onClick={confirmarImportacaoFornecedores} disabled={!preparoFornecedores?.linhas.length || Boolean(preparoFornecedores.erros.length) || importarFornecedores.isPending || prepararImportacaoFornecedores.isPending}>{importarFornecedores.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar importação</Button></div></div></div></DialogContent></Dialog>

      <Dialog open={Boolean(tituloParaExcluir)} onOpenChange={(aberto) => !aberto && setTituloParaExcluir(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Excluir lançamento financeiro</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">{tituloParaExcluir?.descricao}</p><p className="mt-1">O lançamento e suas baixas serão removidos somente se não houver conciliação bancária vinculada.</p></div><p className="text-sm text-muted-foreground">Se o lançamento estiver conciliado, desconcilie o movimento bancário correspondente antes de continuar.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTituloParaExcluir(null)} disabled={excluirTitulo.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarExclusaoTitulo} disabled={excluirTitulo.isPending}>{excluirTitulo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar exclusão</Button></div></div></DialogContent></Dialog>

      <Dialog open={lancamentoAberto} onOpenChange={setLancamentoAberto}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Novo lançamento não programado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Use este lançamento para entradas ou saídas excepcionais, sem orçamento ou recorrência vinculados.</p>
            <div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={lancamento.tipo} onValueChange={(valor) => setLancamento({ ...lancamento, tipo: valor as "receber" | "pagar" })} opcoes={[["receber", "Conta a receber"], ["pagar", "Conta a pagar"]]} /><div className="space-y-2"><Label>Categoria *</Label><Select value={lancamento.categoriaId} onCreate={() => abrirCriacaoContextual("categoria", "lancamento")} createLabel="Criar nova categoria" onValueChange={(valor) => setLancamento({ ...lancamento, categoriaId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar categoria" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (lancamento.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Centro de custo *</Label><Select value={lancamento.centroCustoId} onValueChange={(valor) => setLancamento({ ...lancamento, centroCustoId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione o centro responsável" /></SelectTrigger><SelectContent>{(centrosCusto.data ?? []).filter((item: any) => item.ativo).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome} · {item.tipo === "industrial" ? "Industrial" : item.tipo === "comercial_administrativo" ? "Comercial/Administrativo" : "Não apropriável"}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">A classificação organiza o lançamento e determina a elegibilidade na Rentabilidade.</p></div>
            <div className="space-y-2"><Label>Descrição *</Label><Input value={lancamento.descricao} onChange={(e) => setLancamento({ ...lancamento, descricao: e.target.value })} placeholder="Ex.: Frete emergencial" /></div>
            <div className="grid grid-cols-3 gap-3"><Campo label="Valor (R$) *" value={lancamento.valorOriginal} onChange={(valor) => setLancamento({ ...lancamento, valorOriginal: valor })} /><Campo label="Data de emissão" type="date" value={lancamento.dataEmissao} onChange={(valor) => setLancamento({ ...lancamento, dataEmissao: valor })} /><Campo label="Vencimento" type="date" value={lancamento.dataVencimento} onChange={(valor) => setLancamento({ ...lancamento, dataVencimento: valor })} /></div>
            <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Parcelar lançamento</p><p className="mt-0.5 text-xs text-muted-foreground">Cada parcela será criada como um título independente.</p></div><input type="checkbox" checked={lancamento.parcelar} onChange={(e) => setLancamento({ ...lancamento, parcelar: e.target.checked })} className="h-4 w-4 accent-primary" aria-label="Parcelar lançamento" /></div>{lancamento.parcelar && <div className="mt-3 max-w-[180px]"><Campo label="Quantidade de parcelas" type="number" value={lancamento.quantidadeParcelas} onChange={(valor) => setLancamento({ ...lancamento, quantidadeParcelas: valor })} /></div>}</div>
            <div className="grid grid-cols-2 gap-3">{lancamento.tipo === "receber" ? <div className="space-y-2"><Label>Cliente (opcional)</Label><Select value={lancamento.clienteId || "nenhum"} onCreate={() => abrirCriacaoContextual("cliente", "lancamento")} createLabel="Criar novo cliente" onValueChange={(valor) => setLancamento({ ...lancamento, clienteId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar cliente" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem cliente vinculado</SelectItem>{(clientes.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-2"><Label>Fornecedor (opcional)</Label><Select value={lancamento.fornecedorId || "nenhum"} onCreate={() => abrirCriacaoContextual("fornecedor", "lancamento")} createLabel="Criar novo fornecedor" onValueChange={(valor) => setLancamento({ ...lancamento, fornecedorId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar fornecedor" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem fornecedor vinculado</SelectItem>{(fornecedores.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}<Campo label="Contraparte livre" value={lancamento.contraparteNome} onChange={(valor) => setLancamento({ ...lancamento, contraparteNome: valor })} /></div>
            <div className="grid grid-cols-2 gap-3"><Campo label="Desconto (R$)" value={lancamento.desconto} onChange={(valor) => setLancamento({ ...lancamento, desconto: valor })} /><Campo label="Juros (R$)" value={lancamento.juros} onChange={(valor) => setLancamento({ ...lancamento, juros: valor })} /></div>
            <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3">
              <div><p className="text-sm font-medium text-amber-950">Documentos do lançamento</p><p className="mt-0.5 text-xs text-amber-900">Anexe nota fiscal, boleto ou imagem. PDF, JPG, PNG e WEBP; até 8 MB por arquivo.</p></div>
              <Input aria-label="Anexar documentos do lançamento" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(evento) => { selecionarAnexosLancamento(evento.target.files); evento.currentTarget.value = ""; }} />
              {anexosLancamento.length > 0 && <div className="space-y-1.5">{anexosLancamento.map((arquivo, indice) => <div key={`${arquivo.name}-${indice}`} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-xs"><Paperclip className="h-3.5 w-3.5 text-primary" /><span className="min-w-0 flex-1 truncate">{arquivo.name}</span><span className="text-muted-foreground">{(arquivo.size / 1024 / 1024).toFixed(1)} MB</span><Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`Remover ${arquivo.name}`} onClick={() => setAnexosLancamento((atuais) => atuais.filter((_, posicao) => posicao !== indice))}><X className="h-3.5 w-3.5" /></Button></div>)}</div>}
              {lancamento.tipo === "pagar" && <div className="space-y-2 border-t border-amber-200 pt-3"><div className="flex items-center justify-between gap-2"><Label htmlFor="codigo-boleto">Código de barras ou linha digitável</Label><Button type="button" size="sm" variant="outline" onClick={() => void detectarCodigoDeImagem()}><ScanLine className="mr-1.5 h-3.5 w-3.5" />Ler imagem</Button></div><Input id="codigo-boleto" value={codigoBoletoLancamento} onChange={(evento) => setCodigoBoletoLancamento(evento.target.value.replace(/\D/g, ""))} placeholder="Cole ou confira os dígitos do boleto" inputMode="numeric" /><p className="text-xs text-muted-foreground">A leitura automática é assistida: confirme os dígitos identificados antes de criar o lançamento.</p></div>}
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={lancamento.observacoes} onChange={(e) => setLancamento({ ...lancamento, observacoes: e.target.value })} /></div>
            <Button className="w-full" onClick={salvarLancamento} disabled={criarLancamento.isPending || criarLancamentoParcelado.isPending || enviarAnexoFinanceiro.isPending || atualizarBoletoFinanceiro.isPending}>{(criarLancamento.isPending || criarLancamentoParcelado.isPending || enviarAnexoFinanceiro.isPending || atualizarBoletoFinanceiro.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{lancamento.parcelar ? "Criar parcelas" : "Criar lançamento"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={baixaAberta} onOpenChange={setBaixaAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar baixa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloSelecionado?.descricao}</p><p className="text-muted-foreground mt-1">Saldo em aberto: <strong className="text-foreground">{formatCurrency(tituloSelecionado ? saldoTitulo(tituloSelecionado) : 0)}</strong></p></div>
            <div className="space-y-2"><Label>Conta financeira *</Label><Select value={baixa.contaFinanceiraId} onCreate={() => abrirCriacaoContextual("conta", "baixa")} createLabel="Criar nova conta" onValueChange={(valor) => { const contaSelecionada = (contas.data ?? []).find((item: any) => String(item.id) === valor); setBaixa({ ...baixa, contaFinanceiraId: valor, formaPagamento: contaSelecionada?.tipo === "caixa_cheque" ? "cheque" : baixa.formaPagamento === "cheque" ? "pix" : baixa.formaPagamento }); setChequesSelecionados([]); }}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar conta" /></SelectTrigger><SelectContent>{(contas.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}{item.tipo === "caixa_cheque" ? " · Caixa Cheque" : ""}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><Campo label="Valor (R$) *" value={baixa.valor} onChange={(valor) => setBaixa({ ...baixa, valor })} /><Campo label="Data da baixa" type="date" value={baixa.dataBaixa} onChange={(valor) => setBaixa({ ...baixa, dataBaixa: valor })} /></div>
            <CampoSelect label="Forma de pagamento" value={baixa.formaPagamento} onValueChange={(valor) => setBaixa({ ...baixa, formaPagamento: valor })} opcoes={caixaChequeSelecionado ? [["cheque", "Cheque"]] : [["pix", "PIX"], ["dinheiro", "Dinheiro"], ["cheque", "Cheque"], ["transferencia", "Transferência"], ["boleto", "Boleto"], ["cartao_credito", "Cartão de crédito"], ["cartao_debito", "Cartão de débito"], ["outro", "Outro"]]} />
            {caixaChequeSelecionado && tituloSelecionado?.tipo === "receber" && <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-950">Cheques recebidos</p><p className="mt-0.5 text-xs text-emerald-800">A soma dos cheques precisa coincidir com a baixa. Cada item fica disponível no Caixa Cheque.</p></div><Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setChequesRecebidos((atuais) => [...atuais, { referencia: "", valor: "", clienteId: tituloSelecionado?.clienteId ? String(tituloSelecionado.clienteId) : "", dataCompensacao: "" }])}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button></div><div className="space-y-2">{chequesRecebidos.map((cheque, indice) => <div key={indice} className="grid grid-cols-1 gap-2 rounded-md border border-emerald-200 bg-background p-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_0.75fr_1fr_1fr_auto]"><Input aria-label={`Referência do cheque ${indice + 1}`} value={cheque.referencia} placeholder="Referência" onChange={(evento) => setChequesRecebidos((atuais) => atuais.map((item, posicao) => posicao === indice ? { ...item, referencia: evento.target.value } : item))} /><Input aria-label={`Valor do cheque ${indice + 1}`} value={cheque.valor} placeholder="Valor (R$)" inputMode="decimal" onChange={(evento) => setChequesRecebidos((atuais) => atuais.map((item, posicao) => posicao === indice ? { ...item, valor: evento.target.value } : item))} /><Input aria-label={`Data de compensação do cheque ${indice + 1}`} type="date" value={cheque.dataCompensacao} onChange={(evento) => setChequesRecebidos((atuais) => atuais.map((item, posicao) => posicao === indice ? { ...item, dataCompensacao: evento.target.value } : item))} />{tituloSelecionado?.clienteId ? <div className="flex min-h-9 items-center truncate rounded-md border bg-muted/40 px-2 text-xs font-medium">{tituloSelecionado?.contraparteNome ?? "Cliente do título"}</div> : <SearchableEntitySelect value={cheque.clienteId} onValueChange={(valor) => setChequesRecebidos((atuais) => atuais.map((item, posicao) => posicao === indice ? { ...item, clienteId: valor } : item))} placeholder="Cliente" searchPlaceholder="Buscar cliente..." options={(clientes.data ?? []).map((cliente: any) => ({ value: String(cliente.id), label: cliente.nome, details: cliente.contacto ?? undefined }))} onCreate={() => { setIndiceChequeCliente(indice); abrirCriacaoContextual("cliente", "cheque"); }} createLabel="Criar novo cliente" />}{<Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label={`Remover cheque ${indice + 1}`} disabled={chequesRecebidos.length === 1} onClick={() => setChequesRecebidos((atuais) => atuais.filter((_, posicao) => posicao !== indice))}><X className="h-4 w-4" /></Button>}</div>)}</div><div className="flex items-center justify-between border-t border-emerald-200 pt-2 text-sm"><span className="text-emerald-900">Total informado: <strong>{formatCurrency(totalChequesRecebidos)}</strong></span><span className={Math.abs(totalChequesRecebidos - Number(baixa.valor.replace(",", ".") || 0)) < 0.005 ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{Math.abs(totalChequesRecebidos - Number(baixa.valor.replace(",", ".") || 0)) < 0.005 ? "Valor conferido" : "Ajuste o total dos cheques"}</span></div></div>}
            {caixaChequeSelecionado && tituloSelecionado?.tipo === "pagar" && <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3"><div><p className="text-sm font-semibold text-violet-950">Cheques disponíveis para pagamento</p><p className="mt-0.5 text-xs text-violet-800">Selecione os cheques que sairão do Caixa Cheque. O total deve coincidir com a baixa.</p></div>{chequesDisponiveis.isLoading ? <p className="py-3 text-center text-xs text-muted-foreground">Carregando cheques disponíveis...</p> : chequesDisponiveis.data?.length ? <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-md border bg-background p-1.5">{chequesDisponiveis.data.map((cheque: any) => <label key={cheque.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted/60"><input type="checkbox" aria-label={`Selecionar cheque ${cheque.referencia}`} checked={chequesSelecionados.includes(cheque.id)} onChange={() => setChequesSelecionados((atuais) => atuais.includes(cheque.id) ? atuais.filter((id) => id !== cheque.id) : [...atuais, cheque.id])} /><span className="min-w-0 flex-1 truncate"><strong>{cheque.referencia}</strong><span className="ml-1.5 text-xs text-muted-foreground">· {cheque.clienteNome}</span></span><span className="font-medium">{formatCurrency(cheque.valor)}</span></label>)}</div> : <p className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">Não há cheques disponíveis nesta conta.</p>}<div className="flex items-center justify-between border-t border-violet-200 pt-2 text-sm"><span className="text-violet-900">Total selecionado: <strong>{formatCurrency(totalChequesSelecionados)}</strong></span><span className={Math.abs(totalChequesSelecionados - Number(baixa.valor.replace(",", ".") || 0)) < 0.005 ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{Math.abs(totalChequesSelecionados - Number(baixa.valor.replace(",", ".") || 0)) < 0.005 ? "Valor conferido" : "A seleção deve totalizar a baixa"}</span></div></div>}
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={baixa.observacoes} onChange={(e) => setBaixa({ ...baixa, observacoes: e.target.value})} /></div>
            <Button className="w-full" onClick={salvarBaixa} disabled={registrarBaixa.isPending}>{registrarBaixa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar baixa</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={edicaoLoteAberta} onOpenChange={(aberto) => setEdicaoLoteAberta(aberto)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar lançamentos em lote</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{titulosSelecionados.length} lançamento(s) selecionado(s)</p><p className="mt-1 text-xs text-muted-foreground">Preencha somente os campos que devem mudar. Lançamentos conciliados devem ser desconciliados antes da edição.</p></div>
            <Campo label="Descrição" value={edicaoLote.descricao} onChange={(descricao) => setEdicaoLote({ ...edicaoLote, descricao })} />
            <div className="space-y-2"><Label>Categoria financeira</Label><Select value={edicaoLote.categoriaId} onValueChange={(categoriaId) => setEdicaoLote({ ...edicaoLote, categoriaId })}><SelectTrigger><SelectValue placeholder="Manter categoria atual" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (visaoFinanceira === "pagar" || visaoFinanceira === "pagas" ? "despesa" : "receita")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Centro de Custo</Label><SearchableEntitySelect value={edicaoLote.centroCustoId} onValueChange={(centroCustoId) => setEdicaoLote({ ...edicaoLote, centroCustoId: centroCustoId === "manter" ? "" : centroCustoId })} options={[{ value: "manter", label: "Manter centro atual", details: "Não alterar" }, ...(centrosCusto.data ?? []).filter((item: any) => item.ativo).map((item: any) => ({ value: String(item.id), label: item.nome, details: item.tipo === "industrial" ? "Industrial" : item.tipo === "comercial_administrativo" ? "Comercial/Administrativo" : "Não apropriável" }))]} placeholder="Manter centro atual" searchPlaceholder="Pesquisar Centro de Custo" ariaLabel="Centro de Custo para edição em lote" createLabel="Criar novo Centro de Custo" onCreate={() => abrirCriacaoContextual("centroCusto", "edicaoLote")} /><p className="text-xs text-muted-foreground">Classifica os títulos para organização financeira; não altera a origem física dos custos.</p>{titulosSelecionados.length > 0 && <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /><p>Classificar romaneios de carga de toras como <strong>Matéria-prima</strong> não duplica o custo na Rentabilidade da Madeira. A análise apropria o custo pela cadeia física tora → produção e exclui os títulos de romaneio para evitar dupla contagem.</p></div>}</div>
            <Campo label="Novo vencimento" type="date" value={edicaoLote.dataVencimento} onChange={(dataVencimento) => setEdicaoLote({ ...edicaoLote, dataVencimento })} />
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={3} value={edicaoLote.observacoes} onChange={(evento) => setEdicaoLote({ ...edicaoLote, observacoes: evento.target.value })} /></div>
            <Button className="w-full" onClick={salvarEdicaoEmLote} disabled={atualizarTitulosEmLote.isPending}>{atualizarTitulosEmLote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações em lote</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tituloParaEditar)} onOpenChange={(aberto) => !aberto && setTituloParaEditar(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Corrija qualquer informação do lançamento.</p><p className="mt-1 text-muted-foreground">Itens conciliados com o banco devem ser desconciliados antes de salvar ou excluir.</p>{tituloParaEditar?.origem === "romaneio_carga" && <p className="mt-2 text-xs text-primary">Alterações de vencimento também atualizam o romaneio de carga vinculado.</p>}</div>
            <CampoSelect label="Natureza" value={lancamentoEditado.tipo} onValueChange={(tipo) => setLancamentoEditado({ ...lancamentoEditado, tipo: tipo as "pagar" | "receber", clienteId: "", fornecedorId: "" })} opcoes={[["pagar", "Conta a pagar"], ["receber", "Conta a receber"]]} />
            <Campo label="Descrição *" value={lancamentoEditado.descricao} onChange={(descricao) => setLancamentoEditado({ ...lancamentoEditado, descricao })} />
            <div className="space-y-2"><Label>Centro de custo *</Label><Select value={lancamentoEditado.centroCustoId} onValueChange={(centroCustoId) => setLancamentoEditado({ ...lancamentoEditado, centroCustoId })}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione o centro responsável" /></SelectTrigger><SelectContent>{(centrosCusto.data ?? []).filter((item: any) => item.ativo || String(item.id) === lancamentoEditado.centroCustoId).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}{item.ativo ? "" : " · Inativo"} · {item.tipo === "industrial" ? "Industrial" : item.tipo === "comercial_administrativo" ? "Comercial/Administrativo" : "Não apropriável"}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Títulos históricos sem centro permanecem identificados até uma classificação explícita.</p></div>
            <div className="space-y-2"><Label>Categoria financeira *</Label><Select value={lancamentoEditado.categoriaId} onCreate={() => abrirCriacaoContextual("categoria", "lancamento")} createLabel="Criar nova categoria" onValueChange={(categoriaId) => setLancamentoEditado({ ...lancamentoEditado, categoriaId })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar categoria" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (lancamentoEditado.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Campo label="Valor original (R$) *" value={lancamentoEditado.valorOriginal} onChange={(valorOriginal) => setLancamentoEditado({ ...lancamentoEditado, valorOriginal })} /><Campo label="Data de emissão *" type="date" value={lancamentoEditado.dataEmissao} onChange={(dataEmissao) => setLancamentoEditado({ ...lancamentoEditado, dataEmissao })} /><Campo label="Vencimento *" type="date" value={lancamentoEditado.dataVencimento} onChange={(dataVencimento) => setLancamentoEditado({ ...lancamentoEditado, dataVencimento })} /><Campo label="Desconto (R$)" value={lancamentoEditado.desconto} onChange={(desconto) => setLancamentoEditado({ ...lancamentoEditado, desconto })} /><Campo label="Juros (R$)" value={lancamentoEditado.juros} onChange={(juros) => setLancamentoEditado({ ...lancamentoEditado, juros })} /></div>
            <div className="space-y-2"><Label>{lancamentoEditado.tipo === "receber" ? "Cliente" : "Fornecedor"}</Label>{lancamentoEditado.tipo === "receber" ? <SearchableEntitySelect value={lancamentoEditado.clienteId} onValueChange={(clienteId) => setLancamentoEditado({ ...lancamentoEditado, clienteId, contraparteNome: "" })} placeholder="Pesquisar cliente" searchPlaceholder="Buscar por nome ou telefone..." options={(clientes.data ?? []).map((item: any) => ({ value: String(item.id), label: item.nome, details: item.contacto ?? undefined }))} onCreate={() => abrirCriacaoContextual("cliente", "lancamento")} createLabel="Criar novo cliente" /> : <SearchableEntitySelect value={lancamentoEditado.fornecedorId} onValueChange={(fornecedorId) => setLancamentoEditado({ ...lancamentoEditado, fornecedorId, contraparteNome: "" })} placeholder="Pesquisar fornecedor" searchPlaceholder="Buscar fornecedor..." options={(fornecedores.data ?? []).map((item: any) => ({ value: String(item.id), label: item.nome, details: item.contacto ?? undefined }))} onCreate={() => abrirCriacaoContextual("fornecedor", "lancamento")} createLabel="Criar novo fornecedor" />}</div>
            <div className="space-y-2"><Label>Contraparte avulsa</Label><Input value={lancamentoEditado.contraparteNome} onChange={(event) => setLancamentoEditado({ ...lancamentoEditado, contraparteNome: event.target.value })} placeholder="Preencha se não selecionar cliente ou fornecedor" /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={lancamentoEditado.observacoes} onChange={(event) => setLancamentoEditado({ ...lancamentoEditado, observacoes: event.target.value })} /></div>
            {tituloParaEditar?.tipo === "pagar" && (tituloParaEditar?.linhaDigitavelBoleto || tituloParaEditar?.codigoBarrasBoleto) && <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-amber-950">Dados do boleto</p><p className="mt-1 text-xs text-amber-900">{tituloParaEditar?.linhaDigitavelBoleto ? "Linha digitável" : "Código de barras"}</p></div><Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void copiarCodigoBoleto(tituloParaEditar.linhaDigitavelBoleto ?? tituloParaEditar.codigoBarrasBoleto ?? "")}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button></div><code className="mt-2 block break-all rounded bg-background px-2 py-1.5 text-xs text-foreground">{tituloParaEditar?.linhaDigitavelBoleto ?? tituloParaEditar?.codigoBarrasBoleto}</code><p className="mt-2 text-xs text-amber-900">Confira os dígitos com o documento antes de efetuar o pagamento.</p></div>}
            <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-3">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-amber-950">Documentos vinculados</p><p className="mt-0.5 text-xs text-amber-900">Notas fiscais, boletos e imagens do agendamento.</p></div><Label htmlFor="anexar-documentos-edicao" className="cursor-pointer"><span className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent">{enviarAnexoFinanceiro.isPending ? "Enviando..." : "Anexar"}</span></Label></div>
              <Input id="anexar-documentos-edicao" className="sr-only" aria-label="Anexar documentos ao agendamento" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple disabled={enviarAnexoFinanceiro.isPending} onChange={(evento) => { void anexarDocumentosAoTitulo(evento.target.files); evento.currentTarget.value = ""; }} />
              {anexosTituloEditado.isLoading ? <p className="py-2 text-xs text-muted-foreground">Carregando documentos...</p> : anexosTituloEditado.data?.length ? <div className="space-y-1.5">{anexosTituloEditado.data.map((anexo: any) => <div key={anexo.id} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-xs"><Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate font-medium">{anexo.nomeArquivo}</span><span className="shrink-0 text-muted-foreground">{(Number(anexo.tamanhoBytes) / 1024 / 1024).toFixed(1)} MB</span><Button type="button" size="sm" variant="ghost" className="h-7 px-2" aria-label={`Visualizar ${anexo.nomeArquivo}`} onClick={() => setAnexoParaVisualizar({ nomeArquivo: anexo.nomeArquivo, url: anexo.url, mimeType: anexo.mimeType })}><Eye className="h-3.5 w-3.5" /></Button><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" disabled={removerAnexoFinanceiro.isPending} onClick={() => {
                const tituloId = tituloParaEditar?.id;
                if (!tituloId) return;
                removerAnexoFinanceiro.mutate({ id: anexo.id, tituloId }, { onSuccess: () => { toast.success("Documento removido"); void anexosTituloEditado.refetch(); }, onError: (erro) => toast.error(erro.message) });
              }}>Remover</Button></div>)}</div> : <p className="rounded-md border border-dashed bg-background/60 px-3 py-3 text-center text-xs text-muted-foreground">Nenhum documento anexado a este agendamento.</p>}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTituloParaEditar(null)} disabled={atualizarTitulo.isPending}>Cancelar</Button><Button onClick={salvarAgendamento} disabled={atualizarTitulo.isPending}>{atualizarTitulo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {aba === "transferencias" && <section className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-violet-500/10 p-2 text-violet-700"><ArrowLeftRight className="h-5 w-5" /></div><div><h2 className="font-semibold">Transferências internas</h2><p className="mt-0.5 text-xs text-muted-foreground">Movimente valores entre contas sem criar título, receita, despesa ou categoria.</p></div></div>
          <Button size="sm" onClick={abrirNovaTransferencia} disabled={(contas.data ?? []).length < 2}><Plus className="mr-1.5 h-3.5 w-3.5" />Nova transferência</Button>
        </div>
        <div className="flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Cada operação registra uma saída na origem e uma entrada no destino, vinculadas entre si.</p><Select value={contaFiltroTransferencias} onValueChange={setContaFiltroTransferencias}><SelectTrigger className="w-full sm:w-60" aria-label="Filtrar transferências por conta"><SelectValue placeholder="Todas as contas" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as contas</SelectItem>{(contas.data ?? []).map((conta) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select></div>
        {transferencias.isLoading ? <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Carregando transferências...</div> : transferencias.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Data</TableHead><TableHead>Origem</TableHead><TableHead>Destino</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{transferencias.data.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap text-sm">{formatarDataFinanceira(item.dataTransferencia)}</TableCell><TableCell className="font-medium text-sm">{item.contaOrigemNome}</TableCell><TableCell className="font-medium text-sm">{item.contaDestinoNome}</TableCell><TableCell className="max-w-64"><p className="truncate text-sm" title={item.descricao ?? undefined}>{item.descricao ?? "—"}</p>{item.transferenciaOrigemId && <p className="mt-0.5 text-xs text-muted-foreground">Estorno da transferência #{item.transferenciaOrigemId}</p>}</TableCell><TableCell className="text-right font-semibold text-violet-700">{formatCurrency(item.valor)}</TableCell><TableCell><Badge variant="outline" className={item.estado === "estornada" ? "border-slate-200 bg-slate-100 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{item.estado === "estornada" ? "Estornada" : "Efetivada"}</Badge></TableCell><TableCell className="text-right">{item.estado === "efetivada" ? <Button size="sm" variant="ghost" className="text-amber-700 hover:text-amber-800" onClick={() => { setTransferenciaParaEstornar(item.id); setMotivoEstornoTransferencia(""); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Estornar</Button> : "—"}</TableCell></TableRow>)}</TableBody></Table></div> : <EstadoVazio icon={<ArrowLeftRight className="h-8 w-8" />} texto={(contas.data ?? []).length < 2 ? "Cadastre ao menos duas contas para transferir valores" : "Nenhuma transferência registrada"} acao={(contas.data ?? []).length < 2 ? abrirNovaConta : abrirNovaTransferencia} labelAcao={(contas.data ?? []).length < 2 ? "Nova conta" : "Nova transferência"} />}
      </section>}

      <Dialog open={transferenciaAberta} onOpenChange={(aberto) => { setTransferenciaAberta(aberto); if (!aberto) setTransferencia(valorInicialTransferencia()); }}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Nova transferência interna</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">Esta operação registra somente uma movimentação patrimonial entre contas. Não cria contas a pagar, receber, receitas ou despesas.</div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Conta de origem *</Label><Select value={transferencia.contaOrigemId} onValueChange={(valor) => setTransferencia((atual) => ({ ...atual, contaOrigemId: valor }))}><SelectTrigger aria-label="Conta de origem"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(contas.data ?? []).map((conta) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Conta de destino *</Label><Select value={transferencia.contaDestinoId} onValueChange={(valor) => setTransferencia((atual) => ({ ...atual, contaDestinoId: valor }))}><SelectTrigger aria-label="Conta de destino"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(contas.data ?? []).filter((conta) => String(conta.id) !== transferencia.contaOrigemId).map((conta) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="transferencia-valor">Valor *</Label><Input id="transferencia-valor" aria-label="Valor da transferência" inputMode="decimal" placeholder="0,00" value={transferencia.valor} onChange={(evento) => setTransferencia((atual) => ({ ...atual, valor: evento.target.value }))} /></div><div className="space-y-2"><Label htmlFor="transferencia-data">Data *</Label><Input id="transferencia-data" aria-label="Data da transferência" type="date" value={transferencia.dataTransferencia} onChange={(evento) => setTransferencia((atual) => ({ ...atual, dataTransferencia: evento.target.value }))} /></div></div><div className="space-y-2"><Label htmlFor="transferencia-descricao">Descrição</Label><Textarea id="transferencia-descricao" aria-label="Descrição da transferência" value={transferencia.descricao} onChange={(evento) => setTransferencia((atual) => ({ ...atual, descricao: evento.target.value }))} placeholder="Ex.: Depósito do caixa no banco" maxLength={300} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTransferenciaAberta(false)} disabled={criarTransferencia.isPending}>Cancelar</Button><Button onClick={confirmarTransferencia} disabled={criarTransferencia.isPending}>{criarTransferencia.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Confirmar transferência</Button></div></div></DialogContent>
      </Dialog>

      <Dialog open={transferenciaParaEstornar !== null} onOpenChange={(aberto) => { if (!aberto) { setTransferenciaParaEstornar(null); setMotivoEstornoTransferencia(""); } }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Estornar transferência</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">O estorno preserva a operação original e registra uma nova transferência inversa entre as mesmas contas.</div><div className="space-y-2"><Label htmlFor="motivo-estorno-transferencia">Motivo do estorno *</Label><Textarea id="motivo-estorno-transferencia" aria-label="Motivo do estorno da transferência" value={motivoEstornoTransferencia} onChange={(evento) => setMotivoEstornoTransferencia(evento.target.value)} placeholder="Descreva o motivo" maxLength={4000} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTransferenciaParaEstornar(null)} disabled={estornarTransferencia.isPending}>Cancelar</Button><Button variant="destructive" onClick={confirmarEstornoTransferencia} disabled={estornarTransferencia.isPending}>{estornarTransferencia.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Confirmar estorno</Button></div></div></DialogContent>
      </Dialog>

      <Dialog open={Boolean(anexoParaVisualizar)} onOpenChange={(aberto) => !aberto && setAnexoParaVisualizar(null)}>
        <DialogContent className="flex h-[88vh] max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4"><DialogTitle className="truncate pr-8">{anexoParaVisualizar?.nomeArquivo}</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 bg-muted/30 p-3">
            {anexoParaVisualizar?.mimeType.startsWith("image/") ? <img src={anexoParaVisualizar.url} alt={`Pré-visualização de ${anexoParaVisualizar.nomeArquivo}`} className="h-full w-full object-contain" /> : anexoParaVisualizar?.mimeType === "application/pdf" ? <iframe title={`Pré-visualização de ${anexoParaVisualizar.nomeArquivo}`} src={anexoParaVisualizar.url} className="h-full w-full rounded-md border bg-background" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"><Paperclip className="h-8 w-8" /><p>Este tipo de documento não possui pré-visualização incorporada.</p></div>}
          </div>
          {anexoParaVisualizar && <div className="flex justify-end border-t px-5 py-3"><Button asChild variant="outline"><a href={anexoParaVisualizar.url} target="_blank" rel="noreferrer">Abrir em nova aba</a></Button></div>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tituloBaixas)} onOpenChange={(aberto) => !aberto && setTituloBaixas(null)}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Baixas e conciliação</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{tituloBaixas?.descricao}</p><p className="text-muted-foreground mt-1">Concilie após conferir a movimentação; estornos preservam a baixa original para auditoria.</p></div>{baixasTitulo.isLoading ? <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando baixas...</div> : baixasTitulo.data?.length ? <div className="divide-y rounded-lg border">{baixasTitulo.data.map((item: any) => { const estornada = Boolean(item.estornada); return <div key={item.id} className={`flex items-center justify-between gap-3 p-3 ${estornada ? "bg-muted/30" : ""}`}><div><div className="flex items-center gap-2"><p className={`font-medium text-sm ${estornada ? "line-through text-muted-foreground" : ""}`}>{formatCurrency(item.valor)} · {item.formaPagamento}</p>{estornada && <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">Estornada</Badge>}</div><p className="text-xs text-muted-foreground">{item.contaNome ?? "Conta não encontrada"} · {formatarDataFinanceira(item.dataBaixa)}</p><p className="text-xs text-muted-foreground">{estornada ? `Estornada em ${formatarDataFinanceira(item.estornadaEm)}${item.motivoEstorno ? ` · ${item.motivoEstorno}` : ""}` : item.conciliada ? "Conciliada" : "Pendente de conciliação"}</p></div><div className="flex gap-2">{!estornada && <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setBaixaParaEstornar(item); setMotivoEstorno(""); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Estornar</Button>}<Button size="sm" variant={item.conciliada ? "outline" : "default"} disabled={estornada || conciliarBaixa.isPending} onClick={() => conciliarBaixa.mutate({ id: item.id, conciliada: !item.conciliada }, { onSuccess: () => { toast.success(item.conciliada ? "Conciliação desfeita" : "Baixa conciliada"); baixasTitulo.refetch(); } })}>{item.conciliada ? "Desconciliar" : "Conciliar"}</Button></div></div>; })}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma baixa encontrada.</p>}</div></DialogContent></Dialog>

      <Dialog open={Boolean(baixaParaEstornar)} onOpenChange={(aberto) => !aberto && setBaixaParaEstornar(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Estornar baixa financeira</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">{baixaParaEstornar && formatCurrency(baixaParaEstornar.valor)} · {baixaParaEstornar?.formaPagamento}</p><p className="mt-1">O título será recalculado e a baixa permanecerá registrada como estornada para auditoria.</p></div><div className="space-y-2"><Label htmlFor="motivo-estorno">Motivo do estorno *</Label><Textarea id="motivo-estorno" value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)} placeholder="Ex.: pagamento lançado em duplicidade" rows={3} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setBaixaParaEstornar(null)} disabled={estornarBaixa.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarEstorno} disabled={estornarBaixa.isPending}>{estornarBaixa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar estorno</Button></div></div></DialogContent></Dialog>

      <Dialog open={Boolean(contaParaExcluir)} onOpenChange={(aberto) => !aberto && setContaParaExcluir(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Excluir conta financeira</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">{contaParaExcluir?.nome}</p><p className="mt-1">A exclusão só será concluída se a conta não possuir baixas, cheques, extratos, movimentações ou recorrências vinculadas.</p></div><p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. Deseja continuar?</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContaParaExcluir(null)} disabled={excluirConta.isPending}>Voltar</Button><Button variant="destructive" onClick={confirmarExclusaoConta} disabled={excluirConta.isPending}>{excluirConta.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir conta</Button></div></div></DialogContent></Dialog>

      <Dialog open={fornecedorAberto} onOpenChange={(aberto) => { setFornecedorAberto(aberto); if (!aberto) setFornecedorEditando(null); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{fornecedorEditando ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader><div className="space-y-3"><Campo label="Nome *" value={fornecedor.nome} onChange={(valor) => setFornecedor({ ...fornecedor, nome: valor })} /><div className="grid grid-cols-2 gap-3"><Campo label="Contato" value={fornecedor.contacto} onChange={(valor) => setFornecedor({ ...fornecedor, contacto: valor })} /><Campo label="Documento" value={fornecedor.documento} onChange={(valor) => setFornecedor({ ...fornecedor, documento: valor })} /></div><Campo label="E-mail" type="email" value={fornecedor.email} onChange={(valor) => setFornecedor({ ...fornecedor, email: valor })} /><Campo label="Endereço" value={fornecedor.endereco} onChange={(valor) => setFornecedor({ ...fornecedor, endereco: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={fornecedor.observacoes} onChange={(e) => setFornecedor({ ...fornecedor, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarFornecedor} disabled={criarFornecedor.isPending || atualizarFornecedor.isPending}>{(criarFornecedor.isPending || atualizarFornecedor.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{fornecedorEditando ? "Salvar alterações" : "Salvar fornecedor"}</Button></div></DialogContent></Dialog>

      <Dialog open={clienteAberto} onOpenChange={setClienteAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Campo label="Nome *" value={cliente.nome} onChange={(valor) => setCliente({ ...cliente, nome: valor })} />
            <div className="grid grid-cols-2 gap-3"><Campo label="Contato" value={cliente.contacto} onChange={(valor) => setCliente({ ...cliente, contacto: valor })} /><Campo label="Documento" value={cliente.nif} onChange={(valor) => setCliente({ ...cliente, nif: valor })} /></div>
            <Campo label="E-mail" type="email" value={cliente.email} onChange={(valor) => setCliente({ ...cliente, email: valor })} />
            <Campo label="Endereço" value={cliente.morada} onChange={(valor) => setCliente({ ...cliente, morada: valor })} />
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={cliente.observacoes} onChange={(event) => setCliente({ ...cliente, observacoes: event.target.value })} /></div>
            <Button className="w-full" onClick={salvarCliente} disabled={criarCliente.isPending}>{criarCliente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar cliente</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoriaAberta} onOpenChange={setCategoriaAberta}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Nova categoria financeira</DialogTitle></DialogHeader><div className="space-y-4"><Campo label="Nome *" value={categoria.nome} onChange={(valor) => setCategoria({ ...categoria, nome: valor })} /><CampoSelect label="Aplicação" value={categoria.tipo} onValueChange={(valor) => setCategoria({ ...categoria, tipo: valor as "receita" | "despesa" | "ambos" })} opcoes={[["receita", "Somente receita"], ["despesa", "Somente despesa"], ["ambos", "Receita e despesa"]]} /><Button className="w-full" onClick={salvarCategoria} disabled={criarCategoria.isPending}>Salvar categoria</Button></div></DialogContent></Dialog>

      <Dialog open={centroCustoAberto} onOpenChange={(aberto) => { setCentroCustoAberto(aberto); if (!aberto) setContextoCriacao(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Novo Centro de Custo</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">Crie um Centro de Custo e use-o imediatamente nos lançamentos selecionados.</p><Campo label="Nome *" value={centroCusto.nome} onChange={(nome) => setCentroCusto({ ...centroCusto, nome })} /><CampoSelect label="Tipo" value={centroCusto.tipo} onValueChange={(tipo) => setCentroCusto({ ...centroCusto, tipo: tipo as typeof centroCusto.tipo })} opcoes={[["industrial", "Industrial"], ["comercial_administrativo", "Comercial/Administrativo"], ["nao_apropriavel", "Não apropriável"]]} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={centroCusto.observacoes} onChange={(evento) => setCentroCusto({ ...centroCusto, observacoes: evento.target.value })} /></div><Button className="w-full" onClick={salvarCentroCusto} disabled={criarCentroCusto.isPending}>{criarCentroCusto.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar Centro de Custo</Button></div></DialogContent></Dialog>

      <Dialog open={contaAberta} onOpenChange={(aberto) => { if (!aberto) fecharDialogoConta(); else setContaAberta(true); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{contaEditando ? "Editar conta financeira" : "Nova conta financeira"}</DialogTitle></DialogHeader><div className="space-y-4">{contaEditando && <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="font-medium">Edição cadastral segura</p><p className="mt-1 text-xs text-sky-900">Nome, dados bancários e data de início podem ser corrigidos sem alterar saldos, baixas, conciliação ou histórico.</p></div>}<Campo label="Nome *" value={conta.nome} onChange={(valor) => setConta({ ...conta, nome: valor })} />{contaEditando ? <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/45 p-3 text-sm"><div><p className="text-xs text-muted-foreground">Tipo</p><p className="mt-0.5 font-medium capitalize">{conta.tipo.replace("_", " ")}</p></div><div><p className="text-xs text-muted-foreground">Saldo inicial preservado</p><p className="mt-0.5 font-medium">{formatCurrency(conta.saldoInicial)}</p></div></div> : <><CampoSelect label="Tipo" value={conta.tipo} onValueChange={(valor) => setConta({ ...conta, tipo: valor as "caixa" | "caixa_cheque" | "banco" | "carteira" | "outro" })} opcoes={[["caixa", "Caixa"], ["caixa_cheque", "Caixa Cheque"], ["banco", "Banco"], ["carteira", "Carteira"], ["outro", "Outro"]]} /><Campo label="Saldo inicial (R$)" value={conta.saldoInicial} onChange={(valor) => setConta({ ...conta, saldoInicial: valor })} /></>}{conta.tipo === "banco" && <div className="space-y-3 rounded-lg border bg-muted/20 p-3"><div><p className="text-sm font-medium">Dados bancários</p><p className="mt-0.5 text-xs text-muted-foreground">Informações cadastrais da conta; não alteram movimentações já registradas.</p></div><Campo label="Banco" value={conta.banco} onChange={(valor) => setConta({ ...conta, banco: valor })} /><div className="grid grid-cols-2 gap-3"><Campo label="Agência" value={conta.agencia} onChange={(valor) => setConta({ ...conta, agencia: valor })} /><Campo label="Conta corrente" value={conta.numeroConta} onChange={(valor) => setConta({ ...conta, numeroConta: valor })} /></div></div>}<Campo label="Data de início" type="date" value={conta.dataInicio} onChange={(valor) => setConta({ ...conta, dataInicio: valor })} /><div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={conta.observacoes} onChange={(e) => setConta({ ...conta, observacoes: e.target.value })} /></div><Button className="w-full" onClick={salvarConta} disabled={criarConta.isPending || atualizarConta.isPending}>{(criarConta.isPending || atualizarConta.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{contaEditando ? "Salvar alterações" : "Salvar conta"}</Button></div></DialogContent></Dialog>

      <Dialog open={recorrenciaAberta} onOpenChange={setRecorrenciaAberta}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Nova recorrência financeira</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">A regra será processada diariamente para criar o título correspondente na data do próximo vencimento.</p>
            <div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={recorrencia.tipo} onValueChange={(valor) => setRecorrencia({ ...recorrencia, tipo: valor as "receber" | "pagar" })} opcoes={[["receber", "Conta a receber"], ["pagar", "Conta a pagar"]]} /><div className="space-y-2"><Label>Categoria *</Label><Select value={recorrencia.categoriaId} onCreate={() => abrirCriacaoContextual("categoria", "recorrencia")} createLabel="Criar nova categoria" onValueChange={(valor) => setRecorrencia({ ...recorrencia, categoriaId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar categoria" /></SelectTrigger><SelectContent>{(categorias.data ?? []).filter((item: any) => item.tipo === "ambos" || item.tipo === (recorrencia.tipo === "receber" ? "receita" : "despesa")).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Centro de custo *</Label><Select value={recorrencia.centroCustoId} onValueChange={(valor) => setRecorrencia({ ...recorrencia, centroCustoId: valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione o centro responsável" /></SelectTrigger><SelectContent>{(centrosCusto.data ?? []).filter((item: any) => item.ativo).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome} · {item.tipo === "industrial" ? "Industrial" : item.tipo === "comercial_administrativo" ? "Comercial/Administrativo" : "Não apropriável"}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Os títulos futuros herdarão este centro de custo.</p></div>
            <Campo label="Descrição *" value={recorrencia.descricao} onChange={(valor) => setRecorrencia({ ...recorrencia, descricao: valor })} />
            <div className="grid grid-cols-3 gap-3"><Campo label="Valor (R$) *" value={recorrencia.valor} onChange={(valor) => setRecorrencia({ ...recorrencia, valor })} /><CampoSelect label="Frequência" value={recorrencia.frequencia} onValueChange={(valor) => setRecorrencia({ ...recorrencia, frequencia: valor as typeof recorrencia.frequencia })} opcoes={[["semanal", "Semanal"], ["mensal", "Mensal"], ["trimestral", "Trimestral"], ["semestral", "Semestral"], ["anual", "Anual"]]} /><Campo label="Próximo vencimento" type="date" value={recorrencia.proximoVencimento} onChange={(valor) => setRecorrencia({ ...recorrencia, proximoVencimento: valor })} /></div>
            <div className="grid grid-cols-2 gap-3">{recorrencia.tipo === "receber" ? <div className="space-y-2"><Label>Cliente (opcional)</Label><Select value={recorrencia.clienteId || "nenhum"} onCreate={() => abrirCriacaoContextual("cliente", "recorrencia")} createLabel="Criar novo cliente" onValueChange={(valor) => setRecorrencia({ ...recorrencia, clienteId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar cliente" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem cliente vinculado</SelectItem>{(clientes.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-2"><Label>Fornecedor (opcional)</Label><Select value={recorrencia.fornecedorId || "nenhum"} onCreate={() => abrirCriacaoContextual("fornecedor", "recorrencia")} createLabel="Criar novo fornecedor" onValueChange={(valor) => setRecorrencia({ ...recorrencia, fornecedorId: valor === "nenhum" ? "" : valor })}><SelectTrigger className="w-full"><SelectValue placeholder="Pesquisar fornecedor" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem fornecedor vinculado</SelectItem>{(fornecedores.data ?? []).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}<Campo label="Fim da recorrência" type="date" value={recorrencia.dataFim} onChange={(valor) => setRecorrencia({ ...recorrencia, dataFim: valor })} /></div>
            <Campo label="Contraparte livre" value={recorrencia.contraparteNome} onChange={(valor) => setRecorrencia({ ...recorrencia, contraparteNome: valor })} />
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={recorrencia.observacoes} onChange={(e) => setRecorrencia({ ...recorrencia, observacoes: e.target.value })} /></div>
            <Button className="w-full" onClick={salvarRecorrencia} disabled={criarRecorrencia.isPending}>{criarRecorrencia.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar recorrência</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResumoCard({ label, valor, icon, color, descricao }: { label: string; valor: number; icon: React.ReactNode; color: string; descricao?: string }) {
  return <div className="fk-kpi-card p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="fk-eyebrow">{label}</p><p className="fk-kpi-value mt-1.5 truncate text-2xl font-extrabold text-foreground">{formatCurrency(valor)}</p><p className="mt-1 text-xs text-muted-foreground">{descricao ?? "Títulos em aberto"}</p></div><div className={`rounded-xl p-2.5 ${color}`}>{icon}</div></div></div>;
}

const rotuloPrioridadeOperacional: Record<ContaOperacional["prioridade"], string> = {
  vencido_mais_90: "Atraso crítico +90",
  vencido_61_90: "Atraso crítico 61–90",
  vencido_31_60: "Atraso alto 31–60",
  vencido_8_30: "Atraso 8–30",
  vencido: "Vencido",
  vence_hoje: "Vence hoje",
  vence_em_breve: "Próximo",
  normal: "A vencer",
  encerrado: "Encerrado",
};

const rotuloOrigemOperacional: Record<string, string> = {
  orcamento: "Venda", romaneio_carga: "Romaneio de carga", nota_diesel: "Nota de diesel", serragem_terceiros: "Serragem de terceiros", folha_pagamento: "Folha", manual: "Manual", recorrencia: "Recorrência",
};

function PainelContasOperacionais({ dados, tipo, filtros, clientes, clienteId, fornecedores, contas, onFiltros, onFiltrarCliente, onAbrir, onIrFluxo }: {
  dados: ResultadoContasOperacionais;
  tipo: "pagar" | "receber";
  filtros: ReturnType<typeof valorInicialFiltrosOperacionais>;
  clientes: ClienteFinanceiro[];
  clienteId: string;
  fornecedores: FornecedorFinanceiro[];
  contas: ContaFinanceira[];
  onFiltros: (parcial: Partial<ReturnType<typeof valorInicialFiltrosOperacionais>>) => void;
  onFiltrarCliente: (clienteId: number | null | undefined) => void;
  onAbrir: (titulo: ContaOperacional) => void;
  onIrFluxo: (dataVencimento: Date) => void;
}) {
  const textoTipo = tipo === "pagar" ? "a pagar" : "a receber";
  const aplicar = (parcial: Partial<ReturnType<typeof valorInicialFiltrosOperacionais>>) => onFiltros(parcial);
  const cards = [
    { id: "todos", label: `Total ${textoTipo}`, valor: dados.resumo.saldoAberto, descricao: `${dados.resumo.quantidade} títulos em aberto`, classe: "border-slate-200 bg-slate-50 text-slate-800", filtro: { situacao: "todas", aging: "todas" } },
    { id: "vencido", label: "Vencido", valor: dados.resumo.vencido, descricao: "Vencimento anterior a hoje", classe: "border-rose-200 bg-rose-50 text-rose-800", filtro: { situacao: "vencido", aging: "todas" } },
    { id: "hoje", label: tipo === "pagar" ? "Vence hoje" : "Recebe hoje", valor: dados.resumo.venceHoje, descricao: "Exige acompanhamento hoje", classe: "border-amber-200 bg-amber-50 text-amber-900", filtro: { situacao: "vence_hoje", aging: "todas" } },
    { id: "sete", label: "Próximos 7 dias", valor: dados.resumo.proximosSeteDias, descricao: "Após hoje, até 7 dias", classe: "border-sky-200 bg-sky-50 text-sky-800", filtro: { situacao: "proximos_7_dias", aging: "todas" } },
    { id: "a-vencer", label: "Total a vencer", valor: dados.resumo.aVencer, descricao: "Todos os vencimentos futuros", classe: "border-indigo-200 bg-indigo-50 text-indigo-800", filtro: { situacao: "a_vencer", aging: "todas" } },
    { id: "trinta", label: "Próximos 30 dias", valor: dados.resumo.proximosTrintaDias, descricao: "Após hoje, até 30 dias", classe: "border-cyan-200 bg-cyan-50 text-cyan-800", filtro: { situacao: "proximos_30_dias", aging: "todas" } },
    { id: "percentual-vencido", label: "% vencido", valor: dados.resumo.percentualVencido, descricao: "Do saldo em aberto", classe: "border-rose-200 bg-rose-50 text-rose-800", filtro: { situacao: "vencido", aging: "todas" }, formato: "percentual" },
  ] as const;
  const faixasAging = [
    ["a_vencer", "A vencer"], ["vence_hoje", "Vence hoje"], ["1_7", "Atraso 1–7"], ["8_30", "Atraso 8–30"], ["31_60", "Atraso 31–60"], ["61_90", "Atraso 61–90"], ["mais_90", "Atraso +90"],
  ] as const;
  return <div className="space-y-4 border-t bg-muted/[0.035] px-5 py-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">{cards.map((card) => <button key={card.id} type="button" onClick={() => aplicar(card.filtro)} className={`rounded-xl border p-4 text-left shadow-sm transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${card.classe}`}><p className="text-xs font-medium">{card.label}</p><p className="mt-1 text-xl font-bold">{"formato" in card && card.formato === "percentual" ? `${(card.valor ?? 0).toFixed(1)}%` : formatCurrency(card.valor)}</p><p className="mt-1 text-xs opacity-75">{card.descricao}</p></button>)}</div>
    <div className="fk-panel p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="fk-eyebrow">Refinar fila</p><h3 className="text-sm font-semibold">Filtros operacionais</h3><p className="mt-0.5 text-xs text-muted-foreground">Vencimento é a referência principal. Competência permanece como informação complementar.</p></div><Button size="sm" variant="ghost" onClick={() => { aplicar(valorInicialFiltrosOperacionais()); onFiltrarCliente(null); }}>Limpar filtros operacionais</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1"><Label className="text-xs">Situação</Label><Select value={filtros.situacao} onValueChange={(situacao) => aplicar({ situacao, aging: "todas" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas em aberto</SelectItem><SelectItem value="vencido">Vencidos</SelectItem><SelectItem value="vence_hoje">Vence hoje</SelectItem><SelectItem value="proximos_7_dias">Próximos 7 dias</SelectItem><SelectItem value="proximos_30_dias">Próximos 30 dias</SelectItem><SelectItem value="a_vencer">A vencer</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Estado</Label><Select value={filtros.estado} onValueChange={(estado) => aplicar({ estado })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Aberto e parcial</SelectItem><SelectItem value="aberto">Somente aberto</SelectItem><SelectItem value="parcial">Somente parcial</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Origem</Label><Select value={filtros.origem} onValueChange={(origem) => aplicar({ origem})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as origens</SelectItem>{Object.entries(rotuloOrigemOperacional).map(([origem, rotulo]) => <SelectItem key={origem} value={origem}>{rotulo}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Ordenar por</Label><Select value={filtros.ordenar} onValueChange={(ordenar) => aplicar({ ordenar: ordenar as ReturnType<typeof valorInicialFiltrosOperacionais>["ordenar"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="prioridade">Prioridade</SelectItem><SelectItem value="vencimento_asc">Vencimento mais próximo</SelectItem><SelectItem value="vencimento_desc">Vencimento mais distante</SelectItem><SelectItem value="saldo_desc">Maior saldo</SelectItem><SelectItem value="contraparte">Contraparte</SelectItem></SelectContent></Select></div>{tipo === "pagar" ? <div className="space-y-1"><Label className="text-xs">Fornecedor</Label><Select value={filtros.fornecedorId || "todos"} onValueChange={(fornecedorId) => aplicar({ fornecedorId: fornecedorId === "todos" ? "" : fornecedorId })}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os fornecedores</SelectItem>{fornecedores.map((fornecedor) => <SelectItem key={fornecedor.id} value={String(fornecedor.id)}>{fornecedor.nome}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-1"><Label className="text-xs">Cliente</Label><Select value={clienteId || "todos"} onValueChange={(novoClienteId) => onFiltrarCliente(novoClienteId === "todos" ? null : Number(novoClienteId))}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os clientes</SelectItem>{clientes.map((cliente) => <SelectItem key={cliente.id} value={String(cliente.id)}>{cliente.nome}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-1"><Label className="text-xs">Conta de baixa</Label><Select value={filtros.contaFinanceiraId} onValueChange={(contaFinanceiraId) => aplicar({ contaFinanceiraId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as contas</SelectItem>{contas.map((conta) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select></div></div><p className="mt-3 text-xs text-muted-foreground">{dados.convencaoContaFinanceira}</p></div>
    <div className="rounded-xl border bg-white shadow-sm"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Aging por vencimento</h3><p className="mt-0.5 text-xs text-muted-foreground">Clique em uma faixa para ver somente os títulos que a compõem.</p></div><div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{faixasAging.map(([faixa, rotulo]) => <button key={faixa} type="button" onClick={() => aplicar({ aging: faixa, situacao: "todas" })} className={`p-3 text-left transition-colors hover:bg-muted/40 ${filtros.aging === faixa ? "bg-primary/5" : ""}`}><p className="text-xs text-muted-foreground">{rotulo}</p><p className="mt-1 text-sm font-semibold">{formatCurrency(dados.resumo.aging[faixa])}</p></button>)}</div></div>
    <div className="space-y-4"><div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b px-4 py-3"><div><h3 className="text-sm font-semibold">Fila operacional</h3><p className="mt-0.5 text-xs text-muted-foreground">{dados.itens.length} título{dados.itens.length === 1 ? "" : "s"} conforme os filtros ativos.</p></div></div>{dados.itens.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Vencimento</TableHead><TableHead>Contraparte</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Devido</TableHead><TableHead className="text-right">Pago</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Status</TableHead><TableHead>Prioridade</TableHead></TableRow></TableHeader><TableBody>{dados.itens.map((titulo) => <TableRow key={titulo.id} className="cursor-pointer hover:bg-muted/30" tabIndex={0} onClick={() => onAbrir(titulo)} onKeyDown={(evento) => { if (evento.key === "Enter" || evento.key === " ") onAbrir(titulo); }}><TableCell className="whitespace-nowrap text-sm"><p>{formatarDataFinanceira(titulo.dataVencimento)}</p><p className="text-xs text-muted-foreground">{titulo.diasParaVencimento < 0 ? `${Math.abs(titulo.diasParaVencimento)} dia(s) em atraso` : titulo.diasParaVencimento === 0 ? "Hoje" : `Em ${titulo.diasParaVencimento} dia(s)`}</p></TableCell><TableCell className="min-w-44"><p className="font-medium">{titulo.contraparte}</p><p className="text-xs text-muted-foreground">{titulo.descricao}{titulo.numeroParcela ? ` · ${titulo.numeroParcela}/${titulo.totalParcelas}` : ""}</p></TableCell><TableCell className="text-sm">{rotuloOrigemOperacional[titulo.origem] ?? titulo.origem}</TableCell><TableCell className="text-right text-sm">{formatCurrency(titulo.valorDevido)}</TableCell><TableCell className="text-right text-sm">{formatCurrency(titulo.valorBaixado)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(titulo.saldoAberto)}</TableCell><TableCell><StatusBadge estado={titulo.estado} /></TableCell><TableCell><Badge variant="outline" className={titulo.prioridade.startsWith("vencido") ? "border-rose-200 bg-rose-50 text-rose-700" : titulo.prioridade === "vence_hoje" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}>{rotuloPrioridadeOperacional[titulo.prioridade]}</Badge></TableCell></TableRow>)}</TableBody></Table></div> : <EstadoVazio icon={<CalendarClock className="h-8 w-8" />} texto="Nenhum título em aberto corresponde aos filtros aplicados." />}</div><aside className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start"><div className="rounded-xl border bg-white shadow-sm"><div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Concentração</h3><p className="mt-0.5 text-xs text-muted-foreground">Top 5 por {tipo === "pagar" ? "fornecedor" : "cliente"} · clique para filtrar</p></div>{dados.top5Contrapartes.length ? <div className="divide-y">{dados.top5Contrapartes.map((grupo) => <button key={grupo.contraparte} type="button" className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => { if (tipo === "pagar") aplicar({ fornecedorId: grupo.fornecedorId ? String(grupo.fornecedorId) : "" }); else onFiltrarCliente(grupo.clienteId); }}><div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-medium">{grupo.contraparte}</p><p className="shrink-0 text-sm font-semibold">{formatCurrency(grupo.saldoAberto)}</p></div><p className="mt-1 text-xs text-muted-foreground">{grupo.quantidade} título{grupo.quantidade === 1 ? "" : "s"}{grupo.vencido ? ` · ${formatCurrency(grupo.vencido)} vencido` : ""}</p></button>)}</div> : <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sem concentração no filtro atual.</p>}</div><Button variant="outline" className="w-full" onClick={() => { const proximo = dados.itens[0]; if (proximo) onIrFluxo(proximo.dataVencimento); }}>Ver vencimento no Fluxo de caixa</Button></aside></div>
  </div>;
}

function ListaCompromissos({ titulo, descricao, titulos, classe, vazio }: { titulo: string; descricao: string; titulos: any[]; classe: string; vazio: string }) {
  return <section className={`rounded-xl border bg-white shadow-sm overflow-hidden ${classe}`}><div className="px-5 py-4 border-b"><h2 className="font-semibold text-sm">{titulo}</h2><p className="text-xs text-muted-foreground mt-0.5">{descricao}</p></div>{titulos.length ? <div className="divide-y">{titulos.slice(0, 4).map((titulo) => <div key={titulo.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{titulo.descricao}</p><p className="text-xs text-muted-foreground">{formatarDataFinanceira(titulo.dataVencimento)} · {titulo.tipo === "receber" ? "A receber" : "A pagar"}</p></div><p className="shrink-0 text-sm font-semibold">{formatCurrency(saldoTitulo(titulo))}</p></div>)}</div> : <p className="px-5 py-8 text-center text-sm text-muted-foreground">{vazio}</p>}</section>;
}

function Campo({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (valor: string) => void; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input aria-label={label} type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function CampoSelect({ label, value, onValueChange, opcoes }: { label: string; value: string; onValueChange: (valor: string) => void; opcoes: [string, string][] }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{opcoes.map(([valor, texto]) => <SelectItem key={valor} value={valor}>{texto}</SelectItem>)}</SelectContent></Select></div>;
}

function CadastroTabela({ titulo, descricao, icone, botao, aoCriar, acaoSecundaria, colunas, linhas, vazio }: { titulo: string; descricao: string; icone: React.ReactNode; botao: string; aoCriar: () => void; acaoSecundaria?: React.ReactNode; colunas: string[]; linhas: string[][]; vazio: string }) {
  return <section className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden"><div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary">{icone}</div><div><h2 className="font-semibold">{titulo}</h2><p className="text-xs text-muted-foreground mt-0.5">{descricao}</p></div></div><div className="flex flex-wrap gap-2">{acaoSecundaria}<Button size="sm" onClick={aoCriar}><Plus className="mr-1.5 h-3.5 w-3.5" />{botao}</Button></div></div>{linhas.length ? <Table><TableHeader><TableRow className="bg-muted/40">{colunas.map((coluna) => <TableHead key={coluna}>{coluna}</TableHead>)}</TableRow></TableHeader><TableBody>{linhas.map((linha, indice) => <TableRow key={`${linha[0]}-${indice}`}>{linha.map((celula, celulaIndice) => <TableCell key={`${celula}-${celulaIndice}`} className={celulaIndice === 0 ? "font-medium" : "text-muted-foreground"}>{celula}</TableCell>)}</TableRow>)}</TableBody></Table> : <EstadoVazio icon={<CircleAlert className="h-8 w-8" />} texto={vazio} acao={aoCriar} labelAcao={botao} />}</section>;
}

function TabelaTitulosFinanceiros({ titulos, historico, tipo, selecionados, onSelecionar, onBaixas, onEditar, onBaixar, onExcluir }: { titulos: any[]; historico: boolean; tipo: "pagar" | "receber"; selecionados: number[]; onSelecionar: (id: number) => void; onBaixas: (titulo: any) => void; onEditar: (titulo: any) => void; onBaixar: (titulo: any) => void; onExcluir: (titulo: any) => void }) {
  if (!titulos.length) return <EstadoVazio icon={<CalendarClock className="h-9 w-9" />} texto={historico ? `Nenhuma conta ${tipo === "pagar" ? "paga" : "recebida"} encontrada` : `Nenhuma conta a ${tipo === "pagar" ? "pagar" : "receber"} encontrada`} />;
  const hojeLocal = hoje();
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead className="w-10">Sel.</TableHead><TableHead>Descrição</TableHead><TableHead>{historico ? (tipo === "pagar" ? "Pago em" : "Recebido em") : "Vencimento"}</TableHead><TableHead>Status</TableHead><TableHead className="text-right">{historico ? "Valor liquidado" : "Saldo"}</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{titulos.map((titulo: any) => {
    const possuiBaixas = Number(titulo.valorBaixado || 0) > 0.005;
    const venceHoje = !historico && dataChaveFinanceira(titulo.dataVencimento) === hojeLocal;
    const dataPrincipal = historico ? (titulo.dataUltimaBaixa ?? titulo.dataVencimento) : titulo.dataVencimento;
    return <TableRow key={titulo.id} className={venceHoje ? (tipo === "pagar" ? "bg-amber-50 hover:bg-amber-100/70" : "bg-emerald-50 hover:bg-emerald-100/70") : "hover:bg-muted/20"}><TableCell><input type="checkbox" aria-label={`Selecionar ${titulo.descricao}`} checked={selecionados.includes(titulo.id)} onChange={() => onSelecionar(titulo.id)} /></TableCell><TableCell><button type="button" className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onEditar(titulo)} aria-label={`Editar ${titulo.descricao}`}><p className="font-medium underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary">{titulo.descricao}</p><p className="text-xs text-muted-foreground">{formatReceivableSaleReference(titulo.origem, titulo.descricao)}{titulo.numeroParcela ? ` · Parcela ${titulo.numeroParcela}/${titulo.totalParcelas}` : ""}</p></button></TableCell><TableCell className="text-sm"><div className="flex items-center gap-2">{formatarDataFinanceira(dataPrincipal)}{venceHoje && <Badge variant="outline" className={tipo === "pagar" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-emerald-300 bg-emerald-100 text-emerald-900"}>{tipo === "pagar" ? "Vence hoje" : "Recebe hoje"}</Badge>}</div></TableCell><TableCell><StatusBadge estado={titulo.estado} /></TableCell><TableCell className="text-right font-semibold">{formatCurrency(historico ? Number(titulo.valorBaixado || 0) : saldoTitulo(titulo))}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{possuiBaixas && <Button size="sm" variant="ghost" onClick={() => onBaixas(titulo)}>Baixas</Button>}{!historico && <Button size="sm" variant="outline" onClick={() => onBaixar(titulo)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{tipo === "pagar" ? "Pagar" : "Receber"}</Button>}<Button size="sm" variant="outline" className="text-destructive hover:text-destructive" title="Desconcilie qualquer movimento bancário vinculado antes de excluir" onClick={() => onExcluir(titulo)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div></TableCell></TableRow>;
  })}</TableBody></Table></div>;
}

function EstadoVazio({ icon, texto, acao, labelAcao }: { icon: React.ReactNode; texto: string; acao?: () => void; labelAcao?: string }) {
  return <div className="p-12 text-center text-muted-foreground"><div className="mx-auto mb-3 w-fit opacity-40">{icon}</div><p className="text-sm">{texto}</p>{acao && labelAcao && <Button variant="outline" size="sm" className="mt-4" onClick={acao}><Plus className="h-3.5 w-3.5 mr-1.5" />{labelAcao}</Button>}</div>;
}
