import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Box,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TreePine,
  Upload,
  Warehouse,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { etiquetaPlaqueta } from "@shared/plaquetas";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { PageHeader } from "@/components/PageHeader";

type PlaquetaCarga = {
  codigo: string;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  valorMetroCubico: string;
  observacoes: string;
};

type CargaFormulario = {
  dataCarga: string;
  dataVencimento: string;
  origem: string;
  fornecedorId: string;
  responsavel: string;
  observacoes: string;
  fretePorMetroCubico: string;
  plaquetas: PlaquetaCarga[];
};

type CabecalhoCarga = Omit<CargaFormulario, "plaquetas">;

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) =>
  Number(String(valor ?? "").replace(",", ".")) || 0;
const volumeTora = (diametro: string | number, comprimento: string | number) =>
  Math.PI * (num(diametro) / 100 / 2) ** 2 * num(comprimento);
const valorTora = (
  diametro: string | number,
  comprimento: string | number,
  valorMetroCubico: string | number
) => volumeTora(diametro, comprimento) * num(valorMetroCubico);
const formatarNumero = (valor: number | string, casas = 3) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(
    Number(valor ?? 0)
  );
const formatarMoeda = (valor: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(valor ?? 0)
  );
const formatarData = (valor: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
const novaPlaqueta = (): PlaquetaCarga => ({
  codigo: "",
  madeiraNome: "",
  diametro: "",
  comprimento: "",
  valorMetroCubico: "",
  observacoes: "",
});
const novoCabecalhoCarga = (): CabecalhoCarga => ({
  dataCarga: hoje(),
  dataVencimento: hoje(),
  origem: "",
  fornecedorId: "",
  responsavel: "",
  observacoes: "",
  fretePorMetroCubico: "0",
});
const novaCarga = (): CargaFormulario => ({
  ...novoCabecalhoCarga(),
  plaquetas: [novaPlaqueta()],
});

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const url = URL.createObjectURL(
    new Blob([conteudo], { type: "text/csv;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Campo({
  label,
  children,
  ajuda,
}: {
  label: string;
  children: React.ReactNode;
  ajuda?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium leading-4">{label}</Label>
      {children}
      {ajuda && (
        <p className="text-[11px] leading-4 text-muted-foreground">{ajuda}</p>
      )}
    </div>
  );
}

function CampoLote({ marcado, aoAlternar, rotulo, children }: { marcado: boolean; aoAlternar: (marcado: boolean) => void; rotulo: string; children: React.ReactNode }) {
  return <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-center"><label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={marcado} onChange={evento => aoAlternar(evento.target.checked)} />{rotulo}</label><div className={!marcado ? "opacity-55" : ""}>{children}</div></div>;
}

function EstadoTora({ estado }: { estado: string }) {
  const rotulos: Record<string, string> = {
    disponivel: "Disponível",
    consumida: "Consumida",
    cancelada: "Cancelada",
  };
  return (
    <Badge
      variant="outline"
      className={
        estado === "disponivel"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "bg-muted text-muted-foreground"
      }
    >
      {rotulos[estado] ?? estado}
    </Badge>
  );
}

function IdentificacaoTora({
  item,
}: {
  item: {
    codigo: string;
    codigoFisico?: string | null;
    situacaoIdentificacao?: string;
    indiceDuplicidade?: number | null;
  };
}) {
  const etiqueta = etiquetaPlaqueta(item);
  if (item.situacaoIdentificacao === "duplicada")
    return (
      <div className="space-y-0.5">
        <p className="font-medium">{etiqueta}</p>
        <p className="flex items-center gap-1 text-[11px] text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          Duplicada · conferir
        </p>
      </div>
    );
  if (item.situacaoIdentificacao === "sem_plaqueta")
    return (
      <div className="space-y-0.5">
        <p className="font-medium">{etiqueta}</p>
        <p className="text-[11px] text-sky-700">Identificação interna</p>
      </div>
    );
  return <span className="font-medium">{etiqueta}</span>;
}

function taxaFrete(item: any) {
  const taxaPersistida = num(item.fretePorMetroCubico);
  if (taxaPersistida || !num(item.frete)) return taxaPersistida;
  const volume = num(item.volumeTotal);
  return volume ? num(item.frete) / volume : 0;
}

export default function EstoquePage() {
  const [categoria, setCategoria] = useState<"toras" | "serrado">("toras");
  const [filtrosCargas, setFiltrosCargas] = useState({
    dataInicial: "",
    dataFinal: "",
    origem: "",
  });
  const [filtrosSerrado, setFiltrosSerrado] = useState({
    essencia: "",
    espessura: "",
    largura: "",
    comprimento: "",
  });
  const [gruposSerradoExpandidos, setGruposSerradoExpandidos] = useState<
    Set<string>
  >(() => new Set());
  const [buscaPlaquetas, setBuscaPlaquetas] = useState("");
  const [estadoPlaquetas, setEstadoPlaquetas] = useState<
    "" | "disponivel" | "consumida" | "cancelada"
  >("");
  const [deslocamentoPlaquetas, setDeslocamentoPlaquetas] = useState(0);
  const [dialogCarga, setDialogCarga] = useState(false);
  const [dialogImportacao, setDialogImportacao] = useState(false);
  const [cargaEmEdicao, setCargaEmEdicao] = useState<number | null>(null);
  const [cargaParaExcluir, setCargaParaExcluir] = useState<{
    id: number;
    numero: string;
  } | null>(null);
  const [cargaParaPdf, setCargaParaPdf] = useState<{
    id: number;
    numero: string;
  } | null>(null);
  const [plaquetaRastreadaId, setPlaquetaRastreadaId] = useState<number | null>(null);
  const [volumeRegularizado, setVolumeRegularizado] = useState("");
  const [justificativaRegularizacao, setJustificativaRegularizacao] = useState("");
  const [carga, setCarga] = useState<CargaFormulario>(novaCarga);
  const referenciasPlaquetasCarga = useRef<Record<number, HTMLInputElement | null>>({});
  const [indicePlaquetaParaFoco, setIndicePlaquetaParaFoco] = useState<number | null>(null);
  const [cabecalhoImportacao, setCabecalhoImportacao] =
    useState<CabecalhoCarga>(novoCabecalhoCarga);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [avisosImportacao, setAvisosImportacao] = useState<string[]>([]);
  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [nomeNovoFornecedor, setNomeNovoFornecedor] = useState("");
  const [contextoFornecedor, setContextoFornecedor] = useState<
    "carga" | "importacao" | null
  >(null);
  const [cargasSelecionadas, setCargasSelecionadas] = useState<number[]>([]);
  const [edicaoLoteCargasAberta, setEdicaoLoteCargasAberta] = useState(false);
  const [camposLoteCargas, setCamposLoteCargas] = useState({ dataCarga: false, dataVencimento: false, origem: false, fornecedorId: false, responsavel: false, observacoes: false, fretePorMetroCubico: false });
  const [cabecalhoLoteCargas, setCabecalhoLoteCargas] = useState<CabecalhoCarga>(novoCabecalhoCarga);
  const carregouEdicao = useRef<number | null>(null);
  const utils = trpc.useUtils();
  const buscaUrl = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    const parametros = new URLSearchParams(buscaUrl);
    const estado = parametros.get("estado");
    const busca = parametros.get("busca") ?? "";
    const filtroDisponivel = estado === "disponivel";
    setEstadoPlaquetas(filtroDisponivel ? "disponivel" : "");
    if (filtroDisponivel) setCategoria("toras");
    setBuscaPlaquetas(busca);
    setDeslocamentoPlaquetas(0);
  }, [buscaUrl]);
  const filtrosCargasAtivos = useMemo(
    () => ({
      dataInicial: filtrosCargas.dataInicial || undefined,
      dataFinal: filtrosCargas.dataFinal || undefined,
      origem: filtrosCargas.origem || undefined,
    }),
    [filtrosCargas]
  );
  const cargas = trpc.producao.cargas.list.useQuery(filtrosCargasAtivos);
  const fornecedores = trpc.financeiro.fornecedores.list.useQuery();
  const detalheCarga = trpc.producao.cargas.get.useQuery(
    { id: cargaEmEdicao ?? 1 },
    { enabled: cargaEmEdicao !== null }
  );
  const modeloPlaquetasCsv = trpc.producao.cargas.modeloPlaquetasCsv.useQuery(
    undefined,
    { enabled: false }
  );
  const plaquetas = trpc.producao.plaquetas.list.useQuery({
    busca: buscaPlaquetas || undefined,
    estado: estadoPlaquetas || undefined,
    limite: 10,
    deslocamento: deslocamentoPlaquetas,
  });
  const rastreabilidadePlaqueta = trpc.producao.plaquetas.rastreabilidade.useQuery(
    { id: plaquetaRastreadaId ?? 1 },
    { enabled: plaquetaRastreadaId !== null }
  );
  const regularizarVolumeConsumido = trpc.producao.plaquetas.regularizarVolumeConsumido.useMutation({
    onSuccess: () => {
      toast.success("Volume regularizado com trilha de auditoria");
      setVolumeRegularizado("");
      setJustificativaRegularizacao("");
      void utils.producao.plaquetas.rastreabilidade.invalidate();
      void utils.producao.plaquetas.list.invalidate();
      void utils.producao.romaneios.list.invalidate();
    },
    onError: erro => toast.error(erro.message),
  });
  const serrado = trpc.producao.estoque.resumo.useQuery();
  const serradoProprio = useMemo(
    () =>
      (serrado.data ?? []).filter(
        (item: any) => item.propriedade !== "terceiro"
      ),
    [serrado.data]
  );
  const serradoVisivel = useMemo(() => {
    const correspondeMedida = (valor: string | number, filtro: string) =>
      !filtro.trim() || Math.abs(num(valor) - num(filtro)) < 0.0001;
    const essencia = filtrosSerrado.essencia.trim().toLocaleLowerCase("pt-BR");
    return (serrado.data ?? []).filter(
      (item: any) =>
        (!essencia ||
          String(item.madeiraNome ?? "")
            .toLocaleLowerCase("pt-BR")
            .includes(essencia)) &&
        correspondeMedida(item.espessura, filtrosSerrado.espessura) &&
        correspondeMedida(item.largura, filtrosSerrado.largura) &&
        correspondeMedida(item.comprimento, filtrosSerrado.comprimento)
    );
  }, [filtrosSerrado, serrado.data]);
  const gruposSerradoVisiveis = useMemo(() => {
    const grupos = new Map<
      string,
      {
        chave: string;
        madeiraNome: string;
        espessura: number;
        largura: number;
        propriedade: "proprio" | "terceiro";
        clienteProprietarioId: number | null;
        quantidadeEntrada: number;
        quantidadeSaida: number;
        quantidadeDisponivel: number;
        volumeDisponivel: number;
        itens: any[];
      }
    >();
    serradoVisivel.forEach((item: any) => {
      const espessura = num(item.espessura);
      const largura = num(item.largura);
      const propriedade =
        item.propriedade === "terceiro" ? "terceiro" : "proprio";
      const clienteProprietarioId = item.clienteProprietarioId ?? null;
      const chave = [
        String(item.madeiraNome ?? "")
          .trim()
          .toLocaleUpperCase("pt-BR"),
        espessura.toFixed(2),
        largura.toFixed(2),
        propriedade,
        clienteProprietarioId ?? "",
      ].join("|");
      const grupo: {
        chave: string;
        madeiraNome: string;
        espessura: number;
        largura: number;
        propriedade: "proprio" | "terceiro";
        clienteProprietarioId: number | null;
        quantidadeEntrada: number;
        quantidadeSaida: number;
        quantidadeDisponivel: number;
        volumeDisponivel: number;
        itens: any[];
      } = grupos.get(chave) ?? {
        chave,
        madeiraNome: item.madeiraNome,
        espessura,
        largura,
        propriedade,
        clienteProprietarioId,
        quantidadeEntrada: 0,
        quantidadeSaida: 0,
        quantidadeDisponivel: 0,
        volumeDisponivel: 0,
        itens: [] as any[],
      };
      grupo.quantidadeEntrada += num(item.quantidadeEntrada);
      grupo.quantidadeSaida += num(item.quantidadeSaida);
      grupo.quantidadeDisponivel += num(item.quantidadeDisponivel);
      grupo.volumeDisponivel += num(item.volumeDisponivel);
      grupo.itens.push(item);
      grupos.set(chave, grupo);
    });
    return Array.from(grupos.values())
      .map(grupo => ({
        ...grupo,
        volumeDisponivel: Number(grupo.volumeDisponivel.toFixed(6)),
        itens: grupo.itens.sort(
          (a, b) => num(a.comprimento) - num(b.comprimento)
        ),
      }))
      .sort(
        (a, b) =>
          a.madeiraNome.localeCompare(b.madeiraNome, "pt-BR") ||
          a.espessura - b.espessura ||
          a.largura - b.largura
      );
  }, [serradoVisivel]);
  const totaisSerradoFiltrado = useMemo(
    () =>
      serradoVisivel.reduce(
        (totais, item: any) => ({
          entradas: totais.entradas + num(item.quantidadeEntrada),
          saidas: totais.saidas + num(item.quantidadeSaida),
          quantidade: totais.quantidade + num(item.quantidadeDisponivel),
          volume: totais.volume + num(item.volumeDisponivel),
        }),
        { entradas: 0, saidas: 0, quantidade: 0, volume: 0 }
      ),
    [serradoVisivel]
  );
  const criarCarga = trpc.producao.cargas.create.useMutation();
  const atualizarCarga = trpc.producao.cargas.update.useMutation();
  const excluirCarga = trpc.producao.cargas.excluir.useMutation();
  const importarPlaquetasCsv =
    trpc.producao.cargas.importarPlaquetasCsv.useMutation();
  const atualizarCabecalhoCargasLote =
    trpc.producao.cargas.atualizarCabecalhoEmLote.useMutation();
  const criarFornecedor = trpc.financeiro.fornecedores.create.useMutation();

  const abrirNovoFornecedor = (contexto: "carga" | "importacao") => {
    setContextoFornecedor(contexto);
    setNovoFornecedorAberto(true);
  };
  const salvarNovoFornecedor = () => {
    const nome = nomeNovoFornecedor.trim();
    if (nome.length < 2) {
      toast.error("Informe o nome do fornecedor.");
      return;
    }
    criarFornecedor.mutate(
      { nome },
      {
        onSuccess: fornecedor => {
          const fornecedorId = String(fornecedor.id);
          if (contextoFornecedor === "carga")
            setCarga(anterior => ({ ...anterior, fornecedorId }));
          if (contextoFornecedor === "importacao")
            setCabecalhoImportacao(anterior => ({ ...anterior, fornecedorId }));
          toast.success("Fornecedor criado e selecionado.");
          setNomeNovoFornecedor("");
          setNovoFornecedorAberto(false);
          setContextoFornecedor(null);
          utils.financeiro.fornecedores.list.invalidate();
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };
  const alternarSelecaoCarga = (id: number) => setCargasSelecionadas(selecionadas => selecionadas.includes(id) ? selecionadas.filter(item => item !== id) : [...selecionadas, id]);
  const salvarCabecalhoLoteCargas = () => {
    if (!cargasSelecionadas.length) return;
    if (!Object.entries(camposLoteCargas).some(([campo, marcado]) => marcado && campo !== "fretePorMetroCubico")) { toast.error("Selecione ao menos um dado de cabeçalho para alterar"); return; }
    if (camposLoteCargas.dataCarga && !cabecalhoLoteCargas.dataCarga) { toast.error("Informe a nova data da carga"); return; }
    if (camposLoteCargas.dataVencimento && !cabecalhoLoteCargas.dataVencimento) { toast.error("Informe o novo vencimento"); return; }
    if (camposLoteCargas.fornecedorId && !cabecalhoLoteCargas.fornecedorId) { toast.error("Selecione o fornecedor"); return; }
    atualizarCabecalhoCargasLote.mutate({ ids: cargasSelecionadas, dataCarga: camposLoteCargas.dataCarga ? cabecalhoLoteCargas.dataCarga : undefined, dataVencimento: camposLoteCargas.dataVencimento ? cabecalhoLoteCargas.dataVencimento : undefined, origem: camposLoteCargas.origem ? cabecalhoLoteCargas.origem.trim() || null : undefined, fornecedorId: camposLoteCargas.fornecedorId ? Number(cabecalhoLoteCargas.fornecedorId) : undefined, responsavel: camposLoteCargas.responsavel ? cabecalhoLoteCargas.responsavel.trim() || null : undefined, observacoes: camposLoteCargas.observacoes ? cabecalhoLoteCargas.observacoes.trim() || null : undefined }, {
      onSuccess: () => { toast.success(`${cargasSelecionadas.length} romaneio(s) atualizado(s)`); setCargasSelecionadas([]); setEdicaoLoteCargasAberta(false); utils.producao.cargas.list.invalidate(); }, onError: erro => toast.error(erro.message),
    });
  };

  useEffect(() => {
    const detalhe = detalheCarga.data;
    if (
      !detalhe ||
      cargaEmEdicao === null ||
      carregouEdicao.current === cargaEmEdicao
    )
      return;
    carregouEdicao.current = cargaEmEdicao;
    setCarga({
      dataCarga: new Date(detalhe.carga.dataCarga).toISOString().slice(0, 10),
      dataVencimento: new Date(detalhe.carga.dataVencimento)
        .toISOString()
        .slice(0, 10),
      origem: detalhe.carga.origem ?? "",
      fornecedorId: detalhe.carga.fornecedorId
        ? String(detalhe.carga.fornecedorId)
        : "",
      responsavel: detalhe.carga.responsavel ?? "",
      observacoes: detalhe.carga.observacoes ?? "",
      fretePorMetroCubico: String(taxaFrete(detalhe.carga)),
      plaquetas: detalhe.plaquetas.map((item: any) => ({
        codigo:
          item.codigoFisico ??
          (item.situacaoIdentificacao === "sem_plaqueta" ? "" : item.codigo),
        madeiraNome: item.madeiraNome,
        diametro: String(item.diametro ?? ""),
        comprimento: String(item.comprimento ?? ""),
        valorMetroCubico: String(item.valorMetroCubico ?? ""),
        observacoes: item.observacoes ?? "",
      })),
    });
  }, [cargaEmEdicao, detalheCarga.data]);

  const totais = useMemo(() => {
    const volume = carga.plaquetas.reduce(
      (total, item) => total + volumeTora(item.diametro, item.comprimento),
      0
    );
    const valorProdutos = carga.plaquetas.reduce(
      (total, item) =>
        total +
        valorTora(item.diametro, item.comprimento, item.valorMetroCubico),
      0
    );
    const fretePorMetroCubico = num(carga.fretePorMetroCubico);
    const frete = volume * fretePorMetroCubico;
    return {
      plaquetas: carga.plaquetas.length,
      volume,
      valorProdutos,
      fretePorMetroCubico,
      frete,
      valorTotal: valorProdutos + frete,
    };
  }, [carga]);

  const plaquetasVisiveis = plaquetas.data?.itens ?? [];
  const torasDisponiveis = plaquetas.data?.totalDisponiveis ?? 0;
  const podeExcluirRomaneio = user?.role === "admin";
  const edicaoSomenteCabecalhoCarga = Boolean(cargaEmEdicao && detalheCarga.data?.plaquetas.some((plaqueta: any) => plaqueta.estado !== "disponivel"));
  const salvando = criarCarga.isPending || atualizarCarga.isPending || atualizarCabecalhoCargasLote.isPending;
  const excluindo = excluirCarga.isPending;
  const redefinirCarga = () => {
    carregouEdicao.current = null;
    setCarga(novaCarga());
    setCargaEmEdicao(null);
  };
  const fecharDialogo = () => {
    setDialogCarga(false);
    redefinirCarga();
  };
  const abrirNovoRomaneio = () => {
    redefinirCarga();
    setDialogCarga(true);
  };
  const abrirImportacao = () => {
    setCabecalhoImportacao(novoCabecalhoCarga());
    setArquivoImportacao(null);
    setErrosImportacao([]);
    setAvisosImportacao([]);
    setDialogImportacao(true);
  };
  const abrirEdicao = (id: number) => {
    carregouEdicao.current = null;
    setCarga(novaCarga());
    setCargaEmEdicao(id);
    setDialogCarga(true);
  };
  const atualizarPlaqueta = (
    indice: number,
    campo: keyof PlaquetaCarga,
    valor: string
  ) =>
    setCarga(anterior => ({
      ...anterior,
      plaquetas: anterior.plaquetas.map((item, posicao) =>
        posicao === indice ? { ...item, [campo]: valor } : item
      ),
    }));
  const adicionarPlaqueta = (focarPlaqueta = false) => {
    const proximoIndice = carga.plaquetas.length;
    setCarga(anterior => {
      const ultimaPlaqueta = anterior.plaquetas.at(-1);
      const proximaPlaqueta = {
        ...novaPlaqueta(),
        madeiraNome: ultimaPlaqueta?.madeiraNome ?? "",
        valorMetroCubico: ultimaPlaqueta?.valorMetroCubico ?? "",
      };
      return {
        ...anterior,
        plaquetas: [...anterior.plaquetas, proximaPlaqueta],
      };
    });
    if (focarPlaqueta) setIndicePlaquetaParaFoco(proximoIndice);
  };
  useEffect(() => {
    if (indicePlaquetaParaFoco === null) return;
    const quadro = requestAnimationFrame(() => {
      referenciasPlaquetasCarga.current[indicePlaquetaParaFoco]?.focus();
      setIndicePlaquetaParaFoco(null);
    });
    return () => cancelAnimationFrame(quadro);
  }, [carga.plaquetas.length, indicePlaquetaParaFoco]);
  const removerPlaqueta = (indice: number) =>
    setCarga(anterior => ({
      ...anterior,
      plaquetas: anterior.plaquetas.filter((_, posicao) => posicao !== indice),
    }));
  const carregarPdf = (id: number, numero: string) =>
    setCargaParaPdf({ id, numero });
  const alternarGrupoSerrado = (chave: string) =>
    setGruposSerradoExpandidos(anteriores => {
      const proximos = new Set(anteriores);
      if (proximos.has(chave)) proximos.delete(chave);
      else proximos.add(chave);
      return proximos;
    });
  const confirmarExclusao = () => {
    if (!cargaParaExcluir) return;
    const cargaExcluida = cargaParaExcluir;
    excluirCarga.mutate(
      { id: cargaExcluida.id },
      {
        onSuccess: resultado => {
          toast.success(
            `${resultado.numero} excluído com ${resultado.totalPlaquetas} plaqueta(s) removida(s)`
          );
          if (cargaEmEdicao === cargaExcluida.id) fecharDialogo();
          setCargaParaExcluir(null);
          utils.producao.cargas.list.invalidate();
          utils.producao.plaquetas.list.invalidate();
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };

  const baixarModeloImportacao = async () => {
    const resposta = await modeloPlaquetasCsv.refetch();
    if (!resposta.data) {
      toast.error("Não foi possível gerar o modelo de planilha");
      return;
    }
    baixarCsv(resposta.data, "modelo-importacao-toras-fk-madeiras.csv");
    toast.success("Modelo de planilha baixado");
  };

  const importarArquivo = async () => {
    if (!arquivoImportacao) {
      toast.error("Selecione uma planilha CSV para importar");
      return;
    }
    try {
      const conteudo = await arquivoImportacao.text();
      importarPlaquetasCsv.mutate(
        {
          ...cabecalhoImportacao,
          origem: cabecalhoImportacao.origem || null,
          fornecedorId: cabecalhoImportacao.fornecedorId
            ? Number(cabecalhoImportacao.fornecedorId)
            : null,
          responsavel: cabecalhoImportacao.responsavel || null,
          observacoes: cabecalhoImportacao.observacoes || null,
          conteudo,
        },
        {
          onSuccess: resultado => {
            if (resultado.erros.length) {
              setErrosImportacao(resultado.erros);
              setAvisosImportacao(resultado.avisos ?? []);
              toast.error(
                "A importação foi recusada. Revise as linhas indicadas."
              );
              return;
            }
            if (resultado.avisos?.length)
              toast.warning(
                `${resultado.avisos.length} tora(s) exigem atenção na identificação.`
              );
            toast.success(
              `${resultado.numero} criado com ${resultado.importados} tora(s)`
            );
            setDialogImportacao(false);
            setArquivoImportacao(null);
            setErrosImportacao([]);
            setAvisosImportacao([]);
            utils.producao.cargas.list.invalidate();
            utils.producao.plaquetas.list.invalidate();
          },
          onError: erro => toast.error(erro.message),
        }
      );
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };

  const salvarCarga = () => {
    const entrada = {
      ...carga,
      origem: carga.origem || null,
      fornecedorId: carga.fornecedorId ? Number(carga.fornecedorId) : null,
      responsavel: carga.responsavel || null,
      observacoes: carga.observacoes || null,
      plaquetas: carga.plaquetas.map(item => ({
        ...item,
        observacoes: item.observacoes || null,
      })),
    };
    const sucesso = (resultado: { numero: string; totalPlaquetas: number }) => {
      toast.success(
        `${resultado.numero} salvo com ${resultado.totalPlaquetas} plaqueta(s)`
      );
      fecharDialogo();
      utils.producao.cargas.list.invalidate();
      utils.producao.plaquetas.list.invalidate();
      if (cargaEmEdicao)
        utils.producao.cargas.get.invalidate({ id: cargaEmEdicao });
    };
    const erro = (motivo: { message: string }) => toast.error(motivo.message);
    if (cargaEmEdicao && edicaoSomenteCabecalhoCarga) {
      atualizarCabecalhoCargasLote.mutate(
        {
          ids: [cargaEmEdicao],
          dataCarga: entrada.dataCarga,
          dataVencimento: entrada.dataVencimento,
          origem: entrada.origem,
          fornecedorId: entrada.fornecedorId,
          responsavel: entrada.responsavel,
          observacoes: entrada.observacoes,
          fretePorMetroCubico: entrada.fretePorMetroCubico,
        },
        {
          onSuccess: () => {
            toast.success("Cabeçalho atualizado sem alterar as toras já utilizadas.");
            fecharDialogo();
            utils.producao.cargas.list.invalidate();
            utils.producao.plaquetas.list.invalidate();
            utils.producao.cargas.get.invalidate({ id: cargaEmEdicao });
          },
          onError: erro,
        }
      );
      return;
    }
    if (cargaEmEdicao)
      atualizarCarga.mutate(
        { id: cargaEmEdicao, ...entrada },
        { onSuccess: sucesso, onError: erro }
      );
    else criarCarga.mutate(entrada, { onSuccess: sucesso, onError: erro });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={Warehouse}
        eyebrow="Pátio e armazenamento"
        title="Estoque"
        description="Controle cargas de toras recebidas, plaquetas e peças serradas disponíveis para a operação."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Resumo
          icone={<ClipboardList />}
          titulo="Cargas recebidas"
          valor={(cargas.data ?? []).length}
          detalhe="Romaneios de toras"
          cor="sky"
        />
        <Resumo
          icone={<TreePine />}
          titulo="Toras disponíveis"
          valor={torasDisponiveis}
          detalhe="Prontas para a produção"
          cor="emerald"
        />
        <Resumo
          icone={<Box />}
          titulo="Peças serradas"
          valor={serradoProprio.reduce(
            (total: number, item: any) => total + item.quantidadeDisponivel,
            0
          )}
          detalhe="Estoque próprio para entrega"
          cor="amber"
        />
        <Resumo
          icone={<Warehouse />}
          titulo="Volume serrado"
          valor={`${formatarNumero(serradoProprio.reduce((total: number, item: any) => total + num(item.volumeDisponivel), 0))} m³`}
          detalhe="Saldo próprio por dimensões"
          cor="violet"
        />
      </div>
      <Tabs
        value={categoria}
        onValueChange={valor => setCategoria(valor as typeof categoria)}
      >
        <TabsList>
          <TabsTrigger value="toras">Toras</TabsTrigger>
          <TabsTrigger value="serrado">Serrado</TabsTrigger>
        </TabsList>
      </Tabs>
      {categoria === "toras" && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Romaneios de carga</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cada carga agrupa as plaquetas, o frete e os valores
                  calculados automaticamente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/estoque/plaquetas">
                    <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                    Relatório de plaquetas
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={abrirImportacao}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Importar planilha
                </Button>
                <Button size="sm" onClick={abrirNovoRomaneio}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Novo romaneio de carga
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-b bg-muted/10 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Campo label="Período inicial">
                <Input
                  aria-label="Período inicial"
                  type="date"
                  value={filtrosCargas.dataInicial}
                  onChange={evento =>
                    setFiltrosCargas(anterior => ({
                      ...anterior,
                      dataInicial: evento.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Período final">
                <Input
                  aria-label="Período final"
                  type="date"
                  value={filtrosCargas.dataFinal}
                  onChange={evento =>
                    setFiltrosCargas(anterior => ({
                      ...anterior,
                      dataFinal: evento.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Origem">
                <Input
                  aria-label="Filtrar por origem"
                  value={filtrosCargas.origem}
                  onChange={evento =>
                    setFiltrosCargas(anterior => ({
                      ...anterior,
                      origem: evento.target.value,
                    }))
                  }
                  placeholder="Fornecedor ou fazenda"
                />
              </Campo>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={
                  !filtrosCargas.dataInicial &&
                  !filtrosCargas.dataFinal &&
                  !filtrosCargas.origem
                }
                onClick={() =>
                  setFiltrosCargas({
                    dataInicial: "",
                    dataFinal: "",
                    origem: "",
                  })
                }
              >
                Limpar filtros
              </Button>
            </div>
            {cargasSelecionadas.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50/60 px-5 py-3"><p className="text-sm font-medium text-amber-950">{cargasSelecionadas.length} romaneio(s) selecionado(s)</p><Button size="sm" onClick={() => setEdicaoLoteCargasAberta(true)}>Alterar cabeçalho em lote</Button></div>}
            {cargas.isLoading ? (
              <Carregando />
            ) : cargas.data?.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><input aria-label="Selecionar todos os romaneios de carga" type="checkbox" checked={cargas.data.length > 0 && cargasSelecionadas.length === cargas.data.length} onChange={evento => setCargasSelecionadas(evento.target.checked ? cargas.data.map((item: any) => item.id) : [])} /></TableHead>
                      <TableHead>Romaneio</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Plaquetas</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Frete/m³</TableHead>
                      <TableHead className="text-right">Frete total</TableHead>
                      <TableHead className="text-right">Valor total</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cargas.data.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell><input aria-label={`Selecionar romaneio ${item.numero}`} type="checkbox" checked={cargasSelecionadas.includes(item.id)} onChange={() => alternarSelecaoCarga(item.id)} /></TableCell>
                        <TableCell className="font-medium">
                          {item.numero}
                        </TableCell>
                        <TableCell>{formatarData(item.dataCarga)}</TableCell>
                        <TableCell>{item.origem || "—"}</TableCell>
                        <TableCell>{item.responsavel || "—"}</TableCell>
                        <TableCell className="text-right">
                          {item.totalPlaquetas}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatarNumero(item.volumeTotal)} m³
                        </TableCell>
                        <TableCell className="text-right">
                          {formatarMoeda(taxaFrete(item))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatarMoeda(item.frete)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatarMoeda(item.valorTotal)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar romaneio"
                              aria-label={`Editar ${item.numero}`}
                              onClick={() => abrirEdicao(item.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Gerar PDF"
                              aria-label={`Gerar PDF de ${item.numero}`}
                              onClick={() => carregarPdf(item.id, item.numero)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            {podeExcluirRomaneio && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir romaneio"
                                aria-label={`Excluir ${item.numero}`}
                                onClick={() =>
                                  setCargaParaExcluir({
                                    id: item.id,
                                    numero: item.numero,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Vazio
                icone={<ClipboardList />}
                texto="Nenhum romaneio encontrado para os filtros informados."
              />
            )}
          </section>
          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-semibold">Plaquetas no estoque</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Exibindo 10 entradas por vez. Pesquise por plaqueta ou
                  essência para localizar uma tora.
                </p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-lg">
                <Campo label="Pesquisar plaqueta ou essência">
                  <Input
                    aria-label="Pesquisar plaqueta ou essência"
                    value={buscaPlaquetas}
                    onChange={evento => {
                      setBuscaPlaquetas(evento.target.value);
                      setDeslocamentoPlaquetas(0);
                    }}
                    placeholder="Código ou essência"
                  />
                </Campo>
                <Campo label="Situação">
                  <select
                    aria-label="Filtrar situação das plaquetas"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={estadoPlaquetas}
                    onChange={evento => {
                      setEstadoPlaquetas(
                        evento.target.value as typeof estadoPlaquetas
                      );
                      setDeslocamentoPlaquetas(0);
                    }}
                  >
                    <option value="">Todas</option>
                    <option value="disponivel">Disponíveis</option>
                    <option value="consumida">Consumidas</option>
                    <option value="cancelada">Canceladas</option>
                  </select>
                </Campo>
              </div>
            </div>
            {plaquetas.isLoading ? (
              <Carregando />
            ) : plaquetasVisiveis.length ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Essência</TableHead>
                        <TableHead className="text-right">Diâmetro</TableHead>
                        <TableHead className="text-right">
                          Comprimento
                        </TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">R$/m³</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plaquetasVisiveis.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <button
                              type="button"
                              className="rounded text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Ver rastreabilidade de ${etiquetaPlaqueta(item)}`}
                              onClick={() => setPlaquetaRastreadaId(item.id)}
                            >
                              <IdentificacaoTora item={item} />
                            </button>
                          </TableCell>
                          <TableCell>{item.madeiraNome}</TableCell>
                          <TableCell className="text-right">
                            {item.diametro
                              ? `${formatarNumero(item.diametro, 2)} cm`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.comprimento
                              ? `${formatarNumero(item.comprimento, 2)} m`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarNumero(item.volumeDisponivel)} m³
                          </TableCell>
                          <TableCell className="text-right">
                            {formatarMoeda(item.valorMetroCubico)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatarMoeda(item.valorTotal)}
                          </TableCell>
                          <TableCell>
                            <EstadoTora estado={item.estado} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-3 border-t bg-muted/10 px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Exibindo {deslocamentoPlaquetas + 1}–
                    {deslocamentoPlaquetas + plaquetasVisiveis.length} de{" "}
                    {plaquetas.data?.total ?? 0} plaqueta(s).
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={deslocamentoPlaquetas === 0}
                      onClick={() =>
                        setDeslocamentoPlaquetas(anterior =>
                          Math.max(0, anterior - 10)
                        )
                      }
                    >
                      Anteriores
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={plaquetas.data?.proximoDeslocamento === null}
                      onClick={() =>
                        setDeslocamentoPlaquetas(
                          plaquetas.data?.proximoDeslocamento ??
                            deslocamentoPlaquetas
                        )
                      }
                    >
                      Próximas 10
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <Vazio
                icone={<TreePine />}
                texto={
                  buscaPlaquetas
                    ? "Nenhuma plaqueta encontrada para a pesquisa."
                    : "Nenhuma plaqueta recebida no estoque."
                }
              />
            )}
          </section>
        </div>
      )}
      {categoria === "serrado" && (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b bg-muted/20 px-5 py-4">
            <h2 className="font-semibold">Estoque serrado</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Peças originadas em romaneios de produção, agrupadas por essência
              e medida. Peças de terceiros aparecem identificadas, mas não
              compõem o estoque disponível para venda.
            </p>
          </div>
          {serrado.isLoading ? (
            <Carregando />
          ) : !serrado.data?.length ? (
            <Vazio
              icone={<Box />}
              texto="As peças confirmadas na Produção aparecerão aqui."
            />
          ) : (
            <>
              <div className="grid gap-3 border-b bg-muted/10 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] lg:items-end">
                <Campo label="Essência">
                  <Input
                    aria-label="Filtrar essência serrada"
                    value={filtrosSerrado.essencia}
                    onChange={evento =>
                      setFiltrosSerrado(anterior => ({
                        ...anterior,
                        essencia: evento.target.value,
                      }))
                    }
                    placeholder="Ex.: Cedrinho"
                  />
                </Campo>
                <Campo label="Espessura (cm)">
                  <Input
                    aria-label="Filtrar espessura serrada"
                    inputMode="decimal"
                    value={filtrosSerrado.espessura}
                    onChange={evento =>
                      setFiltrosSerrado(anterior => ({
                        ...anterior,
                        espessura: evento.target.value,
                      }))
                    }
                    placeholder="Ex.: 2,3"
                  />
                </Campo>
                <Campo label="Largura (cm)">
                  <Input
                    aria-label="Filtrar largura serrada"
                    inputMode="decimal"
                    value={filtrosSerrado.largura}
                    onChange={evento =>
                      setFiltrosSerrado(anterior => ({
                        ...anterior,
                        largura: evento.target.value,
                      }))
                    }
                    placeholder="Ex.: 10"
                  />
                </Campo>
                <Campo label="Comprimento (m)">
                  <Input
                    aria-label="Filtrar comprimento serrado"
                    inputMode="decimal"
                    value={filtrosSerrado.comprimento}
                    onChange={evento =>
                      setFiltrosSerrado(anterior => ({
                        ...anterior,
                        comprimento: evento.target.value,
                      }))
                    }
                    placeholder="Ex.: 2,50"
                  />
                </Campo>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!Object.values(filtrosSerrado).some(Boolean)}
                  onClick={() =>
                    setFiltrosSerrado({
                      essencia: "",
                      espessura: "",
                      largura: "",
                      comprimento: "",
                    })
                  }
                >
                  Limpar filtros
                </Button>
              </div>
              {serradoVisivel.length ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Essência e medida</TableHead>
                          <TableHead className="text-right">
                            Comprimentos
                          </TableHead>
                          <TableHead className="text-right">Entradas</TableHead>
                          <TableHead className="text-right">Saídas</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gruposSerradoVisiveis.map(grupo => {
                          const expandido = gruposSerradoExpandidos.has(
                            grupo.chave
                          );
                          const medida = `${formatarNumero(grupo.espessura, 2)} × ${formatarNumero(grupo.largura, 2)} cm`;
                          return (
                            <GrupoEstoqueSerrado
                              key={grupo.chave}
                              grupo={grupo}
                              expandido={expandido}
                              medida={medida}
                              onAlternar={() =>
                                alternarGrupoSerrado(grupo.chave)
                              }
                            />
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div
                    data-testid="total-filtrado-serrado"
                    className="flex flex-col gap-1 border-t bg-primary/[0.035] px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-foreground">
                      Total filtrado
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        +{formatarNumero(totaisSerradoFiltrado.entradas, 0)} entradas
                      </strong>{" · "}
                      <strong className="text-amber-700 dark:text-amber-400">
                        −{formatarNumero(totaisSerradoFiltrado.saidas, 0)} saídas
                      </strong>{" · "}
                      <strong className="text-foreground">
                        {formatarNumero(totaisSerradoFiltrado.quantidade, 0)}{" "}
                        {Math.abs(totaisSerradoFiltrado.quantidade) === 1
                          ? "peça em estoque"
                          : "peças em estoque"}
                      </strong>{" "}
                      ·{" "}
                      <strong className="text-foreground">
                        {formatarNumero(totaisSerradoFiltrado.volume)} m³
                      </strong>
                    </span>
                  </div>
                </>
              ) : (
                <Vazio
                  icone={<Box />}
                  texto="Nenhuma peça encontrada para os filtros informados."
                />
              )}
            </>
          )}
        </section>
      )}
      <Dialog open={edicaoLoteCargasAberta} onOpenChange={aberto => { if (!aberto) setEdicaoLoteCargasAberta(false); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Alterar cabeçalho de romaneios de carga</DialogTitle><DialogDescription>As plaquetas, volumes, valores e fretes das cargas não serão modificados. Marque somente os campos que devem receber o novo valor nos {cargasSelecionadas.length} romaneio(s) selecionados.</DialogDescription></DialogHeader><div className="space-y-3"><CampoLote marcado={camposLoteCargas.dataCarga} aoAlternar={marcado => setCamposLoteCargas(atual => ({ ...atual, dataCarga: marcado }))} rotulo="Data da carga"><Input type="date" disabled={!camposLoteCargas.dataCarga} value={cabecalhoLoteCargas.dataCarga} onChange={evento => setCabecalhoLoteCargas(atual => ({ ...atual, dataCarga: evento.target.value }))} /></CampoLote><CampoLote marcado={camposLoteCargas.dataVencimento} aoAlternar={marcado => setCamposLoteCargas(atual => ({ ...atual, dataVencimento: marcado }))} rotulo="Vencimento"><Input type="date" disabled={!camposLoteCargas.dataVencimento} value={cabecalhoLoteCargas.dataVencimento} onChange={evento => setCabecalhoLoteCargas(atual => ({ ...atual, dataVencimento: evento.target.value }))} /></CampoLote><CampoLote marcado={camposLoteCargas.origem} aoAlternar={marcado => setCamposLoteCargas(atual => ({ ...atual, origem: marcado }))} rotulo="Origem"><Input disabled={!camposLoteCargas.origem} value={cabecalhoLoteCargas.origem} onChange={evento => setCabecalhoLoteCargas(atual => ({ ...atual, origem: evento.target.value }))} placeholder="Fazenda, cidade ou origem" /></CampoLote><CampoLote marcado={camposLoteCargas.fornecedorId} aoAlternar={marcado => setCamposLoteCargas(atual => ({ ...atual, fornecedorId: marcado }))} rotulo="Fornecedor"><SearchableEntitySelect value={cabecalhoLoteCargas.fornecedorId} onValueChange={fornecedorId => setCabecalhoLoteCargas(atual => ({ ...atual, fornecedorId }))} disabled={!camposLoteCargas.fornecedorId} options={(fornecedores.data ?? []).map((fornecedor: any) => ({ value: String(fornecedor.id), label: fornecedor.nome, details: fornecedor.documento ?? "" }))} placeholder="Selecionar fornecedor" searchPlaceholder="Buscar fornecedor" ariaLabel="Fornecedor para alteração em lote" /></CampoLote><CampoLote marcado={camposLoteCargas.responsavel} aoAlternar={marcado => setCamposLoteCargas(atual => ({ ...atual, responsavel: marcado }))} rotulo="Responsável"><Input disabled={!camposLoteCargas.responsavel} value={cabecalhoLoteCargas.responsavel} onChange={evento => setCabecalhoLoteCargas(atual => ({ ...atual, responsavel: evento.target.value }))} /></CampoLote><CampoLote marcado={camposLoteCargas.observacoes} aoAlternar={marcado => setCamposLoteCargas(atual => ({ ...atual, observacoes: marcado }))} rotulo="Observações"><Textarea disabled={!camposLoteCargas.observacoes} value={cabecalhoLoteCargas.observacoes} onChange={evento => setCabecalhoLoteCargas(atual => ({ ...atual, observacoes: evento.target.value }))} /></CampoLote><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEdicaoLoteCargasAberta(false)}>Cancelar</Button><Button onClick={salvarCabecalhoLoteCargas} disabled={atualizarCabecalhoCargasLote.isPending}>{atualizarCabecalhoCargasLote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar alterações</Button></div></div></DialogContent></Dialog>
      <PdfPreviewDialog
        open={Boolean(cargaParaPdf)}
        onOpenChange={aberto => {
          if (!aberto) setCargaParaPdf(null);
        }}
        url={cargaParaPdf ? `/api/pdf/romaneio-carga/${cargaParaPdf.id}` : null}
        title={
          cargaParaPdf
            ? `Romaneio de Carga ${cargaParaPdf.numero}`
            : "Romaneio de Carga"
        }
        description="Confira as plaquetas, volumes e valores antes de confirmar o download."
      />
      <Dialog
        open={dialogCarga}
        onOpenChange={aberto => {
          if (!aberto) fecharDialogo();
          else setDialogCarga(true);
        }}
      >
        <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto p-4 sm:w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] sm:p-6 xl:max-w-[1440px]">
          <DialogHeader>
            <DialogTitle>
              {cargaEmEdicao
                ? "Editar romaneio de carga"
                : "Novo romaneio de carga"}
            </DialogTitle>
            <DialogDescription>
              Informe as toras recebidas; valores e frete são calculados
              automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {detalheCarga.isLoading && cargaEmEdicao ? (
              <Carregando />
            ) : (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-5 text-emerald-950">
                  Ao confirmar, esta entrada cria ou atualiza uma conta a pagar
                  de <strong>custo de matéria-prima</strong> com o valor total
                  da carga, incluindo o frete calculado.
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Campo label="Data da carga *">
                    <Input
                      type="date"
                      value={carga.dataCarga}
                      onChange={evento =>
                        setCarga(anterior => ({
                          ...anterior,
                          dataCarga: evento.target.value,
                        }))
                      }
                    />
                  </Campo>
                  <Campo label="Vencimento da conta a pagar *">
                    <Input
                      aria-label="Vencimento da conta a pagar"
                      type="date"
                      value={carga.dataVencimento}
                      onChange={evento =>
                        setCarga(anterior => ({
                          ...anterior,
                          dataVencimento: evento.target.value,
                        }))
                      }
                    />
                  </Campo>
                  <Campo label="Fornecedor">
                    <SearchableEntitySelect
                      ariaLabel="Fornecedor da carga"
                      value={carga.fornecedorId}
                      onValueChange={fornecedorId =>
                        setCarga(anterior => ({ ...anterior, fornecedorId }))
                      }
                      placeholder="Usar origem como contraparte"
                      searchPlaceholder="Digite o nome do fornecedor..."
                      createLabel="Criar novo fornecedor"
                      onCreate={() => abrirNovoFornecedor("carga")}
                      options={(fornecedores.data ?? []).map(
                        (fornecedor: any) => ({
                          value: String(fornecedor.id),
                          label: fornecedor.nome,
                          details:
                            fornecedor.contacto ?? fornecedor.email ?? null,
                        })
                      )}
                    />
                  </Campo>
                  <Campo label="Origem">
                    <Input
                      value={carga.origem}
                      onChange={evento =>
                        setCarga(anterior => ({
                          ...anterior,
                          origem: evento.target.value,
                        }))
                      }
                      placeholder="Fornecedor ou fazenda"
                    />
                  </Campo>
                  <Campo label="Responsável">
                    <Input
                      value={carga.responsavel}
                      onChange={evento =>
                        setCarga(anterior => ({
                          ...anterior,
                          responsavel: evento.target.value,
                        }))
                      }
                      placeholder="Quem recebeu"
                    />
                  </Campo>
                  <Campo
                    label="Frete por m³ (R$)"
                    ajuda="Ex.: R$ 30,00 × volume total"
                  >
                    <Input
                      aria-label="Frete por m³ (R$)"
                      inputMode="decimal"
                      value={carga.fretePorMetroCubico}
                      onChange={evento =>
                        setCarga(anterior => ({
                          ...anterior,
                          fretePorMetroCubico: evento.target.value,
                        }))
                      }
                      placeholder="0,00"
                    />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                  <IndicadorCarga rotulo="Plaquetas" valor={totais.plaquetas} />
                  <IndicadorCarga
                    rotulo="Volume total"
                    valor={`${formatarNumero(totais.volume)} m³`}
                  />
                  <IndicadorCarga
                    rotulo="Valor das toras"
                    valor={formatarMoeda(totais.valorProdutos)}
                  />
                  <IndicadorCarga
                    rotulo={`Frete (${formatarMoeda(totais.fretePorMetroCubico)}/m³)`}
                    valor={formatarMoeda(totais.frete)}
                  />
                  <IndicadorCarga
                    rotulo="Valor total da carga"
                    valor={formatarMoeda(totais.valorTotal)}
                    destaque
                  />
                </div>
                <section className="space-y-3 rounded-xl border bg-muted/10 p-3 sm:p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Toras da carga</h3>
                      <p className="text-xs text-muted-foreground">Preencha como uma planilha. A nova linha aproveita essência e preço da anterior; pressione Enter no último preço para incluir outra tora.</p>
                      {edicaoSomenteCabecalhoCarga && <p className="mt-1 text-xs font-medium text-amber-700">As toras já foram utilizadas. Nesta edição, apenas os dados do cabeçalho podem ser alterados.</p>}
                    </div>
                    <Badge variant="outline" className="w-fit">{carga.plaquetas.length} linha(s)</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-lg border bg-background">
                    <Table className="min-w-[1120px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead className="min-w-36">Plaqueta</TableHead>
                          <TableHead className="min-w-40">Essência *</TableHead>
                          <TableHead className="w-28">Diâm. cm *</TableHead>
                          <TableHead className="w-28">Comp. m *</TableHead>
                          <TableHead className="w-32">R$/m³ *</TableHead>
                          <TableHead className="w-28 text-right">Volume</TableHead>
                          <TableHead className="w-32 text-right">Valor</TableHead>
                          <TableHead className="min-w-36">Observação</TableHead>
                          <TableHead className="w-14" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carga.plaquetas.map((item, indice) => {
                          const volume = volumeTora(item.diametro, item.comprimento);
                          const valor = valorTora(item.diametro, item.comprimento, item.valorMetroCubico);
                          const codigoRepetido = Boolean(item.codigo.trim()) && carga.plaquetas.filter(outra => outra.codigo.trim().toLocaleUpperCase("pt-BR") === item.codigo.trim().toLocaleUpperCase("pt-BR")).length > 1;
                          const atualizar = (campo: keyof PlaquetaCarga) => (evento: React.ChangeEvent<HTMLInputElement>) => atualizarPlaqueta(indice, campo, evento.target.value);
                          return <TableRow key={indice} className={codigoRepetido ? "bg-amber-50/70 hover:bg-amber-50" : "hover:bg-muted/30"}>
                            <TableCell className="text-center text-sm font-medium text-muted-foreground">{indice + 1}</TableCell>
                            <TableCell className="py-2 align-top">
                              <Input ref={elemento => { referenciasPlaquetasCarga.current[indice] = elemento; }} aria-label={`Plaqueta ${indice + 1}`} value={item.codigo} onChange={atualizar("codigo")} placeholder="PLQ-001" disabled={edicaoSomenteCabecalhoCarga} className={codigoRepetido ? "border-amber-400" : ""} />
                              {codigoRepetido && <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-700"><AlertTriangle className="h-3 w-3" />Duplicada</p>}
                            </TableCell>
                            <TableCell><Input aria-label={`Essência ${indice + 1}`} value={item.madeiraNome} onChange={atualizar("madeiraNome")} placeholder="Cedrinho" disabled={edicaoSomenteCabecalhoCarga} /></TableCell>
                            <TableCell><Input aria-label={`Diâmetro ${indice + 1}`} inputMode="decimal" value={item.diametro} onChange={atualizar("diametro")} placeholder="0,00" disabled={edicaoSomenteCabecalhoCarga} /></TableCell>
                            <TableCell><Input aria-label={`Comprimento ${indice + 1}`} inputMode="decimal" value={item.comprimento} onChange={atualizar("comprimento")} placeholder="0,00" disabled={edicaoSomenteCabecalhoCarga} /></TableCell>
                            <TableCell><Input aria-label={`Preço por metro cúbico ${indice + 1}`} inputMode="decimal" value={item.valorMetroCubico} onChange={atualizar("valorMetroCubico")} onKeyDown={evento => { if (evento.key === "Enter" && indice === carga.plaquetas.length - 1) { evento.preventDefault(); adicionarPlaqueta(true); } }} placeholder="900,00" disabled={edicaoSomenteCabecalhoCarga} /></TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">{formatarNumero(volume)} m³</TableCell>
                            <TableCell className="text-right text-sm font-semibold tabular-nums text-emerald-700">{formatarMoeda(valor)}</TableCell>
                            <TableCell><Input aria-label={`Observação da tora ${indice + 1}`} value={item.observacoes} onChange={atualizar("observacoes")} placeholder="Opcional" disabled={edicaoSomenteCabecalhoCarga} /></TableCell>
                            <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" disabled={edicaoSomenteCabecalhoCarga || carga.plaquetas.length === 1} onClick={() => removerPlaqueta(indice)} aria-label={`Remover plaqueta ${indice + 1}`}><Trash2 className="h-4 w-4" /></Button></TableCell>
                          </TableRow>;
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </section>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => adicionarPlaqueta()}
                  disabled={edicaoSomenteCabecalhoCarga}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar plaqueta
                </Button>
                <Campo label="Observações da carga">
                  <Textarea
                    value={carga.observacoes}
                    onChange={evento =>
                      setCarga(anterior => ({
                        ...anterior,
                        observacoes: evento.target.value,
                      }))
                    }
                    placeholder="Informações gerais da carga"
                  />
                </Campo>
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={fecharDialogo}
                    disabled={salvando}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={salvarCarga} disabled={salvando}>
                    {salvando && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {cargaEmEdicao ? "Salvar alterações" : "Confirmar entrada"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialogImportacao}
        onOpenChange={aberto => {
          setDialogImportacao(aberto);
          if (!aberto) {
            setArquivoImportacao(null);
            setErrosImportacao([]);
            setAvisosImportacao([]);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Importar toras por planilha</DialogTitle>
            <DialogDescription>
              Crie um romaneio de carga usando uma planilha CSV compatível com
              Excel. Todos os dados são validados antes de qualquer entrada no
              estoque; códigos ausentes ou repetidos são aceitos e destacados
              para conferência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950">
              <p className="font-medium">Formato esperado da planilha</p>
              <p className="mt-1 text-xs">
                Código (opcional), essência, diâmetro em cm, comprimento em m,
                preço por m³ e observações opcionais. Códigos repetidos ficam
                destacados; ausência de código recebe identificação interna.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={baixarModeloImportacao}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar modelo CSV
            </Button>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Data da carga *">
                <Input
                  type="date"
                  value={cabecalhoImportacao.dataCarga}
                  onChange={evento =>
                    setCabecalhoImportacao(anterior => ({
                      ...anterior,
                      dataCarga: evento.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Vencimento da conta a pagar *">
                <Input
                  aria-label="Vencimento da conta a pagar (importação)"
                  type="date"
                  value={cabecalhoImportacao.dataVencimento}
                  onChange={evento =>
                    setCabecalhoImportacao(anterior => ({
                      ...anterior,
                      dataVencimento: evento.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Fornecedor">
                <SearchableEntitySelect
                  ariaLabel="Fornecedor da carga importada"
                  value={cabecalhoImportacao.fornecedorId}
                  onValueChange={fornecedorId =>
                    setCabecalhoImportacao(anterior => ({
                      ...anterior,
                      fornecedorId,
                    }))
                  }
                  placeholder="Usar origem como contraparte"
                  searchPlaceholder="Digite o nome do fornecedor..."
                  createLabel="Criar novo fornecedor"
                  onCreate={() => abrirNovoFornecedor("importacao")}
                  options={(fornecedores.data ?? []).map((fornecedor: any) => ({
                    value: String(fornecedor.id),
                    label: fornecedor.nome,
                    details: fornecedor.contacto ?? fornecedor.email ?? null,
                  }))}
                />
              </Campo>
              <Campo
                label="Frete por m³ (R$)"
                ajuda="Ex.: R$ 30,00 × volume total"
              >
                <Input
                  inputMode="decimal"
                  value={cabecalhoImportacao.fretePorMetroCubico}
                  onChange={evento =>
                    setCabecalhoImportacao(anterior => ({
                      ...anterior,
                      fretePorMetroCubico: evento.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
              </Campo>
              <Campo label="Origem">
                <Input
                  value={cabecalhoImportacao.origem}
                  onChange={evento =>
                    setCabecalhoImportacao(anterior => ({
                      ...anterior,
                      origem: evento.target.value,
                    }))
                  }
                  placeholder="Fornecedor ou fazenda"
                />
              </Campo>
              <Campo label="Responsável">
                <Input
                  value={cabecalhoImportacao.responsavel}
                  onChange={evento =>
                    setCabecalhoImportacao(anterior => ({
                      ...anterior,
                      responsavel: evento.target.value,
                    }))
                  }
                  placeholder="Quem recebeu"
                />
              </Campo>
            </div>
            <Campo
              label="Planilha CSV *"
              ajuda="Máximo de 200 toras e 1 MB por importação."
            >
              <Input
                aria-label="Planilha CSV"
                type="file"
                accept=".csv,text/csv"
                onChange={evento => {
                  setArquivoImportacao(evento.target.files?.[0] ?? null);
                  setErrosImportacao([]);
                  setAvisosImportacao([]);
                }}
              />
            </Campo>
            {arquivoImportacao && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="min-w-0 truncate">
                  {arquivoImportacao.name}
                </span>
              </div>
            )}
            {errosImportacao.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">
                  Corrija a planilha antes de importar
                </p>
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-destructive">
                  {errosImportacao.map((erro, indice) => (
                    <li key={`${erro}-${indice}`}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}
            {avisosImportacao.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-950">
                  Atenção às identificações
                </p>
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-amber-900">
                  {avisosImportacao.map((aviso, indice) => (
                    <li key={`${aviso}-${indice}`}>{aviso}</li>
                  ))}
                </ul>
              </div>
            )}
            <Campo label="Observações da carga">
              <Textarea
                value={cabecalhoImportacao.observacoes}
                onChange={evento =>
                  setCabecalhoImportacao(anterior => ({
                    ...anterior,
                    observacoes: evento.target.value,
                  }))
                }
                placeholder="Informações gerais da carga importada"
              />
            </Campo>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setDialogImportacao(false)}
                disabled={importarPlaquetasCsv.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={importarArquivo}
                disabled={importarPlaquetasCsv.isPending}
              >
                {importarPlaquetasCsv.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Importar toras
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={plaquetaRastreadaId !== null}
        onOpenChange={aberto => {
          if (!aberto) setPlaquetaRastreadaId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rastreabilidade da tora</DialogTitle>
            <DialogDescription>
              A consulta exibe somente os vínculos já registrados no estoque e na produção.
            </DialogDescription>
          </DialogHeader>
          {rastreabilidadePlaqueta.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando a cadeia de origem...</div>
          ) : rastreabilidadePlaqueta.data ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tora no estoque</p>
                <p className="mt-1 font-semibold">{etiquetaPlaqueta(rastreabilidadePlaqueta.data.plaqueta)}</p>
                <p className="mt-1 text-muted-foreground">
                  {rastreabilidadePlaqueta.data.plaqueta.madeiraNome} · Ø {rastreabilidadePlaqueta.data.plaqueta.diametro ? formatarNumero(rastreabilidadePlaqueta.data.plaqueta.diametro, 2) : "—"} cm · {rastreabilidadePlaqueta.data.plaqueta.comprimento ? formatarNumero(rastreabilidadePlaqueta.data.plaqueta.comprimento, 3) : "—"} m · {formatarNumero(rastreabilidadePlaqueta.data.plaqueta.volumeInicial, 3)} m³ na entrada
                </p>
              </div>
              {rastreabilidadePlaqueta.data.origem ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Origem registrada</p>
                  <p className="mt-1 font-medium">
                    {rastreabilidadePlaqueta.data.origem.tipo === "romaneio_carga" ? "Romaneio de entrada" : "Romaneio de produção"} · {rastreabilidadePlaqueta.data.origem.numero}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatarData(rastreabilidadePlaqueta.data.origem.data)}</p>
                  {rastreabilidadePlaqueta.data.origem.tipo === "romaneio_carga" ? (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        const origem = rastreabilidadePlaqueta.data?.origem;
                        if (!origem || origem.tipo !== "romaneio_carga") return;
                        setPlaquetaRastreadaId(null);
                        abrirEdicao(origem.id);
                      }}
                    >
                      Abrir romaneio de entrada
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        const origem = rastreabilidadePlaqueta.data?.origem;
                        if (!origem || origem.tipo !== "romaneio_producao") return;
                        setPlaquetaRastreadaId(null);
                        setLocation(`/producao?romaneioId=${origem.id}`);
                      }}
                    >
                      Abrir romaneio de produção
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                  <p className="font-medium">Origem documental não vinculada</p>
                  <p className="mt-1 text-xs">{rastreabilidadePlaqueta.data.plaqueta.origemDeclarada || "Esta tora foi registrada fora de um romaneio de entrada e ainda não possui um vínculo documental adicional."}</p>
                </div>
              )}
              {rastreabilidadePlaqueta.data.consumo && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consumo na produção</p>
                  <p className="mt-1">{rastreabilidadePlaqueta.data.consumo.numero} · {formatarNumero(rastreabilidadePlaqueta.data.consumo.volumeConsumido, 3)} m³ consumidos</p>
                </div>
              )}
              {rastreabilidadePlaqueta.data.regularizacoes.length > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sky-950 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-100">
                  <p className="text-xs font-semibold uppercase tracking-wide">Histórico de regularização de volume</p>
                  <div className="mt-2 space-y-2">
                    {rastreabilidadePlaqueta.data.regularizacoes.map((regularizacao: any) => (
                      <div key={regularizacao.id} className="rounded border border-sky-200/80 bg-background/70 p-2 text-xs dark:border-sky-900">
                        <p><strong>{formatarNumero(regularizacao.volumeAnterior, 3)} m³</strong> → <strong>{formatarNumero(regularizacao.volumeConfirmado, 3)} m³</strong></p>
                        <p className="mt-1 text-muted-foreground">{regularizacao.justificativa}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {user?.role === "admin" && rastreabilidadePlaqueta.data.consumo &&
                (Number(rastreabilidadePlaqueta.data.plaqueta.volumeInicial ?? 0) <= 0 || Number(rastreabilidadePlaqueta.data.consumo.volumeConsumido ?? 0) <= 0) && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                    <p className="font-medium">Regularizar volume ausente</p>
                    <p className="mt-1 text-xs">Use apenas o volume conferido fisicamente ou em documento. A correção preserva o valor anterior, o consumo e a justificativa em uma trilha de auditoria.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
                      <Campo label="Volume confirmado (m³)">
                        <Input aria-label="Volume confirmado da tora" inputMode="decimal" value={volumeRegularizado} onChange={evento => setVolumeRegularizado(evento.target.value)} placeholder="Ex.: 0,845" />
                      </Campo>
                      <Campo label="Justificativa">
                        <Textarea aria-label="Justificativa da regularização" value={justificativaRegularizacao} onChange={evento => setJustificativaRegularizacao(evento.target.value)} placeholder="Informe a conferência documental ou física realizada" />
                      </Campo>
                    </div>
                    <Button
                      size="sm"
                      className="mt-3"
                      disabled={regularizarVolumeConsumido.isPending || !volumeRegularizado.trim() || justificativaRegularizacao.trim().length < 10}
                      onClick={() => {
                        const rastreabilidade = rastreabilidadePlaqueta.data;
                        if (!rastreabilidade) return;
                        regularizarVolumeConsumido.mutate({
                          plaquetaId: rastreabilidade.plaqueta.id,
                          volumeConfirmado: volumeRegularizado,
                          justificativa: justificativaRegularizacao,
                        });
                      }}
                    >
                      {regularizarVolumeConsumido.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Registrar volume conferido
                    </Button>
                  </div>
                )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Não foi possível localizar essa tora no estoque atual.</div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(cargaParaExcluir)}
        onOpenChange={aberto => {
          if (!aberto && !excluindo) setCargaParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir romaneio de carga?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o romaneio{" "}
              <strong>{cargaParaExcluir?.numero}</strong> e todas as suas
              plaquetas disponíveis do estoque. Romaneios com toras já usadas na
              produção são protegidos e não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluindo}
              onClick={confirmarExclusao}
            >
              {excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir romaneio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={novoFornecedorAberto}
        onOpenChange={aberto => {
          setNovoFornecedorAberto(aberto);
          if (!aberto) setContextoFornecedor(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo fornecedor</DialogTitle>
            <DialogDescription>
              O fornecedor será cadastrado e selecionado no romaneio em edição.
            </DialogDescription>
          </DialogHeader>
          <Campo label="Nome do fornecedor *">
            <Input
              autoFocus
              value={nomeNovoFornecedor}
              onChange={evento => setNomeNovoFornecedor(evento.target.value)}
              placeholder="Ex.: Fazenda Boa Vista"
              onKeyDown={evento => {
                if (evento.key === "Enter") salvarNovoFornecedor();
              }}
            />
          </Campo>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setNovoFornecedorAberto(false)}
              disabled={criarFornecedor.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarNovoFornecedor}
              disabled={criarFornecedor.isPending}
            >
              {criarFornecedor.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar e selecionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndicadorCarga({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-lg border p-3 ${destaque ? "border-emerald-200 bg-emerald-50" : "bg-muted/40"}`}
    >
      <p className="break-words text-xs leading-4 text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={`mt-1 break-words text-base font-bold leading-5 tabular-nums sm:text-lg ${destaque ? "text-emerald-800" : ""}`}
      >
        {valor}
      </p>
    </div>
  );
}

function Resumo({
  icone,
  titulo,
  valor,
  detalhe,
  cor,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: React.ReactNode;
  detalhe: string;
  cor: "sky" | "emerald" | "amber" | "violet";
}) {
  const cores = {
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{valor}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${cores[cor]}`}>{icone}</div>
      </div>
    </div>
  );
}

function GrupoEstoqueSerrado({
  grupo,
  expandido,
  medida,
  onAlternar,
}: {
  grupo: {
    madeiraNome: string;
    propriedade?: "proprio" | "terceiro";
    quantidadeEntrada: number;
    quantidadeSaida: number;
    quantidadeDisponivel: number;
    volumeDisponivel: number;
    itens: any[];
  };
  expandido: boolean;
  medida: string;
  onAlternar: () => void;
}) {
  const rotulo = `${grupo.madeiraNome} ${medida}`;
  const negativo = grupo.quantidadeDisponivel < 0;
  return (
    <>
      <TableRow
        className={
          negativo
            ? "bg-destructive/[0.05] hover:bg-destructive/[0.08]"
            : "bg-muted/[0.18] hover:bg-muted/[0.32]"
        }
      >
        <TableCell colSpan={2} className="p-0">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={`${expandido ? "Ocultar" : "Exibir"} comprimentos de ${rotulo}`}
            aria-expanded={expandido}
            onClick={onAlternar}
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expandido ? "rotate-0" : "-rotate-90"}`}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate font-semibold">
                  {grupo.madeiraNome}
                </span>
                {grupo.propriedade === "terceiro" && (
                  <Badge className="border-violet-200 bg-violet-100 text-violet-800 hover:bg-violet-100">
                    Terceiro
                  </Badge>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                Medida {medida}
                {grupo.propriedade === "terceiro"
                  ? " · não disponível para venda"
                  : ""}
              </span>
            </span>
          </button>
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          +{formatarNumero(grupo.quantidadeEntrada, 0)}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">
          −{formatarNumero(grupo.quantidadeSaida, 0)}
        </TableCell>
        <TableCell className={`text-right font-semibold tabular-nums ${negativo ? "text-destructive" : ""}`}>
          {formatarNumero(grupo.quantidadeDisponivel, 0)}
        </TableCell>
        <TableCell
          className={`text-right font-semibold tabular-nums ${negativo ? "text-destructive" : ""}`}
        >
          {formatarNumero(grupo.volumeDisponivel)} m³
        </TableCell>
      </TableRow>
      {expandido &&
        grupo.itens.map((item: any, indice: number) => {
          const saldoNegativo = num(item.quantidadeDisponivel) < 0;
          return (
            <TableRow
              key={`${grupo.madeiraNome}-${item.comprimento}-${indice}`}
              className={saldoNegativo ? "bg-destructive/[0.035]" : ""}
            >
              <TableCell className="pl-12 text-sm text-muted-foreground">
                ↳ Comprimento
              </TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">
                {formatarNumero(item.comprimento, 2)} m
              </TableCell>
              <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                +{formatarNumero(item.quantidadeEntrada, 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-400">
                −{formatarNumero(item.quantidadeSaida, 0)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${saldoNegativo ? "font-semibold text-destructive" : ""}`}>
                {formatarNumero(item.quantidadeDisponivel, 0)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${saldoNegativo ? "font-semibold text-destructive" : ""}`}
              >
                {formatarNumero(item.volumeDisponivel)} m³
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}

function Carregando() {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
      Carregando estoque...
    </div>
  );
}
function Vazio({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center text-sm text-muted-foreground">
      <div className="rounded-full bg-muted p-3">{icone}</div>
      <p>{texto}</p>
    </div>
  );
}
