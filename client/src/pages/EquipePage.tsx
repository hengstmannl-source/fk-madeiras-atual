import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Clipboard, Link2, MailPlus, ShieldCheck, UserRoundPlus, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const papeis = [
  { value: "administrador", label: "Administrador", descricao: "Administra a equipa e opera todos os módulos." },
  { value: "financeiro", label: "Financeiro", descricao: "Controla contas, pagamentos e conciliação." },
  { value: "vendas", label: "Vendas", descricao: "Gere clientes, vendas e recebimentos." },
  { value: "producao", label: "Produção e Estoque", descricao: "Regista romaneios, produção e inventário." },
  { value: "rh", label: "RH e Folha", descricao: "Gere colaboradores, folha e informações de RH." },
  { value: "consulta", label: "Consulta", descricao: "Visualiza informações sem alterar registos." },
] as const;

const nomePapel = (papel: string) => papel === "proprietario" ? "Proprietário" : papeis.find((item) => item.value === papel)?.label ?? papel;

export default function EquipePage() {
  const utils = trpc.useUtils();
  const membros = trpc.equipe.listar.useQuery();
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<(typeof papeis)[number]["value"]>("vendas");
  const [conviteUrl, setConviteUrl] = useState<string | null>(null);
  const convite = trpc.equipe.criarConvite.useMutation({
    onSuccess: async (resultado) => {
      setConviteUrl(resultado.conviteUrl);
      setEmail("");
      await utils.equipe.listar.invalidate();
      toast.success("Convite gerado com validade de 7 dias.");
    },
    onError: (error) => toast.error(error.message),
  });
  const enviar = (event: FormEvent) => { event.preventDefault(); convite.mutate({ email, papel }); };
  const copiar = async () => {
    if (!conviteUrl) return;
    await navigator.clipboard.writeText(conviteUrl);
    toast.success("Link de convite copiado.");
  };

  return <div className="container space-y-7 py-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Acessos da empresa</p><h1 className="text-3xl font-semibold tracking-tight">Colaboradores</h1><p className="mt-2 max-w-2xl text-muted-foreground">Convide a sua equipa e defina acessos adequados para cada função. Cada colaborador entra com as próprias credenciais.</p></div><Badge variant="outline" className="w-fit gap-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800"><ShieldCheck className="h-4 w-4" />Dados protegidos por empresa</Badge></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Card><CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-700" />Equipa atual</CardTitle></CardHeader><CardContent className="p-0">{membros.isLoading ? <p className="p-6 text-sm text-muted-foreground">A carregar colaboradores…</p> : membros.data?.length ? <div className="divide-y">{membros.data.map((usuario) => <div key={usuario.id} className="flex items-center justify-between gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate font-medium">{usuario.name || "Colaborador sem nome"}</p><p className="truncate text-sm text-muted-foreground">{usuario.email || "E-mail não informado"}</p></div><div className="text-right"><Badge variant={usuario.papel === "proprietario" ? "default" : "secondary"}>{nomePapel(usuario.papel ?? "consulta")}</Badge><p className="mt-1 text-xs text-muted-foreground">{usuario.papel ? "Acesso ativo" : "Acesso suspenso"}</p></div></div>)}</div> : <p className="p-6 text-sm text-muted-foreground">Nenhum colaborador foi registado.</p>}</CardContent></Card>
      <Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><UserRoundPlus className="h-5 w-5 text-amber-700" />Convidar colaborador</CardTitle><p className="text-sm text-muted-foreground">Será gerado um link seguro para o primeiro acesso.</p></CardHeader><CardContent><form className="space-y-4" onSubmit={enviar}><div className="space-y-2"><Label htmlFor="emailColaborador">E-mail corporativo</Label><Input id="emailColaborador" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com.br" required /></div><div className="space-y-2"><Label htmlFor="papelColaborador">Perfil de acesso</Label><select id="papelColaborador" value={papel} onChange={(event) => setPapel(event.target.value as typeof papel)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{papeis.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="text-xs text-muted-foreground">{papeis.find((item) => item.value === papel)?.descricao}</p></div><Button className="w-full bg-[#173b30] text-white hover:bg-[#0f2c23]" type="submit" disabled={convite.isPending}><MailPlus className="mr-2 h-4 w-4" />{convite.isPending ? "A gerar convite…" : "Gerar convite seguro"}</Button></form>{conviteUrl && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-950"><Link2 className="h-4 w-4" />Link de primeiro acesso</p><p className="break-all text-xs text-amber-900">{conviteUrl}</p><Button className="mt-3 w-full" variant="outline" size="sm" onClick={copiar}><Clipboard className="mr-2 h-4 w-4" />Copiar link</Button></div>}</CardContent></Card>
    </div>
  </div>;
}
