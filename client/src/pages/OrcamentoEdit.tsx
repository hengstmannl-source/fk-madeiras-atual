import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import {
  ArrowLeft, FileText, Download, Send, CheckCircle2, XCircle, Clock, Loader2,
  Mail, Phone, MapPin, Package,
} from "lucide-react";
import { formatCurrency, formatDimensionCm, formatMeasurement } from "@/lib/utils";
import { toast } from "sonner";

function dataParaInput(data?: Date | string | null) {
  if (!data) return "";
  const valor = new Date(data);
  const deslocamento = valor.getTimezoneOffset() * 60_000;
  return new Date(valor.getTime() - deslocamento).toISOString().slice(0, 10);
}

const estadoColors: Record<string, string> = {
  rascunho: "bg-stone-100 text-stone-600 border-stone-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-50 text-red-700 border-red-200",
};

export default function OrcamentoEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const orcamentoId = parseInt(id || "0");
  const orc = trpc.orcamento.get.useQuery({ id: orcamentoId }, { enabled: orcamentoId > 0 });
  const updateEstado = trpc.orcamento.updateEstado.useMutation();
  const atualizarDatas = trpc.orcamento.atualizarDatas.useMutation();
  const utils = trpc.useUtils();
  const [dataVencimento, setDataVencimento] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [pdfAberto, setPdfAberto] = useState(false);

  // Fetch cliente details
  const clientes = trpc.cliente.list.useQuery();
  const cliente = clientes.data?.find(c => c.id === orc.data?.orcamento.clienteId);

  useEffect(() => {
    if (!orc.data?.orcamento) return;
    setDataVencimento(dataParaInput(orc.data.orcamento.dataVencimento));
    setCompetencia(dataParaInput(orc.data.orcamento.competencia));
  }, [orc.data?.orcamento.dataVencimento, orc.data?.orcamento.competencia]);

  const handleEstado = (estado: string) => {
    const pago = Boolean(orc.data?.orcamento.pago);
    if (pago && !confirm("Esta venda está quitada e bloqueada. Deseja iniciar uma alteração excepcional?")) return;
    if (pago && !confirm("Confirma novamente a alteração do estado de uma venda quitada?")) return;
    updateEstado.mutate({ id: orcamentoId, estado: estado as any, confirmacaoDupla: pago }, {
      onSuccess: () => { toast.success(`Estado atualizado para "${estado}"`); utils.orcamento.get.invalidate({ id: orcamentoId }); },
      onError: (err) => toast.error(err.message),
    });
  };

  const visualizarPdf = () => setPdfAberto(true);

  const handleAtualizarDatas = () => {
    if (!dataVencimento || !competencia) {
      toast.error("Informe vencimento e competência");
      return;
    }
    const pago = Boolean(orc.data?.orcamento.pago);
    if (pago && !confirm("Esta venda está quitada. Deseja alterar as datas mesmo assim?")) return;
    if (pago && !confirm("Confirme novamente a alteração excepcional de uma venda quitada.")) return;
    atualizarDatas.mutate({ id: orcamentoId, dataVencimento, competencia, confirmacaoDupla: pago }, {
      onSuccess: ({ tituloAtualizado }) => {
        toast.success(tituloAtualizado ? "Datas da venda e do recebível atualizadas" : "Datas da venda atualizadas");
        utils.orcamento.get.invalidate({ id: orcamentoId });
        utils.financeiro.titulos.list.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  if (orc.isLoading) {
    return <div className="max-w-7xl mx-auto p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />A carregar...</div>;
  }

  if (!orc.data) {
    return <div className="max-w-7xl mx-auto p-8 text-center text-muted-foreground">Venda não encontrada</div>;
  }

  const { orcamento, itens } = orc.data;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/orcamentos")} className="mb-2 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{orcamento.numero ?? "Venda aguardando aprovação"}</h1>
            <Badge variant="outline" className={`text-xs ${estadoColors[orcamento.estado] ?? ""}`}>{orcamento.estado}</Badge>
            {orcamento.pago && <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">pago e bloqueado</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(orcamento.createdAt).toLocaleDateString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={visualizarPdf}><Download className="h-4 w-4 mr-2" />PDF</Button>
          {orcamento.estado !== "aprovado" && (
            <Button variant="outline" onClick={() => handleEstado("enviado")} className="text-blue-600 border-blue-200"><Send className="h-4 w-4 mr-2" />Enviar</Button>
          )}
          {orcamento.estado !== "aprovado" && (
            <Button variant="outline" onClick={() => handleEstado("aprovado")} className="text-emerald-600 border-emerald-200"><CheckCircle2 className="h-4 w-4 mr-2" />Aprovar</Button>
          )}
          <Button variant="outline" onClick={() => handleEstado("rejeitado")} className="text-red-500 border-red-200"><XCircle className="h-4 w-4 mr-2" />Rejeitar</Button>
        </div>
      </div>

      <PdfPreviewDialog open={pdfAberto} onOpenChange={setPdfAberto} url={pdfAberto ? `/api/pdf/orcamento/${orcamentoId}` : null} title={`Venda ${orcamento.numero ?? orcamentoId}`} description="Confira a venda antes de confirmar o download do PDF." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><Package className="h-4 w-4" />Cliente</CardTitle></CardHeader>
            <CardContent>
              {cliente ? (
                <div className="space-y-2">
                  <p className="font-medium">{cliente.nome}</p>
                  {cliente.contacto && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{cliente.contacto}</p>}
                  {cliente.email && <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{cliente.email}</p>}
                  {cliente.morada && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{cliente.morada}</p>}
                  {cliente.nif && <p className="text-sm text-muted-foreground">NIF: {cliente.nif}</p>}
                </div>
              ) : <p className="text-sm text-muted-foreground">Cliente não encontrado</p>}
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Datas financeiras</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} /></div>
                <div className="space-y-2"><Label>Competência</Label><Input type="date" value={competencia} onChange={(event) => setCompetencia(event.target.value)} /></div>
              </div>
              <Button onClick={handleAtualizarDatas} disabled={atualizarDatas.isPending} className="w-full sm:w-auto">
                {atualizarDatas.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Atualizar datas
              </Button>
              <p className="text-xs text-muted-foreground">Ao existir um recebível vinculado, seu vencimento e competência são atualizados automaticamente.</p>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Itens ({itens?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Madeira</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Medida / tipo</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Unidade</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Preço base</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Valor unit.</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens?.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2.5 font-medium">{item.madeiraNome}</td>
                        <td className="py-2.5 text-muted-foreground">{item.tipoComercializacao === "metro_cubico" ? `${formatDimensionCm(item.espessura)}×${formatDimensionCm(item.largura)} cm × ${item.comprimento} m` : item.tipoComercializacao === "unidade" ? "Venda por unidade" : "Venda por pacote"}</td>
                        <td className="py-2.5 text-right">{item.quantidade}</td>
                        <td className="py-2.5 text-right">{item.tipoComercializacao === "metro_cubico" ? "Peça" : item.tipoComercializacao === "unidade" ? "Unidade" : "Pacote"}</td>
                        <td className="py-2.5 text-right">{formatCurrency(item.precoM3)}</td>
                        <td className="py-2.5 text-right">{formatCurrency(item.valorPeca)}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrency(item.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {orcamento.observacoes && (
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Observações</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{orcamento.observacoes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary */}
        <div>
          <Card className="border border-border/50 shadow-sm sticky top-6">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(orcamento.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span className="text-destructive">- {formatCurrency(orcamento.desconto || "0")}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Frete</span><span>+ {formatCurrency(orcamento.frete || "0")}</span></div>
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{formatCurrency(orcamento.total)}</span></div>
              <Separator />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Peças</p><p className="font-semibold text-sm">{orcamento.totalPecas}</p></div>
                <div><p className="text-xs text-muted-foreground">M. Linear</p><p className="font-semibold text-sm">{formatMeasurement(orcamento.totalMetroLinear)} m</p></div>
                <div><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold text-sm">{formatMeasurement(orcamento.totalVolume)} m³</p></div>
              </div>
              {orcamento.vendedor && <div className="text-xs text-muted-foreground pt-2">Vendedor: {orcamento.vendedor}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
