import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export default function MadeirasPage() {
  const madeiras = trpc.madeira.list.useQuery();
  const create = trpc.madeira.create.useMutation();
  const update = trpc.madeira.update.useMutation();
  const remove = trpc.madeira.delete.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", precoM3: "", unidadeMedida: "m³" });

  const handleSubmit = () => {
    if (!form.nome || !form.precoM3) { toast.error("Preencha os campos obrigatórios"); return; }
    if (editId) {
      update.mutate({ id: editId, ...form }, {
        onSuccess: () => {
          toast.success("Madeira atualizada");
          utils.madeira.list.invalidate();
          setOpen(false);
          setForm({ nome: "", descricao: "", precoM3: "", unidadeMedida: "m³" });
          setEditId(null);
        },
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      create.mutate(form, {
        onSuccess: () => {
          toast.success("Madeira criada");
          utils.madeira.list.invalidate();
          setOpen(false);
          setForm({ nome: "", descricao: "", precoM3: "", unidadeMedida: "m³" });
        },
        onError: (err: any) => toast.error(err.message),
      });
    }
  };

  const handleEdit = (m: any) => {
    setEditId(m.id);
    setForm({ nome: m.nome, descricao: m.descricao || "", precoM3: m.precoM3, unidadeMedida: m.unidadeMedida || "m³" });
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminar esta madeira?")) return;
    remove.mutate({ id }, {
      onSuccess: () => { toast.success("Madeira eliminada"); utils.madeira.list.invalidate(); },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Madeiras</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de tipos de madeira serrada</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ nome: "", descricao: "", precoM3: "", unidadeMedida: "m³" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />Nova Madeira
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Madeira</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} placeholder="Ex: Pinho Silvestre" className="bg-white" /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} placeholder="Descrição opcional" className="bg-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Preço/m³ *</Label><Input type="number" step="0.01" value={form.precoM3} onChange={(e) => setForm({...form, precoM3: e.target.value})} placeholder="800.00" className="bg-white" /></div>
                <div className="space-y-2"><Label>Unidade</Label><Input value={form.unidadeMedida} onChange={(e) => setForm({...form, unidadeMedida: e.target.value})} placeholder="m³" className="bg-white" /></div>
              </div>
              <Button onClick={handleSubmit} disabled={create.isPending || update.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {create.isPending || update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">
        {madeiras.isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        ) : madeiras.data && madeiras.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="font-semibold">Preço/m³</TableHead>
                <TableHead className="font-semibold">Unidade</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {madeiras.data.filter(m => m.ativo).map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{m.descricao || "—"}</TableCell>
                  <TableCell>{formatCurrency(m.precoM3)}</TableCell>
                  <TableCell><Badge variant="outline">{m.unidadeMedida}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={m.ativo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-stone-100 text-stone-500 border-stone-200"}>{m.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma madeira cadastrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
