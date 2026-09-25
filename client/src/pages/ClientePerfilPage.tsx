import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CalendarDays, CircleDollarSign, FileText, Loader2, Mail, MapPin, Phone, ReceiptText, ShoppingCart, UserRound } from "lucide-react";

const dinheiro = (valor: number | string | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor ?? 0));
const data = (valor: Date | string | null | undefined) => valor ? new Date(valor).toLocaleDateString("pt-BR") : "—";

const estadoPedido: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", rejeitado: "Rejeitado" };
const classePedido: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700", enviado: "bg-blue-100 text-blue-700", aprovado: "bg-emerald-100 text-emerald-700", rejeitado: "bg-rose-100 text-rose-700",
};
const classeTitulo: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-700", parcial: "bg-amber-100 text-amber-800", vencido: "bg-rose-100 text-rose-700",
};

function StatusPedido({ pedido }: { pedido: { estado: string; pago: boolean | number; entregue: boolean | number } }) {
  return <div className="flex flex-wrap gap-1">
    <Badge className={classePedido[pedido.estado] ?? "bg-muted text-muted-foreground"}>{estadoPedido[pedido.estado] ?? pedido.estado}</Badge>
    {Boolean(pedido.pago) && <Badge variant="outline" className="border-emerald-200 text-emerald-700">Pago</Badge>}
    {Boolean(pedido.entregue) && <Badge variant="outline" className="border-violet-200 text-violet-700">Entregue</Badge>}
  </div>;
}

function TabelaPedidos({ pedidos, vazio }: { pedidos: any[]; vazio: string }) {
  if (!pedidos.length) return <div className="py-10 text-center text-sm text-muted-foreground"><ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-35" />{vazio}</div>;
  return <div className="overflow-x-auto"><Table>
    <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Data</TableHead><TableHead>Vencimento</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
    <TableBody>{pedidos.map((pedido) => <TableRow key={pedido.id}>
      <TableCell><Link href={`/orcamentos/${pedido.id}`} className="font-medium text-primary hover:underline">{pedido.numero || `Pedido #${pedido.id}`}</Link></TableCell>
      <TableCell>{data(pedido.createdAt)}</TableCell><TableCell>{data(pedido.dataVencimento)}</TableCell>
      <TableCell><StatusPedido pedido={pedido} /></TableCell><TableCell className="text-right font-medium">{dinheiro(pedido.total)}</TableCell>
    </TableRow>)}</TableBody>
  </Table></div>;
}

export default function ClientePerfilPage() {
  const [, parametros] = useRoute("/clientes/:id");
  const clienteId = Number(parametros?.id);
  const perfil = trpc.cliente.perfil.useQuery({ id: clienteId }, { enabled: Number.isInteger(clienteId) && clienteId > 0 });

  if (perfil.isLoading) return <div className="flex min-h-72 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando cadastro do cliente...</div>;
  if (perfil.isError || !perfil.data) return <div className="mx-auto max-w-2xl space-y-4 py-12 text-center"><UserRound className="mx-auto h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-semibold">Cliente não encontrado</h1><p className="text-sm text-muted-foreground">O cadastro solicitado não está disponível nesta empresa.</p><Button asChild variant="outline"><Link href="/clientes"><ArrowLeft className="mr-2 h-4 w-4" />Voltar aos clientes</Link></Button></div>;

  const { cliente, resumo, ultimosPedidos, historicoPedidos, titulosAbertos } = perfil.data;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link href="/clientes"><ArrowLeft className="mr-2 h-4 w-4" />Clientes</Link></Button><h1 className="text-2xl font-bold tracking-tight">Cadastro do cliente</h1><p className="mt-1 text-sm text-muted-foreground">Visão comercial e financeira consolidada.</p></div>
      <Button asChild variant="outline"><Link href={`/orcamentos/novo?clienteId=${cliente.id}`}><ShoppingCart className="mr-2 h-4 w-4" />Nova venda</Link></Button>
    </div>

    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card"><CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_2fr]">
      <div className="space-y-2"><div className="flex items-center gap-2"><div className="rounded-full bg-primary/10 p-2 text-primary"><UserRound className="h-5 w-5" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</p><h2 className="text-xl font-bold">{cliente.nome}</h2></div></div>{cliente.nif && <p className="pt-1 text-sm text-muted-foreground">CPF/CNPJ: {cliente.nif}</p>}</div>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3"><p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-primary" />{cliente.contacto || "Telefone não informado"}</p><p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" />{cliente.email || "E-mail não informado"}</p><p className="flex items-center gap-2 text-sm sm:col-span-2 xl:col-span-1"><MapPin className="h-4 w-4 shrink-0 text-primary" />{cliente.morada || "Endereço não informado"}</p>{cliente.observacoes && <p className="col-span-full text-sm text-muted-foreground">Observações: {cliente.observacoes}</p>}</div>
    </CardContent></Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700"><CircleDollarSign className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Total comprado</p><p className="text-lg font-bold">{dinheiro(resumo.totalComprado)}</p><p className="text-xs text-muted-foreground">{resumo.pedidosConfirmados} pedido(s) aprovado(s)</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-lg bg-sky-100 p-2.5 text-sky-700"><ShoppingCart className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Pedidos registrados</p><p className="text-lg font-bold">{resumo.pedidosRegistrados}</p><p className="text-xs text-muted-foreground">Histórico comercial</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-lg bg-amber-100 p-2.5 text-amber-800"><ReceiptText className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Em aberto</p><p className="text-lg font-bold">{dinheiro(resumo.totalEmAberto)}</p><p className="text-xs text-muted-foreground">Saldo a receber</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-lg bg-violet-100 p-2.5 text-violet-700"><FileText className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Títulos em aberto</p><p className="text-lg font-bold">{resumo.titulosEmAberto}</p><p className="text-xs text-muted-foreground">Contas a receber</p></div></CardContent></Card>
    </div>

    <Tabs defaultValue="ultimos" className="space-y-4"><TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1"><TabsTrigger value="ultimos">Últimos pedidos</TabsTrigger><TabsTrigger value="titulos">Títulos em aberto ({resumo.titulosEmAberto})</TabsTrigger><TabsTrigger value="historico">Histórico de pedidos ({resumo.pedidosRegistrados})</TabsTrigger></TabsList>
      <TabsContent value="ultimos"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" />Últimos pedidos</CardTitle></CardHeader><CardContent><TabelaPedidos pedidos={ultimosPedidos} vazio="Ainda não há pedidos para este cliente." /></CardContent></Card></TabsContent>
      <TabsContent value="titulos"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-primary" />Títulos a receber em aberto</CardTitle></CardHeader><CardContent>{titulosAbertos.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Origem</TableHead><TableHead>Vencimento</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Saldo aberto</TableHead></TableRow></TableHeader><TableBody>{titulosAbertos.map((titulo) => <TableRow key={titulo.id}><TableCell className="font-medium">{titulo.descricao}</TableCell><TableCell className="capitalize">{titulo.origem.replaceAll("_", " ")}</TableCell><TableCell>{data(titulo.dataVencimento)}</TableCell><TableCell><Badge className={classeTitulo[titulo.estado] ?? "bg-muted text-muted-foreground"}>{titulo.estado}</Badge></TableCell><TableCell className="text-right font-medium">{dinheiro(titulo.saldoAberto)}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="py-10 text-center text-sm text-muted-foreground"><ReceiptText className="mx-auto mb-2 h-8 w-8 opacity-35" />Não há títulos em aberto para este cliente.</div>}</CardContent></Card></TabsContent>
      <TabsContent value="historico"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Histórico completo de pedidos</CardTitle></CardHeader><CardContent><TabelaPedidos pedidos={historicoPedidos} vazio="Ainda não há pedidos registrados para este cliente." /></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}
