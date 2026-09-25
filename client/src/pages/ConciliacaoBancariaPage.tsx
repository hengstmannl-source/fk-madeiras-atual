import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import { CheckCircle2, CircleAlert, FileSpreadsheet, Landmark, Loader2, PlusCircle, RefreshCw, Upload, WandSparkles } from "lucide-react";
import { toast } from "sonner";

type EstadoMovimento = "pendente" | "conciliado" | "ignorado" | "divergente";

const opcoesEstado: Array<{ value: "todos" | EstadoMovimento; label: string }> = [
  { value: "todos", label: "Todos os estados" },
  { value: "pendente", label: "Pendentes" },
  { value: "conciliado", label: "Conciliados" },
  { value: "divergente", label: "Divergências" },
  { value: "ignorado", label: "Ignorados" },
];

const estiloEstado: Record<EstadoMovimento, string> = {
  pendente: "border-amber-300 bg-amber-50 text-amber-800",
  conciliado: "border-emerald-300 bg-emerald-50 text-emerald-800",
  divergente: "border-rose-300 bg-rose-50 text-rose-800",
  ignorado: "border-slate-300 bg-slate-50 text-slate-700",
};

function formatarData(data: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(data));
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

export default function ConciliacaoBancariaPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const contas = trpc.financeiro.contas.list.useQuery();
  const categorias = trpc.financeiro.categorias.list.useQuery();
  const [contaFinanceiraId, setContaFinanceiraId] = useState("");
  const [estado, setEstado] = useState<"todos" | EstadoMovimento>("pendente");
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conteudoArquivo, setConteudoArquivo] = useState("");
  const [formatoArquivo, setFormatoArquivo] = useState<"csv" | "ofx">("csv");
  const [preparo, setPreparo] = useState<{ linhas: any[]; erros: string[] } | null>(null);
  const [movimentoNovoLancamento, setMovimentoNovoLancamento] = useState<any>(null);
  const [categoriaId, setCategoriaId] = useState("");
  const [descricaoNovoLancamento, setDescricaoNovoLancamento] = useState("");

  const contasBancarias = useMemo(() => (contas.data ?? []).filter((conta: any) => conta.tipo === "banco" && conta.ativa), [contas.data]);
  useEffect(() => {
    if (!contaFinanceiraId && contasBancarias[0]) setContaFinanceiraId(String(contasBancarias[0].id));
  }, [contaFinanceiraId, contasBancarias]);

  const filtroConciliacao = useMemo(() => ({
    contaFinanceiraId: contaFinanceiraId ? Number(contaFinanceiraId) : undefined,
    estado: estado === "todos" ? undefined : estado,
  }), [contaFinanceiraId, estado]);
  const movimentos = trpc.financeiro.conciliacao.list.useQuery(filtroConciliacao, { enabled: Boolean(contaFinanceiraId) });
  const modeloCsv = trpc.financeiro.conciliacao.modeloCsv.useQuery(undefined, { enabled: false });
  const prepararImportacao = trpc.financeiro.conciliacao.prepararImportacao.useMutation();
  const importarExtrato = trpc.financeiro.conciliacao.importar.useMutation();
  const confirmar = trpc.financeiro.conciliacao.confirmar.useMutation();
  const confirmarTransferencia = trpc.financeiro.conciliacao.confirmarTransferencia.useMutation();
  const desfazer = trpc.financeiro.conciliacao.desfazer.useMutation();
  const definirEstado = trpc.financeiro.conciliacao.definirEstado.useMutation();
  const criarLancamento = trpc.financeiro.conciliacao.criarLancamento.useMutation();

  const invalidar = () => {
    utils.financeiro.conciliacao.list.invalidate();
    utils.financeiro.titulos.list.invalidate();
    utils.financeiro.alertas.list.invalidate();
    utils.financeiro.relatorios.fluxoCaixa.invalidate();
  };
  const resumo = useMemo(() => (movimentos.data ?? []).reduce((acumulado: Record<EstadoMovimento, { quantidade: number; valor: number }>, movimento: any) => {
    const estadoMovimento = movimento.estado as EstadoMovimento;
    acumulado[estadoMovimento].quantidade += 1;
    acumulado[estadoMovimento].valor += Number(movimento.valor);
    return acumulado;
  }, {
    pendente: { quantidade: 0, valor: 0 }, conciliado: { quantidade: 0, valor: 0 }, divergente: { quantidade: 0, valor: 0 }, ignorado: { quantidade: 0, valor: 0 },
  }), [movimentos.data]);

  const baixarModelo = async () => {
    const resposta = await modeloCsv.refetch();
    if (!resposta.data) { toast.error("Não foi possível gerar o modelo de extrato"); return; }
    baixarCsv(resposta.data, "modelo-extrato-bancario-fk-madeiras.csv");
  };

  const limparImportacao = () => { setArquivo(null); setConteudoArquivo(""); setPreparo(null); setFormatoArquivo("csv"); };
  const selecionarArquivo = async (selecionado: File | null) => {
    setArquivo(selecionado);
    setPreparo(null);
    setConteudoArquivo("");
    if (!selecionado) return;
    const extensao = selecionado.name.split(".").pop()?.toLocaleLowerCase();
    if (extensao !== "csv" && extensao !== "ofx") { toast.error("Selecione um arquivo CSV ou OFX"); setArquivo(null); return; }
    try {
      const conteudo = await selecionado.text();
      const formato = extensao as "csv" | "ofx";
      setConteudoArquivo(conteudo);
      setFormatoArquivo(formato);
      prepararImportacao.mutate({ conteudo, formato }, {
        onSuccess: (resultado) => setPreparo(resultado),
        onError: (erro) => setPreparo({ linhas: [], erros: [erro.message] }),
      });
    } catch { setPreparo({ linhas: [], erros: ["Não foi possível ler o arquivo selecionado"] }); }
  };

  const confirmarImportacao = () => {
    if (!contaFinanceiraId || !arquivo || !conteudoArquivo || !preparo || preparo.erros.length) return;
    importarExtrato.mutate({ contaFinanceiraId: Number(contaFinanceiraId), nomeArquivo: arquivo.name, formato: formatoArquivo, conteudo: conteudoArquivo }, {
      onSuccess: (resultado) => {
        if (resultado.erros.length) { setPreparo({ linhas: [], erros: resultado.erros }); toast.error("A importação foi recusada. Revise os dados indicados."); return; }
        const resumoImportacao = [
          `${resultado.importados} movimento(s) importado(s)`,
          resultado.duplicados ? `${resultado.duplicados} já existente(s) ignorado(s)` : null,
        ].filter(Boolean).join(" · ");
        toast.success(`${resumoImportacao} para conciliação`);
        limparImportacao();
        setImportacaoAberta(false);
        invalidar();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const confirmarSugestao = (movimentoId: number, baixaFinanceiraId: number) => confirmar.mutate({ movimentoId, baixaFinanceiraId }, {
    onSuccess: () => { toast.success("Movimento conciliado com a baixa financeira"); invalidar(); },
    onError: (erro) => toast.error(erro.message),
  });
  const confirmarSugestaoTransferencia = (movimentoId: number, movimentoTransferenciaFinanceiraId: number) => confirmarTransferencia.mutate({ movimentoId, movimentoTransferenciaFinanceiraId }, {
    onSuccess: () => { toast.success("Movimento conciliado como transferência interna, sem impactar receitas ou despesas"); invalidar(); },
    onError: (erro) => toast.error(erro.message),
  });
  const alterarEstado = (movimentoId: number, novoEstado: "ignorado" | "divergente") => definirEstado.mutate({ movimentoId, estado: novoEstado }, {
    onSuccess: () => { toast.success(novoEstado === "ignorado" ? "Movimento ignorado" : "Movimento sinalizado como divergente"); invalidar(); },
    onError: (erro) => toast.error(erro.message),
  });
  const abrirNovoLancamento = (movimento: any) => {
    setMovimentoNovoLancamento(movimento);
    setCategoriaId("");
    setDescricaoNovoLancamento(movimento.descricao);
  };
  const salvarNovoLancamento = () => {
    if (!movimentoNovoLancamento || !categoriaId || descricaoNovoLancamento.trim().length < 2) { toast.error("Informe uma categoria e uma descrição para o lançamento"); return; }
    criarLancamento.mutate({ movimentoId: movimentoNovoLancamento.id, categoriaId: Number(categoriaId), descricao: descricaoNovoLancamento.trim() }, {
      onSuccess: () => { toast.success("Lançamento criado e movimento conciliado"); setMovimentoNovoLancamento(null); invalidar(); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const categoriaCompativel = (categoria: any) => movimentoNovoLancamento && (categoria.tipo === "ambos" || categoria.tipo === (movimentoNovoLancamento.tipo === "entrada" ? "receita" : "despesa"));

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <div className="flex items-center gap-2"><div className="rounded-lg bg-primary/10 p-2"><Landmark className="h-5 w-5 text-primary" /></div><h1 className="text-2xl font-bold tracking-tight text-foreground">Conciliação bancária</h1></div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Importe o extrato de uma conta bancária, associe os movimentos às baixas existentes e mantenha as divergências rastreáveis.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={baixarModelo} disabled={modeloCsv.isFetching}><FileSpreadsheet className="mr-2 h-4 w-4" />Modelo CSV</Button><Button onClick={() => setImportacaoAberta(true)} disabled={!contasBancarias.length}><Upload className="mr-2 h-4 w-4" />Importar extrato</Button></div>
    </header>

    {!contasBancarias.length ? <Card className="border-amber-200 bg-amber-50/50"><CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-amber-950">Nenhuma conta bancária disponível</h2><p className="mt-1 text-sm text-amber-800">Cadastre uma conta do tipo Banco antes de importar um extrato.</p></div><Button onClick={() => setLocation("/financeiro?aba=contas")}><PlusCircle className="mr-2 h-4 w-4" />Criar nova conta</Button></CardContent></Card> : <>
      <Card><CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_220px]"><div className="space-y-1.5"><Label>Conta bancária</Label><SearchableEntitySelect ariaLabel="Conta bancária para conciliação" value={contaFinanceiraId} onValueChange={setContaFinanceiraId} placeholder="Pesquisar conta bancária" searchPlaceholder="Digite o nome da conta..." createLabel="Criar nova conta" onCreate={() => setLocation("/financeiro?aba=contas")} options={contasBancarias.map((conta: any) => ({ value: String(conta.id), label: conta.nome, details: "Conta bancária" }))} /></div><div className="space-y-1.5"><Label>Exibir</Label><select aria-label="Estado dos movimentos" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={estado} onChange={(evento) => setEstado(evento.target.value as "todos" | EstadoMovimento)}>{opcoesEstado.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}</select></div></CardContent></Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(resumo) as Array<[EstadoMovimento, { quantidade: number; valor: number }]>).map(([chave, dados]) => <Card key={chave} className="shadow-sm"><CardContent className="p-4"><p className="text-xs font-medium capitalize text-muted-foreground">{chave === "pendente" ? "Pendentes" : chave === "conciliado" ? "Conciliados" : chave === "divergente" ? "Divergências" : "Ignorados"}</p><p className="mt-2 text-xl font-bold tracking-tight">{formatCurrency(dados.valor)}</p><p className="mt-1 text-xs text-muted-foreground">{dados.quantidade} movimento(s)</p></CardContent></Card>)}
      </section>

      <section className="space-y-3">
        {movimentos.isLoading ? <Card><CardContent className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando movimentos bancários...</CardContent></Card> : null}
        {!movimentos.isLoading && !movimentos.data?.length ? <Card><CardContent className="p-8 text-center"><Landmark className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Nenhum movimento encontrado</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Importe um extrato para esta conta ou altere o filtro de estado.</p></CardContent></Card> : null}
        {(movimentos.data ?? []).map((movimento: any) => <Card key={movimento.id} className="overflow-hidden"><CardContent className="p-0"><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={estiloEstado[movimento.estado as EstadoMovimento]}>{movimento.estado}</Badge><span className={`text-sm font-semibold ${movimento.tipo === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>{movimento.tipo === "entrada" ? "+" : "−"}{formatCurrency(movimento.valor)}</span><span className="text-xs text-muted-foreground">{formatarData(movimento.dataMovimento)} · {movimento.contaNome}</span></div><h2 className="mt-2 break-words font-semibold text-foreground">{movimento.descricao}</h2><p className="mt-1 text-xs text-muted-foreground">Extrato: {movimento.nomeArquivo}{movimento.identificadorExterno ? ` · ID ${movimento.identificadorExterno}` : ""}</p>{movimento.estado === "conciliado" ? <p className="mt-3 text-sm text-emerald-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />Conciliado com a baixa #{movimento.baixaFinanceiraId}{movimento.baixaDescricao ? ` — ${movimento.baixaDescricao}` : ""}</p> : null}{movimento.estado === "divergente" && movimento.observacoes ? <p className="mt-3 text-sm text-rose-800">Observação: {movimento.observacoes}</p> : null}</div>
          <div className="flex shrink-0 flex-wrap gap-2">{movimento.estado === "pendente" ? <><Button size="sm" variant="outline" onClick={() => abrirNovoLancamento(movimento)}><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Criar lançamento</Button><Button size="sm" variant="outline" onClick={() => alterarEstado(movimento.id, "divergente")}><CircleAlert className="mr-1.5 h-3.5 w-3.5" />Divergência</Button><Button size="sm" variant="ghost" onClick={() => alterarEstado(movimento.id, "ignorado")}>Ignorar</Button></> : null}{movimento.estado === "conciliado" ? <Button size="sm" variant="outline" onClick={() => desfazer.mutate({ movimentoId: movimento.id }, { onSuccess: () => { toast.success("Conciliação desfeita"); invalidar(); }, onError: (erro) => toast.error(erro.message) })}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Desfazer</Button> : null}</div></div>
          {movimento.estado === "pendente" && movimento.sugestoes?.length ? <div className="border-t bg-muted/30 px-5 py-4"><div className="flex items-center gap-2 text-sm font-medium"><WandSparkles className="h-4 w-4 text-primary" />Sugestões de baixa compatível</div><div className="mt-3 grid gap-2">{movimento.sugestoes.slice(0, 3).map((sugestao: any) => <div key={sugestao.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{sugestao.descricaoTitulo}</p><p className="text-xs text-muted-foreground">{formatCurrency(sugestao.valor)} · {formatarData(sugestao.dataBaixa)} · {sugestao.motivo}</p></div><Button size="sm" onClick={() => confirmarSugestao(movimento.id, sugestao.id)} disabled={confirmar.isPending}>Conciliar</Button></div>)}</div></div> : null}
          {movimento.estado === "pendente" && movimento.sugestoesTransferencia?.length ? <div className="border-t bg-sky-50/60 px-5 py-4"><div className="flex items-center gap-2 text-sm font-medium text-sky-950"><Landmark className="h-4 w-4 text-sky-700" />Sugestões de transferência interna</div><p className="mt-1 text-xs text-sky-800">Esta ação apenas vincula os dois lados patrimoniais; não cria título, baixa, receita nem despesa.</p><div className="mt-3 grid gap-2">{movimento.sugestoesTransferencia.slice(0, 3).map((sugestao: any) => <div key={sugestao.id} className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{sugestao.descricao}</p><p className="text-xs text-muted-foreground">{formatCurrency(sugestao.valor)} · {formatarData(sugestao.dataMovimento)} · {sugestao.motivo}</p></div><Button size="sm" variant="outline" onClick={() => confirmarSugestaoTransferencia(movimento.id, sugestao.id)} disabled={confirmarTransferencia.isPending}>Conciliar transferência</Button></div>)}</div></div> : null}
        </CardContent></Card>)}
      </section>
    </>}

    <Dialog open={importacaoAberta} onOpenChange={(aberto) => { setImportacaoAberta(aberto); if (!aberto) limparImportacao(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Importar extrato bancário</DialogTitle><DialogDescription>São aceitos arquivos CSV e OFX de até 1 MB. Nenhuma baixa é criada nesta etapa: os movimentos serão apenas preparados para conciliação.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-dashed border-border bg-muted/20 p-4"><Label htmlFor="arquivo-extrato">Arquivo de extrato</Label><Input id="arquivo-extrato" className="mt-2" type="file" accept=".csv,.ofx,text/csv,application/x-ofx" onChange={(evento) => selecionarArquivo(evento.target.files?.[0] ?? null)} />{arquivo ? <p className="mt-2 text-xs text-muted-foreground">{arquivo.name} · formato {formatoArquivo.toUpperCase()}</p> : null}</div>{prepararImportacao.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validando o extrato...</p> : null}{preparo?.erros.length ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><p className="font-medium text-rose-900">Revise o arquivo antes de importar</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">{preparo.erros.slice(0, 8).map((erro, indice) => <li key={indice}>{erro}</li>)}</ul></div> : null}{preparo && !preparo.erros.length ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">{preparo.linhas.length} movimento(s) prontos para importar</p><div className="mt-3 max-h-48 space-y-1 overflow-auto text-sm text-emerald-900">{preparo.linhas.slice(0, 8).map((linha: any) => <div key={linha.numeroLinha} className="flex justify-between gap-3"><span className="truncate">{linha.dataMovimento} · {linha.descricao}</span><span className="whitespace-nowrap">{linha.tipo === "entrada" ? "+" : "−"}{formatCurrency(linha.valor)}</span></div>)}</div>{preparo.linhas.length > 8 ? <p className="mt-2 text-xs text-emerald-800">Mais {preparo.linhas.length - 8} movimento(s) serão incluídos.</p> : null}</div> : null}</div><DialogFooter><Button variant="outline" onClick={() => setImportacaoAberta(false)} disabled={importarExtrato.isPending}>Cancelar</Button><Button onClick={confirmarImportacao} disabled={!preparo || preparo.erros.length > 0 || importarExtrato.isPending}>{importarExtrato.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar movimentos</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(movimentoNovoLancamento)} onOpenChange={(aberto) => !aberto && setMovimentoNovoLancamento(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Criar lançamento a partir do extrato</DialogTitle><DialogDescription>O lançamento será criado como quitado e conciliado com este movimento bancário. Nenhuma baixa será duplicada.</DialogDescription></DialogHeader>{movimentoNovoLancamento ? <div className="space-y-4"><div className="rounded-lg bg-muted p-3 text-sm"><p className="font-medium">{movimentoNovoLancamento.descricao}</p><p className="mt-1 text-muted-foreground">{formatarData(movimentoNovoLancamento.dataMovimento)} · {formatCurrency(movimentoNovoLancamento.valor)}</p></div><div className="space-y-1.5"><Label>Categoria financeira</Label><SearchableEntitySelect ariaLabel="Categoria do lançamento bancário" value={categoriaId} onValueChange={setCategoriaId} placeholder="Pesquisar categoria" searchPlaceholder="Digite a categoria..." createLabel="Criar nova categoria" onCreate={() => setLocation("/financeiro?aba=categorias")} options={(categorias.data ?? []).filter(categoriaCompativel).map((categoria: any) => ({ value: String(categoria.id), label: categoria.nome, details: categoria.tipo === "receita" ? "Receita" : categoria.tipo === "despesa" ? "Despesa" : "Ambos" }))} /></div><div className="space-y-1.5"><Label htmlFor="descricao-lancamento-bancario">Descrição</Label><Input id="descricao-lancamento-bancario" value={descricaoNovoLancamento} onChange={(evento) => setDescricaoNovoLancamento(evento.target.value)} /></div></div> : null}<DialogFooter><Button variant="outline" onClick={() => setMovimentoNovoLancamento(null)} disabled={criarLancamento.isPending}>Cancelar</Button><Button onClick={salvarNovoLancamento} disabled={criarLancamento.isPending}>{criarLancamento.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar e conciliar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
