import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Parametros = {
  fgtsPercentual: string;
  inssPatronalPercentual: string;
  inssPatronalEstimadoAtivo: boolean;
  descontoInssEstimadoAtivo: boolean;
  provisaoDecimoTerceiroAtiva: boolean;
  provisaoFeriasAtiva: boolean;
  provisaoTercoFeriasAtiva: boolean;
  observacoes: string;
};

const padrao: Parametros = { fgtsPercentual: "8", inssPatronalPercentual: "20", inssPatronalEstimadoAtivo: true, descontoInssEstimadoAtivo: false, provisaoDecimoTerceiroAtiva: true, provisaoFeriasAtiva: true, provisaoTercoFeriasAtiva: true, observacoes: "" };

export function RhConfiguracoesEncargos() {
  const utils = trpc.useUtils();
  const configuracao = trpc.rh.fichas.configuracoes.get.useQuery();
  const [parametros, setParametros] = useState<Parametros>(padrao);
  useEffect(() => {
    if (!configuracao.data) return;
    setParametros({
      fgtsPercentual: String(configuracao.data.fgtsPercentual ?? 8),
      inssPatronalPercentual: String(configuracao.data.inssPatronalPercentual ?? 20),
      inssPatronalEstimadoAtivo: configuracao.data.inssPatronalEstimadoAtivo ?? true,
      descontoInssEstimadoAtivo: configuracao.data.descontoInssEstimadoAtivo ?? false,
      provisaoDecimoTerceiroAtiva: configuracao.data.provisaoDecimoTerceiroAtiva ?? true,
      provisaoFeriasAtiva: configuracao.data.provisaoFeriasAtiva ?? true,
      provisaoTercoFeriasAtiva: configuracao.data.provisaoTercoFeriasAtiva ?? true,
      observacoes: configuracao.data.observacoes ?? "",
    });
  }, [configuracao.data]);
  const salvar = trpc.rh.fichas.configuracoes.update.useMutation({
    onSuccess: async () => { toast.success("Parâmetros de encargos atualizados."); await utils.rh.fichas.configuracoes.invalidate(); },
    onError: (erro) => toast.error(erro.message),
  });
  const alternar = (campo: keyof Pick<Parametros, "inssPatronalEstimadoAtivo" | "descontoInssEstimadoAtivo" | "provisaoDecimoTerceiroAtiva" | "provisaoFeriasAtiva" | "provisaoTercoFeriasAtiva">) => setParametros((atual) => ({ ...atual, [campo]: !atual[campo] }));
  return <Card className="border-sky-200 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20"><CardContent className="space-y-5 p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-sky-700 dark:text-sky-300" /><h3 className="font-semibold">Parâmetros gerenciais da empresa</h3></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">As alíquotas são estimativas de custo para planejamento interno. Não geram guias, impostos ou obrigações oficiais.</p></div><Button onClick={() => salvar.mutate({ ...parametros, observacoes: parametros.observacoes || null })} disabled={salvar.isPending}><Save className="mr-2 h-4 w-4" />Salvar parâmetros</Button></div><div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="fgts-percentual">FGTS estimado (%)</Label><Input id="fgts-percentual" aria-label="FGTS estimado percentual" inputMode="decimal" className="mt-1.5" value={parametros.fgtsPercentual} onChange={(event) => setParametros({ ...parametros, fgtsPercentual: event.target.value })} /></div><div><Label htmlFor="inss-patronal-percentual">INSS patronal estimado (%)</Label><Input id="inss-patronal-percentual" aria-label="INSS patronal percentual" inputMode="decimal" className="mt-1.5" value={parametros.inssPatronalPercentual} onChange={(event) => setParametros({ ...parametros, inssPatronalPercentual: event.target.value })} /></div></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{([
    ["inssPatronalEstimadoAtivo", "Considerar INSS patronal no custo"],
    ["descontoInssEstimadoAtivo", "Estimar desconto de INSS no líquido"],
    ["provisaoDecimoTerceiroAtiva", "Provisionar 13º salário"],
    ["provisaoFeriasAtiva", "Provisionar férias"],
    ["provisaoTercoFeriasAtiva", "Provisionar adicional de 1/3 de férias"],
  ] as const).map(([campo, rotulo]) => <label key={campo} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"><input type="checkbox" checked={parametros[campo]} onChange={() => alternar(campo)} />{rotulo}</label>)}</div><div><Label htmlFor="observacoes-encargos">Observações</Label><Textarea id="observacoes-encargos" className="mt-1.5" value={parametros.observacoes} onChange={(event) => setParametros({ ...parametros, observacoes: event.target.value })} placeholder="Anotações internas sobre premissas de custo" /></div></CardContent></Card>;
}
