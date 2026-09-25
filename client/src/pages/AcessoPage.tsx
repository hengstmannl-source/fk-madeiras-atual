import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, LockKeyhole, Mail, ShieldCheck, Trees } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Redirect, useLocation, useRoute } from "wouter";
import { toast } from "sonner";

function mensagemErro(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação. Tente novamente.";
}

function AcessoShell({ children, titulo, descricao }: { children: React.ReactNode; titulo: string; descricao: string }) {
  return (
    <main className="min-h-screen bg-[#f4f2ec] text-slate-950 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#102b24] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,transparent_0%,transparent_35%,rgba(228,186,100,0.22)_35%,transparent_36%),radial-gradient(circle_at_8%_14%,#b98442_0,transparent_27%),radial-gradient(circle_at_82%_82%,#3f7656_0,transparent_33%)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#d6a255] text-[#102b24] shadow-lg"><Trees className="h-6 w-6" /></div>
          <div><p className="text-lg font-bold tracking-tight">FK Madeiras</p><p className="text-xs text-emerald-100/70">Gestão que acompanha o seu negócio</p></div>
        </div>
        <div className="relative max-w-lg">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#ecc37f]">Plataforma de gestão madeireira</p>
          <h1 className="text-4xl font-semibold leading-tight">Uma operação integrada, com dados e acessos protegidos.</h1>
          <div className="mt-10 grid gap-4 text-sm text-emerald-50/85">
            {[
              "Financeiro, vendas, estoque e produção em um só lugar.",
              "Acessos individuais para cada colaborador.",
              "Perfis individuais e seguros para cada colaborador.",
            ].map((item) => <div key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#ecc37f]" />{item}</div>)}
          </div>
        </div>
        <p className="relative text-xs text-emerald-50/55">© {new Date().getFullYear()} FK Madeiras. Gestão profissional para o setor florestal.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#102b24] text-[#d6a255]"><Trees className="h-5 w-5" /></div><span className="font-bold">FK Madeiras</span></div>
          <div className="mb-8"><p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#a66f2b]">Acesso seguro</p><h2 className="text-3xl font-semibold tracking-tight">{titulo}</h2><p className="mt-3 leading-relaxed text-slate-600">{descricao}</p></div>
          <div className="rounded-2xl border border-[#ded9ce] bg-white p-6 shadow-[0_24px_60px_rgba(30,43,35,0.10)] sm:p-8">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const [, navegar] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const entrar = trpc.auth.entrar.useMutation({
    onSuccess: async () => {
  await utils.auth.me.fetch();
  navegar("/");
},
    onError: (error) => toast.error(error.message),
  });
  const enviar = (event: FormEvent) => { event.preventDefault(); entrar.mutate({ email, senha }); };

  return <AcessoShell titulo="Entre na sua operação" descricao="Use as credenciais fornecidas pelo administrador da sua empresa.">
    <form className="space-y-5" onSubmit={enviar}>
      <div className="space-y-2"><Label htmlFor="email">E-mail</Label><div className="relative"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 pl-10" placeholder="nome@empresa.com.br" required /></div></div>
      <div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label htmlFor="senha">Senha</Label><span className="text-right text-xs text-slate-400">Esqueceu? Fale com o administrador.</span></div><div className="relative"><LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} className="h-11 pl-10" placeholder="A sua senha" required /></div></div>
      <Button className="h-11 w-full bg-[#173b30] text-white hover:bg-[#0f2c23]" type="submit" disabled={entrar.isPending}>{entrar.isPending ? "A entrar…" : "Entrar no sistema"}</Button>
    </form>
    <div className="mt-7 border-t pt-6 text-center text-sm text-slate-600">Precisa de acesso? Solicite um convite ao administrador.</div>
  </AcessoShell>;
}

export function CadastroEmpresaPage() {
  return <Redirect to="/login" />;
}

export function ConvitePage() {
  const [, parametros] = useRoute("/convite/:token");
  const [, navegar] = useLocation();
  const utils = trpc.useUtils();
  const token = parametros?.token ?? "";
  const convite = trpc.equipe.consultarConvite.useQuery({ token }, { enabled: Boolean(token), retry: false });
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const aceitar = trpc.equipe.aceitarConvite.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); navegar("/"); }, onError: (error) => toast.error(error.message) });
  const enviar = (event: FormEvent) => { event.preventDefault(); aceitar.mutate({ token, nome, senha }); };

  return <AcessoShell titulo="Complete o seu acesso" descricao="Crie as suas credenciais para entrar no ambiente seguro da sua equipa.">
    {convite.isLoading ? <p className="text-sm text-slate-500">A validar o convite…</p> : convite.error ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Este convite é inválido ou já expirou. Peça um novo convite ao administrador.</div> : convite.data ? <><div className="mb-6 rounded-xl border border-[#e7dfd0] bg-[#fbf8f1] p-4 text-sm"><div className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 text-[#8b5721]" /><div><p className="font-semibold">{"FK Madeiras"}</p><p className="mt-1 text-slate-600">Convite para <strong>{convite.data.email}</strong> como {convite.data.papel}.</p></div></div></div><form className="space-y-5" onSubmit={enviar}><div className="space-y-2"><Label htmlFor="nomeConvite">Nome completo</Label><Input id="nomeConvite" value={nome} onChange={(event) => setNome(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="senhaConvite">Crie a sua senha</Label><Input id="senhaConvite" type="password" autoComplete="new-password" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Mínimo de 8 caracteres, maiúscula e número" required /></div><Button className="h-11 w-full bg-[#173b30] text-white hover:bg-[#0f2c23]" disabled={aceitar.isPending}>{aceitar.isPending ? "A preparar acesso…" : "Ativar o meu acesso"}</Button></form></> : null}
  </AcessoShell>;
}
