import { useState } from "react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Loader2, Mail, Phone, MapPin, FileSpreadsheet, Upload, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";

type LinhaImportacao = { linha: number; nome: string; contacto: string; email: string; morada: string; nif: string; observacoes: string };
const valorPlanilha = (linha: Record<string, unknown>, ...nomes: string[]) => {
  const chave = Object.keys(linha).find(atual => nomes.includes(atual.trim().toLocaleLowerCase("pt-BR")));
  return chave ? String(linha[chave] ?? "").trim() : "";
};

export default function ClientesPage() {
  const clientes = trpc.cliente.list.useQuery();
  const create = trpc.cliente.create.useMutation();
  const update = trpc.cliente.update.useMutation();
  const remove = trpc.cliente.delete.useMutation();
  const previsualizarImportacao = trpc.cliente.previsualizarImportacao.useMutation();
  const importarClientes = trpc.cliente.importar.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [linhasImportacao, setLinhasImportacao] = useState<LinhaImportacao[]>([]);
  const [previsaoImportacao, setPrevisaoImportacao] = useState<any>(null);

  const baixarModelo = () => {
    const csv = "Nome;Telefone;Email;CPF/CNPJ;Endereço;Observações\nCliente Exemplo;(65) 99999-0000;cliente@exemplo.com;000.000.000-00;Cidade - UF;Observação opcional\n";
    const arquivo = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url; link.download = "modelo-importacao-clientes.csv"; link.click();
    URL.revokeObjectURL(url);
  };
  const lerPlanilha = async (arquivo?: File) => {
    if (!arquivo) return;
    try {
      const livro = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const planilha = livro.Sheets[livro.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, { defval: "" });
      const linhas = dados.map((registro, indice) => ({
        linha: indice + 2,
        nome: valorPlanilha(registro, "nome", "cliente", "razão social", "razao social"),
        contacto: valorPlanilha(registro, "telefone", "contato", "contacto", "celular"),
        email: valorPlanilha(registro, "email", "e-mail"),
        nif: valorPlanilha(registro, "cpf/cnpj", "cpf", "cnpj", "nif", "documento"),
        morada: valorPlanilha(registro, "endereço", "endereco", "morada"),
        observacoes: valorPlanilha(registro, "observações", "observacoes", "observação", "observacao"),
      })).filter(linha => Object.values(linha).some(valor => String(valor).trim() && valor !== linha.linha));
      if (!linhas.length) { toast.error("A planilha não possui linhas de clientes"); return; }
      setLinhasImportacao(linhas);
      previsualizarImportacao.mutate({ linhas }, { onSuccess: setPrevisaoImportacao, onError: erro => toast.error(erro.message) });
    } catch {
      toast.error("Não foi possível ler a planilha. Use Excel (.xlsx) ou CSV.");
    }
  };
  const confirmarImportacao = () => importarClientes.mutate({ linhas: linhasImportacao }, {
    onSuccess: resultado => {
      toast.success(`${resultado.importadas} cliente(s) importado(s)${resultado.ignoradas ? `; ${resultado.ignoradas} linha(s) ignorada(s)` : ""}`);
      utils.cliente.list.invalidate(); setImportOpen(false); setLinhasImportacao([]); setPrevisaoImportacao(null);
    },
    onError: erro => toast.error(erro.message),
  });

  const handleSubmit = () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    if (editId) {
      update.mutate({ id: editId, ...form }, {
        onSuccess: () => { toast.success("Cliente atualizado"); utils.cliente.list.invalidate(); setOpen(false); setEditId(null); setForm({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); },
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      create.mutate(form, {
        onSuccess: () => { toast.success("Cliente criado"); utils.cliente.list.invalidate(); setOpen(false); },
        onError: (err: any) => toast.error(err.message),
      });
    }
  };

  const handleEdit = (c: any) => {
    setEditId(c.id); setForm({ nome: c.nome, contacto: c.contacto || "", email: c.email || "", morada: c.morada || "", nif: c.nif || "", observacoes: c.observacoes || "" }); setOpen(true);
  };
  const handleDelete = (id: number) => {
    if (!confirm("Eliminar este cliente?")) return;
    remove.mutate({ id }, { onSuccess: () => { toast.success("Cliente eliminado"); utils.cliente.list.invalidate(); }, onError: (err) => toast.error(err.message) });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={Users}
        eyebrow="Gestão comercial"
        title="Clientes"
        description="Centralize cadastros, contatos e o histórico comercial de cada cliente."
        actions={<div className="flex items-center gap-2">
        <Dialog open={importOpen} onOpenChange={(aberto) => { setImportOpen(aberto); if (!aberto) { setLinhasImportacao([]); setPrevisaoImportacao(null); } }}>
          <DialogTrigger asChild><Button variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" />Importar planilha</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>Importar clientes por planilha</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Aceita arquivos Excel ou CSV com as colunas Nome, Telefone, E-mail, CPF/CNPJ, Endereço e Observações. A prévia bloqueia duplicidades por nome, telefone, e-mail e CPF/CNPJ.</p>
              <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={baixarModelo}><Download className="mr-2 h-4 w-4" />Baixar modelo CSV</Button><Label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm font-medium hover:bg-muted"><Upload className="h-4 w-4" />Selecionar planilha<Input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={evento => lerPlanilha(evento.target.files?.[0])} /></Label></div>
              {previsualizarImportacao.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validando planilha...</div>}
              {previsaoImportacao && <><div className="grid grid-cols-3 gap-2"><div className="rounded-md bg-muted p-2 text-center text-sm"><strong>{previsaoImportacao.resumo.total}</strong><br />linhas</div><div className="rounded-md bg-emerald-50 p-2 text-center text-sm text-emerald-800"><strong>{previsaoImportacao.resumo.aptas}</strong><br />aptas</div><div className="rounded-md bg-amber-50 p-2 text-center text-sm text-amber-800"><strong>{previsaoImportacao.resumo.recusadas}</strong><br />recusadas</div></div><div className="max-h-64 overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Cliente</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader><TableBody>{previsaoImportacao.linhas.map((linha: any) => <TableRow key={linha.linha}><TableCell>{linha.linha}</TableCell><TableCell>{linha.nome || "—"}</TableCell><TableCell>{linha.apta ? <span className="text-emerald-700">Apta</span> : <span className="flex gap-1 text-amber-700"><AlertTriangle className="h-4 w-4 shrink-0" />{linha.motivos.join("; ")}</span>}</TableCell></TableRow>)}</TableBody></Table></div><Button className="w-full" disabled={!previsaoImportacao.resumo.aptas || importarClientes.isPending} onClick={confirmarImportacao}>{importarClientes.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar {previsaoImportacao.resumo.aptas} cliente(s) apto(s)</Button></>}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ nome: "", contacto: "", email: "", morada: "", nif: "", observacoes: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} placeholder="Nome completo" className="bg-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto} onChange={(e) => setForm({...form, contacto: e.target.value})} placeholder="+351 ..." className="bg-white" /></div>
                <div className="space-y-2"><Label>NIF</Label><Input value={form.nif} onChange={(e) => setForm({...form, nif: e.target.value})} placeholder="NIF" className="bg-white" /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="email@exemplo.pt" className="bg-white" /></div>
              <div className="space-y-2"><Label>Morada</Label><Input value={form.morada} onChange={(e) => setForm({...form, morada: e.target.value})} placeholder="Morada completa" className="bg-white" /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} placeholder="Notas adicionais" className="bg-white" rows={2} /></div>
              <Button onClick={handleSubmit} disabled={create.isPending || update.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">{create.isPending || update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editId ? "Atualizar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>}
      />

      <div className="fk-panel overflow-hidden">
        {clientes.isLoading ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>
        : clientes.data && clientes.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Contacto</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">NIF</TableHead>
                <TableHead className="font-semibold">Morada</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.data.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell><Link href={`/clientes/${c.id}`} className="font-medium text-primary transition-colors hover:text-primary/80 hover:underline">{c.nome}</Link></TableCell>
                  <TableCell><span className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3 w-3" />{c.contacto || "—"}</span></TableCell>
                  <TableCell><span className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3 w-3" />{c.email || "—"}</span></TableCell>
                  <TableCell>{c.nif || "—"}</TableCell>
                  <TableCell><span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate max-w-[150px]">{c.morada || "—"}</span></span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum cliente cadastrado</p></div>
        )}
      </div>
    </div>
  );
}
