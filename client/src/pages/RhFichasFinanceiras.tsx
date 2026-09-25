import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowDownToLine, CalendarDays, CheckCircle2, CircleDollarSign, HandCoins, Plus, ReceiptText, UserPlus, Users, WalletCards, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const hoje = () => new Date().toLocaleDateString("en-CA");
const competenciaAtual = () => hoje().slice(0, 7);
const dinheiro = (valor: string | number | null | undefined) => Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBrasil = (valor: Date | string | null | undefined) => valor ? new Date(valor).toLocaleDateString("pt-BR") : "—";
const competenciaBrasil = (valor: string) => new Date(`${valor}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const dataIso = (valor: Date | string) => new Date(valor).toLocaleDateString("en-CA");
const vencimentoPadrao = (competencia: string) => {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(ano, mes, 0).toLocaleDateString("en-CA");
};

type FormFuncionario = {
  nome: string; cpf: string; cargoId: string; departamentoId: string; dataAdmissao: string; salarioAtual: string; observacoes: string;
};
type FormAdiantamento = {
  id?: number; colaboradorId: string; competencia: string; dataAdiantamento: string; valor: string; observacoes: string; permitirExcesso: boolean;
};

const novoFuncionario = (): FormFuncionario => ({ nome: "", cpf: "", cargoId: "", departamentoId: "", dataAdmissao: hoje(), salarioAtual: "", observacoes: "" });
const novoAdiantamento = (competencia: string, colaboradorId = ""): FormAdiantamento => ({ colaboradorId, competencia, dataAdiantamento: hoje(), valor: "", observacoes: "", permitirExcesso: false });

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-slate-700 dark:text-slate-200">{label}</Label>{children}</div>;
}

function Kpi({ titulo, valor, descricao, Icon, destaque }: { titulo: string; valor: string; descricao: string; Icon: React.ElementType; destaque?: boolean }) {
  return <Card className={destaque ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30" : ""}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{titulo}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{valor}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{descricao}</p></div><div className="rounded-xl bg-slate-100 p-2.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

export function RhFichasFinanceiras() {
  const utils = trpc.useUtils();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [busca, setBusca] = useState("");
  const [dialogFuncionario, setDialogFuncionario] = useState(false);
  const [dialogAdiantamento, setDialogAdiantamento] = useState(false);
  const [dialogFechamento, setDialogFechamento] = useState(false);
  const [dialogCancelar, setDialogCancelar] = useState<{ id: number; nome: string } | null>(null);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<number | null>(null);
  const [funcionario, setFuncionario] = useState<FormFuncionario>(novoFuncionario);
  const [adiantamento, setAdiantamento] = useState<FormAdiantamento>(() => novoAdiantamento(competenciaAtual()));
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [dataVencimento, setDataVencimento] = useState(vencimentoPadrao(competenciaAtual()));

  const resumo = trpc.rh.controle.resumo.useQuery({ competencia });
  const adiantamentos = trpc.rh.controle.adiantamentos.list.useQuery({ competencia });
  const adiantamentosFuncionario = trpc.rh.controle.adiantamentos.list.useQuery({ competencia, colaboradorId: funcionarioSelecionado ?? 0 }, { enabled: Boolean(funcionarioSelecionado) });
  const cargos = trpc.rh.cargos.list.useQuery();
  const departamentos = trpc.rh.departamentos.list.useQuery();

  const invalidar = async () => {
    await Promise.all([
      utils.rh.controle.resumo.invalidate(),
      utils.rh.controle.adiantamentos.invalidate(),
      utils.rh.colaboradores.invalidate(),
    ]);
  };

  const criarFuncionario = trpc.rh.colaboradores.create.useMutation({
    onSuccess: async ({ id }) => {
      toast.success("Funcionário cadastrado e disponível para receber adiantamentos.");
      setDialogFuncionario(false);
      setFuncionario(novoFuncionario());
      setFuncionarioSelecionado(id);
      await invalidar();
    },
    onError: (erro) => toast.error(erro.message),
  });
  const criarAdiantamento = trpc.rh.controle.adiantamentos.create.useMutation({
    onSuccess: async ({ excessoAutorizado }) => {
      toast.success(excessoAutorizado ? "Adiantamento registrado com saldo negativo autorizado." : "Adiantamento registrado.");
      setDialogAdiantamento(false);
      setAdiantamento(novoAdiantamento(competencia));
      await invalidar();
    },
    onError: (erro) => toast.error(erro.message),
  });
  const atualizarAdiantamento = trpc.rh.controle.adiantamentos.update.useMutation({
    onSuccess: async () => {
      toast.success("Adiantamento atualizado.");
      setDialogAdiantamento(false);
      setAdiantamento(novoAdiantamento(competencia));
      await invalidar();
    },
    onError: (erro) => toast.error(erro.message),
  });
  const cancelarAdiantamento = trpc.rh.controle.adiantamentos.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Adiantamento cancelado e mantido no histórico.");
      setDialogCancelar(null);
      setMotivoCancelamento("");
      await invalidar();
    },
    onError: (erro) => toast.error(erro.message),
  });
  const fecharCompetencia = trpc.rh.controle.fechamento.enviarFinanceiro.useMutation({
    onSuccess: async ({ jaFechada, titulos }) => {
      toast.success(jaFechada ? "Esta competência já estava fechada." : `${titulos} saldo(s) enviado(s) para Contas a Pagar.`);
      setDialogFechamento(false);
      await invalidar();
    },
    onError: (erro) => toast.error(erro.message),
  });

  const linhas = useMemo(() => (resumo.data?.linhas ?? []).filter((linha) => `${linha.nome} ${linha.cargoNome ?? ""} ${linha.departamentoNome ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))), [resumo.data?.linhas, busca]);
  const funcionarioAtual = useMemo(() => (resumo.data?.linhas ?? []).find((linha) => linha.id === funcionarioSelecionado) ?? null, [resumo.data?.linhas, funcionarioSelecionado]);
  const totais = resumo.data?.totais ?? { funcionariosAtivos: 0, salarios: 0, adiantamentos: 0, saldoPagar: 0 };
  const competenciaFechada = resumo.data?.estado === "fechada";

  const abrirNovoAdiantamento = (colaboradorId = "") => {
    setAdiantamento(novoAdiantamento(competencia, colaboradorId));
    setDialogAdiantamento(true);
  };
  const abrirEdicaoAdiantamento = (item: NonNullable<typeof adiantamentos.data>[number]) => {
    setAdiantamento({ id: item.id, colaboradorId: String(item.colaboradorId), competencia, dataAdiantamento: dataIso(item.dataAdiantamento), valor: String(item.valor), observacoes: item.observacoes ?? "", permitirExcesso: false });
    setDialogAdiantamento(true);
  };
  const salvarFuncionario = () => {
    if (!funcionario.nome.trim() || !funcionario.cpf.trim() || !funcionario.dataAdmissao || Number(funcionario.salarioAtual) <= 0) {
      toast.error("Informe nome, CPF, data de admissão e salário mensal.");
      return;
    }
    criarFuncionario.mutate({
      nome: funcionario.nome,
      cpf: funcionario.cpf,
      cargoId: funcionario.cargoId ? Number(funcionario.cargoId) : null,
      departamentoId: funcionario.departamentoId ? Number(funcionario.departamentoId) : null,
      dataAdmissao: funcionario.dataAdmissao,
      salarioAtual: funcionario.salarioAtual,
      observacoes: funcionario.observacoes || null,
      usuarioId: null, rg: null, pis: null, email: null, telefone: null, dataNascimento: null, dataDesligamento: null,
      tipoContrato: "clt", situacao: "ativo", cargaHorariaSemanal: "44", banco: null, agencia: null, contaBancaria: null, chavePix: null,
    });
  };
  const salvarAdiantamento = () => {
    if (!adiantamento.colaboradorId || !adiantamento.dataAdiantamento || Number(adiantamento.valor) <= 0) {
      toast.error("Informe funcionário, data e valor positivo.");
      return;
    }
    const dados = { colaboradorId: Number(adiantamento.colaboradorId), competencia: adiantamento.competencia, dataAdiantamento: adiantamento.dataAdiantamento, valor: adiantamento.valor, observacoes: adiantamento.observacoes || null, permitirExcesso: adiantamento.permitirExcesso };
    if (adiantamento.id) atualizarAdiantamento.mutate({ id: adiantamento.id, ...dados });
    else criarAdiantamento.mutate(dados);
  };

  return <section className="space-y-5">
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-slate-950 dark:to-sky-950/30">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Controle simples e operacional</p><h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">RH — Funcionários e Adiantamentos</h2><p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">Cadastre funcionários, registre adiantamentos e acompanhe o saldo mensal a pagar. Este painel não calcula folha, impostos ou encargos.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialogFuncionario(true)}><UserPlus className="mr-2 h-4 w-4" />Novo funcionário</Button><Button onClick={() => abrirNovoAdiantamento()} disabled={competenciaFechada}><Plus className="mr-2 h-4 w-4" />Novo adiantamento</Button></div></div>
    </div>

    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Competência mensal</h3><p className="text-sm text-slate-500 dark:text-slate-400">Salário informado menos os adiantamentos deste mês.</p></div><Campo label="Competência"><Input type="month" value={competencia} onChange={(event) => { setCompetencia(event.target.value); setDataVencimento(vencimentoPadrao(event.target.value)); }} className="w-[180px]" /></Campo></div>

    {competenciaFechada && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" />Esta competência foi enviada ao Financeiro e está fechada para alterações.</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi titulo="Funcionários ativos" valor={String(totais.funcionariosAtivos)} descricao="Participam desta competência" Icon={Users} /><Kpi titulo="Total de salários" valor={dinheiro(totais.salarios)} descricao="Salários mensais informados" Icon={CircleDollarSign} /><Kpi titulo="Total adiantado" valor={dinheiro(totais.adiantamentos)} descricao="Adiantamentos não cancelados" Icon={HandCoins} /><Kpi titulo="Total a pagar" valor={dinheiro(totais.saldoPagar)} descricao="Saldo após os adiantamentos" Icon={WalletCards} destaque /></div>

    <Card><CardHeader className="flex flex-col justify-between gap-3 space-y-0 sm:flex-row sm:items-center"><div><CardTitle>Funcionários</CardTitle><p className="mt-1 text-sm font-normal text-slate-500 dark:text-slate-400">Abra um perfil para consultar os adiantamentos e o saldo da competência.</p></div><Input aria-label="Buscar funcionário" placeholder="Buscar por nome, cargo ou departamento" value={busca} onChange={(event) => setBusca(event.target.value)} className="sm:w-80" /></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3 font-medium">Funcionário</th><th className="px-4 py-3 font-medium">Cargo</th><th className="px-4 py-3 text-right font-medium">Salário</th><th className="px-4 py-3 text-right font-medium">Adiantado</th><th className="px-4 py-3 text-right font-medium">Saldo a pagar</th><th className="px-4 py-3" /></tr></thead><tbody>{linhas.map((linha) => <tr key={linha.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-4 py-3"><button className="text-left font-medium text-emerald-700 hover:underline dark:text-emerald-300" onClick={() => setFuncionarioSelecionado(linha.id)}>{linha.nome}</button><p className="text-xs text-slate-500">{linha.departamentoNome ?? "Sem departamento"}</p></td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{linha.cargoNome ?? "Não informado"}</td><td className="px-4 py-3 text-right tabular-nums">{dinheiro(linha.salario)}</td><td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-300">{dinheiro(linha.adiantado)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{dinheiro(linha.saldoPagar)}</td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => abrirNovoAdiantamento(String(linha.id))} disabled={competenciaFechada}>Adiantamento</Button></td></tr>)}{!linhas.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum funcionário ativo encontrado nesta competência.</td></tr>}</tbody></table></div></CardContent></Card>

    <Card><CardHeader className="flex flex-col justify-between gap-3 space-y-0 sm:flex-row sm:items-center"><div><CardTitle>Adiantamentos</CardTitle><p className="mt-1 text-sm font-normal text-slate-500 dark:text-slate-400">Cada registro reduz somente o saldo do funcionário na competência selecionada.</p></div><Button variant="outline" onClick={() => abrirNovoAdiantamento()} disabled={competenciaFechada}><Plus className="mr-2 h-4 w-4" />Novo adiantamento</Button></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Funcionário</th><th className="px-4 py-3 font-medium">Observação</th><th className="px-4 py-3 text-right font-medium">Valor</th><th className="px-4 py-3 font-medium">Situação</th><th className="px-4 py-3" /></tr></thead><tbody>{(adiantamentos.data ?? []).map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-4 py-3">{dataBrasil(item.dataAdiantamento)}</td><td className="px-4 py-3 font-medium">{item.colaboradorNome}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.observacoes || "—"}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{dinheiro(item.valor)}</td><td className="px-4 py-3"><span className={item.estado === "cancelado" ? "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300" : item.estado === "descontado" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200"}>{item.estado === "aberto" ? "Ativo" : item.estado === "descontado" ? "Fechado" : "Cancelado"}</span></td><td className="px-4 py-3 text-right">{item.estado === "aberto" && !competenciaFechada && <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => abrirEdicaoAdiantamento(item)}>Editar</Button><Button variant="ghost" size="sm" className="text-rose-700 hover:text-rose-800 dark:text-rose-300" onClick={() => setDialogCancelar({ id: item.id, nome: item.colaboradorNome })}>Cancelar</Button></div>}</td></tr>)}{!(adiantamentos.data ?? []).length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum adiantamento registrado para {competenciaBrasil(competencia)}.</td></tr>}</tbody></table></div></CardContent></Card>

    <Card className="border-sky-200 dark:border-sky-900"><CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-sky-700 dark:text-sky-300" />Fechamento de {competenciaBrasil(competencia)}</CardTitle></CardHeader><CardContent className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3"><div><p className="text-slate-500">Salários</p><p className="font-semibold">{dinheiro(totais.salarios)}</p></div><div><p className="text-slate-500">Adiantamentos</p><p className="font-semibold">{dinheiro(totais.adiantamentos)}</p></div><div><p className="text-slate-500">Total a pagar</p><p className="font-semibold text-emerald-700 dark:text-emerald-300">{dinheiro(totais.saldoPagar)}</p></div></div><div className="max-w-xl text-sm text-slate-600 dark:text-slate-300"><p>Ao confirmar, o RH envia somente os saldos mensais para <strong>Contas a Pagar</strong>. Baixas, contas bancárias e conciliação continuam sendo controladas exclusivamente no Financeiro.</p><Button className="mt-3" onClick={() => setDialogFechamento(true)} disabled={competenciaFechada || totais.funcionariosAtivos === 0}><ArrowDownToLine className="mr-2 h-4 w-4" />Enviar para Contas a Pagar</Button></div></CardContent></Card>

    <Dialog open={dialogFuncionario} onOpenChange={setDialogFuncionario}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Novo funcionário</DialogTitle><DialogDescription>Cadastre os dados essenciais. Informações adicionais podem ser ajustadas posteriormente no cadastro do colaborador.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Campo label="Nome"><Input value={funcionario.nome} onChange={(event) => setFuncionario({ ...funcionario, nome: event.target.value })} autoFocus /></Campo><Campo label="CPF"><Input value={funcionario.cpf} onChange={(event) => setFuncionario({ ...funcionario, cpf: event.target.value })} placeholder="Somente números ou formato CPF" /></Campo><Campo label="Cargo"><select value={funcionario.cargoId} onChange={(event) => setFuncionario({ ...funcionario, cargoId: event.target.value })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Não informado</option>{(cargos.data ?? []).filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo><Campo label="Departamento"><select value={funcionario.departamentoId} onChange={(event) => setFuncionario({ ...funcionario, departamentoId: event.target.value })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Não informado</option>{(departamentos.data ?? []).filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo><Campo label="Data de admissão"><Input type="date" value={funcionario.dataAdmissao} onChange={(event) => setFuncionario({ ...funcionario, dataAdmissao: event.target.value })} /></Campo><Campo label="Salário mensal"><Input inputMode="decimal" placeholder="0,00" value={funcionario.salarioAtual} onChange={(event) => setFuncionario({ ...funcionario, salarioAtual: event.target.value })} /></Campo><div className="sm:col-span-2"><Campo label="Observações"><Textarea value={funcionario.observacoes} onChange={(event) => setFuncionario({ ...funcionario, observacoes: event.target.value })} placeholder="Opcional" /></Campo></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogFuncionario(false)}>Cancelar</Button><Button onClick={salvarFuncionario} disabled={criarFuncionario.isPending}><UserPlus className="mr-2 h-4 w-4" />Salvar funcionário</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialogAdiantamento} onOpenChange={setDialogAdiantamento}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{adiantamento.id ? "Editar adiantamento" : "Novo adiantamento"}</DialogTitle><DialogDescription>O valor será descontado do saldo mensal do funcionário na competência selecionada.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><Campo label="Funcionário"><select value={adiantamento.colaboradorId} onChange={(event) => setAdiantamento({ ...adiantamento, colaboradorId: event.target.value })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Selecionar funcionário</option>{(resumo.data?.linhas ?? []).map((item) => <option key={item.id} value={item.id}>{item.nome} — saldo {dinheiro(item.saldoPagar)}</option>)}</select></Campo><div className="grid gap-4 sm:grid-cols-2"><Campo label="Competência"><Input type="month" value={adiantamento.competencia} onChange={(event) => setAdiantamento({ ...adiantamento, competencia: event.target.value })} /></Campo><Campo label="Data"><Input type="date" value={adiantamento.dataAdiantamento} onChange={(event) => setAdiantamento({ ...adiantamento, dataAdiantamento: event.target.value })} /></Campo></div><Campo label="Valor"><Input inputMode="decimal" placeholder="0,00" value={adiantamento.valor} onChange={(event) => setAdiantamento({ ...adiantamento, valor: event.target.value })} /></Campo><Campo label="Observação"><Textarea value={adiantamento.observacoes} onChange={(event) => setAdiantamento({ ...adiantamento, observacoes: event.target.value })} placeholder="Opcional" /></Campo><label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><input type="checkbox" className="mt-0.5" checked={adiantamento.permitirExcesso} onChange={(event) => setAdiantamento({ ...adiantamento, permitirExcesso: event.target.checked })} /><span>Permitir saldo negativo neste funcionário. Esta exceção exige perfil de administrador e fica registrada na auditoria.</span></label></div><DialogFooter><Button variant="outline" onClick={() => setDialogAdiantamento(false)}>Cancelar</Button><Button onClick={salvarAdiantamento} disabled={criarAdiantamento.isPending || atualizarAdiantamento.isPending}><HandCoins className="mr-2 h-4 w-4" />Salvar adiantamento</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(funcionarioSelecionado)} onOpenChange={(aberto) => !aberto && setFuncionarioSelecionado(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{funcionarioAtual?.nome ?? "Funcionário"}</DialogTitle><DialogDescription>Perfil simples de {competenciaBrasil(competencia)}: salário, adiantamentos e saldo a pagar.</DialogDescription></DialogHeader>{funcionarioAtual && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900"><p className="text-xs text-slate-500">Salário mensal</p><p className="mt-1 font-semibold">{dinheiro(funcionarioAtual.salario)}</p></div><div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30"><p className="text-xs text-slate-500">Adiantado</p><p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">{dinheiro(funcionarioAtual.adiantado)}</p></div><div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30"><p className="text-xs text-slate-500">Saldo a pagar</p><p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">{dinheiro(funcionarioAtual.saldoPagar)}</p></div></div><div><div className="mb-2 flex items-center justify-between"><h4 className="font-semibold">Histórico de adiantamentos</h4><Button size="sm" onClick={() => abrirNovoAdiantamento(String(funcionarioAtual.id))} disabled={competenciaFechada}><Plus className="mr-1 h-4 w-4" />Adiantamento</Button></div><div className="space-y-2">{(adiantamentosFuncionario.data ?? []).map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"><div><p className="font-medium">{dataBrasil(item.dataAdiantamento)} · {dinheiro(item.valor)}</p><p className="text-xs text-slate-500">{item.observacoes || "Sem observação"}</p></div><span className="text-xs text-slate-500">{item.estado === "cancelado" ? "Cancelado" : item.estado === "descontado" ? "Fechado" : "Ativo"}</span></div>)}{!(adiantamentosFuncionario.data ?? []).length && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-500 dark:border-slate-800">Nenhum adiantamento nesta competência.</p>}</div></div></div>}<DialogFooter><Button variant="outline" onClick={() => setFuncionarioSelecionado(null)}>Fechar</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(dialogCancelar)} onOpenChange={(aberto) => !aberto && setDialogCancelar(null)}><DialogContent><DialogHeader><DialogTitle>Cancelar adiantamento</DialogTitle><DialogDescription>O lançamento de {dialogCancelar?.nome} permanecerá no histórico como cancelado e deixará de afetar o saldo.</DialogDescription></DialogHeader><Campo label="Motivo do cancelamento"><Textarea value={motivoCancelamento} onChange={(event) => setMotivoCancelamento(event.target.value)} placeholder="Explique o motivo" /></Campo><DialogFooter><Button variant="outline" onClick={() => setDialogCancelar(null)}>Voltar</Button><Button variant="destructive" onClick={() => dialogCancelar && cancelarAdiantamento.mutate({ id: dialogCancelar.id, motivo: motivoCancelamento })} disabled={motivoCancelamento.trim().length < 3 || cancelarAdiantamento.isPending}><XCircle className="mr-2 h-4 w-4" />Cancelar adiantamento</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialogFechamento} onOpenChange={setDialogFechamento}><DialogContent><DialogHeader><DialogTitle>Enviar saldos para Contas a Pagar</DialogTitle><DialogDescription>Serão criados títulos a pagar para os saldos de {competenciaBrasil(competencia)}. Esta ação fecha a competência para novos adiantamentos.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100"><p><strong>Total a pagar:</strong> {dinheiro(totais.saldoPagar)}</p><p className="mt-1">O Financeiro continuará responsável por baixa, conta bancária, pagamento e conciliação.</p></div><Campo label="Data de vencimento"><Input type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} /></Campo></div><DialogFooter><Button variant="outline" onClick={() => setDialogFechamento(false)}>Cancelar</Button><Button onClick={() => fecharCompetencia.mutate({ competencia, dataVencimento })} disabled={fecharCompetencia.isPending}><CalendarDays className="mr-2 h-4 w-4" />Confirmar envio</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
