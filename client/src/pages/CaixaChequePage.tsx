import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowDownToLine, CheckCircle2, CircleDollarSign, Clock3, Landmark, ReceiptText, RotateCcw, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type EstadoCheque = "todos" | "disponivel" | "utilizado" | "estornado" | "depositado";

const estadoCheque = {
  disponivel: { label: "Disponível", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  utilizado: { label: "Utilizado", className: "border-violet-200 bg-violet-50 text-violet-700" },
  estornado: { label: "Devolvido", className: "border-rose-300 bg-rose-50 text-rose-700" },
  depositado: { label: "Depositado", className: "border-sky-300 bg-sky-50 text-sky-800" },
} as const;

const alertaCompensacao = {
  atrasada: { label: "Compensação atrasada", className: "border-rose-300 bg-rose-100 text-rose-800", row: "bg-rose-50/80 hover:bg-rose-100/70" },
  hoje: { label: "Compensa hoje", className: "border-amber-300 bg-amber-100 text-amber-900", row: "bg-amber-50/80 hover:bg-amber-100/70" },
  proxima: { label: "Compensação próxima", className: "border-sky-300 bg-sky-100 text-sky-800", row: "bg-sky-50/80 hover:bg-sky-100/70" },
} as const;

function formatarData(data: Date | string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(data));
}

export default function CaixaChequePage() {
  const [, setLocation] = useLocation();
  const [estado, setEstado] = useState<EstadoCheque>("todos");
  const [chequeEmDevolucao, setChequeEmDevolucao] = useState<any>(null);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [dataDevolucao, setDataDevolucao] = useState(() => new Date().toISOString().slice(0, 10));
  const [chequeEmDeposito, setChequeEmDeposito] = useState<any>(null);
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [dataDeposito, setDataDeposito] = useState(() => new Date().toISOString().slice(0, 10));
  const [contaHistoricoId, setContaHistoricoId] = useState("todas");
  const filtro = useMemo(() => estado === "todos" ? undefined : { estado }, [estado]);
  const utils = trpc.useUtils();
  const resumo = trpc.financeiro.cheques.resumo.useQuery();
  const cheques = trpc.financeiro.cheques.list.useQuery(filtro);
  const chequesDisponiveis = trpc.financeiro.cheques.list.useQuery({ estado: "disponivel" });
  const contas = trpc.financeiro.contas.list.useQuery();
  const contasBancarias = useMemo(() => (contas.data ?? []).filter((conta: any) => conta.ativa && conta.tipo === "banco"), [contas.data]);
  const filtroHistorico = useMemo(() => contaHistoricoId === "todas" ? undefined : { contaFinanceiraId: Number(contaHistoricoId) }, [contaHistoricoId]);
  const historicoDepositos = trpc.financeiro.cheques.historicoDepositos.useQuery(filtroHistorico);
  const alertas = useMemo(() => (chequesDisponiveis.data ?? []).filter((cheque: any) => cheque.alertaCompensacao), [chequesDisponiveis.data]);
  const devolverCheque = trpc.financeiro.titulos.devolverCheque.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.financeiro.cheques.list.invalidate(),
        utils.financeiro.cheques.resumo.invalidate(),
        utils.financeiro.titulos.list.invalidate(),
      ]);
      setChequeEmDevolucao(null);
      setMotivoDevolucao("");
    },
  });
  const depositarCheque = trpc.financeiro.cheques.depositar.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.financeiro.cheques.list.invalidate(),
        utils.financeiro.cheques.resumo.invalidate(),
        utils.financeiro.cheques.historicoDepositos.invalidate(),
      ]);
      setChequeEmDeposito(null);
      setContaDestinoId("");
    },
  });

  const abrirDevolucao = (cheque: any) => {
    setChequeEmDevolucao(cheque);
    setMotivoDevolucao("");
    setDataDevolucao(new Date().toISOString().slice(0, 10));
  };

  const confirmarDevolucao = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chequeEmDevolucao) return;
    devolverCheque.mutate({ id: chequeEmDevolucao.id, motivo: motivoDevolucao, dataDevolucao });
  };

  const abrirDeposito = (cheque: any) => {
    setChequeEmDeposito(cheque);
    setContaDestinoId(contasBancarias[0] ? String(contasBancarias[0].id) : "");
    setDataDeposito(new Date().toISOString().slice(0, 10));
  };

  const confirmarDeposito = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chequeEmDeposito || !contaDestinoId) return;
    depositarCheque.mutate({ id: chequeEmDeposito.id, contaDestinoId: Number(contaDestinoId), dataDeposito });
  };

  return (
    <main className="container py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><ReceiptText className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wide">Financeiro</span></div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Caixa Cheque</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Controle individual dos cheques recebidos e utilizados, preservando o vínculo com cada cliente e movimentação financeira.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLocation("/financeiro?tipo=receber")}>Registrar recebimento</Button>
          <Button onClick={() => setLocation("/financeiro?tipo=pagar")}>Usar em pagamento</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/40"><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-emerald-800"><CircleDollarSign className="h-4 w-4" />Saldo disponível</CardDescription><CardTitle className="text-2xl text-emerald-950">{formatCurrency(resumo.data?.totalDisponivel ?? 0)}</CardTitle></CardHeader><CardContent><p className="text-xs text-emerald-800">{resumo.data?.quantidadeDisponivel ?? 0} cheque(s) disponível(is) para pagamento.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-violet-600" />Total utilizado</CardDescription><CardTitle className="text-2xl">{formatCurrency(resumo.data?.totalUtilizado ?? 0)}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{resumo.data?.quantidadeUtilizada ?? 0} cheque(s) já vinculados a pagamentos.</p></CardContent></Card>
        <Card className="border-sky-200 bg-sky-50/40"><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2 text-sky-800"><Landmark className="h-4 w-4" />Total depositado</CardDescription><CardTitle className="text-2xl text-sky-950">{formatCurrency(resumo.data?.totalDepositado ?? 0)}</CardTitle></CardHeader><CardContent><p className="text-xs text-sky-800">{resumo.data?.quantidadeDepositada ?? 0} cheque(s) transferidos para bancos.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" />Contas de cheque</CardDescription><CardTitle className="text-2xl">{resumo.data?.contas.length ?? 0}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{resumo.data?.contas.length ? `${resumo.data.contas.length} conta(s) de cheque cadastrada(s) para o controle.` : "Cadastre uma conta do tipo Caixa Cheque no Financeiro para iniciar o controle."}</p></CardContent></Card>
      </div>

      {alertas.length > 0 && <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-lg bg-amber-100 p-2 text-amber-800"><TriangleAlert className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-semibold">Atenção à compensação de cheques</h2><p className="mt-0.5 text-sm text-amber-900">{alertas.length} cheque(s) disponível(is) precisam de acompanhamento: a tabela abaixo identifica os itens atrasados, previstos para hoje ou próximos da compensação.</p><div className="mt-3 flex flex-wrap gap-2">{alertas.slice(0, 6).map((cheque: any) => { const alerta = alertaCompensacao[cheque.alertaCompensacao as keyof typeof alertaCompensacao]; return <Badge key={cheque.id} variant="outline" className={alerta.className}>{cheque.referencia} · {formatarData(cheque.dataCompensacao)}</Badge>; })}{alertas.length > 6 && <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">+{alertas.length - 6} item(ns)</Badge>}</div></div></div></section>}

      <Card className="mt-6">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Cheques individuais</CardTitle><CardDescription className="mt-1">Referência, cliente, entrada, compensação, utilização ou transferência para banco.</CardDescription></div><Select value={estado} onValueChange={(valor) => setEstado(valor as EstadoCheque)}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrar situação" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os cheques</SelectItem><SelectItem value="disponivel">Disponíveis</SelectItem><SelectItem value="utilizado">Utilizados</SelectItem><SelectItem value="depositado">Depositados</SelectItem><SelectItem value="estornado">Estornados</SelectItem></SelectContent></Select></CardHeader>
        <CardContent>
          {cheques.isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando cheques...</div> : cheques.data?.length ? <><p className="mb-2 text-xs text-muted-foreground sm:hidden">Deslize a tabela lateralmente para consultar todos os dados.</p><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Referência</TableHead><TableHead>Cliente</TableHead><TableHead>Conta</TableHead><TableHead>Recebido em</TableHead><TableHead>Compensação</TableHead><TableHead>Utilizado em</TableHead><TableHead>Depósito</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{cheques.data.map((cheque: any) => { const dadosEstado = estadoCheque[cheque.estado as keyof typeof estadoCheque]; const alerta = cheque.alertaCompensacao ? alertaCompensacao[cheque.alertaCompensacao as keyof typeof alertaCompensacao] : null; return <TableRow key={cheque.id} className={alerta?.row}><TableCell className="font-medium">{cheque.referencia}</TableCell><TableCell>{cheque.clienteNome}</TableCell><TableCell>{cheque.contaNome}</TableCell><TableCell>{formatarData(cheque.dataRecebimento)}</TableCell><TableCell><div className="flex flex-col items-start gap-1"><span>{formatarData(cheque.dataCompensacao)}</span>{alerta && <Badge variant="outline" className={alerta.className}>{alerta.label}</Badge>}</div></TableCell><TableCell>{formatarData(cheque.utilizadoEm)}</TableCell><TableCell>{cheque.estado === "depositado" ? <div className="flex flex-col gap-1"><span>{formatarData(cheque.depositadoEm)}</span><span className="text-xs text-muted-foreground">{cheque.contaDestinoNome}</span></div> : "—"}</TableCell><TableCell><div className="flex flex-col items-start gap-1"><Badge variant="outline" className={dadosEstado.className}>{dadosEstado.label}</Badge>{cheque.estado === "estornado" && <span className="max-w-48 text-xs text-muted-foreground">{formatarData(cheque.estornadoEm)} · {cheque.motivoEstorno || "Sem motivo informado"}</span>}</div></TableCell><TableCell className="text-right font-medium">{formatCurrency(cheque.valor)}</TableCell><TableCell className="text-right">{cheque.estado === "disponivel" ? <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" className="border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800" onClick={() => abrirDeposito(cheque)}><ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />Depositar</Button><Button type="button" variant="outline" size="sm" className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => abrirDevolucao(cheque)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Devolver</Button></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow>; })}</TableBody></Table></div></> : <div className="rounded-lg border border-dashed py-14 text-center"><ReceiptText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhum cheque encontrado</p><p className="mt-1 text-sm text-muted-foreground">Registre um recebimento com a conta Caixa Cheque para inserir o primeiro item.</p></div>}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Histórico de depósitos bancários</CardTitle><CardDescription className="mt-1">Transferências internas concluídas, rastreáveis pela conta bancária de destino e fora do fluxo de caixa.</CardDescription></div><Select value={contaHistoricoId} onValueChange={setContaHistoricoId}><SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Filtrar conta bancária" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as contas bancárias</SelectItem>{contasBancarias.map((conta: any) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select></CardHeader>
        <CardContent>{historicoDepositos.isLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Carregando histórico...</div> : historicoDepositos.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Depósito em</TableHead><TableHead>Cheque</TableHead><TableHead>Cliente</TableHead><TableHead>Conta de origem</TableHead><TableHead>Conta bancária</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{historicoDepositos.data.map((cheque: any) => <TableRow key={cheque.id}><TableCell>{formatarData(cheque.depositadoEm)}</TableCell><TableCell className="font-medium">{cheque.referencia}</TableCell><TableCell>{cheque.clienteNome}</TableCell><TableCell>{cheque.contaNome}</TableCell><TableCell>{cheque.contaDestinoNome}</TableCell><TableCell className="text-right font-medium">{formatCurrency(cheque.valor)}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="rounded-lg border border-dashed py-10 text-center"><Landmark className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">Nenhum depósito encontrado</p><p className="mt-1 text-sm text-muted-foreground">Quando um cheque compensado for transferido para um banco, ele aparecerá neste histórico.</p></div>}</CardContent>
      </Card>

      <Dialog open={Boolean(chequeEmDevolucao)} onOpenChange={(aberto) => { if (!aberto && !devolverCheque.isPending) setChequeEmDevolucao(null); }}>
        <DialogContent>
          <form onSubmit={confirmarDevolucao}>
            <DialogHeader><DialogTitle>Registrar cheque devolvido</DialogTitle><DialogDescription>O cheque <strong>{chequeEmDevolucao?.referencia}</strong> será removido do saldo disponível e o recebimento será revertido no valor de {formatCurrency(chequeEmDevolucao?.valor ?? 0)}.</DialogDescription></DialogHeader>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-2"><Label htmlFor="data-devolucao">Data da devolução</Label><input id="data-devolucao" type="date" value={dataDevolucao} onChange={(event) => setDataDevolucao(event.target.value)} required className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm" /></div>
              <div className="grid gap-2"><Label htmlFor="motivo-devolucao">Motivo da devolução</Label><Textarea id="motivo-devolucao" value={motivoDevolucao} onChange={(event) => setMotivoDevolucao(event.target.value)} placeholder="Ex.: cheque devolvido por insuficiência de fundos" required minLength={3} /></div>
              {devolverCheque.error && <p className="text-sm text-destructive">{devolverCheque.error.message}</p>}
            </div>
            <DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={() => setChequeEmDevolucao(null)} disabled={devolverCheque.isPending}>Cancelar</Button><Button type="submit" variant="destructive" disabled={devolverCheque.isPending}>{devolverCheque.isPending ? "Registrando..." : "Confirmar devolução"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(chequeEmDeposito)} onOpenChange={(aberto) => { if (!aberto && !depositarCheque.isPending) setChequeEmDeposito(null); }}>
        <DialogContent>
          <form onSubmit={confirmarDeposito}>
            <DialogHeader><DialogTitle>Depositar cheque em conta bancária</DialogTitle><DialogDescription>O cheque <strong>{chequeEmDeposito?.referencia}</strong> será transferido do Caixa Cheque para a conta bancária selecionada. Esta operação é interna e não altera o relatório de fluxo de caixa.</DialogDescription></DialogHeader>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-2"><Label htmlFor="conta-destino-deposito">Conta bancária de destino</Label><Select value={contaDestinoId} onValueChange={setContaDestinoId} disabled={!contasBancarias.length}><SelectTrigger id="conta-destino-deposito"><SelectValue placeholder={contasBancarias.length ? "Selecione a conta" : "Nenhuma conta bancária ativa"} /></SelectTrigger><SelectContent>{contasBancarias.map((conta: any) => <SelectItem key={conta.id} value={String(conta.id)}>{conta.nome}</SelectItem>)}</SelectContent></Select>{!contasBancarias.length && <p className="text-xs text-destructive">Cadastre ou ative uma conta do tipo Banco no Financeiro antes de registrar o depósito.</p>}</div>
              <div className="grid gap-2"><Label htmlFor="data-deposito">Data do depósito</Label><input id="data-deposito" type="date" value={dataDeposito} onChange={(event) => setDataDeposito(event.target.value)} required className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm" /></div>
              {depositarCheque.error && <p className="text-sm text-destructive">{depositarCheque.error.message}</p>}
            </div>
            <DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={() => setChequeEmDeposito(null)} disabled={depositarCheque.isPending}>Cancelar</Button><Button type="submit" disabled={depositarCheque.isPending || !contaDestinoId}>{depositarCheque.isPending ? "Depositando..." : "Confirmar depósito"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
