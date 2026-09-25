import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Download,
  Factory,
  FileSpreadsheet,
  FileText,
  Layers3,
  Loader2,
  Plus,
  Scissors,
  Trash2,
  TreePine,
  Upload,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { type LinhaComprimentoVenda } from "@/lib/vendaItemGroup";
import {
  calcularAproveitamentoPorEssencia,
  type VolumePorEssencia,
} from "@shared/aproveitamentoPorEssencia";
import { assinaturaComposicaoRomaneioProducao } from "@shared/romaneioCabecalho";

type ItemForm = {
  madeiraNome: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: string;
};
type GrupoPecasForm = {
  madeiraNome: string;
  espessura: string;
  largura: string;
};
type LinhaComprimento = LinhaComprimentoVenda;
type ToraForm = {
  plaquetaId: string;
  codigo: string;
  semPlaqueta: boolean;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  volume: string;
  origem: "estoque" | "entrada_imediata";
  exigeConferenciaManual: boolean;
};
type AproveitamentoForm = { madeiraNome: string; volume: string };
type RomaneioForm = {
  toras: ToraForm[];
  dataProducao: string;
  fita: string;
  responsavel: string;
  observacoes: string;
  itens: ItemForm[];
  aproveitamentos: AproveitamentoForm[];
  incluirAproveitamentoNoRendimento: boolean;
};
type ToraTerceiroForm = {
  referencia: string;
  madeiraNome: string;
  diametro: string;
  comprimento: string;
  volume: string;
};
type SerragemTerceirosForm = {
  clienteId: string;
  dataProducao: string;
  dataVencimento: string;
  responsavel: string;
  observacoes: string;
  valorServico: string;
  toras: ToraTerceiroForm[];
  itens: ItemForm[];
};
type RetiradaSerragemForm = {
  dataRetirada: string;
  responsavel: string;
  observacoes: string;
  itens: Array<{ loteId: number; quantidade: string }>;
};
type NovoClienteSerragemForm = { nome: string; contacto: string };

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (valor: string | number | null | undefined) =>
  Number(String(valor ?? "").replace(",", ".")) || 0;
const formatarNumero = (valor: number | string, casas = 3) =>
  new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: casas === 2 ? 0 : casas,
  }).format(Number(valor ?? 0));
const formatarMoeda = (valor: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(valor ?? 0)
  );
const formatarData = (valor: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(valor));
let resumoTarifaSerragem: {
  volumeToras: number;
  tarifaPorM3: number;
  valorTotal: number;
} | null = null;
let resumoAproveitamentoEmExibicao: VolumePorEssencia[] = [];
const comprimentosPadraoProducao = [
  "2",
  "2,5",
  "3",
  "3,5",
  "4",
  "4,5",
  "5",
  "5,5",
  "6",
  "6,5",
  "7",
  "7,5",
  "8",
  "8,5",
  "9",
];
const criarLinhasComprimentoPadrao = (): LinhaComprimento[] =>
  comprimentosPadraoProducao.map((comprimento, indice) => ({
    id: indice + 1,
    comprimento,
    quantidade: "",
  }));
const criarLinhasComprimentoVazias = criarLinhasComprimentoPadrao;
const novoItem = (madeiraNome = ""): ItemForm => ({
  madeiraNome,
  espessura: "",
  largura: "",
  comprimento: "",
  quantidade: "",
});
const novoGrupoPecas = (madeiraNome = ""): GrupoPecasForm => ({
  madeiraNome,
  espessura: "",
  largura: "",
});
const novoRomaneio = (): RomaneioForm => ({
  toras: [],
  dataProducao: hoje(),
  fita: "",
  responsavel: "",
  observacoes: "",
  itens: [],
  aproveitamentos: [],
  incluirAproveitamentoNoRendimento: false,
});
const novaSerragemTerceiros = (): SerragemTerceirosForm => ({
  clienteId: "",
  dataProducao: hoje(),
  dataVencimento: hoje(),
  responsavel: "",
  observacoes: "",
  valorServico: "",
  toras: [
    {
      referencia: "",
      madeiraNome: "",
      diametro: "",
      comprimento: "",
      volume: "",
    },
  ],
  itens: [novoItem()],
});
const novaRetiradaSerragem = (): RetiradaSerragemForm => ({
  dataRetirada: hoje(),
  responsavel: "",
  observacoes: "",
  itens: [],
});
const novoClienteSerragem = (): NovoClienteSerragemForm => ({
  nome: "",
  contacto: "",
});
const calcularVolumePecas = (
  espessura: string | number,
  largura: string | number,
  comprimento: string | number
) => (num(espessura) * num(largura) * num(comprimento)) / 10000;
const calcularVolumeTora = (
  diametro: string | number,
  comprimento: string | number
) => Math.PI * (num(diametro) / 200) ** 2 * num(comprimento);
const calcularItem = (item: ItemForm) => ({
  quantidade: num(item.quantidade),
  metrosLineares: num(item.comprimento) * num(item.quantidade),
  volume: calcularVolumePecas(
    item.espessura,
    item.largura,
    num(item.comprimento) * num(item.quantidade)
  ),
});
const normalizarCodigo = (codigo: string) =>
  codigo.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "-");

function AproveitamentoManualPortal({
  aberto,
  etapa,
  valor,
  atualizarValor,
  volumeRomaneado,
  volumeComAproveitamento,
  aproveitamento,
}: {
  aberto: boolean;
  etapa: "toras" | "pecas";
  valor: RomaneioForm;
  atualizarValor: (atualizacao: (atual: RomaneioForm) => RomaneioForm) => void;
  volumeRomaneado: number;
  volumeComAproveitamento: number;
  aproveitamento: number;
}) {
  if (!aberto || etapa !== "pecas" || typeof document === "undefined")
    return null;
  const destino = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"]')
  ).at(-1);
  if (!destino) return null;
  return createPortal(
    <section
      className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:mx-6 sm:p-4"
      data-testid="aproveitamento-manual"
    >
      <div className="mb-3">
        <p className="font-medium text-amber-950">
          Aproveitamento não romaneado
        </p>
        <p className="mt-1 text-xs text-amber-900">
          Registre peças menores de 2 m em m³. O estoque receberá
          “Aproveitamento de [essência]”.
        </p>
      </div>
      <div className="space-y-2">
        {valor.aproveitamentos.map((item, indice) => (
          <div
            key={indice}
            className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
          >
            <Input
              aria-label={`Essência do aproveitamento ${indice + 1}`}
              value={item.madeiraNome}
              placeholder="Essência, ex.: Cedrinho"
              onChange={e =>
                atualizarValor(atual => ({
                  ...atual,
                  aproveitamentos: atual.aproveitamentos.map((linha, i) =>
                    i === indice
                      ? { ...linha, madeiraNome: e.target.value }
                      : linha
                  ),
                }))
              }
            />
            <Input
              aria-label={`Volume de aproveitamento ${indice + 1}`}
              inputMode="decimal"
              value={item.volume}
              placeholder="Volume em m³"
              onChange={e =>
                atualizarValor(atual => ({
                  ...atual,
                  aproveitamentos: atual.aproveitamentos.map((linha, i) =>
                    i === indice ? { ...linha, volume: e.target.value } : linha
                  ),
                }))
              }
            />
            <Button
              type="button"
              variant="outline"
              aria-label={`Remover aproveitamento ${indice + 1}`}
              onClick={() =>
                atualizarValor(atual => ({
                  ...atual,
                  aproveitamentos: atual.aproveitamentos.filter(
                    (_, i) => i !== indice
                  ),
                }))
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            atualizarValor(atual => ({
              ...atual,
              aproveitamentos: [
                ...atual.aproveitamentos,
                { madeiraNome: atual.toras[0]?.madeiraNome ?? "", volume: "" },
              ],
            }))
          }
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar aproveitamento
        </Button>
        <label className="flex items-center gap-2 text-sm font-medium text-amber-950">
          <input
            type="checkbox"
            checked={valor.incluirAproveitamentoNoRendimento}
            onChange={e =>
              atualizarValor(atual => ({
                ...atual,
                incluirAproveitamentoNoRendimento: e.target.checked,
              }))
            }
          />
          Adicionar o aproveitamento à produção
        </label>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">Produção romaneada</span>
          <strong className="block text-foreground">
            {formatarNumero(volumeRomaneado)} m³
          </strong>
        </div>
        <div>
          <span className="text-muted-foreground">
            Produção + aproveitamento
          </span>
          <strong className="block text-foreground">
            {formatarNumero(volumeComAproveitamento)} m³
          </strong>
        </div>
        <div>
          <span className="text-muted-foreground">Rendimento atual</span>
          <strong className="block text-foreground">
            {formatarNumero(aproveitamento, 2)}%
          </strong>
        </div>
      </div>
    </section>,
    destino
  );
}
const baixarCsv = (conteudo: string, nomeArquivo: string) => {
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
};

export default function ProducaoPage() {
  const [dialogRomaneio, setDialogRomaneio] = useState(false);
  const [etapa, setEtapa] = useState<"toras" | "pecas">("toras");
  const [codigoPlaqueta, setCodigoPlaqueta] = useState("");
  const [aceitarToraSemPlaqueta, setAceitarToraSemPlaqueta] = useState(false);
  const [plaquetaSemIdentificacaoSelecionada, setPlaquetaSemIdentificacaoSelecionada] = useState("");
  const [dialogImportacao, setDialogImportacao] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState<File | null>(null);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [dialogImportacaoPecas, setDialogImportacaoPecas] = useState(false);
  const [arquivoImportacaoPecas, setArquivoImportacaoPecas] =
    useState<File | null>(null);
  const [errosImportacaoPecas, setErrosImportacaoPecas] = useState<string[]>(
    []
  );
  const [romaneio, setRomaneio] = useState<RomaneioForm>(novoRomaneio);
  const [romaneioEmEdicaoId, setRomaneioEmEdicaoId] = useState<number | null>(
    null
  );
  const assinaturaComposicaoOriginal = useRef<string | null>(null);
  const [romaneioParaExcluir, setRomaneioParaExcluir] = useState<{
    id: number;
    numero: string;
  } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    id: number;
    numero: string;
  } | null>(null);
  const [dialogSerragemTerceiros, setDialogSerragemTerceiros] = useState(false);
  const [
    dialogSerragemTerceirosResponsivo,
    setDialogSerragemTerceirosResponsivo,
  ] = useState(false);
  const [
    dialogSerragemTerceirosUnificada,
    setDialogSerragemTerceirosUnificada,
  ] = useState(false);
  const [serragemTerceiros, atualizarEstadoSerragemTerceiros] =
    useState<SerragemTerceirosForm>(novaSerragemTerceiros);
  const [serragemEmEdicaoId, setSerragemEmEdicaoId] = useState<number | null>(
    null
  );
  const [dialogRetiradaSerragem, setDialogRetiradaSerragem] = useState(false);
  const [serragemParaRetirada, setSerragemParaRetirada] = useState<any | null>(
    null
  );
  const [detalheRetiradaSerragem, setDetalheRetiradaSerragem] = useState<
    any | null
  >(null);
  const [retiradaSerragem, setRetiradaSerragem] =
    useState<RetiradaSerragemForm>(novaRetiradaSerragem);
  const [dialogNovoClienteSerragem, setDialogNovoClienteSerragem] =
    useState(false);
  const [novoClienteSerragemForm, setNovoClienteSerragemForm] =
    useState<NovoClienteSerragemForm>(novoClienteSerragem);
  const [grupoPecas, setGrupoPecas] = useState<GrupoPecasForm>(novoGrupoPecas);
  const [linhasComprimento, setLinhasComprimento] = useState<
    LinhaComprimento[]
  >(criarLinhasComprimentoPadrao);
  const [filtroEssenciaProducao, setFiltroEssenciaProducao] = useState("");
  const [filtroDataInicialProducao, setFiltroDataInicialProducao] =
    useState("");
  const [filtroDataFinalProducao, setFiltroDataFinalProducao] = useState("");
  const [selecionadosProducao, setSelecionadosProducao] = useState<number[]>(
    []
  );
  const [selecionadosSerragem, setSelecionadosSerragem] = useState<number[]>(
    []
  );
  const [edicaoLoteAberta, setEdicaoLoteAberta] = useState<
    "producao" | "serragem" | null
  >(null);
  const [camposLoteProducao, setCamposLoteProducao] = useState({
    dataProducao: false,
    fita: false,
    responsavel: false,
    observacoes: false,
  });
  const [loteProducao, setLoteProducao] = useState({
    dataProducao: hoje(),
    fita: "",
    responsavel: "",
    observacoes: "",
  });
  const [camposLoteSerragem, setCamposLoteSerragem] = useState({
    clienteId: false,
    dataProducao: false,
    dataVencimento: false,
    responsavel: false,
    observacoes: false,
  });
  const [loteSerragem, setLoteSerragem] = useState({
    clienteId: "",
    dataProducao: hoje(),
    dataVencimento: hoje(),
    responsavel: "",
    observacoes: "",
  });
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const buscaDaRota = useSearch();
  const rastreabilidadeAberta = useRef<number | null>(null);
  const plaquetas = trpc.producao.plaquetas.list.useQuery({ limite: 10 });
  const plaquetasSemIdentificacao =
    trpc.producao.plaquetas.semIdentificacaoDisponiveis.useQuery(undefined, {
      enabled: aceitarToraSemPlaqueta,
    });
  const buscaPlaquetaDigitada = trpc.producao.plaquetas.buscar.useQuery(
    { codigo: normalizarCodigo(codigoPlaqueta) },
    { enabled: Boolean(codigoPlaqueta.trim()), retry: false }
  );
  const confirmarVariacoesAtipicas =
    trpc.producao.plaquetas.confirmarVariacoesAtipicas.useMutation();
  const romaneios = trpc.producao.romaneios.list.useQuery();
  const estoque = trpc.producao.estoque.resumo.useQuery();
  const confirmarRomaneio = trpc.producao.romaneios.confirmar.useMutation();
  const atualizarRomaneio = trpc.producao.romaneios.update.useMutation();
  const atualizarCabecalhoRomaneiosLote =
    trpc.producao.romaneios.atualizarCabecalhoEmLote.useMutation();
  const excluirRomaneio = trpc.producao.romaneios.excluir.useMutation();
  const clientes = trpc.cliente.list.useQuery();
  const serragensTerceiros = trpc.producao.serragemTerceiros.list.useQuery();
  const criarSerragemTerceiros =
    trpc.producao.serragemTerceiros.criar.useMutation();
  const atualizarSerragemTerceiros =
    trpc.producao.serragemTerceiros.update.useMutation();
  const atualizarCabecalhoSerragensLote =
    trpc.producao.serragemTerceiros.atualizarCabecalhoEmLote.useMutation();
  const registrarRetiradaSerragem =
    trpc.producao.serragemTerceiros.registrarRetirada.useMutation();
  const criarClienteSerragem = trpc.cliente.create.useMutation();
  const modeloTorasCsv = trpc.producao.romaneios.modeloTorasCsv.useQuery(
    undefined,
    { enabled: false }
  );
  const importarTorasCsv =
    trpc.producao.romaneios.importarTorasCsv.useMutation();
  const modeloPecasCsv = trpc.producao.romaneios.modeloPecasCsv.useQuery(
    undefined,
    { enabled: false }
  );
  const importarPecasCsv =
    trpc.producao.romaneios.importarPecasCsv.useMutation();
  const torasDisponiveis = useMemo(
    () =>
      (plaquetas.data?.itens ?? []).filter(
        (item: any) => item.estado === "disponivel"
      ),
    [plaquetas.data]
  );
  const volumeTorasDisponiveis = Number(
    plaquetas.data?.totalVolumeDisponivel ?? 0
  );
  const volumeMedioPorTora = Number(plaquetas.data?.volumeMedioPorTora ?? 0);
  const essenciasDisponiveis = plaquetas.data?.essenciasDisponiveis ?? [];
  const alertaVariacaoAtipica = Boolean(plaquetas.data?.alertaVariacaoAtipica);
  const essenciasAtipicas = plaquetas.data?.essenciasAtipicas ?? [];
  const variacoesAtipicas = plaquetas.data?.variacoesAtipicas ?? [];
  const estoqueProprio = useMemo(
    () =>
      (estoque.data ?? []).filter(
        (item: any) => item.propriedade !== "terceiro"
      ),
    [estoque.data]
  );
  const totalToras = useMemo(
    () => romaneio.toras.reduce((total, tora) => total + num(tora.volume), 0),
    [romaneio.toras]
  );
  const totaisPecas = useMemo(
    () =>
      romaneio.itens.reduce(
        (total, item) => {
          const calculo = calcularItem(item);
          return {
            pecas: total.pecas + calculo.quantidade,
            metrosLineares: total.metrosLineares + calculo.metrosLineares,
            volume: total.volume + calculo.volume,
          };
        },
        { pecas: 0, metrosLineares: 0, volume: 0 }
      ),
    [romaneio.itens]
  );
  const pecasPorBitola = useMemo(() => {
    const agrupadas = new Map<string, { medida: string; quantidade: number }>();
    romaneio.itens.forEach(item => {
      const quantidade = calcularItem(item).quantidade;
      if (quantidade <= 0) return;
      const medida = `${formatarNumero(item.espessura, 2)} × ${formatarNumero(item.largura, 2)} cm`;
      const atual = agrupadas.get(medida) ?? { medida, quantidade: 0 };
      atual.quantidade += quantidade;
      agrupadas.set(medida, atual);
    });
    return Array.from(agrupadas.values()).sort(
      (a, b) => b.quantidade - a.quantidade || a.medida.localeCompare(b.medida, "pt-BR")
    );
  }, [romaneio.itens]);
  const volumeAproveitamentoManual = useMemo(
    () =>
      romaneio.aproveitamentos.reduce(
        (total, item) => total + num(item.volume),
        0
      ),
    [romaneio.aproveitamentos]
  );
  const volumeProducaoComAproveitamento =
    totaisPecas.volume + volumeAproveitamentoManual;
  const volumeParaRendimento = romaneio.incluirAproveitamentoNoRendimento
    ? volumeProducaoComAproveitamento
    : totaisPecas.volume;
  const aproveitamento =
    totalToras > 0 ? (volumeParaRendimento / totalToras) * 100 : 0;
  const setSerragemTerceiros = (
    atualizacao: SetStateAction<SerragemTerceirosForm>
  ) =>
    atualizarEstadoSerragemTerceiros(atual => {
      const proximo =
        typeof atualizacao === "function" ? atualizacao(atual) : atualizacao;
      const essenciaAnterior = atual.toras[0]?.madeiraNome ?? "";
      const novaToraAdicionada = proximo.toras.length > atual.toras.length;
      const toras = proximo.toras.map((tora, indice) => {
        const diametroInformado = num(tora.diametro) > 0;
        const comprimentoInformado = num(tora.comprimento) > 0;
        const madeiraNome =
          novaToraAdicionada && indice === 0 && !tora.madeiraNome.trim()
            ? essenciaAnterior
            : tora.madeiraNome;
        return {
          ...tora,
          madeiraNome,
          volume:
            diametroInformado && comprimentoInformado
              ? calcularVolumeTora(tora.diametro, tora.comprimento).toFixed(6)
              : "",
        };
      });
      return { ...proximo, toras };
    });
  const aproveitamentoPorEssencia = useMemo(
    () =>
      calcularAproveitamentoPorEssencia(
        romaneio.toras,
        romaneio.itens.map(item => ({
          madeiraNome: item.madeiraNome,
          volume: calcularItem(item).volume,
        }))
      ),
    [romaneio.toras, romaneio.itens]
  );
  resumoAproveitamentoEmExibicao = aproveitamentoPorEssencia;
  const resumoEssencias = useMemo(
    () =>
      aproveitamentoPorEssencia.map(
        resumo => [resumo.essencia, resumo.volumeToras] as const
      ),
    [aproveitamentoPorEssencia]
  );
  const essenciasRelatorioProducao = useMemo(
    () =>
      Array.from(
        new Set(
          (romaneios.data ?? [])
            .map((item: any) =>
              String(item.madeiraTora ?? item.madeiraNome ?? "").trim()
            )
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [romaneios.data]
  );
  const romaneiosFiltrados = useMemo(
    () =>
      (romaneios.data ?? []).filter((item: any) => {
        const data = new Date(item.dataProducao).toISOString().slice(0, 10);
        const correspondeEssencia =
          !filtroEssenciaProducao ||
          String(item.madeiraTora ?? item.madeiraNome ?? "")
            .trim()
            .toLocaleLowerCase("pt-BR") ===
            filtroEssenciaProducao.toLocaleLowerCase("pt-BR");
        return (
          correspondeEssencia &&
          (!filtroDataInicialProducao || data >= filtroDataInicialProducao) &&
          (!filtroDataFinalProducao || data <= filtroDataFinalProducao)
        );
      }),
    [
      romaneios.data,
      filtroEssenciaProducao,
      filtroDataInicialProducao,
      filtroDataFinalProducao,
    ]
  );

  const invalidar = () => {
    utils.producao.plaquetas.list.invalidate();
    utils.producao.romaneios.list.invalidate();
    utils.producao.estoque.resumo.invalidate();
    utils.producao.serragemTerceiros.list.invalidate();
    utils.producao.serragemTerceiros.detalhe.invalidate();
  };
  const abrirRomaneio = () => {
    setRomaneioEmEdicaoId(null);
    setEtapa("toras");
    setCodigoPlaqueta("");
    setAceitarToraSemPlaqueta(false);
    setGrupoPecas(novoGrupoPecas());
    setLinhasComprimento(criarLinhasComprimentoVazias());
    setRomaneio(novoRomaneio());
    setDialogRomaneio(true);
  };
  const abrirEdicaoRomaneio = async (id: number) => {
    try {
      const detalhe: any = await utils.producao.romaneios.detalhe.fetch({ id });
      const dataProducao = new Date(detalhe.romaneio.dataProducao)
        .toISOString()
        .slice(0, 10);
      const toras: ToraForm[] = (detalhe.toras ?? []).map((tora: any) => ({
        plaquetaId: String(tora.plaquetaId),
        codigo:
          tora.codigo ?? tora.plaquetaCodigo ?? `Plaqueta ${tora.plaquetaId}`,
        semPlaqueta: Boolean(tora.situacaoIdentificacao === "sem_plaqueta"),
        madeiraNome: String(tora.madeiraNome ?? ""),
        diametro: String(tora.diametro ?? ""),
        comprimento: String(tora.comprimento ?? ""),
        volume: String(tora.volume ?? ""),
        origem: "estoque" as const,
        exigeConferenciaManual: Boolean(tora.medidasConferidasManual),
      }));
      const itens: ItemForm[] = (detalhe.itens ?? []).map((item: any) => ({
        madeiraNome: String(item.madeiraNome ?? ""),
        espessura: String(item.espessura ?? ""),
        largura: String(item.largura ?? ""),
        comprimento: String(item.comprimento ?? ""),
        quantidade: String(item.quantidade ?? ""),
      }));
      const aproveitamentos = (detalhe.aproveitamentos ?? []).map((item: any) => ({
        madeiraNome: String(item.madeiraNome ?? ""),
        volume: String(item.volume ?? ""),
      }));
      const incluirAproveitamentoNoRendimento = Boolean(
        detalhe.romaneio.incluirAproveitamentoNoRendimento
      );
      assinaturaComposicaoOriginal.current = assinaturaComposicaoRomaneioProducao({
        itens,
        aproveitamentos,
        incluirAproveitamentoNoRendimento,
      });
      setRomaneio({
        toras,
        dataProducao,
        fita: detalhe.romaneio.fita ?? "",
        responsavel: detalhe.romaneio.responsavel ?? "",
        observacoes: detalhe.romaneio.observacoes ?? "",
        itens,
        aproveitamentos,
        incluirAproveitamentoNoRendimento,
      });
      const ultimoItem = itens.at(-1);
      setGrupoPecas(
        ultimoItem
          ? {
              madeiraNome: ultimoItem.madeiraNome,
              espessura: ultimoItem.espessura,
              largura: ultimoItem.largura,
            }
          : novoGrupoPecas(toras[0]?.madeiraNome ?? "")
      );
      setLinhasComprimento(criarLinhasComprimentoVazias());
      setRomaneioEmEdicaoId(id);
      setCodigoPlaqueta("");
      setEtapa("pecas");
      setDialogRomaneio(true);
    } catch (erro: any) {
      toast.error(
        erro.message ?? "Não foi possível abrir o romaneio para edição"
      );
    }
  };
  useEffect(() => {
    const idOrigem = Number(
      new URLSearchParams(buscaDaRota).get("romaneioId")
    );
    if (!Number.isInteger(idOrigem) || idOrigem <= 0) return;
    if (rastreabilidadeAberta.current === idOrigem) return;
    rastreabilidadeAberta.current = idOrigem;
    setLocation("/producao");
    void abrirEdicaoRomaneio(idOrigem);
  }, [buscaDaRota, setLocation]);
  const abrirImportacao = () => {
    setArquivoImportacao(null);
    setErrosImportacao([]);
    setDialogImportacao(true);
  };
  const abrirImportacaoPecas = () => {
    setArquivoImportacaoPecas(null);
    setErrosImportacaoPecas([]);
    setDialogImportacaoPecas(true);
  };
  const baixarModeloImportacao = async () => {
    const resposta = await modeloTorasCsv.refetch();
    if (!resposta.data) {
      toast.error("Não foi possível gerar o modelo de planilha");
      return;
    }
    baixarCsv(resposta.data, "modelo-plaquetas-producao-fk-madeiras.csv");
    toast.success("Modelo de planilha baixado");
  };
  const importarArquivo = async () => {
    if (!arquivoImportacao) {
      toast.error("Selecione uma planilha CSV para importar");
      return;
    }
    try {
      const conteudo = await arquivoImportacao.text();
      importarTorasCsv.mutate(
        { conteudo },
        {
          onSuccess: resultado => {
            if (resultado.erros.length) {
              setErrosImportacao(resultado.erros);
              toast.error(
                "A importação foi recusada. Revise as linhas indicadas."
              );
              return;
            }
            const codigosAtuais = new Set(
              romaneio.toras.map(tora => normalizarCodigo(tora.codigo))
            );
            const repetidas = resultado.toras.filter(tora =>
              codigosAtuais.has(normalizarCodigo(tora.codigo))
            );
            if (repetidas.length) {
              setErrosImportacao(
                repetidas.map(
                  tora =>
                    `A plaqueta ${tora.codigo} já foi adicionada ao romaneio atual`
                )
              );
              toast.error(
                "A planilha contém plaquetas já adicionadas ao romaneio."
              );
              return;
            }
            setRomaneio(atual => {
              const novasToras: ToraForm[] = resultado.toras.map(
                (tora: any) => ({
                  ...tora,
                  plaquetaId: tora.plaquetaId ? String(tora.plaquetaId) : "",
                  origem: tora.origem,
                  exigeConferenciaManual: Boolean(tora.exigeConferenciaManual),
                })
              );
              const primeiraEssencia = novasToras[0]?.madeiraNome ?? "";
              return {
                ...atual,
                toras: [...novasToras, ...atual.toras],
                itens: atual.itens.map(item =>
                  item.madeiraNome
                    ? item
                    : { ...item, madeiraNome: primeiraEssencia }
                ),
              };
            });
            setDialogImportacao(false);
            setArquivoImportacao(null);
            setErrosImportacao([]);
            toast.success(
              `${resultado.toras.length} plaqueta(s) adicionada(s) ao romaneio`
            );
          },
          onError: erro => toast.error(erro.message),
        }
      );
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };
  const baixarModeloPecas = async () => {
    const resposta = await modeloPecasCsv.refetch();
    if (!resposta.data) {
      toast.error("Não foi possível gerar o modelo de planilha");
      return;
    }
    baixarCsv(resposta.data, "modelo-pecas-serradas-producao-fk-madeiras.csv");
    toast.success("Modelo de peças baixado");
  };
  const importarArquivoPecas = async () => {
    if (!arquivoImportacaoPecas) {
      toast.error("Selecione uma planilha CSV para importar");
      return;
    }
    try {
      const conteudo = await arquivoImportacaoPecas.text();
      importarPecasCsv.mutate(
        { conteudo },
        {
          onSuccess: resultado => {
            if (resultado.erros.length) {
              setErrosImportacaoPecas(resultado.erros);
              toast.error(
                "A importação foi recusada. Revise as linhas indicadas."
              );
              return;
            }
            const novosItens = resultado.itens.map(item => ({
              ...item,
              quantidade: String(item.quantidade),
            }));
            setRomaneio(atual => ({
              ...atual,
              itens: [...atual.itens, ...novosItens],
            }));
            const ultimoItem = novosItens.at(-1);
            if (ultimoItem)
              setGrupoPecas({
                madeiraNome: ultimoItem.madeiraNome,
                espessura: ultimoItem.espessura,
                largura: ultimoItem.largura,
              });
            setLinhasComprimento(criarLinhasComprimentoVazias());
            setDialogImportacaoPecas(false);
            setArquivoImportacaoPecas(null);
            setErrosImportacaoPecas([]);
            toast.success(
              `${novosItens.length} peça(s) adicionada(s) ao romaneio`
            );
          },
          onError: erro => toast.error(erro.message),
        }
      );
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };
  const adicionarTora = async () => {
    if (romaneioEmEdicaoId) {
      toast.error(
        "As toras de um romaneio confirmado permanecem bloqueadas para preservar a rastreabilidade"
      );
      return;
    }
    const codigoNormalizado = normalizarCodigo(codigoPlaqueta);
    if (!codigoNormalizado) {
      if (aceitarToraSemPlaqueta) {
        toast.error("Selecione abaixo a tora sem plaqueta que já está disponível no estoque");
        return;
      }
      toast.error("Digite o código da plaqueta");
      return;
    }
    if (
      romaneio.toras.some(
        tora => normalizarCodigo(tora.codigo) === codigoNormalizado
      )
    ) {
      toast.error("Essa plaqueta já foi adicionada ao romaneio diário");
      return;
    }
    let plaqueta: any;
    try {
      plaqueta = await utils.producao.plaquetas.buscar.fetch({
        codigo: codigoNormalizado,
      });
    } catch (erro: any) {
      toast.error(
        erro?.message ?? "Não foi possível consultar a plaqueta no estoque"
      );
      return;
    }
    if (!plaqueta) {
      const toraAvulsa: ToraForm = {
        plaquetaId: "",
        codigo: codigoNormalizado,
        semPlaqueta: false,
        madeiraNome: "",
        diametro: "",
        comprimento: "",
        volume: "",
        origem: "entrada_imediata",
        exigeConferenciaManual: false,
      };
      setRomaneio(atual => ({ ...atual, toras: [toraAvulsa, ...atual.toras] }));
      setCodigoPlaqueta("");
      toast.message(
        "Plaqueta não encontrada no estoque. Informe os dados para registrar a entrada e o consumo imediato."
      );
      return;
    }
    const exigeConferenciaManual =
      plaqueta.situacaoIdentificacao === "duplicada";
    const tora: ToraForm = {
      plaquetaId: String(plaqueta.id),
      codigo: plaqueta.codigoFisico ?? plaqueta.codigo,
      semPlaqueta: false,
      madeiraNome: exigeConferenciaManual ? "" : (plaqueta.madeiraNome ?? ""),
      diametro: exigeConferenciaManual ? "" : String(plaqueta.diametro ?? ""),
      comprimento: exigeConferenciaManual
        ? ""
        : String(plaqueta.comprimento ?? ""),
      volume: exigeConferenciaManual
        ? ""
        : String(plaqueta.volumeDisponivel ?? plaqueta.volumeInicial ?? ""),
      origem: "estoque",
      exigeConferenciaManual,
    };
    setRomaneio(atual => ({
      ...atual,
      toras: [tora, ...atual.toras],
      itens: atual.itens.map(item =>
        item.madeiraNome ? item : { ...item, madeiraNome: tora.madeiraNome }
      ),
    }));
    setCodigoPlaqueta("");
    if (exigeConferenciaManual)
      toast.warning(
        "Há mais de uma tora com esta plaqueta. Preencha manualmente as medidas da tora selecionada antes de continuar."
      );
  };
  const adicionarToraSemIdentificacao = (id: string) => {
    const plaqueta = (plaquetasSemIdentificacao.data ?? []).find(
      (item: any) => String(item.id) === id
    );
    if (!plaqueta) return;
    if (romaneio.toras.some(tora => tora.plaquetaId === String(plaqueta.id))) {
      toast.error("Essa tora sem plaqueta já foi adicionada ao romaneio diário");
      return;
    }
    const tora: ToraForm = {
      plaquetaId: String(plaqueta.id),
      codigo: plaqueta.codigo,
      semPlaqueta: true,
      madeiraNome: String(plaqueta.madeiraNome ?? ""),
      diametro: String(plaqueta.diametro ?? ""),
      comprimento: String(plaqueta.comprimento ?? ""),
      volume: String(plaqueta.volumeDisponivel ?? plaqueta.volumeInicial ?? ""),
      origem: "estoque",
      exigeConferenciaManual: false,
    };
    setRomaneio(atual => ({
      ...atual,
      toras: [tora, ...atual.toras],
      itens: atual.itens.map(item =>
        item.madeiraNome ? item : { ...item, madeiraNome: tora.madeiraNome }
      ),
    }));
    setPlaquetaSemIdentificacaoSelecionada("");
    toast.success("Tora sem plaqueta selecionada do estoque e vinculada ao romaneio");
  };
  const atualizarTora = (
    indice: number,
    campo: keyof ToraForm,
    valor: string
  ) => {
    if (romaneioEmEdicaoId) return;
    setRomaneio(atual => ({
      ...atual,
      toras: atual.toras.map((tora, posicao) =>
        posicao === indice ? { ...tora, [campo]: valor } : tora
      ),
    }));
  };
  const removerTora = (indice: number) => {
    if (romaneioEmEdicaoId) return;
    setRomaneio(atual => ({
      ...atual,
      toras: atual.toras.filter((_, posicao) => posicao !== indice),
    }));
  };
  const usarVolumeCalculado = (indice: number) => {
    if (romaneioEmEdicaoId) return;
    setRomaneio(atual => ({
      ...atual,
      toras: atual.toras.map((tora, posicao) =>
        posicao === indice
          ? {
              ...tora,
              volume: calcularVolumeTora(
                tora.diametro,
                tora.comprimento
              ).toFixed(6),
            }
          : tora
      ),
    }));
  };
  const prepararEtapaPecas = () => {
    setGrupoPecas(atual =>
      atual.madeiraNome.trim()
        ? atual
        : novoGrupoPecas(romaneio.toras[0]?.madeiraNome ?? "")
    );
    setEtapa("pecas");
  };
  const atualizarLinhaComprimento = (
    id: number,
    campo: "comprimento" | "quantidade",
    valor: string
  ) =>
    setLinhasComprimento(linhas =>
      linhas.map(linha =>
        linha.id === id ? { ...linha, [campo]: valor } : linha
      )
    );
  const adicionarLinhaComprimento = () =>
    setLinhasComprimento(linhas => [
      ...linhas,
      {
        id: Math.max(0, ...linhas.map(linha => linha.id)) + 1,
        comprimento: "",
        quantidade: "",
      },
    ]);
  const removerLinhaComprimento = (id: number) =>
    setLinhasComprimento(linhas =>
      linhas.length === 1 ? linhas : linhas.filter(linha => linha.id !== id)
    );
  const adicionarGrupoPecas = () => {
    if (
      !grupoPecas.madeiraNome.trim() ||
      num(grupoPecas.espessura) <= 0 ||
      num(grupoPecas.largura) <= 0
    ) {
      toast.error(
        "Informe essência, espessura e largura para a medida produzida"
      );
      return;
    }
    const linhasPreenchidas = linhasComprimento.filter(linha =>
      linha.quantidade.trim()
    );
    if (!linhasPreenchidas.length) {
      toast.error("Informe ao menos um comprimento e sua quantidade");
      return;
    }
    if (
      linhasPreenchidas.some(
        linha =>
          num(linha.comprimento) <= 0 ||
          !Number.isInteger(num(linha.quantidade)) ||
          num(linha.quantidade) <= 0
      )
    ) {
      toast.error("Revise os comprimentos e as quantidades preenchidas");
      return;
    }
    const itens = linhasPreenchidas.map(linha => ({
      madeiraNome: grupoPecas.madeiraNome.trim(),
      espessura: grupoPecas.espessura,
      largura: grupoPecas.largura,
      comprimento: linha.comprimento,
      quantidade: linha.quantidade,
    }));
    setRomaneio(atual => ({ ...atual, itens: [...atual.itens, ...itens] }));
    setLinhasComprimento(criarLinhasComprimentoVazias());
    toast.success(
      `${itens.length} comprimento(s) adicionado(s). A medida foi mantida para o próximo lançamento.`
    );
  };
  const editarBitola = (indice: number) => {
    const item = romaneio.itens[indice];
    if (!item) return;
    setGrupoPecas({
      madeiraNome: item.madeiraNome,
      espessura: item.espessura,
      largura: item.largura,
    });
    setLinhasComprimento([
      {
        id: Date.now(),
        comprimento: item.comprimento,
        quantidade: item.quantidade,
      },
    ]);
    setRomaneio(atual => ({
      ...atual,
      itens: atual.itens.filter((_, posicao) => posicao !== indice),
    }));
  };
  const removerBitola = (indice: number) =>
    setRomaneio(atual => ({
      ...atual,
      itens: atual.itens.filter((_, posicao) => posicao !== indice),
    }));
  const salvarRomaneio = () => {
    if (!romaneio.itens.length) {
      toast.error("Adicione ao menos uma bitola produzida antes de confirmar");
      return;
    }
    const dadosProducao = {
      dataProducao: romaneio.dataProducao,
      fita: romaneio.fita,
      responsavel: romaneio.responsavel,
      observacoes: romaneio.observacoes,
      itens: romaneio.itens.map(item => ({
        ...item,
        quantidade: Number(item.quantidade),
      })),
      aproveitamentos: romaneio.aproveitamentos
        .filter(item => item.madeiraNome.trim() && num(item.volume) > 0)
        .map(item => ({
          madeiraNome: item.madeiraNome.trim(),
          volume: num(item.volume),
        })),
      incluirAproveitamentoNoRendimento:
        romaneio.incluirAproveitamentoNoRendimento,
    };
    const aoSalvar = (resultado: any, mensagem: string) => {
      toast.success(
        `${resultado.numero} ${mensagem} · aproveitamento de ${formatarNumero(resultado.aproveitamento, 2)}%`
      );
      setDialogRomaneio(false);
      setRomaneioEmEdicaoId(null);
      invalidar();
    };
    if (romaneioEmEdicaoId) {
      const assinaturaAtual = assinaturaComposicaoRomaneioProducao({
        itens: romaneio.itens,
        aproveitamentos: romaneio.aproveitamentos,
        incluirAproveitamentoNoRendimento:
          romaneio.incluirAproveitamentoNoRendimento,
      });
      if (assinaturaComposicaoOriginal.current === assinaturaAtual) {
        atualizarCabecalhoRomaneiosLote.mutate(
          {
            ids: [romaneioEmEdicaoId],
            dataProducao: romaneio.dataProducao,
            fita: romaneio.fita || null,
            responsavel: romaneio.responsavel || null,
            observacoes: romaneio.observacoes || null,
          },
          {
            onSuccess: () => {
              toast.success(
                "Cabeçalho atualizado sem alterar as toras, peças ou movimentações existentes."
              );
              setDialogRomaneio(false);
              setRomaneioEmEdicaoId(null);
              assinaturaComposicaoOriginal.current = null;
              invalidar();
            },
            onError: erro => toast.error(erro.message),
          }
        );
        return;
      }
      atualizarRomaneio.mutate(
        { id: romaneioEmEdicaoId, ...dadosProducao },
        {
          onSuccess: resultado => aoSalvar(resultado, "atualizado"),
          onError: erro => toast.error(erro.message),
        }
      );
      return;
    }
    confirmarRomaneio.mutate(
      {
        ...dadosProducao,
        toras: romaneio.toras.map(tora =>
          tora.origem === "entrada_imediata"
            ? {
                novaPlaqueta: { codigo: tora.semPlaqueta ? null : tora.codigo },
                medidasConferidasManual: tora.exigeConferenciaManual,
                tora: {
                  madeiraNome: tora.madeiraNome,
                  diametro: tora.diametro || null,
                  comprimento: tora.comprimento || null,
                  volume: tora.volume,
                },
              }
            : {
                plaquetaId: Number(tora.plaquetaId),
                medidasConferidasManual: tora.exigeConferenciaManual,
                tora: {
                  madeiraNome: tora.madeiraNome,
                  diametro: tora.diametro || null,
                  comprimento: tora.comprimento || null,
                  volume: tora.volume,
                },
              }
        ),
      },
      {
        onSuccess: resultado => aoSalvar(resultado, "confirmado"),
        onError: erro => toast.error(erro.message),
      }
    );
  };
  const confirmarExclusaoRomaneio = () => {
    if (!romaneioParaExcluir) return;
    excluirRomaneio.mutate(
      { id: romaneioParaExcluir.id },
      {
        onSuccess: resultado => {
          toast.success(
            `${resultado.numero} removido e o estoque foi revertido`
          );
          setRomaneioParaExcluir(null);
          invalidar();
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };
  const abrirSerragemTerceiros = () => {
    setSerragemEmEdicaoId(null);
    setSerragemTerceiros(novaSerragemTerceiros());
    setDialogSerragemTerceirosUnificada(true);
  };
  const abrirEdicaoSerragem = async (servico: any) => {
    try {
      const detalhe: any = await utils.producao.serragemTerceiros.detalhe.fetch(
        { id: servico.id }
      );
      const origem = detalhe.servico;
      if (!origem)
        throw new Error("Não foi possível carregar os dados do serviço");
      setSerragemTerceiros({
        clienteId: String(origem.clienteId),
        dataProducao: new Date(origem.dataProducao).toISOString().slice(0, 10),
        dataVencimento: new Date(origem.dataVencimento)
          .toISOString()
          .slice(0, 10),
        responsavel: origem.responsavel ?? "",
        observacoes: origem.observacoes ?? "",
        valorServico: String(origem.valorMetroCubico ?? ""),
        toras: (detalhe.toras ?? []).map((tora: any) => ({
          referencia: String(tora.referencia ?? ""),
          madeiraNome: String(tora.madeiraNome ?? ""),
          diametro: String(tora.diametro ?? ""),
          comprimento: String(tora.comprimento ?? ""),
          volume: String(tora.volume ?? ""),
        })),
        itens: (detalhe.itens ?? []).map((item: any) => ({
          madeiraNome: String(item.madeiraNome ?? ""),
          espessura: String(item.espessura ?? ""),
          largura: String(item.largura ?? ""),
          comprimento: String(item.comprimento ?? ""),
          quantidade: String(item.quantidade ?? ""),
        })),
      });
      setSerragemEmEdicaoId(servico.id);
      setDialogSerragemTerceirosUnificada(true);
    } catch (erro: any) {
      toast.error(
        erro.message ?? "Não foi possível abrir a serragem para edição"
      );
    }
  };
  const abrirRetiradaSerragem = async (servico: any) => {
    setSerragemParaRetirada(servico);
    setDetalheRetiradaSerragem(null);
    setRetiradaSerragem(novaRetiradaSerragem());
    setDialogRetiradaSerragem(true);
    try {
      const detalhe: any = await utils.producao.serragemTerceiros.detalhe.fetch(
        { id: servico.id }
      );
      setDetalheRetiradaSerragem(detalhe);
      setRetiradaSerragem(atual => ({
        ...atual,
        itens: (detalhe.lotes ?? [])
          .filter((lote: any) => num(lote.quantidadeDisponivel) > 0)
          .map((lote: any) => ({ loteId: lote.id, quantidade: "" })),
      }));
    } catch (erro: any) {
      toast.error(
        erro.message ?? "Não foi possível carregar as peças deste serviço"
      );
      setDialogRetiradaSerragem(false);
    }
  };
  const totalTorasTerceiros = serragemTerceiros.toras.reduce(
    (total, tora) => total + num(tora.volume),
    0
  );
  const totalPecasTerceiros = serragemTerceiros.itens.reduce(
    (total, item) => total + calcularItem(item).volume,
    0
  );
  const tarifaPorM3Terceiros = num(serragemTerceiros.valorServico);
  const valorTotalSerragemTerceiros = Number(
    (totalTorasTerceiros * tarifaPorM3Terceiros).toFixed(2)
  );
  resumoTarifaSerragem = {
    volumeToras: totalTorasTerceiros,
    tarifaPorM3: tarifaPorM3Terceiros,
    valorTotal: valorTotalSerragemTerceiros,
  };
  const salvarSerragemTerceiros = () => {
    if (!serragemTerceiros.clienteId) {
      toast.error("Selecione o cliente proprietário das toras");
      return;
    }
    const torasPreenchidas = serragemTerceiros.toras.filter(tora =>
      Boolean(
        tora.referencia.trim() ||
          num(tora.diametro) > 0 ||
          num(tora.comprimento) > 0
      )
    );
    const itensPreenchidos = serragemTerceiros.itens.filter(item =>
      Boolean(
        item.madeiraNome.trim() ||
          num(item.espessura) > 0 ||
          num(item.largura) > 0 ||
          num(item.comprimento) > 0 ||
          num(item.quantidade) > 0
      )
    );
    if (!torasPreenchidas.length) {
      toast.error("Informe pelo menos uma tora serrada");
      return;
    }
    if (!itensPreenchidos.length) {
      toast.error("Informe pelo menos uma peça produzida");
      return;
    }
    if (
      torasPreenchidas.some(
        tora =>
          num(tora.diametro) <= 0 ||
          num(tora.comprimento) <= 0
      )
    ) {
      toast.error(
        "Preencha diâmetro e comprimento de todas as toras informadas"
      );
      return;
    }
    if (
      itensPreenchidos.some(
        item =>
          item.madeiraNome.trim().length < 2 ||
          num(item.espessura) <= 0 ||
          num(item.largura) <= 0 ||
          num(item.comprimento) <= 0 ||
          num(item.quantidade) <= 0
      )
    ) {
      toast.error(
        "Preencha essência, medidas e quantidade de todas as peças informadas"
      );
      return;
    }
    const { valorServico, ...dadosSerragem } = serragemTerceiros;
    const entrada = {
      ...dadosSerragem,
      clienteId: Number(serragemTerceiros.clienteId),
      valorMetroCubico: valorServico,
      toras: torasPreenchidas.map(tora => ({
        ...tora,
        referencia: tora.referencia.trim() || "-",
        madeiraNome: tora.madeiraNome.trim(),
      })),
      itens: itensPreenchidos.map(item => ({
        ...item,
        madeiraNome: item.madeiraNome.trim(),
        quantidade: Number(item.quantidade),
      })),
    };
    const opcoes = {
      onSuccess: (resultado: any) => {
        toast.success(
          `${resultado.numero} ${serragemEmEdicaoId ? "atualizada" : "registrada"} · aproveitamento de ${formatarNumero(resultado.aproveitamento, 2)}%`
        );
        setDialogSerragemTerceiros(false);
        setDialogSerragemTerceirosResponsivo(false);
        setDialogSerragemTerceirosUnificada(false);
        setSerragemEmEdicaoId(null);
        invalidar();
      },
      onError: (erro: { message: string }) => toast.error(erro.message),
    };
    if (serragemEmEdicaoId)
      atualizarSerragemTerceiros.mutate(
        { id: serragemEmEdicaoId, ...entrada },
        opcoes
      );
    else criarSerragemTerceiros.mutate(entrada, opcoes);
  };
  const salvarRetiradaSerragem = () => {
    if (!serragemParaRetirada) return;
    const itens = retiradaSerragem.itens
      .filter(item => num(item.quantidade) > 0)
      .map(item => ({
        loteId: item.loteId,
        quantidade: Math.floor(num(item.quantidade)),
      }));
    if (!itens.length) {
      toast.error("Informe a quantidade retirada em pelo menos uma peça");
      return;
    }
    registrarRetiradaSerragem.mutate(
      {
        serragemId: serragemParaRetirada.id,
        dataRetirada: retiradaSerragem.dataRetirada,
        responsavel: retiradaSerragem.responsavel || null,
        observacoes: retiradaSerragem.observacoes || null,
        itens,
      },
      {
        onSuccess: () => {
          toast.success("Retirada registrada e saldo do cliente atualizado");
          setDialogRetiradaSerragem(false);
          setSerragemParaRetirada(null);
          setDetalheRetiradaSerragem(null);
          invalidar();
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };
  const salvarNovoClienteSerragem = () => {
    if (!novoClienteSerragemForm.nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    criarClienteSerragem.mutate(
      {
        nome: novoClienteSerragemForm.nome.trim(),
        contacto: novoClienteSerragemForm.contacto.trim() || undefined,
      },
      {
        onSuccess: cliente => {
          if (!cliente.id) {
            toast.error("Não foi possível selecionar o cliente criado");
            return;
          }
          setSerragemTerceiros(atual => ({
            ...atual,
            clienteId: String(cliente.id),
          }));
          utils.cliente.list.invalidate();
          setDialogNovoClienteSerragem(false);
          setNovoClienteSerragemForm(novoClienteSerragem());
          toast.success("Cliente criado e selecionado");
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };
  const alternarSelecao = (id: number, tipo: "producao" | "serragem") => {
    const atualizar =
      tipo === "producao" ? setSelecionadosProducao : setSelecionadosSerragem;
    atualizar(selecionados =>
      selecionados.includes(id)
        ? selecionados.filter(item => item !== id)
        : [...selecionados, id]
    );
  };
  const selecionarTodos = (
    ids: number[],
    tipo: "producao" | "serragem",
    marcado: boolean
  ) => {
    (tipo === "producao" ? setSelecionadosProducao : setSelecionadosSerragem)(
      marcado ? ids : []
    );
  };
  const salvarCabecalhoLoteProducao = () => {
    if (!selecionadosProducao.length) return;
    if (!Object.values(camposLoteProducao).some(Boolean)) {
      toast.error("Selecione ao menos um dado de cabeçalho para alterar");
      return;
    }
    if (camposLoteProducao.dataProducao && !loteProducao.dataProducao) {
      toast.error("Informe a nova data da produção");
      return;
    }
    atualizarCabecalhoRomaneiosLote.mutate(
      {
        ids: selecionadosProducao,
        dataProducao: camposLoteProducao.dataProducao
          ? loteProducao.dataProducao
          : undefined,
        fita: camposLoteProducao.fita
          ? loteProducao.fita.trim() || null
          : undefined,
        responsavel: camposLoteProducao.responsavel
          ? loteProducao.responsavel.trim() || null
          : undefined,
        observacoes: camposLoteProducao.observacoes
          ? loteProducao.observacoes.trim() || null
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            `${selecionadosProducao.length} romaneio(s) atualizado(s)`
          );
          setSelecionadosProducao([]);
          setEdicaoLoteAberta(null);
          utils.producao.romaneios.list.invalidate();
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };
  const salvarCabecalhoLoteSerragem = () => {
    if (!selecionadosSerragem.length) return;
    if (!Object.values(camposLoteSerragem).some(Boolean)) {
      toast.error("Selecione ao menos um dado de cabeçalho para alterar");
      return;
    }
    if (camposLoteSerragem.clienteId && !loteSerragem.clienteId) {
      toast.error("Selecione o cliente proprietário");
      return;
    }
    if (camposLoteSerragem.dataProducao && !loteSerragem.dataProducao) {
      toast.error("Informe a nova data do serviço");
      return;
    }
    if (camposLoteSerragem.dataVencimento && !loteSerragem.dataVencimento) {
      toast.error("Informe o novo vencimento da cobrança");
      return;
    }
    atualizarCabecalhoSerragensLote.mutate(
      {
        ids: selecionadosSerragem,
        clienteId: camposLoteSerragem.clienteId
          ? Number(loteSerragem.clienteId)
          : undefined,
        dataProducao: camposLoteSerragem.dataProducao
          ? loteSerragem.dataProducao
          : undefined,
        dataVencimento: camposLoteSerragem.dataVencimento
          ? loteSerragem.dataVencimento
          : undefined,
        responsavel: camposLoteSerragem.responsavel
          ? loteSerragem.responsavel.trim() || null
          : undefined,
        observacoes: camposLoteSerragem.observacoes
          ? loteSerragem.observacoes.trim() || null
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            `${selecionadosSerragem.length} serviço(s) atualizado(s)`
          );
          setSelecionadosSerragem([]);
          setEdicaoLoteAberta(null);
          utils.producao.serragemTerceiros.list.invalidate();
        },
        onError: erro => toast.error(erro.message),
      }
    );
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <AproveitamentoManualPortal
        aberto={dialogRomaneio}
        etapa={etapa}
        valor={romaneio}
        atualizarValor={setRomaneio}
        volumeRomaneado={totaisPecas.volume}
        volumeComAproveitamento={volumeProducaoComAproveitamento}
        aproveitamento={aproveitamento}
      />
      <header className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Chão de fábrica
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Produção diária
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Registre todas as plaquetas serradas no dia, ajuste as medidas
            efetivas e informe as peças produzidas para acompanhar o
            aproveitamento real.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full shrink-0 md:w-auto"
            variant="outline"
            onClick={abrirSerragemTerceiros}
          >
            <Scissors className="mr-2 h-4 w-4" />
            Serragem de terceiros
          </Button>
          <Button className="w-full shrink-0 md:w-auto" onClick={abrirRomaneio}>
            <Scissors className="mr-2 h-4 w-4" />
            Nova produção diária
          </Button>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Resumo
          icon={<TreePine />}
          titulo="Toras disponíveis"
          valor={
            <>
              <span>{plaquetas.data?.totalDisponiveis ?? 0}</span>
              <span className="ml-2 text-sm font-semibold text-emerald-700">
                {formatarNumero(volumeTorasDisponiveis)} m³
              </span>
            </>
          }
          detalhe={`Prontas para serragem · Média: ${formatarNumero(volumeMedioPorTora)} m³/tora`}
          cor="emerald"
          acao={
            <div className="mt-3 space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/estoque?estado=disponivel")}
              >
                Ver toras disponíveis
              </Button>
              {alertaVariacaoAtipica && (
                <div
                  data-testid="alerta-variacao-volume"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-left text-xs text-amber-950"
                >
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="space-y-2">
                      <p>
                        <strong>Variação de volume identificada.</strong> Há
                        essências com toras muito maiores que a média:{" "}
                        {essenciasAtipicas.join(", ")}. Consulte o detalhamento
                        antes de planejar a serragem.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={confirmarVariacoesAtipicas.isPending}
                        className="h-7 border-amber-300 bg-amber-100/70 px-2 text-xs text-amber-950 hover:bg-amber-200"
                        onClick={() =>
                          confirmarVariacoesAtipicas.mutate(
                            { variacoes: variacoesAtipicas },
                            {
                              onSuccess: () => {
                                toast.success(
                                  "Variação conferida. O aviso voltará somente se houver nova alteração nos volumes."
                                );
                                utils.producao.plaquetas.list.invalidate();
                              },
                              onError: erro => toast.error(erro.message),
                            }
                          )
                        }
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        {confirmarVariacoesAtipicas.isPending
                          ? "A confirmar..."
                          : "Marcar como conferida"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {essenciasDisponiveis.length > 0 && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 text-left">
                  <p className="mb-1.5 text-xs font-semibold text-emerald-950">
                    Disponibilidade por essência
                  </p>
                  <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                    {essenciasDisponiveis.map(
                      (item: {
                        essencia: string;
                        quantidade: number;
                        volume: number;
                      }) => (
                        <Button
                          key={item.essencia}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto w-full justify-between whitespace-normal px-2 py-1.5 text-left text-xs text-emerald-950 hover:bg-emerald-100"
                          aria-label={`Filtrar toras de ${item.essencia}`}
                          onClick={() =>
                            setLocation(
                              `/estoque?estado=disponivel&busca=${encodeURIComponent(item.essencia)}`
                            )
                          }
                        >
                          <span className="font-semibold">{item.essencia}</span>
                          <span className="text-right text-emerald-800">
                            {item.quantidade} toras ·{" "}
                            {formatarNumero(item.volume)} m³
                          </span>
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          }
        />
        <Resumo
          icon={<Factory />}
          titulo="Romaneios"
          valor={(romaneios.data ?? []).length}
          detalhe="Produção confirmada"
          cor="sky"
        />
        <Resumo
          icon={<Layers3 />}
          titulo="Peças em estoque"
          valor={estoqueProprio.reduce(
            (total: number, item: any) => total + item.quantidadeDisponivel,
            0
          )}
          detalhe="Estoque próprio para entrega"
          cor="amber"
        />
        <Resumo
          icon={<BarChart3 />}
          titulo="Volume serrado"
          valor={`${formatarNumero(estoqueProprio.reduce((total: number, item: any) => total + item.volumeDisponivel, 0))} m³`}
          detalhe="Saldo próprio por dimensões"
          cor="violet"
        />
      </div>
      <section className="min-w-0 overflow-hidden rounded-xl border border-violet-200 bg-card shadow-sm">
        <Cabecalho
          titulo="Serragem de terceiros"
          texto="Toras recebidas de clientes não entram no estoque próprio. As peças ficam identificadas como propriedade do cliente e não podem ser vendidas."
        />
        {selecionadosSerragem.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-violet-100 bg-violet-50/60 px-4 py-3">
            <p className="text-sm font-medium text-violet-950">
              {selecionadosSerragem.length} serviço(s) selecionado(s)
            </p>
            <Button size="sm" onClick={() => setEdicaoLoteAberta("serragem")}>
              Alterar cabeçalho em lote
            </Button>
          </div>
        )}
        {serragensTerceiros.isLoading ? (
          <Carregando />
        ) : serragensTerceiros.data?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      aria-label="Selecionar todos os serviços de serragem"
                      type="checkbox"
                      checked={selecionadosSerragem.length === serragensTerceiros.data.length}
                      onChange={e => selecionarTodos(serragensTerceiros.data.map((item: any) => item.id), "serragem", e.target.checked)}
                    />
                  </TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Toras</TableHead>
                  <TableHead className="text-right">Produzido</TableHead>
                  <TableHead className="text-right">Cobrança</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serragensTerceiros.data.map((servico: any) => (
                  <TableRow key={servico.id}>
                    <TableCell>
                      <input
                        aria-label={`Selecionar serviço ${servico.numero}`}
                        type="checkbox"
                        checked={selecionadosSerragem.includes(servico.id)}
                        onChange={() => alternarSelecao(servico.id, "serragem")}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {servico.numero}
                      <Badge className="ml-2 bg-violet-100 text-violet-800 hover:bg-violet-100">
                        Terceiro
                      </Badge>
                    </TableCell>
                    <TableCell>{servico.clienteNome}</TableCell>
                    <TableCell>{formatarData(servico.dataProducao)}</TableCell>
                    <TableCell className="text-right">
                      {formatarNumero(servico.volumeToras)} m³
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarNumero(servico.volumeProduzido)} m³
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(num(servico.valorServico))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirEdicaoSerragem(servico)}
                        >
                          Editar serviço
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirRetiradaSerragem(servico)}
                        >
                          Registrar retirada
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Vazio
            icone={<Scissors />}
            texto="Nenhuma serragem de terceiros registrada."
          />
        )}
      </section>
      <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
        <Cabecalho
          titulo="Romaneios diários"
          texto="Cada romaneio consolida as toras serradas, as peças produzidas e o aproveitamento do dia."
        />
        {selecionadosProducao.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-y bg-sky-50/60 px-4 py-3">
            <p className="text-sm font-medium text-sky-950">
              {selecionadosProducao.length} romaneio(s) selecionado(s)
            </p>
            <Button size="sm" onClick={() => setEdicaoLoteAberta("producao")}>
              Alterar cabeçalho em lote
            </Button>
          </div>
        )}
        <div className="grid gap-3 border-y bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Essência">
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={filtroEssenciaProducao}
              onChange={evento =>
                setFiltroEssenciaProducao(evento.target.value)
              }
            >
              <option value="">Todas as essências</option>
              {essenciasRelatorioProducao.map(essencia => (
                <option key={essencia} value={essencia}>
                  {essencia}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Data inicial">
            <Input
              type="date"
              value={filtroDataInicialProducao}
              onChange={evento =>
                setFiltroDataInicialProducao(evento.target.value)
              }
            />
          </Campo>
          <Campo label="Data final">
            <Input
              type="date"
              value={filtroDataFinalProducao}
              onChange={evento =>
                setFiltroDataFinalProducao(evento.target.value)
              }
            />
          </Campo>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              variant="outline"
              onClick={() => {
                setFiltroEssenciaProducao("");
                setFiltroDataInicialProducao("");
                setFiltroDataFinalProducao("");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
        {romaneios.isLoading ? (
          <Carregando />
        ) : romaneios.data?.length ? (
          romaneiosFiltrados.length ? (
            <TabelaRomaneios
              romaneios={romaneiosFiltrados}
              selecionados={selecionadosProducao}
              onAlternarSelecao={id => alternarSelecao(id, "producao")}
              onSelecionarTodos={marcado => selecionarTodos(romaneiosFiltrados.map((item: any) => item.id), "producao", marcado)}
              onEditar={abrirEdicaoRomaneio}
              onVisualizarPdf={item =>
                setPdfPreview({ id: item.id, numero: item.numero })
              }
              onExcluir={item =>
                setRomaneioParaExcluir({ id: item.id, numero: item.numero })
              }
            />
          ) : (
            <Vazio
              icone={<BarChart3 />}
              texto="Nenhum romaneio corresponde aos filtros selecionados."
            />
          )
        ) : (
          <Vazio
            icone={<Scissors />}
            texto="Nenhuma produção diária confirmada. Primeiro, registre as toras em Estoque."
          />
        )}
      </section>
      <Dialog
        open={edicaoLoteAberta === "producao"}
        onOpenChange={aberto => {
          if (!aberto) setEdicaoLoteAberta(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Alterar cabeçalho de Produções</DialogTitle>
            <DialogDescription>
              Os itens, toras, peças e totais não serão modificados. Marque
              somente os campos que devem receber o novo valor nos{" "}
              {selecionadosProducao.length} romaneio(s) selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <CampoLote
              marcado={camposLoteProducao.dataProducao}
              aoAlternar={marcado =>
                setCamposLoteProducao(atual => ({
                  ...atual,
                  dataProducao: marcado,
                }))
              }
              rotulo="Data da produção"
            >
              <Input
                type="date"
                disabled={!camposLoteProducao.dataProducao}
                value={loteProducao.dataProducao}
                onChange={e =>
                  setLoteProducao(atual => ({
                    ...atual,
                    dataProducao: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteProducao.fita}
              aoAlternar={marcado =>
                setCamposLoteProducao(atual => ({ ...atual, fita: marcado }))
              }
              rotulo="Fita"
            >
              <Input
                disabled={!camposLoteProducao.fita}
                value={loteProducao.fita}
                onChange={e =>
                  setLoteProducao(atual => ({ ...atual, fita: e.target.value }))
                }
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteProducao.responsavel}
              aoAlternar={marcado =>
                setCamposLoteProducao(atual => ({
                  ...atual,
                  responsavel: marcado,
                }))
              }
              rotulo="Responsável"
            >
              <Input
                disabled={!camposLoteProducao.responsavel}
                value={loteProducao.responsavel}
                onChange={e =>
                  setLoteProducao(atual => ({
                    ...atual,
                    responsavel: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteProducao.observacoes}
              aoAlternar={marcado =>
                setCamposLoteProducao(atual => ({
                  ...atual,
                  observacoes: marcado,
                }))
              }
              rotulo="Observações"
            >
              <Textarea
                disabled={!camposLoteProducao.observacoes}
                value={loteProducao.observacoes}
                onChange={e =>
                  setLoteProducao(atual => ({
                    ...atual,
                    observacoes: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEdicaoLoteAberta(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={salvarCabecalhoLoteProducao}
                disabled={atualizarCabecalhoRomaneiosLote.isPending}
              >
                {atualizarCabecalhoRomaneiosLote.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Aplicar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={edicaoLoteAberta === "serragem"}
        onOpenChange={aberto => {
          if (!aberto) setEdicaoLoteAberta(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Alterar cabeçalho de Serragens</DialogTitle>
            <DialogDescription>
              As toras, peças, volume produzido e valores não serão modificados.
              Marque somente os campos que devem receber o novo valor nos{" "}
              {selecionadosSerragem.length} serviço(s) selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <CampoLote
              marcado={camposLoteSerragem.clienteId}
              aoAlternar={marcado =>
                setCamposLoteSerragem(atual => ({
                  ...atual,
                  clienteId: marcado,
                }))
              }
              rotulo="Cliente proprietário"
            >
              <SearchableEntitySelect
                value={loteSerragem.clienteId}
                onValueChange={clienteId =>
                  setLoteSerragem(atual => ({ ...atual, clienteId }))
                }
                disabled={!camposLoteSerragem.clienteId}
                options={(clientes.data ?? []).map((cliente: any) => ({
                  value: String(cliente.id),
                  label: cliente.nome,
                  details: cliente.telefone ?? cliente.documento ?? "",
                }))}
                placeholder="Selecionar cliente"
                searchPlaceholder="Buscar cliente"
                ariaLabel="Cliente proprietário para alteração em lote"
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteSerragem.dataProducao}
              aoAlternar={marcado =>
                setCamposLoteSerragem(atual => ({
                  ...atual,
                  dataProducao: marcado,
                }))
              }
              rotulo="Data do serviço"
            >
              <Input
                type="date"
                disabled={!camposLoteSerragem.dataProducao}
                value={loteSerragem.dataProducao}
                onChange={e =>
                  setLoteSerragem(atual => ({
                    ...atual,
                    dataProducao: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteSerragem.dataVencimento}
              aoAlternar={marcado =>
                setCamposLoteSerragem(atual => ({
                  ...atual,
                  dataVencimento: marcado,
                }))
              }
              rotulo="Vencimento da cobrança"
            >
              <Input
                type="date"
                disabled={!camposLoteSerragem.dataVencimento}
                value={loteSerragem.dataVencimento}
                onChange={e =>
                  setLoteSerragem(atual => ({
                    ...atual,
                    dataVencimento: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteSerragem.responsavel}
              aoAlternar={marcado =>
                setCamposLoteSerragem(atual => ({
                  ...atual,
                  responsavel: marcado,
                }))
              }
              rotulo="Responsável"
            >
              <Input
                disabled={!camposLoteSerragem.responsavel}
                value={loteSerragem.responsavel}
                onChange={e =>
                  setLoteSerragem(atual => ({
                    ...atual,
                    responsavel: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <CampoLote
              marcado={camposLoteSerragem.observacoes}
              aoAlternar={marcado =>
                setCamposLoteSerragem(atual => ({
                  ...atual,
                  observacoes: marcado,
                }))
              }
              rotulo="Observações"
            >
              <Textarea
                disabled={!camposLoteSerragem.observacoes}
                value={loteSerragem.observacoes}
                onChange={e =>
                  setLoteSerragem(atual => ({
                    ...atual,
                    observacoes: e.target.value,
                  }))
                }
              />
            </CampoLote>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEdicaoLoteAberta(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={salvarCabecalhoLoteSerragem}
                disabled={atualizarCabecalhoSerragensLote.isPending}
              >
                {atualizarCabecalhoSerragensLote.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Aplicar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PdfPreviewDialog
        open={Boolean(pdfPreview)}
        onOpenChange={aberto => {
          if (!aberto) setPdfPreview(null);
        }}
        url={pdfPreview ? `/api/pdf/romaneio/${pdfPreview.id}` : null}
        title={
          pdfPreview
            ? `Romaneio de Produção ${pdfPreview.numero}`
            : "Romaneio de Produção"
        }
        description="Confira a grade por bitola e os totais do romaneio antes de confirmar o download."
      />
      <Dialog
        open={Boolean(romaneioParaExcluir)}
        onOpenChange={aberto => {
          if (!aberto) setRomaneioParaExcluir(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Remover produção diária?</DialogTitle>
            <DialogDescription>
              Esta ação exclui o romaneio{" "}
              <strong>{romaneioParaExcluir?.numero}</strong>, remove as peças
              produzidas e devolve as plaquetas ao estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  A exclusão será bloqueada se qualquer peça deste romaneio já
                  tiver sido entregue, inventariada ou ajustada.
                </p>
              </div>
            </div>
            <Acoes
              cancelar={() => setRomaneioParaExcluir(null)}
              confirmar={confirmarExclusaoRomaneio}
              carregando={excluirRomaneio.isPending}
              texto="Remover produção"
            />
          </div>
        </DialogContent>
      </Dialog>
      {dialogSerragemTerceirosUnificada && (
        <SerragemTerceirosUnificadaDialog
          valor={serragemTerceiros}
          atualizarValor={setSerragemTerceiros}
          clientes={clientes.data ?? []}
          aberto={dialogSerragemTerceirosUnificada}
          modoEdicao={Boolean(serragemEmEdicaoId)}
          aoFechar={() => {
            setDialogSerragemTerceirosUnificada(false);
            setSerragemEmEdicaoId(null);
          }}
          aoCriarCliente={() => {
            setNovoClienteSerragemForm(novoClienteSerragem());
            setDialogNovoClienteSerragem(true);
          }}
          aoSalvar={salvarSerragemTerceiros}
          salvando={
            criarSerragemTerceiros.isPending ||
            atualizarSerragemTerceiros.isPending
          }
        />
      )}
      <Dialog
        open={dialogSerragemTerceiros}
        onOpenChange={setDialogSerragemTerceiros}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Serragem de terceiros</DialogTitle>
            <DialogDescription>
              Registre as toras do cliente sem criar estoque próprio. Somente as
              peças produzidas ficam registradas, identificadas como propriedade
              do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="Cliente proprietário *">
                <SearchableEntitySelect
                  value={serragemTerceiros.clienteId}
                  onValueChange={clienteId =>
                    setSerragemTerceiros(atual => ({ ...atual, clienteId }))
                  }
                  options={(clientes.data ?? []).map((cliente: any) => ({
                    value: String(cliente.id),
                    label: cliente.nome,
                    details: cliente.telefone ?? cliente.documento ?? "",
                  }))}
                  placeholder="Selecionar cliente"
                  searchPlaceholder="Buscar por nome ou telefone"
                  ariaLabel="Cliente proprietário"
                />
              </Campo>
              <Campo label="Data do serviço *">
                <Input
                  type="date"
                  value={serragemTerceiros.dataProducao}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      dataProducao: e.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Vencimento da cobrança *">
                <Input
                  type="date"
                  value={serragemTerceiros.dataVencimento}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      dataVencimento: e.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Valor do serviço (R$) *">
                <Input
                  inputMode="decimal"
                  value={serragemTerceiros.valorServico}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      valorServico: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
              </Campo>
            </div>
            <div className="rounded-xl border bg-violet-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Toras serradas do cliente</h3>
                  <p className="text-xs text-muted-foreground">
                    Referência livre, medidas e volume. Estas toras não entram
                    no estoque próprio.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      toras: [
                        ...atual.toras,
                        {
                          referencia: "",
                          madeiraNome: "",
                          diametro: "",
                          comprimento: "",
                          volume: "",
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar tora
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referência</TableHead>
                      <TableHead>Essência</TableHead>
                      <TableHead>Diâmetro (cm)</TableHead>
                      <TableHead>Comprimento (m)</TableHead>
                      <TableHead>Volume (m³)</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serragemTerceiros.toras.map((tora, indice) => (
                      <TableRow key={indice}>
                        {(
                          [
                            "referencia",
                            "madeiraNome",
                            "diametro",
                            "comprimento",
                            "volume",
                          ] as const
                        ).map(campo => (
                          <TableCell key={campo}>
                            <Input
                              inputMode={
                                campo === "referencia" ||
                                campo === "madeiraNome"
                                  ? undefined
                                  : "decimal"
                              }
                              value={tora[campo]}
                              onChange={e =>
                                setSerragemTerceiros(atual => ({
                                  ...atual,
                                  toras: atual.toras.map((linha, i) =>
                                    i === indice
                                      ? { ...linha, [campo]: e.target.value }
                                      : linha
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={serragemTerceiros.toras.length === 1}
                            onClick={() =>
                              setSerragemTerceiros(atual => ({
                                ...atual,
                                toras: atual.toras.filter(
                                  (_, i) => i !== indice
                                ),
                              }))
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-sm font-medium">
                Total de toras: {formatarNumero(totalTorasTerceiros)} m³
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Produção serrada</h3>
                  <p className="text-xs text-muted-foreground">
                    Use a mesma grade de dimensões da produção diária. As peças
                    serão marcadas como estoque de terceiros.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      itens: [...atual.itens, novoItem()],
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar peça
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Essência</TableHead>
                      <TableHead>Espessura (cm)</TableHead>
                      <TableHead>Largura (cm)</TableHead>
                      <TableHead>Comprimento (m)</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serragemTerceiros.itens.map((item, indice) => (
                      <TableRow key={indice}>
                        {(
                          [
                            "madeiraNome",
                            "espessura",
                            "largura",
                            "comprimento",
                            "quantidade",
                          ] as const
                        ).map(campo => (
                          <TableCell key={campo}>
                            <Input
                              inputMode={
                                campo === "madeiraNome" ? undefined : "decimal"
                              }
                              value={item[campo]}
                              onChange={e =>
                                setSerragemTerceiros(atual => ({
                                  ...atual,
                                  itens: atual.itens.map((linha, i) =>
                                    i === indice
                                      ? { ...linha, [campo]: e.target.value }
                                      : linha
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={serragemTerceiros.itens.length === 1}
                            onClick={() =>
                              setSerragemTerceiros(atual => ({
                                ...atual,
                                itens: atual.itens.filter(
                                  (_, i) => i !== indice
                                ),
                              }))
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-sm font-medium">
                Volume produzido: {formatarNumero(totalPecasTerceiros)} m³{" "}
                {totalTorasTerceiros > 0
                  ? `· Aproveitamento: ${formatarNumero((totalPecasTerceiros / totalTorasTerceiros) * 100, 2)}%`
                  : ""}
              </p>
            </div>
            <Campo label="Responsável">
              <Input
                value={serragemTerceiros.responsavel}
                onChange={e =>
                  setSerragemTerceiros(atual => ({
                    ...atual,
                    responsavel: e.target.value,
                  }))
                }
              />
            </Campo>
            <Campo label="Observações">
              <Textarea
                value={serragemTerceiros.observacoes}
                onChange={e =>
                  setSerragemTerceiros(atual => ({
                    ...atual,
                    observacoes: e.target.value,
                  }))
                }
              />
            </Campo>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogSerragemTerceiros(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={salvarSerragemTerceiros}
                disabled={criarSerragemTerceiros.isPending}
              >
                {criarSerragemTerceiros.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Scissors className="mr-2 h-4 w-4" />
                )}
                Registrar serviço
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialogSerragemTerceirosResponsivo}
        onOpenChange={setDialogSerragemTerceirosResponsivo}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="min-w-0">
            <DialogTitle className="break-words">
              Serragem de terceiros
            </DialogTitle>
            <DialogDescription>
              Registre toras pertencentes ao cliente. Elas não entram no estoque
              próprio; apenas as peças serradas são guardadas como estoque de
              terceiros.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Campo label="Cliente proprietário *">
                <SearchableEntitySelect
                  value={serragemTerceiros.clienteId}
                  onValueChange={clienteId =>
                    setSerragemTerceiros(atual => ({ ...atual, clienteId }))
                  }
                  options={(clientes.data ?? []).map((cliente: any) => ({
                    value: String(cliente.id),
                    label: cliente.nome,
                    details:
                      cliente.telefone ??
                      cliente.contacto ??
                      cliente.documento ??
                      "",
                  }))}
                  placeholder="Selecionar cliente"
                  searchPlaceholder="Buscar por nome ou telefone"
                  createLabel="Criar novo cliente"
                  onCreate={() => {
                    setNovoClienteSerragemForm(novoClienteSerragem());
                    setDialogNovoClienteSerragem(true);
                  }}
                  ariaLabel="Cliente proprietário"
                />
              </Campo>
              <Campo label="Data do serviço *">
                <Input
                  type="date"
                  value={serragemTerceiros.dataProducao}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      dataProducao: e.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Vencimento da cobrança *">
                <Input
                  type="date"
                  value={serragemTerceiros.dataVencimento}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      dataVencimento: e.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Valor do serviço (R$) *">
                <Input
                  inputMode="decimal"
                  value={serragemTerceiros.valorServico}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      valorServico: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
              </Campo>
            </div>
            <div className="min-w-0 rounded-xl border border-violet-200 bg-violet-50/70 p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">Toras serradas do cliente</h3>
                  <p className="text-xs text-muted-foreground">
                    Referência livre, medidas e volume. Estas toras não criam
                    saldo de estoque próprio.
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      toras: [
                        ...atual.toras,
                        {
                          referencia: "",
                          madeiraNome: "",
                          diametro: "",
                          comprimento: "",
                          volume: "",
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar tora
                </Button>
              </div>
              <div className="space-y-3">
                {serragemTerceiros.toras.map((tora, indice) => (
                  <div
                    key={indice}
                    className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border bg-background p-3 sm:grid-cols-2 xl:grid-cols-6"
                  >
                    <Campo label="Referência">
                      <Input
                        value={tora.referencia}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            toras: atual.toras.map((linha, i) =>
                              i === indice
                                ? { ...linha, referencia: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Essência">
                      <Input
                        value={tora.madeiraNome}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            toras: atual.toras.map((linha, i) =>
                              i === indice
                                ? { ...linha, madeiraNome: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Diâmetro (cm)">
                      <Input
                        inputMode="decimal"
                        value={tora.diametro}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            toras: atual.toras.map((linha, i) =>
                              i === indice
                                ? { ...linha, diametro: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Comprimento (m)">
                      <Input
                        inputMode="decimal"
                        value={tora.comprimento}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            toras: atual.toras.map((linha, i) =>
                              i === indice
                                ? { ...linha, comprimento: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Volume (m³)">
                      <Input
                        inputMode="decimal"
                        value={tora.volume}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            toras: atual.toras.map((linha, i) =>
                              i === indice
                                ? { ...linha, volume: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        type="button"
                        variant="ghost"
                        disabled={serragemTerceiros.toras.length === 1}
                        onClick={() =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            toras: atual.toras.filter((_, i) => i !== indice),
                          }))
                        }
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium">
                Total de toras: {formatarNumero(totalTorasTerceiros)} m³
              </p>
            </div>
            <div className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">Produção serrada</h3>
                  <p className="text-xs text-muted-foreground">
                    A mesma grade da produção diária, com identificação de
                    estoque de terceiros.
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      itens: [...atual.itens, novoItem()],
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar peça
                </Button>
              </div>
              <div className="space-y-3">
                {serragemTerceiros.itens.map((item, indice) => (
                  <div
                    key={indice}
                    className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border bg-background p-3 sm:grid-cols-2 xl:grid-cols-6"
                  >
                    <Campo label="Essência">
                      <Input
                        value={item.madeiraNome}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            itens: atual.itens.map((linha, i) =>
                              i === indice
                                ? { ...linha, madeiraNome: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Espessura (cm)">
                      <Input
                        inputMode="decimal"
                        value={item.espessura}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            itens: atual.itens.map((linha, i) =>
                              i === indice
                                ? { ...linha, espessura: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Largura (cm)">
                      <Input
                        inputMode="decimal"
                        value={item.largura}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            itens: atual.itens.map((linha, i) =>
                              i === indice
                                ? { ...linha, largura: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Comprimento (m)">
                      <Input
                        inputMode="decimal"
                        value={item.comprimento}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            itens: atual.itens.map((linha, i) =>
                              i === indice
                                ? { ...linha, comprimento: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Quantidade">
                      <Input
                        inputMode="numeric"
                        value={item.quantidade}
                        onChange={e =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            itens: atual.itens.map((linha, i) =>
                              i === indice
                                ? { ...linha, quantidade: e.target.value }
                                : linha
                            ),
                          }))
                        }
                      />
                    </Campo>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        type="button"
                        variant="ghost"
                        disabled={serragemTerceiros.itens.length === 1}
                        onClick={() =>
                          setSerragemTerceiros(atual => ({
                            ...atual,
                            itens: atual.itens.filter((_, i) => i !== indice),
                          }))
                        }
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium">
                Volume produzido: {formatarNumero(totalPecasTerceiros)} m³{" "}
                {totalTorasTerceiros > 0
                  ? `· Aproveitamento: ${formatarNumero((totalPecasTerceiros / totalTorasTerceiros) * 100, 2)}%`
                  : ""}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Responsável">
                <Input
                  value={serragemTerceiros.responsavel}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      responsavel: e.target.value,
                    }))
                  }
                />
              </Campo>
              <Campo label="Observações">
                <Textarea
                  value={serragemTerceiros.observacoes}
                  onChange={e =>
                    setSerragemTerceiros(atual => ({
                      ...atual,
                      observacoes: e.target.value,
                    }))
                  }
                />
              </Campo>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogSerragemTerceirosResponsivo(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={salvarSerragemTerceiros}
                disabled={criarSerragemTerceiros.isPending}
              >
                {criarSerragemTerceiros.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Scissors className="mr-2 h-4 w-4" />
                )}
                Registrar serviço
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialogNovoClienteSerragem}
        onOpenChange={setDialogNovoClienteSerragem}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              O cliente será criado e selecionado automaticamente para este
              serviço.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Nome *">
              <Input
                autoFocus
                value={novoClienteSerragemForm.nome}
                onChange={e =>
                  setNovoClienteSerragemForm(atual => ({
                    ...atual,
                    nome: e.target.value,
                  }))
                }
                placeholder="Nome do cliente"
              />
            </Campo>
            <Campo label="Telefone">
              <Input
                inputMode="tel"
                value={novoClienteSerragemForm.contacto}
                onChange={e =>
                  setNovoClienteSerragemForm(atual => ({
                    ...atual,
                    contacto: e.target.value,
                  }))
                }
                placeholder="(00) 00000-0000"
              />
            </Campo>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogNovoClienteSerragem(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={salvarNovoClienteSerragem}
                disabled={criarClienteSerragem.isPending}
              >
                {criarClienteSerragem.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Criar cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialogRetiradaSerragem}
        onOpenChange={aberto => {
          setDialogRetiradaSerragem(aberto);
          if (!aberto) {
            setSerragemParaRetirada(null);
            setDetalheRetiradaSerragem(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Registrar retirada de peças</DialogTitle>
            <DialogDescription>
              {serragemParaRetirada
                ? `${serragemParaRetirada.numero} · ${serragemParaRetirada.clienteNome}`
                : "Selecione as peças que o cliente está retirando."}
            </DialogDescription>
          </DialogHeader>
          {!detalheRetiradaSerragem ? (
            <Carregando />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
                Informe apenas as quantidades entregues agora. O saldo restante
                continuará identificado como propriedade do cliente no estoque.
              </div>
              <div className="space-y-3">
                {(detalheRetiradaSerragem.lotes ?? [])
                  .filter((lote: any) => num(lote.quantidadeDisponivel) > 0)
                  .map((lote: any) => {
                    const item = retiradaSerragem.itens.find(
                      linha => linha.loteId === lote.id
                    );
                    return (
                      <div
                        key={lote.id}
                        className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_10rem]"
                      >
                        <div>
                          <p className="font-medium">
                            {lote.madeiraNome} ·{" "}
                            {formatarNumero(num(lote.espessura), 2)} ×{" "}
                            {formatarNumero(num(lote.largura), 2)} ×{" "}
                            {formatarNumero(num(lote.comprimento), 2)} m
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Disponível para retirada:{" "}
                            <strong className="text-foreground">
                              {formatarNumero(
                                num(lote.quantidadeDisponivel),
                                0
                              )}{" "}
                              peça(s)
                            </strong>
                          </p>
                        </div>
                        <Campo label="Retirar agora">
                          <Input
                            aria-label={`Retirar agora — ${lote.madeiraNome}`}
                            inputMode="numeric"
                            value={item?.quantidade ?? ""}
                            placeholder="0"
                            onChange={e =>
                              setRetiradaSerragem(atual => ({
                                ...atual,
                                itens: atual.itens.map(linha =>
                                  linha.loteId === lote.id
                                    ? { ...linha, quantidade: e.target.value }
                                    : linha
                                ),
                              }))
                            }
                          />
                        </Campo>
                      </div>
                    );
                  })}
              </div>
              {!(detalheRetiradaSerragem.lotes ?? []).some(
                (lote: any) => num(lote.quantidadeDisponivel) > 0
              ) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  Todas as peças deste serviço já foram retiradas pelo cliente.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo label="Data da retirada *">
                      <Input
                        type="date"
                        value={retiradaSerragem.dataRetirada}
                        onChange={e =>
                          setRetiradaSerragem(atual => ({
                            ...atual,
                            dataRetirada: e.target.value,
                          }))
                        }
                      />
                    </Campo>
                    <Campo label="Responsável">
                      <Input
                        value={retiradaSerragem.responsavel}
                        onChange={e =>
                          setRetiradaSerragem(atual => ({
                            ...atual,
                            responsavel: e.target.value,
                          }))
                        }
                        placeholder="Quem realizou a entrega"
                      />
                    </Campo>
                  </div>
                  <Campo label="Observações">
                    <Textarea
                      value={retiradaSerragem.observacoes}
                      onChange={e =>
                        setRetiradaSerragem(atual => ({
                          ...atual,
                          observacoes: e.target.value,
                        }))
                      }
                      placeholder="Ex.: retirada parcial, conferência pelo cliente"
                    />
                  </Campo>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogRetiradaSerragem(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={salvarRetiradaSerragem}
                      disabled={registrarRetiradaSerragem.isPending}
                    >
                      {registrarRetiradaSerragem.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Confirmar retirada
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogRomaneio} onOpenChange={setDialogRomaneio}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] min-w-0 max-w-6xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="min-w-0">
            <DialogTitle className="break-words">
              Romaneio de produção diária
            </DialogTitle>
            <DialogDescription>
              Informe as toras serradas e as peças produzidas para calcular o
              aproveitamento diário.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-5">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
              Adicione as plaquetas serradas no dia. Os dados do estoque são
              sugeridos, mas podem ser corrigidos neste romaneio para
              representar o volume efetivamente aproveitado.
            </div>
            <Tabs
              value={etapa}
              onValueChange={valor => setEtapa(valor as typeof etapa)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="toras">1. Toras serradas</TabsTrigger>
                <TabsTrigger value="pecas" disabled={!romaneio.toras.length}>
                  2. Peças produzidas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {etapa === "toras" ? (
              <div className="space-y-4">
                <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
                  <Campo label="Data da produção *">
                    <Input
                      type="date"
                      value={romaneio.dataProducao}
                      onChange={e =>
                        setRomaneio({
                          ...romaneio,
                          dataProducao: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo label="Fita / linha">
                    <Input
                      value={romaneio.fita}
                      onChange={e =>
                        setRomaneio({ ...romaneio, fita: e.target.value })
                      }
                      placeholder="Ex.: Fita 1"
                    />
                  </Campo>
                  <Campo label="Responsável">
                    <Input
                      value={romaneio.responsavel}
                      onChange={e =>
                        setRomaneio({
                          ...romaneio,
                          responsavel: e.target.value,
                        })
                      }
                      placeholder="Nome do responsável"
                    />
                  </Campo>
                  <Campo label="Toras no romaneio">
                    <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm font-semibold">
                      {romaneio.toras.length} plaqueta(s)
                    </div>
                  </Campo>
                </div>
                <div className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4">
                  <div className="min-w-0 space-y-3">
                    <Campo label="Código da plaqueta">
                      <Input
                        aria-label="Código da plaqueta"
                        value={codigoPlaqueta}
                        onChange={evento =>
                          setCodigoPlaqueta(evento.target.value)
                        }
                        onKeyDown={evento => {
                          if (evento.key === "Enter") {
                            evento.preventDefault();
                            void adicionarTora();
                          }
                        }}
                        placeholder="Digite a plaqueta, ex.: TOR-0008"
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Digite o código e pressione Enter. Se ele existir, as
                        medidas do Estoque serão preenchidas. Se não existir,
                        informe as medidas no cartão para registrar entrada e
                        consumo imediato.
                      </p>
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/70 dark:bg-amber-950/20">
                        <Checkbox
                          id="aceitar-tora-sem-plaqueta"
                          checked={aceitarToraSemPlaqueta}
                          onCheckedChange={valor =>
                            setAceitarToraSemPlaqueta(valor === true)
                          }
                        />
                        <Label
                          htmlFor="aceitar-tora-sem-plaqueta"
                          className="cursor-pointer text-xs font-medium leading-5 text-amber-950 dark:text-amber-100"
                        >
                          Aceitar tora sem plaqueta
                          <span className="mt-0.5 block font-normal text-amber-800 dark:text-amber-200">
                            Use quando a identificação física foi perdida. Se a tora já entrou no estoque, selecione-a abaixo para consumir o mesmo registro, sem criar um novo código.
                          </span>
                        </Label>
                      </div>
                      {aceitarToraSemPlaqueta && (
                        <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/40 p-2.5 dark:border-amber-900/70 dark:bg-amber-950/10">
                          <Label htmlFor="tora-sem-plaqueta-estoque" className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                            Tora sem plaqueta disponível no estoque
                          </Label>
                          <select
                            id="tora-sem-plaqueta-estoque"
                            aria-label="Tora sem plaqueta disponível no estoque"
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={plaquetaSemIdentificacaoSelecionada}
                            onChange={evento => {
                              const id = evento.target.value;
                              setPlaquetaSemIdentificacaoSelecionada(id);
                              if (id) adicionarToraSemIdentificacao(id);
                            }}
                          >
                            <option value="">Selecione pela essência, diâmetro e comprimento</option>
                            {(plaquetasSemIdentificacao.data ?? []).map((plaqueta: any) => (
                              <option key={plaqueta.id} value={String(plaqueta.id)}>
                                {plaqueta.madeiraNome} · Ø {formatarNumero(plaqueta.diametro, 2)} cm · {formatarNumero(plaqueta.comprimento, 3)} m · {formatarNumero(plaqueta.volumeDisponivel, 3)} m³ · {plaqueta.codigo}
                              </option>
                            ))}
                          </select>
                          {plaquetasSemIdentificacao.isLoading ? (
                            <p className="text-xs text-muted-foreground">Carregando toras sem plaqueta disponíveis...</p>
                          ) : (plaquetasSemIdentificacao.data ?? []).length === 0 ? (
                            <p className="text-xs text-amber-800 dark:text-amber-200">Não há tora sem plaqueta disponível no estoque. Registre a entrada pelo Estoque antes de serrar.</p>
                          ) : (
                            <p className="text-xs text-amber-800 dark:text-amber-200">A seleção preenche as medidas e preserva a identificação interna já cadastrada.</p>
                          )}
                        </div>
                      )}
                      {codigoPlaqueta.trim() && !plaquetas.isLoading && (
                        <p
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            buscaPlaquetaDigitada.isLoading
                              ? "text-muted-foreground"
                              : buscaPlaquetaDigitada.data
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {buscaPlaquetaDigitada.isLoading
                            ? "Consultando a plaqueta no estoque..."
                            : buscaPlaquetaDigitada.data
                              ? "Plaqueta disponível encontrada. Pressione Enter para adicionar."
                              : "Plaqueta ainda não cadastrada. Pressione Enter para adicioná-la com entrada imediata."}
                        </p>
                      )}
                    </Campo>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        className="w-full"
                        type="button"
                        onClick={() => void adicionarTora()}
                        disabled={!codigoPlaqueta.trim()}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Adicionar tora
                      </Button>
                      <Button
                        className="w-full"
                        type="button"
                        variant="outline"
                        onClick={abrirImportacao}
                      >
                        <Upload className="mr-1.5 h-4 w-4" />
                        Importar planilha
                      </Button>
                    </div>
                  </div>
                </div>
                {romaneio.toras.length ? (
                  <div className="grid w-full min-w-0 grid-cols-1 gap-3">
                    {romaneio.toras.map((tora, indice) => {
                      const volumePelasMedidas = calcularVolumeTora(
                        tora.diametro,
                        tora.comprimento
                      );
                      return (
                        <div
                          key={`${tora.plaquetaId || tora.codigo}-${indice}`}
                          className="w-full min-w-0 rounded-xl border p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words font-semibold">
                                {tora.codigo}{" "}
                                <span className="font-normal text-muted-foreground">
                                  · tora {indice + 1}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tora.semPlaqueta
                                  ? "Sem identificação física: informe as medidas conferidas para gerar um código interno e registrar o consumo."
                                  : "Ajuste as medidas se a serragem aproveitou menos madeira que a medida registrada no estoque."}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="shrink-0 text-rose-700 hover:text-rose-800"
                              onClick={() => removerTora(indice)}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Remover
                            </Button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Campo label="Essência *">
                              <Input
                                value={tora.madeiraNome}
                                onChange={e =>
                                  atualizarTora(
                                    indice,
                                    "madeiraNome",
                                    e.target.value
                                  )
                                }
                              />
                            </Campo>
                            <Campo label="Diâmetro (cm)">
                              <Input
                                inputMode="decimal"
                                value={tora.diametro}
                                onChange={e =>
                                  atualizarTora(
                                    indice,
                                    "diametro",
                                    e.target.value
                                  )
                                }
                              />
                            </Campo>
                            <Campo label="Comprimento (m)">
                              <Input
                                inputMode="decimal"
                                value={tora.comprimento}
                                onChange={e =>
                                  atualizarTora(
                                    indice,
                                    "comprimento",
                                    e.target.value
                                  )
                                }
                              />
                            </Campo>
                            <Campo label="Volume efetivo (m³) *">
                              <Input
                                inputMode="decimal"
                                value={tora.volume}
                                onChange={e =>
                                  atualizarTora(
                                    indice,
                                    "volume",
                                    e.target.value
                                  )
                                }
                              />
                            </Campo>
                          </div>
                          {volumePelasMedidas > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                Volume cilíndrico pelas medidas:{" "}
                                <strong className="text-foreground">
                                  {formatarNumero(volumePelasMedidas)} m³
                                </strong>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => usarVolumeCalculado(indice)}
                              >
                                Usar cálculo
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Vazio
                    icone={<TreePine />}
                    texto="Digite ou importe ao menos uma plaqueta disponível do estoque para iniciar o romaneio do dia."
                  />
                )}
                {romaneio.toras.length > 0 && (
                  <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Resultado das toras serradas
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                        <strong className="text-xl text-emerald-950">
                          {formatarNumero(totalToras)} m³
                        </strong>
                        {resumoEssencias.map(([essencia, volume]) => (
                          <span
                            key={essencia}
                            className="text-sm text-emerald-900"
                          >
                            {formatarNumero(volume)} m³ de {essencia}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={prepararEtapaPecas}
                        disabled={romaneio.toras.some(
                          tora =>
                            !tora.madeiraNome.trim() || num(tora.volume) <= 0
                        )}
                      >
                        Continuar para peças
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">Romaneio de madeira serrada</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Defina a essência e a medida uma vez; abaixo, preencha todos
                    os comprimentos e as quantidades produzidas no mesmo
                    romaneio.
                  </p>
                </div>
                <section className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4">
                  <div className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">Medida e comprimentos</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A medida permanece preenchida após adicionar a grade
                        para agilizar o próximo lançamento.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {romaneio.itens.length} comprimento(s)
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={abrirImportacaoPecas}
                      >
                        <Upload className="mr-1.5 h-4 w-4" />
                        Importar planilha
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo label="Essência *">
                      <Input
                        aria-label="Essência da medida"
                        value={grupoPecas.madeiraNome}
                        onChange={e =>
                          setGrupoPecas({
                            ...grupoPecas,
                            madeiraNome: e.target.value,
                          })
                        }
                      />
                    </Campo>
                    <Campo label="Espessura (cm) *">
                      <Input
                        aria-label="Espessura da medida"
                        inputMode="decimal"
                        value={grupoPecas.espessura}
                        onChange={e =>
                          setGrupoPecas({
                            ...grupoPecas,
                            espessura: e.target.value,
                          })
                        }
                      />
                    </Campo>
                    <Campo label="Largura (cm) *">
                      <Input
                        aria-label="Largura da medida"
                        inputMode="decimal"
                        value={grupoPecas.largura}
                        onChange={e =>
                          setGrupoPecas({
                            ...grupoPecas,
                            largura: e.target.value,
                          })
                        }
                      />
                    </Campo>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-lg border bg-background">
                    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">
                          Comprimentos do romaneio
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Preencha cada comprimento e a quantidade de peças
                          correspondente.
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        m / peças
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] table-fixed text-sm">
                        <thead className="bg-muted/20 text-xs text-muted-foreground">
                          <tr>
                            <th className="w-[42%] px-3 py-2 text-left font-medium">
                              Comprimento (m)
                            </th>
                            <th className="w-[42%] px-3 py-2 text-left font-medium">
                              Quantidade
                            </th>
                            <th className="w-[16%] px-2 py-2 text-right font-medium">
                              Ação
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasComprimento.map((linha, indice) => (
                            <tr
                              key={linha.id}
                              className="border-t border-border/50"
                            >
                              <td className="p-2">
                                <Input
                                  aria-label={`Comprimento da linha ${indice + 1}`}
                                  value={linha.comprimento}
                                  onChange={e =>
                                    atualizarLinhaComprimento(
                                      linha.id,
                                      "comprimento",
                                      e.target.value
                                    )
                                  }
                                  inputMode="decimal"
                                  placeholder="Ex.: 3,00"
                                  className="h-9"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  aria-label={`Quantidade da linha ${indice + 1}`}
                                  value={linha.quantidade}
                                  onChange={e =>
                                    atualizarLinhaComprimento(
                                      linha.id,
                                      "quantidade",
                                      e.target.value
                                    )
                                  }
                                  inputMode="numeric"
                                  placeholder="Ex.: 20"
                                  className="h-9"
                                  onKeyDown={evento => {
                                    if (evento.key === "Enter") {
                                      evento.preventDefault();
                                      adicionarGrupoPecas();
                                    }
                                  }}
                                />
                              </td>
                              <td className="p-2 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remover comprimento ${indice + 1}`}
                                  disabled={linhasComprimento.length === 1}
                                  onClick={() =>
                                    removerLinhaComprimento(linha.id)
                                  }
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t bg-muted/10 px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={adicionarLinhaComprimento}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Adicionar comprimento
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Prévia da grade:{" "}
                      <strong className="text-foreground">
                        {formatarNumero(
                          linhasComprimento.reduce(
                            (total, linha) =>
                              total +
                              calcularVolumePecas(
                                grupoPecas.espessura,
                                grupoPecas.largura,
                                num(linha.comprimento) * num(linha.quantidade)
                              ),
                            0
                          )
                        )}{" "}
                        m³
                      </strong>
                    </p>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={adicionarGrupoPecas}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Adicionar comprimentos ao romaneio
                    </Button>
                  </div>
                </section>
                {romaneio.itens.length ? (
                  <section className="min-w-0 space-y-2">
                    <p className="text-sm font-medium">
                      Comprimentos adicionados
                    </p>
                    {romaneio.itens.map((item, indice) => {
                      const calculo = calcularItem(item);
                      return (
                        <div
                          key={`${item.madeiraNome}-${indice}`}
                          className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="break-words font-medium">
                              {item.madeiraNome || "Sem essência"} ·{" "}
                              {item.espessura || "—"} × {item.largura || "—"} cm
                              · {item.comprimento || "—"} m
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatarNumero(calculo.quantidade)} peças ·{" "}
                              {formatarNumero(calculo.volume)} m³ ·{" "}
                              {formatarNumero(calculo.metrosLineares)} m
                              lineares
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => editarBitola(indice)}
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-rose-700 hover:text-rose-800"
                              onClick={() => removerBitola(indice)}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ) : (
                  <Vazio
                    icone={<Layers3 />}
                    texto="Nenhum comprimento adicionado. Preencha a grade acima, importe uma planilha ou use Adicionar comprimentos ao romaneio."
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Indicador
                    texto="Toras serradas"
                    valor={`${formatarNumero(totalToras)} m³`}
                    destaque="primary"
                  />
                  <Indicador
                    texto="Peças"
                    valor={totaisPecas.pecas}
                    detalhe={<ResumoPecasPorBitola itens={pecasPorBitola} />}
                  />
                  <Indicador
                    texto="M. lineares"
                    valor={`${formatarNumero(totaisPecas.metrosLineares)} m`}
                  />
                  <Indicador
                    texto="Madeira serrada"
                    valor={`${formatarNumero(totaisPecas.volume)} m³`}
                  />
                  <Indicador
                    texto="Aproveitamento"
                    valor={`${formatarNumero(aproveitamento, 2)}%`}
                    destaque={aproveitamento > 100 ? "destructive" : "primary"}
                  />
                </div>
                <Campo label="Observações">
                  <Textarea
                    value={romaneio.observacoes}
                    onChange={e =>
                      setRomaneio({ ...romaneio, observacoes: e.target.value })
                    }
                  />
                </Campo>
                <div className="flex flex-col justify-between gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setEtapa("toras")}>
                    <ChevronLeft className="mr-1.5 h-4 w-4" />
                    Voltar
                  </Button>
                  <Acoes
                    cancelar={() => setDialogRomaneio(false)}
                    confirmar={salvarRomaneio}
                    carregando={confirmarRomaneio.isPending}
                    texto="Confirmar romaneio"
                  />
                </div>
              </div>
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
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Importar plaquetas para produção</DialogTitle>
            <DialogDescription>
              Carregue um CSV, revise as medidas e confirme o romaneio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950">
              <p className="font-medium">
                Use plaquetas do Estoque ou dê entrada imediata
              </p>
              <p className="mt-1 text-xs">
                A coluna <strong>plaqueta</strong> é obrigatória. Para uma
                plaqueta existente, os campos vazios são preenchidos pelo
                Estoque. Para um código novo, informe pelo menos{" "}
                <strong>essência</strong> e <strong>volume</strong>: a entrada e
                o consumo serão registrados ao confirmar o romaneio.
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
            <Campo label="Planilha CSV *">
              <Input
                aria-label="Planilha CSV de produção"
                type="file"
                accept=".csv,text/csv"
                onChange={evento => {
                  setArquivoImportacao(evento.target.files?.[0] ?? null);
                  setErrosImportacao([]);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Máximo de 200 plaquetas e 1 MB por importação.
              </p>
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
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setDialogImportacao(false)}
                disabled={importarTorasCsv.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={importarArquivo}
                disabled={importarTorasCsv.isPending}
              >
                {importarTorasCsv.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Importar plaquetas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialogImportacaoPecas}
        onOpenChange={aberto => {
          setDialogImportacaoPecas(aberto);
          if (!aberto) {
            setArquivoImportacaoPecas(null);
            setErrosImportacaoPecas([]);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Importar peças serradas</DialogTitle>
            <DialogDescription>
              Carregue as bitolas produzidas para adicioná-las ao romaneio
              atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-5 text-sky-950">
              <p className="font-medium">
                Importe as bitolas e quantidades produzidas
              </p>
              <p className="mt-1 text-xs">
                Use as colunas{" "}
                <strong>
                  essência, espessura_cm, largura_cm, comprimento_m e quantidade
                </strong>
                . Todas as medidas devem ser positivas e a quantidade deve ser
                inteira.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={baixarModeloPecas}>
              <Download className="mr-2 h-4 w-4" />
              Baixar modelo CSV
            </Button>
            <Campo label="Planilha CSV de peças *">
              <Input
                aria-label="Planilha CSV de peças"
                type="file"
                accept=".csv,text/csv"
                onChange={evento => {
                  setArquivoImportacaoPecas(evento.target.files?.[0] ?? null);
                  setErrosImportacaoPecas([]);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Máximo de 1.000 peças e 1 MB por importação.
              </p>
            </Campo>
            {arquivoImportacaoPecas && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="min-w-0 truncate">
                  {arquivoImportacaoPecas.name}
                </span>
              </div>
            )}
            {errosImportacaoPecas.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">
                  Corrija a planilha antes de importar
                </p>
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs leading-5 text-destructive">
                  {errosImportacaoPecas.map((erro, indice) => (
                    <li key={`${erro}-${indice}`}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setDialogImportacaoPecas(false)}
                disabled={importarPecasCsv.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={importarArquivoPecas}
                disabled={importarPecasCsv.isPending}
              >
                {importarPecasCsv.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Importar peças
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  const campoTarifaSerragem = label === "Valor do serviço (R$) *";
  const resumo = campoTarifaSerragem ? resumoTarifaSerragem : null;
  const nomeCampo = campoTarifaSerragem ? "Tarifa por m³ (R$/m³) *" : label;
  const controle = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        "aria-label": (children.props as any)["aria-label"] ?? nomeCampo,
      })
    : children;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="break-words">{nomeCampo}</Label>
      {controle}
      {resumo && (
        <p className="text-xs font-medium text-violet-700">
          {formatarMoeda(resumo.tarifaPorM3)} ×{" "}
          {formatarNumero(resumo.volumeToras)} m³ ={" "}
          <span className="font-semibold">
            {formatarMoeda(resumo.valorTotal)}
          </span>
        </p>
      )}
    </div>
  );
}
function Cabecalho({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h2 className="font-semibold">{titulo}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{texto}</p>
      </div>
      {acao}
    </div>
  );
}
function Resumo({
  icon,
  titulo,
  valor,
  detalhe,
  cor,
  acao,
}: {
  icon: ReactNode;
  titulo: string;
  valor: ReactNode;
  detalhe: string;
  cor: string;
  acao?: ReactNode;
}) {
  const cores: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <p className="mt-1 break-words text-xl font-bold">{valor}</p>
        </div>
        <div className={`shrink-0 rounded-lg p-2 ${cores[cor]}`}>{icon}</div>
      </div>
      <p className="mt-2 break-words text-xs text-muted-foreground">
        {detalhe}
      </p>
      {acao}
    </div>
  );
}
function ResumoAproveitamentoPorEssencia({
  resumos,
}: {
  resumos: VolumePorEssencia[];
}) {
  if (!resumos.length) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-primary/15 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Por essência
      </p>
      {resumos.map(resumo => (
        <div
          key={resumo.essencia}
          className="rounded-md border border-primary/10 bg-background/50 px-2.5 py-2 text-xs"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
            <span className="truncate font-medium" title={resumo.essencia}>
              {resumo.essencia}
            </span>
            <span className="font-semibold text-primary">
              {formatarNumero(resumo.aproveitamento, 2)}%
            </span>
            <span className="truncate text-muted-foreground">
              {formatarNumero(resumo.volumeProduzido)} de{" "}
              {formatarNumero(resumo.volumeToras)} m³
            </span>
            <span className="text-muted-foreground">produzido</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-amber-200/70 pt-1.5 text-amber-800">
            <span className="font-medium">Perda estimada</span>
            <span className="font-semibold">
              {formatarNumero(resumo.perdaVolume)} m³ ·{" "}
              {formatarNumero(resumo.perdaPercentual, 2)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
function Indicador({
  texto,
  valor,
  destaque,
  detalhe,
}: {
  texto: string;
  valor: ReactNode;
  destaque?: string;
  detalhe?: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border p-3 ${destaque === "destructive" ? "border-rose-200 bg-rose-50" : destaque ? "border-primary/20 bg-primary/5" : "bg-muted/20"}`}
    >
      <p className="text-xs text-muted-foreground">{texto}</p>
      <p className="mt-1 break-words font-semibold">{valor}</p>
      {detalhe}
      {texto === "Aproveitamento" && (
        <ResumoAproveitamentoPorEssencia
          resumos={resumoAproveitamentoEmExibicao}
        />
      )}
    </div>
  );
}
function ResumoPecasPorBitola({
  itens,
}: {
  itens: Array<{ medida: string; quantidade: number }>;
}) {
  if (!itens.length) {
    return <p className="mt-2 text-xs text-muted-foreground">Nenhuma peça informada</p>;
  }
  return (
    <div
      className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground"
      data-testid="pecas-por-bitola"
      aria-label="Total de peças por bitola"
    >
      {itens.map(item => (
        <p key={item.medida} className="flex items-center justify-between gap-2 whitespace-nowrap">
          <span className="truncate">{item.medida}</span>
          <span className="font-medium tabular-nums text-foreground">{formatarNumero(item.quantidade)} peças</span>
        </p>
      ))}
    </div>
  );
}
function Acoes({
  cancelar,
  confirmar,
  carregando,
  texto,
}: {
  cancelar: () => void;
  confirmar: () => void;
  carregando: boolean;
  texto: string;
}) {
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
      <Button
        className="w-full sm:w-auto"
        variant="outline"
        onClick={cancelar}
        disabled={carregando}
      >
        Cancelar
      </Button>
      <Button
        className="w-full sm:w-auto"
        onClick={confirmar}
        disabled={carregando}
      >
        {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {texto}
      </Button>
    </div>
  );
}
function Carregando() {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
      Carregando...
    </div>
  );
}
function Vazio({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground">
      <div className="shrink-0 rounded-full bg-muted p-3">{icone}</div>
      <p className="max-w-sm break-words text-sm">{texto}</p>
    </div>
  );
}
function CampoLote({
  marcado,
  aoAlternar,
  rotulo,
  children,
}: {
  marcado: boolean;
  aoAlternar: (marcado: boolean) => void;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-center">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={marcado}
          onChange={e => aoAlternar(e.target.checked)}
        />
        {rotulo}
      </label>
      <div className={!marcado ? "opacity-55" : ""}>{children}</div>
    </div>
  );
}
function TabelaRomaneios({
  romaneios,
  selecionados,
  onAlternarSelecao,
  onSelecionarTodos,
  onEditar,
  onVisualizarPdf,
  onExcluir,
}: {
  romaneios: any[];
  selecionados: number[];
  onAlternarSelecao: (id: number) => void;
  onSelecionarTodos: (marcado: boolean) => void;
  onEditar: (id: number) => void;
  onVisualizarPdf: (item: any) => void;
  onExcluir: (item: any) => void;
}) {
  return (
    <>
      <div className="space-y-3 p-3 sm:hidden">
        {romaneios.map(item => (
          <article key={item.id} className="rounded-lg border bg-card p-3">
            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><input aria-label={`Selecionar romaneio ${item.numero}`} type="checkbox" checked={selecionados.includes(item.id)} onChange={() => onAlternarSelecao(item.id)} />Selecionar para alteração em lote</label>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.numero}</p>
                <p className="text-xs text-muted-foreground">
                  {formatarData(item.dataProducao)} · {item.totalToras ?? 1}{" "}
                  tora(s)
                </p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                {formatarNumero(item.aproveitamento ?? 0, 2)}%
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Toras</p>
                <p className="font-medium">
                  {formatarNumero(item.volumeTora ?? item.volumePlaqueta)} m³
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Produção</p>
                <p className="font-medium">
                  {item.totalPecas} peças ·{" "}
                  {formatarNumero(item.volumeProduzido)} m³
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditar(item.id)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onVisualizarPdf(item)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 hover:text-rose-800"
                onClick={() => onExcluir(item)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden w-full max-w-full overflow-x-auto sm:block">
        <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><input aria-label="Selecionar todos os romaneios de produção" type="checkbox" checked={romaneios.length > 0 && selecionados.length === romaneios.length} onChange={e => onSelecionarTodos(e.target.checked)} /></TableHead>
              <TableHead>Romaneio</TableHead>
              <TableHead>Data / toras</TableHead>
              <TableHead>Produção</TableHead>
              <TableHead>Aproveitamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {romaneios.map(item => (
              <TableRow key={item.id}>
                <TableCell><input aria-label={`Selecionar romaneio ${item.numero}`} type="checkbox" checked={selecionados.includes(item.id)} onChange={() => onAlternarSelecao(item.id)} /></TableCell>
                <TableCell>
                  <p className="font-medium">{item.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.fita ?? "Sem fita"}
                  </p>
                </TableCell>
                <TableCell>
                  <p>
                    {formatarData(item.dataProducao)} · {item.totalToras ?? 1}{" "}
                    tora(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatarNumero(item.volumeTora ?? item.volumePlaqueta)} m³
                    de toras
                  </p>
                </TableCell>
                <TableCell>
                  <p>{item.totalPecas} peças</p>
                  <p className="text-xs text-muted-foreground">
                    {formatarNumero(item.volumeProduzido)} m³
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {formatarNumero(item.aproveitamento ?? 0, 2)}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditar(item.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onVisualizarPdf(item)}
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-700 hover:text-rose-800"
                      onClick={() => onExcluir(item)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function SerragemTerceirosUnificadaDialog({
  valor,
  atualizarValor,
  clientes,
  aberto,
  modoEdicao,
  aoFechar,
  aoCriarCliente,
  aoSalvar,
  salvando,
}: {
  valor: SerragemTerceirosForm;
  atualizarValor: (atualizacao: SetStateAction<SerragemTerceirosForm>) => void;
  clientes: any[];
  aberto: boolean;
  modoEdicao: boolean;
  aoFechar: () => void;
  aoCriarCliente: () => void;
  aoSalvar: () => void;
  salvando: boolean;
}) {
  const [etapa, setEtapa] = useState<"toras" | "pecas">("toras");
  const [grupoPecas, setGrupoPecas] = useState<GrupoPecasForm>(() =>
    novoGrupoPecas(valor.toras[0]?.madeiraNome ?? "")
  );
  const [linhasComprimento, setLinhasComprimento] = useState<
    LinhaComprimento[]
  >(() => criarLinhasComprimentoVazias());
  const [errosImportacaoToras, setErrosImportacaoToras] = useState<string[]>(
    []
  );
  const [errosImportacaoPecas, setErrosImportacaoPecas] = useState<string[]>(
    []
  );
  const modeloTorasCsv =
    trpc.producao.serragemTerceiros.modeloTorasCsv.useQuery(undefined, {
      enabled: false,
    });
  const modeloPecasCsv =
    trpc.producao.serragemTerceiros.modeloPecasCsv.useQuery(undefined, {
      enabled: false,
    });
  const importarTorasCsv =
    trpc.producao.serragemTerceiros.importarTorasCsv.useMutation();
  const importarPecasCsv =
    trpc.producao.serragemTerceiros.importarPecasCsv.useMutation();
  const totalToras = valor.toras.reduce(
    (total, tora) => total + num(tora.volume),
    0
  );
  const totaisPecas = valor.itens.reduce(
    (total, item) => {
      const calculo = calcularItem(item);
      return {
        pecas: total.pecas + calculo.quantidade,
        metrosLineares: total.metrosLineares + calculo.metrosLineares,
        volume: total.volume + calculo.volume,
      };
    },
    { pecas: 0, metrosLineares: 0, volume: 0 }
  );
  const pecasPorBitola = (() => {
    const agrupadas = new Map<string, { medida: string; quantidade: number }>();
    valor.itens.forEach(item => {
      const quantidade = calcularItem(item).quantidade;
      if (quantidade <= 0) return;
      const medida = `${formatarNumero(item.espessura, 2)} × ${formatarNumero(item.largura, 2)} cm`;
      const atual = agrupadas.get(medida) ?? { medida, quantidade: 0 };
      atual.quantidade += quantidade;
      agrupadas.set(medida, atual);
    });
    return Array.from(agrupadas.values()).sort(
      (a, b) => b.quantidade - a.quantidade || a.medida.localeCompare(b.medida, "pt-BR")
    );
  })();
  const aproveitamento =
    totalToras > 0 ? (totaisPecas.volume / totalToras) * 100 : 0;
  const aproveitamentoPorEssencia = calcularAproveitamentoPorEssencia(
    valor.toras,
    valor.itens.map(item => ({
      madeiraNome: item.madeiraNome,
      volume: calcularItem(item).volume,
    }))
  );
  resumoAproveitamentoEmExibicao = aproveitamentoPorEssencia;
  const tarifa = num(valor.valorServico);
  const valorTotal = totalToras * tarifa;
  const baixarModeloToras = async () => {
    const resposta = await modeloTorasCsv.refetch();
    if (!resposta.data) {
      toast.error("Não foi possível gerar o modelo de toras");
      return;
    }
    baixarCsv(resposta.data, "modelo-toras-serragem-terceiros-fk-madeiras.csv");
  };
  const baixarModeloPecas = async () => {
    const resposta = await modeloPecasCsv.refetch();
    if (!resposta.data) {
      toast.error("Não foi possível gerar o modelo de peças");
      return;
    }
    baixarCsv(resposta.data, "modelo-pecas-serragem-terceiros-fk-madeiras.csv");
  };
  const importarArquivoToras = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const conteudo = await arquivo.text();
      importarTorasCsv.mutate(
        { conteudo },
        {
          onSuccess: resultado => {
            if (resultado.erros.length) {
              setErrosImportacaoToras(resultado.erros);
              toast.error(
                "A planilha de toras possui pendências. Revise as linhas indicadas."
              );
              return;
            }
            const toras = resultado.toras.map((tora: any) => ({
              ...tora,
              volume: calcularVolumeTora(
                tora.diametro,
                tora.comprimento
              ).toFixed(6),
            }));
            atualizarValor(atual => ({
              ...atual,
              toras: [
                ...toras,
                ...atual.toras.filter(
                  tora =>
                    tora.referencia.trim() ||
                    tora.madeiraNome.trim() ||
                    tora.diametro ||
                    tora.comprimento
                ),
              ],
            }));
            setErrosImportacaoToras([]);
            toast.success(
              `${toras.length} tora(s) incluída(s) na prévia do romaneio.`
            );
          },
          onError: erro => toast.error(erro.message),
        }
      );
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };
  const importarArquivoPecas = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const conteudo = await arquivo.text();
      importarPecasCsv.mutate(
        { conteudo },
        {
          onSuccess: resultado => {
            if (resultado.erros.length) {
              setErrosImportacaoPecas(resultado.erros);
              toast.error(
                "A planilha de peças possui pendências. Revise as linhas indicadas."
              );
              return;
            }
            const itens = resultado.itens.map((item: any) => ({
              ...item,
              quantidade: String(item.quantidade),
            }));
            atualizarValor(atual => ({
              ...atual,
              itens: [
                ...atual.itens.filter(
                  item =>
                    item.madeiraNome.trim() ||
                    item.espessura ||
                    item.largura ||
                    item.comprimento ||
                    item.quantidade
                ),
                ...itens,
              ],
            }));
            const ultimo = itens.at(-1);
            if (ultimo)
              setGrupoPecas({
                madeiraNome: ultimo.madeiraNome,
                espessura: ultimo.espessura,
                largura: ultimo.largura,
              });
            setErrosImportacaoPecas([]);
            toast.success(
              `${itens.length} item(ns) de peça incluído(s) na prévia do romaneio.`
            );
          },
          onError: erro => toast.error(erro.message),
        }
      );
    } catch {
      toast.error("Não foi possível ler o arquivo selecionado");
    }
  };
  const atualizarTora = (
    indice: number,
    campo: keyof ToraTerceiroForm,
    novoValor: string
  ) =>
    atualizarValor(atual => ({
      ...atual,
      toras: atual.toras.map((tora, posicao) =>
        posicao === indice ? { ...tora, [campo]: novoValor } : tora
      ),
    }));
  const removerTora = (indice: number) =>
    atualizarValor(atual => ({
      ...atual,
      toras:
        atual.toras.length === 1
          ? atual.toras
          : atual.toras.filter((_, posicao) => posicao !== indice),
    }));
  const adicionarTora = () =>
    atualizarValor(atual => ({
      ...atual,
      toras: [
        {
          referencia: "",
          madeiraNome: "",
          diametro: "",
          comprimento: "",
          volume: "",
        },
        ...atual.toras,
      ],
    }));
  const atualizarLinha = (
    id: number,
    campo: "comprimento" | "quantidade",
    novoValor: string
  ) =>
    setLinhasComprimento(linhas =>
      linhas.map(linha =>
        linha.id === id ? { ...linha, [campo]: novoValor } : linha
      )
    );
  const adicionarLinha = () =>
    setLinhasComprimento(linhas => [
      ...linhas,
      {
        id: Math.max(0, ...linhas.map(linha => linha.id)) + 1,
        comprimento: "",
        quantidade: "",
      },
    ]);
  const removerLinha = (id: number) =>
    setLinhasComprimento(linhas =>
      linhas.length === 1 ? linhas : linhas.filter(linha => linha.id !== id)
    );
  const adicionarGrupo = () => {
    if (
      !grupoPecas.madeiraNome.trim() ||
      num(grupoPecas.espessura) <= 0 ||
      num(grupoPecas.largura) <= 0
    ) {
      toast.error(
        "Informe essência, espessura e largura para a medida produzida"
      );
      return;
    }
    const preenchidas = linhasComprimento.filter(linha =>
      linha.quantidade.trim()
    );
    if (
      !preenchidas.length ||
      preenchidas.some(
        linha =>
          num(linha.comprimento) <= 0 ||
          !Number.isInteger(num(linha.quantidade)) ||
          num(linha.quantidade) <= 0
      )
    ) {
      toast.error("Revise os comprimentos e as quantidades preenchidas");
      return;
    }
    const itens = preenchidas.map(linha => ({
      madeiraNome: grupoPecas.madeiraNome.trim(),
      espessura: grupoPecas.espessura,
      largura: grupoPecas.largura,
      comprimento: linha.comprimento,
      quantidade: linha.quantidade,
    }));
    atualizarValor(atual => ({
      ...atual,
      itens: [
        ...atual.itens.filter(
          item =>
            item.madeiraNome.trim() ||
            item.espessura ||
            item.largura ||
            item.comprimento ||
            item.quantidade
        ),
        ...itens,
      ],
    }));
    setLinhasComprimento(criarLinhasComprimentoPadrao());
    toast.success(
      `${itens.length} comprimento(s) adicionado(s). A medida foi mantida para o próximo lançamento.`
    );
  };
  const editarItem = (indice: number) => {
    const item = valor.itens[indice];
    if (!item) return;
    setGrupoPecas({
      madeiraNome: item.madeiraNome,
      espessura: item.espessura,
      largura: item.largura,
    });
    setLinhasComprimento([
      {
        id: Date.now(),
        comprimento: item.comprimento,
        quantidade: item.quantidade,
      },
    ]);
    atualizarValor(atual => ({
      ...atual,
      itens: atual.itens.filter((_, posicao) => posicao !== indice),
    }));
  };
  const removerItem = (indice: number) =>
    atualizarValor(atual => ({
      ...atual,
      itens: atual.itens.filter((_, posicao) => posicao !== indice),
    }));
  const torasValidas =
    valor.toras.length > 0 &&
    valor.toras.every(
      tora =>
        tora.madeiraNome.trim().length >= 2 &&
        num(tora.diametro) > 0 &&
        num(tora.comprimento) > 0 &&
        num(tora.volume) > 0
    );
  const avancar = () => {
    if (!valor.clienteId) {
      toast.error("Selecione o cliente proprietário das toras");
      return;
    }
    if (tarifa <= 0) {
      toast.error("Informe a tarifa por m³ do serviço");
      return;
    }
    if (!torasValidas) {
      toast.error(
        "Preencha a essência e as medidas de todas as toras"
      );
      return;
    }
    setGrupoPecas(atual =>
      atual.madeiraNome.trim()
        ? atual
        : novoGrupoPecas(valor.toras[0]?.madeiraNome ?? "")
    );
    setEtapa("pecas");
  };
  return (
    <Dialog
      open={aberto}
      onOpenChange={novoAberto => {
        if (!novoAberto) aoFechar();
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] min-w-0 max-w-6xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words">
            {modoEdicao
              ? "Editar serragem de terceiros"
              : "Serragem de terceiros"}
          </DialogTitle>
          <DialogDescription>
            O mesmo processo da produção diária: importe toras e peças por
            planilha ou informe manualmente. A planilha apenas preenche a
            prévia; o serviço só é gravado ao confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-5">
          <Tabs
            value={etapa}
            onValueChange={novaEtapa => setEtapa(novaEtapa as typeof etapa)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="toras">1. Toras serradas</TabsTrigger>
              <TabsTrigger value="pecas" disabled={!torasValidas}>
                2. Peças produzidas
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {etapa === "toras" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Campo label="Cliente proprietário *">
                  <SearchableEntitySelect
                    value={valor.clienteId}
                    onValueChange={clienteId =>
                      atualizarValor(atual => ({ ...atual, clienteId }))
                    }
                    options={clientes.map((cliente: any) => ({
                      value: String(cliente.id),
                      label: cliente.nome,
                      details:
                        cliente.telefone ??
                        cliente.contacto ??
                        cliente.documento ??
                        "",
                    }))}
                    placeholder="Selecionar cliente"
                    searchPlaceholder="Buscar por nome ou telefone"
                    createLabel="Criar novo cliente"
                    onCreate={aoCriarCliente}
                    ariaLabel="Cliente proprietário"
                  />
                </Campo>
                <Campo label="Data do serviço *">
                  <Input
                    type="date"
                    value={valor.dataProducao}
                    onChange={e =>
                      atualizarValor(atual => ({
                        ...atual,
                        dataProducao: e.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo label="Vencimento da cobrança *">
                  <Input
                    type="date"
                    value={valor.dataVencimento}
                    onChange={e =>
                      atualizarValor(atual => ({
                        ...atual,
                        dataVencimento: e.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo label="Tarifa por m³ (R$) *">
                  <Input
                    inputMode="decimal"
                    value={valor.valorServico}
                    onChange={e =>
                      atualizarValor(atual => ({
                        ...atual,
                        valorServico: e.target.value,
                      }))
                    }
                    placeholder="Ex.: 50,00"
                  />
                </Campo>
              </div>
              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Importar toras por planilha</p>
                    <p className="text-xs text-muted-foreground">
                      CSV com referência, essência, diâmetro em cm e comprimento
                      em m. A referência “-” pode repetir.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={baixarModeloToras}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Baixar modelo
                    </Button>
                    <Label className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm hover:bg-muted">
                      <Upload className="mr-1.5 h-4 w-4" />
                      Importar CSV
                      <Input
                        className="sr-only"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={evento => {
                          void importarArquivoToras(evento.target.files?.[0]);
                          evento.currentTarget.value = "";
                        }}
                      />
                    </Label>
                  </div>
                </div>
                {errosImportacaoToras.length > 0 && (
                  <ul className="mt-3 list-disc rounded-lg border border-rose-200 bg-rose-50 px-7 py-3 text-sm text-rose-800">
                    {errosImportacaoToras.map((erro, indice) => (
                      <li key={`${erro}-${indice}`}>{erro}</li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4">
                <div className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">Toras do cliente</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revise a prévia antes de avançar. O volume é calculado
                      automaticamente.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={adicionarTora}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Adicionar tora
                  </Button>
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-3">
                  {valor.toras.map((tora, indice) => (
                    <div
                      key={indice}
                      className="w-full min-w-0 rounded-xl border bg-background p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <p className="break-words font-semibold">
                          Tora {indice + 1}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-rose-700 hover:text-rose-800"
                          onClick={() => removerTora(indice)}
                          disabled={valor.toras.length === 1}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <Campo label="Referência *">
                          <Input
                            aria-label={`Referência da tora ${indice + 1}`}
                            value={tora.referencia}
                            onChange={e =>
                              atualizarTora(
                                indice,
                                "referencia",
                                e.target.value
                              )
                            }
                          />
                        </Campo>
                        <Campo label="Essência *">
                          <Input
                            aria-label={`Essência da tora ${indice + 1}`}
                            value={tora.madeiraNome}
                            onChange={e =>
                              atualizarTora(
                                indice,
                                "madeiraNome",
                                e.target.value
                              )
                            }
                          />
                        </Campo>
                        <Campo label="Diâmetro (cm) *">
                          <Input
                            aria-label={`Diâmetro da tora ${indice + 1}`}
                            inputMode="decimal"
                            value={tora.diametro}
                            onChange={e =>
                              atualizarTora(indice, "diametro", e.target.value)
                            }
                          />
                        </Campo>
                        <Campo label="Comprimento (m) *">
                          <Input
                            aria-label={`Comprimento da tora ${indice + 1}`}
                            inputMode="decimal"
                            value={tora.comprimento}
                            onChange={e =>
                              atualizarTora(
                                indice,
                                "comprimento",
                                e.target.value
                              )
                            }
                          />
                        </Campo>
                        <Campo label="Volume calculado (m³)">
                          <Input
                            aria-label={`Volume da tora ${indice + 1}`}
                            value={
                              tora.volume ? formatarNumero(tora.volume, 3) : ""
                            }
                            readOnly
                            className="bg-muted/40 font-medium"
                          />
                        </Campo>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <strong className="text-xl text-emerald-950">
                  {formatarNumero(totalToras)} m³
                </strong>
                <span className="ml-4 text-sm text-emerald-900">
                  Cobrança calculada:{" "}
                  <strong>{formatarMoeda(valorTotal)}</strong>
                </span>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={avancar}
                  disabled={!valor.clienteId || tarifa <= 0 || !torasValidas}
                >
                  Continuar para peças
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Importar peças por planilha</p>
                    <p className="text-xs text-muted-foreground">
                      Aceita o modelo em matriz de bitolas ou o formato por
                      linha da Produção Diária.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={baixarModeloPecas}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Baixar modelo
                    </Button>
                    <Label className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm hover:bg-muted">
                      <Upload className="mr-1.5 h-4 w-4" />
                      Importar CSV
                      <Input
                        className="sr-only"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={evento => {
                          void importarArquivoPecas(evento.target.files?.[0]);
                          evento.currentTarget.value = "";
                        }}
                      />
                    </Label>
                  </div>
                </div>
                {errosImportacaoPecas.length > 0 && (
                  <ul className="mt-3 list-disc rounded-lg border border-rose-200 bg-rose-50 px-7 py-3 text-sm text-rose-800">
                    {errosImportacaoPecas.map((erro, indice) => (
                      <li key={`${erro}-${indice}`}>{erro}</li>
                    ))}
                  </ul>
                )}
              </section>
              <div>
                <p className="font-semibold">Romaneio de madeira serrada</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Também é possível complementar ou corrigir a importação pela
                  grade abaixo.
                </p>
              </div>
              <section className="min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="Essência *">
                    <Input
                      aria-label="Essência da medida de terceiros"
                      value={grupoPecas.madeiraNome}
                      onChange={e =>
                        setGrupoPecas({
                          ...grupoPecas,
                          madeiraNome: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo label="Espessura (cm) *">
                    <Input
                      aria-label="Espessura da medida de terceiros"
                      inputMode="decimal"
                      value={grupoPecas.espessura}
                      onChange={e =>
                        setGrupoPecas({
                          ...grupoPecas,
                          espessura: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo label="Largura (cm) *">
                    <Input
                      aria-label="Largura da medida de terceiros"
                      inputMode="decimal"
                      value={grupoPecas.largura}
                      onChange={e =>
                        setGrupoPecas({
                          ...grupoPecas,
                          largura: e.target.value,
                        })
                      }
                    />
                  </Campo>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] table-fixed text-sm">
                    <tbody>
                      {linhasComprimento.map((linha, indice) => (
                        <tr key={linha.id} className="border-t">
                          <td className="p-2">
                            <Input
                              aria-label={`Comprimento da peça de terceiros ${indice + 1}`}
                              value={linha.comprimento}
                              onChange={e =>
                                atualizarLinha(
                                  linha.id,
                                  "comprimento",
                                  e.target.value
                                )
                              }
                              inputMode="decimal"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              aria-label={`Quantidade da peça de terceiros ${indice + 1}`}
                              value={linha.quantidade}
                              onChange={e =>
                                atualizarLinha(
                                  linha.id,
                                  "quantidade",
                                  e.target.value
                                )
                              }
                              inputMode="numeric"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remover comprimento de terceiros ${indice + 1}`}
                              disabled={linhasComprimento.length === 1}
                              onClick={() => removerLinha(linha.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={adicionarLinha}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar comprimento
                  </Button>
                  <Button type="button" size="sm" onClick={adicionarGrupo}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar comprimentos ao romaneio
                  </Button>
                </div>
              </section>
              <section className="space-y-2">
                {valor.itens
                  .filter(item => item.madeiraNome.trim())
                  .map((item, indice) => {
                    const calculo = calcularItem(item);
                    return (
                      <div
                        key={`${item.madeiraNome}-${indice}`}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <p className="min-w-0 break-words text-sm font-medium">
                          {item.madeiraNome} · {item.espessura} × {item.largura}{" "}
                          cm · {item.comprimento} m · {item.quantidade} peças ·{" "}
                          {formatarNumero(calculo.volume)} m³
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removerItem(indice)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
              </section>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Indicador
                  texto="Toras serradas"
                  valor={`${formatarNumero(totalToras)} m³`}
                  destaque="primary"
                />
                <Indicador
                  texto="Peças"
                  valor={totaisPecas.pecas}
                  detalhe={<ResumoPecasPorBitola itens={pecasPorBitola} />}
                />
                <Indicador
                  texto="M. lineares"
                  valor={`${formatarNumero(totaisPecas.metrosLineares)} m`}
                />
                <Indicador
                  texto="Madeira serrada"
                  valor={`${formatarNumero(totaisPecas.volume)} m³`}
                />
                <Indicador
                  texto="Aproveitamento"
                  valor={`${formatarNumero(aproveitamento, 2)}%`}
                  destaque={aproveitamento > 100 ? "destructive" : "primary"}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Responsável">
                  <Input
                    value={valor.responsavel}
                    onChange={e =>
                      atualizarValor(atual => ({
                        ...atual,
                        responsavel: e.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo label="Observações">
                  <Textarea
                    value={valor.observacoes}
                    onChange={e =>
                      atualizarValor(atual => ({
                        ...atual,
                        observacoes: e.target.value,
                      }))
                    }
                  />
                </Campo>
              </div>
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setEtapa("toras")}>
                  <ChevronLeft className="mr-1.5 h-4 w-4" />
                  Voltar
                </Button>
                <Acoes
                  cancelar={aoFechar}
                  confirmar={aoSalvar}
                  carregando={salvando}
                  texto={modoEdicao ? "Salvar alterações" : "Registrar serviço"}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
