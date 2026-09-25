import { useState } from "react";
import { CircleDollarSign, Droplets, Fuel, Loader2, Plus, ReceiptText, Trash2, Truck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import { trpc } from "@/lib/trpc";

const numero = (valor: string | number | null | undefined) => Number(String(valor ?? 0).replace(",", ".")) || 0;
const dinheiro = (valor: string | number | null | undefined) => numero(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const litros = (valor: string | number | null | undefined) => `${numero(valor).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} L`;
const dataHoje = () => new Date().toLocaleDateString("en-CA");
const dataBrasil = (valor: Date | string) => new Date(valor).toLocaleDateString("pt-BR");

const novaNotaPadrao = () => ({ numeroNota: "", fornecedorId: "", litros: "", valorTotal: "", dataNota: dataHoje(), dataVencimento: dataHoje(), observacoes: "" });
const novoAbastecimentoPadrao = () => ({ destino: "", responsavel: "", litros: "", dataAbastecimento: dataHoje(), observacoes: "" });

function EstadoTitulo({ estado }: { estado?: string }) {
  const estilo = estado === "pago" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : estado === "vencido" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800";
  const texto = estado === "pago" ? "Pago" : estado === "vencido" ? "Vencido" : estado === "cancelado" ? "Cancelado" : "Agendado";
  return <Badge variant="outline" className={estilo}>{texto}</Badge>;
}

export default function DieselPage() {
  const utils = trpc.useUtils();
  const [notaAberta, setNotaAberta] = useState(false);
  const [abastecimentoAberto, setAbastecimentoAberto] = useState(false);
  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [notaParaExcluir, setNotaParaExcluir] = useState<{ id: number; numeroNota: string | null } | null>(null);
  const [nomeNovoFornecedor, setNomeNovoFornecedor] = useState("");
  const [nota, setNota] = useState(novaNotaPadrao);
  const [abastecimento, setAbastecimento] = useState(novoAbastecimentoPadrao);
  const resumo = trpc.diesel.resumo.useQuery();
  const fornecedores = trpc.financeiro.fornecedores.list.useQuery();
  const criarNota = trpc.diesel.criarNota.useMutation();
  const registrarAbastecimento = trpc.diesel.registrarAbastecimento.useMutation();
  const excluirNota = trpc.diesel.excluirNota.useMutation();
  const criarFornecedor = trpc.financeiro.fornecedores.create.useMutation();

  const salvarNota = () => {
    if (!nota.fornecedorId) return toast.error("Selecione o fornecedor da nota de diesel.");
    criarNota.mutate({ ...nota, fornecedorId: Number(nota.fornecedorId), numeroNota: nota.numeroNota || null, observacoes: nota.observacoes || null }, {
      onSuccess: () => { toast.success("Nota registada e conta a pagar agendada."); setNotaAberta(false); setNota(novaNotaPadrao()); utils.diesel.resumo.invalidate(); },
      onError: (erro) => toast.error(erro.message),
    });
  };
  const salvarAbastecimento = () => {
    registrarAbastecimento.mutate({ ...abastecimento, responsavel: abastecimento.responsavel || null, observacoes: abastecimento.observacoes || null }, {
      onSuccess: (resultado) => { toast.success(`Abastecimento registado: ${litros(resultado.litros)} · custo ${dinheiro(resultado.custoTotal)}.`); setAbastecimentoAberto(false); setAbastecimento(novoAbastecimentoPadrao()); utils.diesel.resumo.invalidate(); },
      onError: (erro) => toast.error(erro.message),
    });
  };
  const salvarNovoFornecedor = () => {
    const nome = nomeNovoFornecedor.trim();
    if (nome.length < 2) { toast.error("Informe o nome do fornecedor."); return; }
    criarFornecedor.mutate({ nome }, {
      onSuccess: (fornecedor) => {
        toast.success("Fornecedor criado e selecionado.");
        setNota((atual) => ({ ...atual, fornecedorId: String(fornecedor.id) }));
        setNomeNovoFornecedor("");
        setNovoFornecedorAberto(false);
        utils.financeiro.fornecedores.list.invalidate();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };
  const confirmarExclusaoNota = () => {
    if (!notaParaExcluir) return;
    excluirNota.mutate({ id: notaParaExcluir.id }, {
      onSuccess: () => {
        toast.success("Nota de diesel removida do tanque e o lembrete financeiro foi cancelado.");
        setNotaParaExcluir(null);
        utils.diesel.resumo.invalidate();
      },
      onError: (erro) => toast.error(erro.message),
    });
  };
  const dados = resumo.data;
  const possuiAbastecimentos = Boolean(dados?.abastecimentos?.length);

  return <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-1.5"><div className="flex items-center gap-2 text-primary"><Fuel className="size-5" /><span className="text-sm font-semibold">Tanque de combustível</span></div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Diesel, notas e abastecimentos</h1><p className="max-w-3xl text-sm leading-6 text-muted-foreground">A nota agenda o pagamento no Financeiro e adiciona litros ao tanque. O custo operacional só é apropriado quando o diesel é efetivamente abastecido.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => setNotaAberta(true)}><ReceiptText className="mr-2 size-4" />Nova nota de diesel</Button><Button onClick={() => setAbastecimentoAberto(true)} disabled={(dados?.saldoLitros ?? 0) <= 0}><Plus className="mr-2 size-4" />Registrar abastecimento</Button></div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo no tanque</p><p className="mt-1 text-2xl font-bold">{litros(dados?.saldoLitros)}</p><p className="text-xs text-muted-foreground">disponível para abastecer</p></div><Droplets className="size-8 text-sky-600" /></CardContent></Card>
      <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custo médio</p><p className="mt-1 text-2xl font-bold">{dinheiro(dados?.custoMedioLitro)}</p><p className="text-xs text-muted-foreground">por litro no tanque</p></div><CircleDollarSign className="size-8 text-emerald-600" /></CardContent></Card>
      <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor no tanque</p><p className="mt-1 text-2xl font-bold">{dinheiro(dados?.valorEstoque)}</p><p className="text-xs text-muted-foreground">diesel ainda não apropriado</p></div><Fuel className="size-8 text-amber-600" /></CardContent></Card>
      <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custo apropriado</p><p className="mt-1 text-2xl font-bold">{dinheiro(dados?.custoApropriado)}</p><p className="text-xs text-muted-foreground">nos abastecimentos</p></div><Truck className="size-8 text-violet-600" /></CardContent></Card>
    </div>

    <Card className="border-sky-100 bg-sky-50/40"><CardContent className="p-5 text-sm leading-6 text-sky-950"><strong>Como funciona:</strong> a conta a pagar criada pela nota é apenas o compromisso de pagamento com o fornecedor. O custo de operação é calculado pelo <strong>custo médio do tanque</strong> no momento de cada abastecimento, evitando duplicidade de custo.</CardContent></Card>

    <section className="grid gap-6 xl:grid-cols-[1.18fr_1fr]">
      <Card className="min-w-0"><CardContent className="p-0"><div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Notas e pagamentos agendados</h2><p className="mt-1 text-sm text-muted-foreground">Entradas de diesel que geram lembrete no Contas a pagar.</p></div><Button size="sm" variant="outline" onClick={() => setNotaAberta(true)}>Adicionar nota</Button></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nota / fornecedor</TableHead><TableHead>Litros</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{resumo.isLoading ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow> : dados?.notas?.length ? dados.notas.map((item: any) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.numeroNota ? `Nota ${item.numeroNota}` : "Nota sem número"}</p><p className="text-xs text-muted-foreground">{item.fornecedorNome}</p></TableCell><TableCell>{litros(item.litros)}</TableCell><TableCell>{dinheiro(item.valorTotal)}</TableCell><TableCell className="whitespace-nowrap">{dataBrasil(item.dataVencimento)}</TableCell><TableCell><EstadoTitulo estado={item.titulo?.estado} /></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Excluir nota ${item.numeroNota ?? item.id}`} title={possuiAbastecimentos ? "A exclusão é bloqueada após registrar abastecimentos." : "Excluir nota de diesel"} disabled={possuiAbastecimentos} onClick={() => setNotaParaExcluir({ id: item.id, numeroNota: item.numeroNota })}><Trash2 className="size-4" /><span className="sr-only">Excluir nota</span></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">Nenhuma nota de diesel registada.</TableCell></TableRow>}</TableBody></Table></div><p className="px-5 pb-5 text-xs leading-5 text-muted-foreground">A exclusão remove os litros do tanque e cancela o lembrete financeiro. Após registrar qualquer abastecimento, as notas ficam bloqueadas para preservar o saldo e o custo médio.</p></CardContent></Card>
      <Card className="min-w-0"><CardContent className="p-0"><div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Abastecimentos e custo real</h2><p className="mt-1 text-sm text-muted-foreground">O custo é apropriado somente na saída do tanque.</p></div><Button size="sm" onClick={() => setAbastecimentoAberto(true)} disabled={(dados?.saldoLitros ?? 0) <= 0}>Abastecer</Button></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data / destino</TableHead><TableHead>Litros</TableHead><TableHead>R$/L</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader><TableBody>{resumo.isLoading ? <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow> : dados?.abastecimentos?.length ? dados.abastecimentos.map((item: any) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.destino}</p><p className="text-xs text-muted-foreground">{dataBrasil(item.dataAbastecimento)}{item.responsavel ? ` · ${item.responsavel}` : ""}</p></TableCell><TableCell>{litros(item.litros)}</TableCell><TableCell>{dinheiro(item.custoUnitario)}</TableCell><TableCell className="text-right font-medium">{dinheiro(item.custoTotal)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-sm text-muted-foreground">Registe uma nota para abastecer o tanque.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    </section>

    <Dialog open={notaAberta} onOpenChange={setNotaAberta}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Nova nota de diesel</DialogTitle><DialogDescription>Será criada uma conta a pagar agendada, sem lançar custo operacional neste momento.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Campo label="Número da nota"><Input value={nota.numeroNota} onChange={(evento) => setNota((atual) => ({ ...atual, numeroNota: evento.target.value }))} placeholder="Ex.: 12345" /></Campo><div className="space-y-1.5"><Label>Fornecedor *</Label><SearchableEntitySelect ariaLabel="Fornecedor da nota de diesel" value={nota.fornecedorId} onValueChange={(fornecedorId) => setNota((atual) => ({ ...atual, fornecedorId }))} placeholder="Pesquisar ou selecionar fornecedor" searchPlaceholder="Digite o nome do fornecedor..." createLabel="Criar novo fornecedor" onCreate={() => setNovoFornecedorAberto(true)} options={(fornecedores.data ?? []).map((item: any) => ({ value: String(item.id), label: item.nome, details: item.contacto ?? item.email ?? null }))} /></div><Campo label="Litros recebidos *"><Input inputMode="decimal" value={nota.litros} onChange={(evento) => setNota((atual) => ({ ...atual, litros: evento.target.value }))} placeholder="Ex.: 1.000" /></Campo><Campo label="Valor total (R$) *"><Input inputMode="decimal" value={nota.valorTotal} onChange={(evento) => setNota((atual) => ({ ...atual, valorTotal: evento.target.value }))} placeholder="Ex.: 6.500,00" /></Campo><Campo label="Data da nota *"><Input type="date" value={nota.dataNota} onChange={(evento) => setNota((atual) => ({ ...atual, dataNota: evento.target.value }))} /></Campo><Campo label="Vencimento *"><Input type="date" value={nota.dataVencimento} onChange={(evento) => setNota((atual) => ({ ...atual, dataVencimento: evento.target.value }))} /></Campo><div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={nota.observacoes} onChange={(evento) => setNota((atual) => ({ ...atual, observacoes: evento.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setNotaAberta(false)} disabled={criarNota.isPending}>Cancelar</Button><Button onClick={salvarNota} disabled={criarNota.isPending}>{criarNota.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Agendar pagamento e adicionar ao tanque</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={novoFornecedorAberto} onOpenChange={setNovoFornecedorAberto}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Criar novo fornecedor</DialogTitle><DialogDescription>O fornecedor será cadastrado e selecionado nesta nota de diesel.</DialogDescription></DialogHeader><Campo label="Nome do fornecedor *"><Input autoFocus value={nomeNovoFornecedor} onChange={(evento) => setNomeNovoFornecedor(evento.target.value)} placeholder="Ex.: Posto Central" onKeyDown={(evento) => { if (evento.key === "Enter") salvarNovoFornecedor(); }} /></Campo><DialogFooter><Button variant="outline" onClick={() => setNovoFornecedorAberto(false)} disabled={criarFornecedor.isPending}>Cancelar</Button><Button onClick={salvarNovoFornecedor} disabled={criarFornecedor.isPending}>{criarFornecedor.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Criar e selecionar</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={abastecimentoAberto} onOpenChange={setAbastecimentoAberto}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Registrar abastecimento</DialogTitle><DialogDescription>O sistema aplicará o custo médio atual de {dinheiro(dados?.custoMedioLitro)} por litro, sem criar nova conta a pagar.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Campo label="Destino / equipamento *"><Input value={abastecimento.destino} onChange={(evento) => setAbastecimento((atual) => ({ ...atual, destino: evento.target.value }))} placeholder="Ex.: Carregadeira" /></Campo><Campo label="Responsável"><Input value={abastecimento.responsavel} onChange={(evento) => setAbastecimento((atual) => ({ ...atual, responsavel: evento.target.value }))} placeholder="Quem abasteceu" /></Campo><Campo label="Litros abastecidos *"><Input inputMode="decimal" value={abastecimento.litros} onChange={(evento) => setAbastecimento((atual) => ({ ...atual, litros: evento.target.value }))} placeholder={`Disponível: ${litros(dados?.saldoLitros)}`} /></Campo><Campo label="Data *"><Input type="date" value={abastecimento.dataAbastecimento} onChange={(evento) => setAbastecimento((atual) => ({ ...atual, dataAbastecimento: evento.target.value }))} /></Campo><div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={abastecimento.observacoes} onChange={(evento) => setAbastecimento((atual) => ({ ...atual, observacoes: evento.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAbastecimentoAberto(false)} disabled={registrarAbastecimento.isPending}>Cancelar</Button><Button onClick={salvarAbastecimento} disabled={registrarAbastecimento.isPending}>{registrarAbastecimento.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Confirmar abastecimento</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={Boolean(notaParaExcluir)} onOpenChange={(aberto) => { if (!aberto) setNotaParaExcluir(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta nota de diesel?</AlertDialogTitle><AlertDialogDescription>Os litros serão removidos do tanque e o lembrete financeiro será cancelado. Esta ação só é permitida enquanto não houver abastecimentos registrados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={excluirNota.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmarExclusaoNota} disabled={excluirNota.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{excluirNota.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Excluir nota</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
