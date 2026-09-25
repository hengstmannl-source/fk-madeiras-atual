import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Eye, Trash2, Loader2, Send, CheckCircle2, XCircle, Clock, Copy, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

const estadosOrcamento = ["rascunho", "enviado", "aprovado", "rejeitado"] as const;
type EstadoOrcamento = (typeof estadosOrcamento)[number];

function isEstadoOrcamento(valor: string): valor is EstadoOrcamento {
  return estadosOrcamento.some((estado) => estado === valor);
}

const estadoColors: Record<EstadoOrcamento, string> = {
  rascunho: "bg-stone-100 text-stone-600 border-stone-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-50 text-red-700 border-red-200",
};

const estadoIcons: Record<EstadoOrcamento, LucideIcon> = { rascunho: Clock, enviado: Send, aprovado: CheckCircle2, rejeitado: XCircle };

export default function OrcamentosPage() {
  const [filterEstado, setFilterEstado] = useState<"todos" | EstadoOrcamento>("todos");
  const orcamentos = trpc.orcamento.list.useQuery(filterEstado !== "todos" ? { estado: filterEstado } : undefined);
  const updateEstado = trpc.orcamento.updateEstado.useMutation();
  const remove = trpc.orcamento.delete.useMutation();
  const duplicate = trpc.orcamento.duplicate.useMutation();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const clientes = trpc.cliente.list.useQuery();
  const clienteMap = useMemo(() => {
    const map = new Map<number, string>();
    clientes.data?.forEach(c => map.set(c.id, c.nome));
    return map;
  }, [clientes.data]);

  const handleEstado = (id: number, estado: EstadoOrcamento) => {
    updateEstado.mutate({ id, estado }, {
      onSuccess: () => { toast.success(`Estado atualizado para "${estado}"`); utils.orcamento.list.invalidate(); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDelete = (orcamento: { id: number; pago: boolean }) => {
    if (!confirm("Excluir esta venda?")) return;
    if (orcamento.pago && !confirm("Esta venda está quitada e bloqueada. Confirma novamente que deseja excluí-la?")) return;
    remove.mutate({ id: orcamento.id, confirmacaoDupla: orcamento.pago }, { onSuccess: () => { toast.success("Venda excluída"); utils.orcamento.list.invalidate(); }, onError: (err) => toast.error(err.message) });
  };

  const handleDuplicate = (id: number) => {
    duplicate.mutate({ id }, {
      onSuccess: (data: any) => { toast.success("Venda duplicada"); utils.orcamento.list.invalidate(); if (data?.id) setLocation(`/orcamentos/${data.id}`); },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={FileText}
        eyebrow="Comercial"
        title="Vendas"
        description="Acompanhe pedidos de madeira serrada, seus estados e a evolução comercial."
        actions={<Button onClick={() => setLocation("/orcamentos/novo")} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Nova venda</Button>}
      />

      <div className="fk-panel flex items-center gap-3 p-3">
        <Select value={filterEstado} onValueChange={(valor) => {
          if (valor === "todos" || isEstadoOrcamento(valor)) setFilterEstado(valor);
        }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os estados" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="fk-panel overflow-hidden">
        {orcamentos.isLoading ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        : orcamentos.data && orcamentos.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Nº Venda</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="font-semibold">Total</TableHead>
                <TableHead className="font-semibold">Peças</TableHead>
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentos.data.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-primary">{o.numero ?? "Aguardando aprovação"}</TableCell>
                  <TableCell>{clienteMap.get(o.clienteId) || "—"}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Badge variant="outline" className={`text-xs ${estadoColors[o.estado] ?? ""}`}>{o.estado}</Badge>{o.pago && <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">pago</Badge>}</div></TableCell>
                  <TableCell className="font-semibold">{formatCurrency(o.total)}</TableCell>
                  <TableCell>{o.totalPecas}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("pt-PT")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation(`/orcamentos/${o.id}`)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(o.id)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(o)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma venda encontrada</p></div>
        )}
      </div>
    </div>
  );
}
