import { type KeyboardEvent, useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SearchableEntitySelect } from "@/components/SearchableEntitySelect";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, Calculator, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatCurrency, formatMeasurement, parseDecimalInput } from "@/lib/utils";
import { atualizarItemVenda, criarItemVendaComercial, criarItensVendaPorMedida, criarLinhasComprimentoPadraoVenda, obterIndiceTabPorColunaVenda, resumirItensVendaPorBitola, rotulosTipoComercializacaoVenda, type ComponentePacoteVenda, type ItemVendaCalculado, type LinhaComprimentoVenda, type TipoComercializacaoVenda } from "@/lib/vendaItemGroup";
import { disponibilidadeEstoqueVenda, prepararModeloMedida } from "@/lib/vendaMedidas";
import type { TaxaAdicionalComercial } from "@/lib/acertoComercial";
import { mapearOrcamentoParaDuplicacao } from "@/lib/orcamentoDuplicacao";
import { calcularPreviaComercial } from "@shared/comercial.preview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ItemOrcamento = ItemVendaCalculado;

interface AproveitamentoVenda {
  madeiraNome: string;
  volume: string;
  precoM3: string;
}

function dataLocalParaInput(data = new Date()) {
  const deslocamento = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 10);
}

export default function OrcamentoNovo() {
  const [, setLocation] = useLocation();
  const duplicarRaw = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("duplicar");
  const duplicarId = duplicarRaw && /^\d+$/.test(duplicarRaw) && Number(duplicarRaw) > 0 ? Number(duplicarRaw) : null;
  const duplicarInvalido = duplicarRaw !== null && duplicarId === null;
  const revisarRaw = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("revisarInterna");
  const revisarId = revisarRaw && /^\d+$/.test(revisarRaw) && Number(revisarRaw) > 0 ? Number(revisarRaw) : null;
  const revisarInvalido = revisarRaw !== null && revisarId === null;
  const origemId = duplicarId ?? revisarId;
  const clientes = trpc.cliente.list.useQuery();
  const origemDuplicacao = trpc.orcamento.get.useQuery({ id: origemId ?? 1 }, { enabled: origemId !== null });
  const [origemCarregada, setOrigemCarregada] = useState(false);
  const [motivoRevisao, setMotivoRevisao] = useState("");

  const [clienteId, setClienteId] = useState("");
  const [tipoVenda, setTipoVenda] = useState<"externa" | "interna">("externa");
  const [clienteSelectorOpen, setClienteSelectorOpen] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoClienteForm, setNovoClienteForm] = useState({ nome: "", contacto: "", email: "", morada: "", nif: "" });
  const createCliente = trpc.cliente.create.useMutation();
  const [desconto, setDesconto] = useState("0");
  const [frete, setFrete] = useState("0");
  const [pesoCargaToneladas, setPesoCargaToneladas] = useState("");
  const [comissaoTipo, setComissaoTipo] = useState<"percentual" | "fixo">("percentual");
  const [comissaoValor, setComissaoValor] = useState("0");
  const [taxasAdicionais, setTaxasAdicionais] = useState<TaxaAdicionalComercial[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [dataVencimento, setDataVencimento] = useState(() => dataLocalParaInput());
  const [competencia, setCompetencia] = useState(() => dataLocalParaInput());
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [aproveitamentosVenda, setAproveitamentosVenda] = useState<AproveitamentoVenda[]>([]);
  const [aproveitamentoForm, setAproveitamentoForm] = useState<AproveitamentoVenda>({ madeiraNome: "", volume: "", precoM3: "" });
  const [grupoItem, setGrupoItem] = useState({ madeiraId: null as number | null, madeiraNome: "", precoM3: "", espessuraCm: "", larguraCm: "" });
  const [linhasComprimento, setLinhasComprimento] = useState<LinhaComprimentoVenda[]>(criarLinhasComprimentoPadraoVenda);
  const [tipoComercializacao, setTipoComercializacao] = useState<TipoComercializacaoVenda>("metro_cubico");
  const [itemComercial, setItemComercial] = useState({ madeiraNome: "", quantidade: "", precoComercial: "" });
  const [produtoComercialId, setProdutoComercialId] = useState("");
  const [componentesPacote, setComponentesPacote] = useState<ComponentePacoteVenda[]>([]);
  const produtosComerciais = trpc.orcamento.produtosComerciais.list.useQuery();
  const criarProdutoComercial = trpc.orcamento.produtosComerciais.create.useMutation();
  const [produtoComercialOpen, setProdutoComercialOpen] = useState(false);
  const [produtoForm, setProdutoForm] = useState({ nome: "", tipoComercializacao: "unidade" as "unidade" | "pacote", precoPadrao: "", observacoes: "", componentes: [] as ComponentePacoteVenda[] });
  const madeiras = trpc.madeira.list.useQuery();
  const estoqueSerrado = trpc.producao.estoque.resumo.useQuery();
  const createMadeira = trpc.madeira.create.useMutation();
  const [novaMadeiraOpen, setNovaMadeiraOpen] = useState(false);
  const [novaMadeiraForm, setNovaMadeiraForm] = useState({ nome: "", precoM3: "", descricao: "" });
  const modelosMedida = trpc.orcamento.modelosMedida.list.useQuery();
  const criarModeloMedida = trpc.orcamento.modelosMedida.create.useMutation();
  const excluirModeloMedida = trpc.orcamento.modelosMedida.delete.useMutation();
  const [modeloOpen, setModeloOpen] = useState(false);
  const [nomeModelo, setNomeModelo] = useState("");

  useEffect(() => {
    const origem = origemDuplicacao.data;
    if (!origem || origemCarregada) return;
    if (revisarId !== null && (origem.orcamento.tipoVenda !== "interna" || origem.orcamento.estado !== "aprovado" || origem.orcamento.entregue)) return;
    const inicial = mapearOrcamentoParaDuplicacao(origem);
    setTipoVenda(inicial.tipoVenda);
    setClienteId(inicial.clienteId);
    setDesconto(inicial.desconto);
    setFrete(inicial.frete);
    setPesoCargaToneladas(inicial.pesoCargaToneladas);
    setComissaoTipo(inicial.comissaoTipo);
    setComissaoValor(inicial.comissaoValor);
    setObservacoes(inicial.observacoes);
    setVendedor(inicial.vendedor);
    setDataValidade(inicial.dataValidade);
    setDataVencimento(inicial.dataVencimento);
    setCompetencia(inicial.competencia);
    setItens(inicial.itens);
    setAproveitamentosVenda(inicial.aproveitamentos);
    setTaxasAdicionais(inicial.taxasAdicionais);
    setOrigemCarregada(true);
    toast.success(revisarId !== null ? "Venda carregada para revisão comercial." : "Dados comerciais carregados. Revise e salve como novo rascunho.");
  }, [origemDuplicacao.data, origemCarregada, revisarId]);

  const clienteSelecionado = clientes.data?.find((cliente) => cliente.id === Number(clienteId));
  const opcoesMadeira = useMemo(() => (madeiras.data ?? []).map((madeira) => ({
    value: String(madeira.id),
    label: madeira.nome,
    details: `Preço padrão: ${formatCurrency(madeira.precoM3)}/m³`,
  })), [madeiras.data]);
  const opcoesMadeiraItem = (item: ItemOrcamento) => item.madeiraId && !opcoesMadeira.some((opcao) => opcao.value === String(item.madeiraId))
    ? [...opcoesMadeira, { value: String(item.madeiraId), label: item.madeiraNome, details: "Referência atual (indisponível no catálogo ativo)" }]
    : opcoesMadeira;

  const previaCorrigida = useMemo(() => {
    if (itens.length === 0 && aproveitamentosVenda.length === 0) return { resultado: null, erro: null };
    try {
      return {
        resultado: calcularPreviaComercial({
          itens: itens.map((item) => ({
            madeiraNome: item.madeiraNome,
            espessura: item.espessura,
            largura: item.largura,
            comprimento: item.comprimento,
            quantidade: item.quantidade,
            tipoComercializacao: item.tipoComercializacao,
            precoM3: item.precoM3,
            componentesPacote: item.componentesPacote,
          })),
          aproveitamentos: aproveitamentosVenda,
          desconto,
          fretePorTonelada: frete,
          pesoCargaToneladas,
          comissao: { tipo: comissaoTipo, valor: comissaoValor },
          taxas: taxasAdicionais,
        }),
        erro: null,
      };
    } catch (erro) {
      return { resultado: null, erro: erro instanceof Error ? erro.message : "Revise os valores comerciais informados" };
    }
  }, [itens, aproveitamentosVenda, desconto, frete, pesoCargaToneladas, comissaoTipo, comissaoValor, taxasAdicionais]);

  const itensComPrevia = useMemo(() => itens.map((item, index) => {
    const calculado = previaCorrigida.resultado?.itens[index];
    return calculado ? {
      ...item,
      precoLinear: calculado.precoLinear,
      valorPeca: calculado.valorPeca,
      valorTotal: calculado.valorTotal,
      unidadesPorComercializacao: item.tipoComercializacao === "metro_cubico" ? 0 : calculado.unidadesPorComercializacao,
    } : item;
  }), [itens, previaCorrigida.resultado]);

  const totalsPreview = previaCorrigida.resultado ?? null;

  const resumoPorBitola = useMemo(() => resumirItensVendaPorBitola(itens), [itens]);

  const atualizarLinhaComprimento = (id: number, campo: "comprimento" | "quantidade", valor: string) => {
    setLinhasComprimento((linhas) => linhas.map((linha) => linha.id === id ? { ...linha, [campo]: valor } : linha));
  };

  const navegarColunaRomaneio = (evento: KeyboardEvent<HTMLInputElement>, coluna: "comprimento" | "quantidade", indice: number) => {
    if (evento.key !== "Tab") return;
    const proximoIndice = obterIndiceTabPorColunaVenda(indice, linhasComprimento.length, evento.shiftKey);
    if (proximoIndice === null) return;
    const destino = document.querySelector<HTMLInputElement>(`[data-romaneio-venda="${coluna}-${proximoIndice}"]`);
    if (!destino) return;
    evento.preventDefault();
    destino.focus();
  };

  const disponibilidadeLinha = (comprimento: string) => {
    return disponibilidadeEstoqueVenda({ estoque: estoqueSerrado.data ?? [], madeiraNome: grupoItem.madeiraNome, espessuraCm: grupoItem.espessuraCm, larguraCm: grupoItem.larguraCm, comprimento });
  };

  const adicionarGrupoItens = () => {
    const resultado = criarItensVendaPorMedida({ ...grupoItem, linhas: linhasComprimento });
    if (resultado.erro) { toast.error(resultado.erro); return; }
    setItens((itensAtuais) => [...itensAtuais, ...resultado.itens]);
    setGrupoItem((grupo) => ({ ...grupo, espessuraCm: "", larguraCm: "" }));
    setLinhasComprimento(criarLinhasComprimentoPadraoVenda());
    toast.success(`${resultado.itens.length} comprimento(s) adicionado(s) à venda`);
  };

  const confirmarGrupoComEnter = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    adicionarGrupoItens();
  };

  const adicionarItemComercial = () => {
    if (tipoComercializacao === "metro_cubico") return;
    const resultado = criarItemVendaComercial({ ...itemComercial, tipoComercializacao, produtoComercialId: produtoComercialId ? Number(produtoComercialId) : null, componentesPacote: tipoComercializacao === "pacote" ? componentesPacote : [] });
    if (resultado.erro || !resultado.item) { toast.error(resultado.erro ?? "Não foi possível adicionar o item"); return; }
    setItens((itensAtuais) => [...itensAtuais, resultado.item!]);
    setItemComercial({ madeiraNome: "", quantidade: "", precoComercial: "" });
    setProdutoComercialId("");
    setComponentesPacote([]);
    toast.success(`${tipoComercializacao === "unidade" ? "Unidade" : "Pacote"} adicionado à venda`);
  };

  const adicionarComponentePacote = () => setComponentesPacote((atual) => [...atual, { descricao: "", madeiraNome: "", espessura: "", largura: "", comprimento: "", quantidade: 1 }]);
  const atualizarComponentePacote = (indice: number, campo: keyof ComponentePacoteVenda, valor: string | number) => setComponentesPacote((atual) => atual.map((componente, index) => index === indice ? { ...componente, [campo]: valor } : componente));
  const removerComponentePacote = (indice: number) => setComponentesPacote((atual) => atual.filter((_, index) => index !== indice));
  const selecionarProdutoComercial = (id: string) => {
    setProdutoComercialId(id);
    const produto = produtosComerciais.data?.find((item) => item.id === Number(id));
    if (!produto) return;
    setTipoComercializacao(produto.tipoComercializacao as TipoComercializacaoVenda);
    setItemComercial((item) => ({ ...item, madeiraNome: produto.nome, precoComercial: String(produto.precoPadrao) }));
    setComponentesPacote(produto.componentes.map((componente) => ({ descricao: componente.descricao, madeiraNome: componente.madeiraNome, espessura: componente.espessura, largura: componente.largura, comprimento: componente.comprimento, quantidade: componente.quantidade })));
  };
  const adicionarComponenteProduto = () => setProdutoForm((form) => ({ ...form, componentes: [...form.componentes, { descricao: "", madeiraNome: "", espessura: "", largura: "", comprimento: "", quantidade: 1 }] }));
  const atualizarComponenteProduto = (indice: number, campo: keyof ComponentePacoteVenda, valor: string | number) => setProdutoForm((form) => ({ ...form, componentes: form.componentes.map((componente, index) => index === indice ? { ...componente, [campo]: valor } : componente) }));
  const removerComponenteProduto = (indice: number) => setProdutoForm((form) => ({ ...form, componentes: form.componentes.filter((_, index) => index !== indice) }));
  const salvarProdutoComercial = () => {
    criarProdutoComercial.mutate({ ...produtoForm, observacoes: produtoForm.observacoes || null }, {
      onSuccess: async (produto) => {
        await utils.orcamento.produtosComerciais.list.invalidate();
        setProdutoComercialOpen(false);
        setProdutoForm({ nome: "", tipoComercializacao: "unidade", precoPadrao: "", observacoes: "", componentes: [] });
        selecionarProdutoComercial(String(produto.id));
        toast.success("Produto comercial cadastrado e selecionado");
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const removeItem = (index: number) => setItens(itens.filter((_, i) => i !== index));
  const atualizarItem = (index: number, alteracoes: Partial<ItemOrcamento>) => {
    setItens((atuais) => atuais.map((item, itemIndex) => itemIndex === index ? atualizarItemVenda(item, alteracoes) : item));
  };
  const atualizarComponenteItem = (itemIndex: number, componenteIndex: number, campo: keyof ComponentePacoteVenda, valor: string | number) => {
    const item = itens[itemIndex];
    if (!item) return;
    atualizarItem(itemIndex, { componentesPacote: item.componentesPacote.map((componente, index) => index === componenteIndex ? { ...componente, [campo]: valor } : componente) });
  };
  const adicionarComponenteItem = (itemIndex: number) => {
    const item = itens[itemIndex];
    if (!item) return;
    atualizarItem(itemIndex, { componentesPacote: [...item.componentesPacote, { descricao: "", madeiraNome: "", espessura: "", largura: "", comprimento: "", quantidade: 1 }] });
  };
  const removerComponenteItem = (itemIndex: number, componenteIndex: number) => {
    const item = itens[itemIndex];
    if (!item) return;
    atualizarItem(itemIndex, { componentesPacote: item.componentesPacote.filter((_, index) => index !== componenteIndex) });
  };

  const adicionarTaxaAdicional = () => setTaxasAdicionais((taxas) => [...taxas, { descricao: "", tipo: "percentual", valor: "0" }]);
  const atualizarTaxaAdicional = (indice: number, campo: keyof TaxaAdicionalComercial, valor: string) => setTaxasAdicionais((taxas) => taxas.map((taxa, index) => index === indice ? { ...taxa, [campo]: valor } : taxa));
  const removerTaxaAdicional = (indice: number) => setTaxasAdicionais((taxas) => taxas.filter((_, index) => index !== indice));

  const aproveitamentosDisponiveis = useMemo(() => (estoqueSerrado.data ?? [])
    .filter((item) => String(item.madeiraNome ?? "").toLocaleLowerCase("pt-BR").startsWith("aproveitamento de ")),
    [estoqueSerrado.data]);

  const adicionarAproveitamento = () => {
    const volume = aproveitamentoForm.volume.trim().replace(",", ".");
    const precoM3 = aproveitamentoForm.precoM3.trim().replace(",", ".");
    if (!aproveitamentoForm.madeiraNome || !volume) { toast.error("Selecione o aproveitamento e informe um volume positivo"); return; }
    if (!precoM3) { toast.error("Informe um preço por m³ válido"); return; }
    const tentativa = [...aproveitamentosVenda, { ...aproveitamentoForm, volume, precoM3 }];
    try {
      calcularPreviaComercial({ itens: [], aproveitamentos: tentativa, desconto, fretePorTonelada: frete, pesoCargaToneladas, comissao: { tipo: comissaoTipo, valor: comissaoValor }, taxas: taxasAdicionais });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Revise o aproveitamento informado");
      return;
    }
    setAproveitamentosVenda(tentativa);
    setAproveitamentoForm({ madeiraNome: "", volume: "", precoM3: "" });
  };

  const create = trpc.orcamento.create.useMutation();
  const revisarInterna = trpc.orcamento.revisarInterna.useMutation();
  const utils = trpc.useUtils();
  const salvandoRef = useRef(false);

  const selecionarMadeira = (valor: string) => {
    const madeira = madeiras.data?.find((item) => item.id === Number(valor));
    if (!madeira) return;
    setGrupoItem((grupo) => ({ ...grupo, madeiraId: madeira.id, madeiraNome: madeira.nome, precoM3: String(madeira.precoM3) }));
  };

  const criarMadeiraEmContexto = () => {
    if (!novaMadeiraForm.nome.trim()) { toast.error("Informe o nome da madeira"); return; }
    if (!novaMadeiraForm.precoM3.trim() || Number(novaMadeiraForm.precoM3.replace(",", ".")) < 0) { toast.error("Informe um preço por m³ válido"); return; }
    createMadeira.mutate({ ...novaMadeiraForm, nome: novaMadeiraForm.nome.trim(), unidadeMedida: "m³" }, {
      onSuccess: async (resultado) => {
        await utils.madeira.list.invalidate();
        setGrupoItem((grupo) => ({ ...grupo, madeiraId: resultado.id, madeiraNome: novaMadeiraForm.nome.trim(), precoM3: novaMadeiraForm.precoM3 }));
        setNovaMadeiraForm({ nome: "", precoM3: "", descricao: "" });
        setNovaMadeiraOpen(false);
        toast.success("Madeira criada e selecionada");
      },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const aplicarModeloMedida = (id: string) => {
    const modelo = modelosMedida.data?.find((item) => item.id === Number(id));
    if (!modelo) return;
    setGrupoItem({ madeiraId: modelo.madeiraId, madeiraNome: modelo.madeiraNome, precoM3: String(modelo.precoM3), espessuraCm: String(modelo.espessuraCm), larguraCm: String(modelo.larguraCm) });
    const quantidadesPorComprimento = new Map(modelo.comprimentos.map((linha) => [Number(String(linha.comprimento).replace(",", ".")), linha.quantidade]));
    setLinhasComprimento(criarLinhasComprimentoPadraoVenda().map((linha) => ({
      ...linha,
      quantidade: quantidadesPorComprimento.get(Number(linha.comprimento.replace(",", "."))) ?? "",
    })));
    toast.success(`Modelo “${modelo.nome}” aplicado`);
  };

  const salvarModeloMedida = () => {
    const modelo = prepararModeloMedida({ nome: nomeModelo, madeiraNome: grupoItem.madeiraNome, precoM3: grupoItem.precoM3, espessuraCm: grupoItem.espessuraCm, larguraCm: grupoItem.larguraCm, linhas: linhasComprimento });
    if (modelo.erro) { toast.error(modelo.erro); return; }
    criarModeloMedida.mutate({ nome: modelo.nome!, madeiraId: grupoItem.madeiraId, madeiraNome: grupoItem.madeiraNome, precoM3: grupoItem.precoM3, espessuraCm: grupoItem.espessuraCm, larguraCm: grupoItem.larguraCm, comprimentos: modelo.comprimentos }, {
      onSuccess: async () => { await utils.orcamento.modelosMedida.list.invalidate(); setNomeModelo(""); setModeloOpen(false); toast.success("Modelo de medida guardado"); },
      onError: (erro) => toast.error(erro.message),
    });
  };

  const handleCriarCliente = () => {
    if (!novoClienteForm.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    createCliente.mutate(novoClienteForm, {
      onSuccess: async (res) => {
        toast.success("Cliente criado com sucesso");
        await utils.cliente.list.invalidate();
        if (res.id) setClienteId(String(res.id));
        setNovoClienteOpen(false);
        setNovoClienteForm({ nome: "", contacto: "", email: "", morada: "", nif: "" });
      },
      onError: (err: any) => toast.error(err.message),
    });
  };

  const handleSave = (estado: "rascunho" | "enviado") => {
    if (salvandoRef.current || create.isPending || revisarInterna.isPending) return;
    if (previaCorrigida.erro) { toast.error(`Corrija os valores da prévia comercial: ${previaCorrigida.erro}`); return; }
    const resultadoComercial = previaCorrigida.resultado;
    if (!resultadoComercial) { toast.error("Adicione itens válidos antes de salvar"); return; }
    if (origemId !== null && !origemCarregada) { toast.error("Aguarde o carregamento dos dados da venda original"); return; }
    if (duplicarId !== null && estado !== "rascunho") { toast.error("A cópia deve iniciar como rascunho"); return; }
    if (revisarId !== null && motivoRevisao.trim().length < 3) { toast.error("Informe o motivo da revisão comercial"); return; }
    if (!clienteId) { toast.error("Selecione um cliente"); return; }
    if (duplicarId !== null && (!dataVencimento || !competencia)) { toast.error("Revise e informe vencimento e competência antes de salvar a cópia"); return; }
    const itemInvalido = itens.find((item) => {
      if (item.madeiraNome.trim().length < 2 || !Number.isInteger(item.quantidade) || item.quantidade <= 0) return true;
      if (item.tipoComercializacao === "metro_cubico") {
        return ![item.espessura, item.largura, item.comprimento, item.precoM3].every((valor) => Number.isFinite(parseDecimalInput(valor)) && parseDecimalInput(valor) > 0);
      }
      const preco = parseDecimalInput(item.precoM3);
      if (!Number.isFinite(preco) || preco < 0) return true;
      return item.tipoComercializacao === "pacote" && (!item.componentesPacote.length || item.componentesPacote.some((componente) => componente.descricao.trim().length < 2 || !Number.isInteger(componente.quantidade) || componente.quantidade <= 0));
    });
    if (itemInvalido) { toast.error("Revise os produtos, quantidades, valores e componentes dos itens"); return; }
    if (itens.length === 0 && aproveitamentosVenda.length === 0) { toast.error("Adicione pelo menos um item ou aproveitamento"); return; }
    salvandoRef.current = true;
    const payload = {
      clienteId: Number(clienteId),
      tipoVenda,
      duplicadoDeId: duplicarId ?? undefined,
      estado,
      desconto,
      frete: resultadoComercial.abatimentoFrete,
      fretePorTonelada: frete || undefined,
      pesoCargaToneladas: pesoCargaToneladas || undefined,
      abatimentoFrete: resultadoComercial.abatimentoFrete,
      baseAposFrete: resultadoComercial.baseAposFrete,
      comissaoTipo,
      comissaoValor: comissaoValor || undefined,
      comissaoCalculada: resultadoComercial.comissaoCalculada,
      taxasAdicionais,
      subtotal: resultadoComercial.subtotal,
      total: resultadoComercial.total,
      totalPecas: resultadoComercial.totalPecas,
      totalMetroLinear: resultadoComercial.totalMetroLinear,
      totalVolume: resultadoComercial.totalVolume,
      observacoes: observacoes || undefined,
      vendedor: vendedor || undefined,
      dataValidade: dataValidade || undefined,
      dataVencimento,
      competencia,
      itens: itensComPrevia.map(({ madeiraId, bitolaId, produtoComercialId, madeiraNome, bitolaDescricao, espessura, largura, comprimento, quantidade, tipoComercializacao, unidadesPorComercializacao, precoM3, precoLinear, valorPeca, valorTotal, componentesPacote }) => ({ madeiraId, bitolaId, produtoComercialId, madeiraNome, bitolaDescricao, espessura, largura, comprimento, quantidade, tipoComercializacao, unidadesPorComercializacao, precoM3, precoLinear, valorPeca, valorTotal, componentesPacote })),
      aproveitamentos: aproveitamentosVenda,
    };
    const onSuccess = () => { toast.success(revisarId !== null ? "Revisão comercial salva; a venda continua aprovada." : estado === "enviado" ? "Venda enviada!" : "Venda salva!"); utils.orcamento.list.invalidate(); setLocation("/orcamentos"); };
    const onError = (err: any) => { salvandoRef.current = false; toast.error(err.message); };
    if (revisarId !== null) {
      revisarInterna.mutate({ ...payload, id: revisarId, versaoComercialEsperada: Number(origemDuplicacao.data?.orcamento.versaoComercial ?? 1), motivo: motivoRevisao }, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  };

  if (duplicarInvalido || revisarInvalido) return <div className="mx-auto max-w-xl py-12 text-center"><h1 className="text-lg font-semibold">Não foi possível abrir a operação</h1><p className="mt-2 text-sm text-muted-foreground">O identificador informado é inválido.</p><Button className="mt-4" onClick={() => setLocation("/orcamentos")}>Voltar para vendas</Button></div>;
  if (origemId !== null && origemDuplicacao.isLoading) return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados comerciais da venda…</div>;
  if (origemId !== null && (origemDuplicacao.isError || (origemDuplicacao.isSuccess && !origemDuplicacao.data))) return <div className="mx-auto max-w-xl py-12 text-center"><h1 className="text-lg font-semibold">Não foi possível carregar a venda</h1><p className="mt-2 text-sm text-muted-foreground">A venda não está disponível para esta empresa ou ocorreu uma falha de carregamento.</p><Button className="mt-4" onClick={() => setLocation("/orcamentos")}>Voltar para vendas</Button></div>;
  if (revisarId !== null && origemDuplicacao.data && (origemDuplicacao.data.orcamento.tipoVenda !== "interna" || origemDuplicacao.data.orcamento.estado !== "aprovado" || origemDuplicacao.data.orcamento.entregue)) return <div className="mx-auto max-w-xl py-12 text-center"><h1 className="text-lg font-semibold">Revisão indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Somente vendas internas aprovadas e ainda não retiradas podem ser revisadas.</p><Button className="mt-4" onClick={() => setLocation("/orcamentos")}>Voltar para vendas</Button></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/orcamentos")} className="mb-2 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{revisarId !== null ? "Revisar venda interna" : duplicarId !== null ? "Duplicar venda" : "Nova Venda"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{revisarId !== null ? "A alteração cria uma revisão auditável, atualiza reservas e ajusta somente saldos financeiros em aberto." : duplicarId !== null ? "Revise e edite os dados comerciais. A cópia só será criada quando você salvar como rascunho." : "Registre a venda de madeira serrada e programe o recebimento"}</p>
        </div>
      </div>

      {revisarId !== null && <div className="space-y-2"><Label htmlFor="motivo-revisao">Motivo da revisão *</Label><Textarea id="motivo-revisao" value={motivoRevisao} onChange={(event) => setMotivoRevisao(event.target.value)} maxLength={4000} placeholder="Descreva o motivo comercial da alteração" /></div>}
      {duplicarId !== null && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Esta é uma nova proposta independente. Nenhum orçamento foi criado ainda; aprovação, pagamento, entrega e histórico da origem não serão copiados.</div>}
      {duplicarId !== null && origemCarregada && (!dataVencimento || !competencia) && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">A origem não possui todas as datas comerciais. Informe vencimento e competência antes de salvar.</div>}
      {duplicarId !== null && origemCarregada && clientes.isSuccess && !clientes.data?.some((cliente) => cliente.id === Number(clienteId)) && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">O cliente original não está disponível na lista atual. Selecione um cliente válido antes de salvar.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-4">Dados da Venda</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo-venda">Tipo de venda</Label>
                  <select id="tipo-venda" aria-label="Tipo de venda" value={tipoVenda} onChange={(event) => setTipoVenda(event.target.value as "externa" | "interna")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="externa">Venda externa</option>
                    <option value="interna">Venda interna</option>
                  </select>
                  {tipoVenda === "interna" && <p className="text-xs text-muted-foreground">Na aprovação, somente itens comercializados por m³ reservam estoque serrado. Unidade e pacote não movimentam estoque.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <div className="flex gap-2">
                    <Popover open={clienteSelectorOpen} onOpenChange={setClienteSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={clienteSelectorOpen}
                          className="bg-white flex-1 justify-between font-normal"
                        >
                          <span className="truncate">
                            {clienteSelecionado
                              ? `${clienteSelecionado.nome}${clienteSelecionado.contacto ? ` · ${clienteSelecionado.contacto}` : ""}`
                              : "Buscar cliente por nome ou telefone"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Digite nome ou telefone..." />
                          <CommandList>
                            <CommandGroup heading="Ação rápida">
                              <CommandItem
                                value="criar novo cliente"
                                onSelect={() => {
                                  setClienteSelectorOpen(false);
                                  setNovoClienteOpen(true);
                                }}
                                className="text-primary"
                              >
                                <Plus className="h-4 w-4" />
                                <span className="font-medium">Criar novo cliente</span>
                              </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup heading="Clientes">
                              {clientes.data?.map((cliente) => (
                                <CommandItem
                                  key={cliente.id}
                                  value={`${cliente.nome} ${cliente.contacto ?? ""}`}
                                  onSelect={() => {
                                    setClienteId(String(cliente.id));
                                    setClienteSelectorOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${clienteId === String(cliente.id) ? "opacity-100" : "opacity-0"}`} />
                                  <span className="min-w-0 truncate">{cliente.nome}</span>
                                  {cliente.contacto && <span className="ml-auto pl-3 text-xs text-muted-foreground">{cliente.contacto}</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => setNovoClienteOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Novo cliente
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Nome do vendedor" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade da proposta</Label>
                    <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento *</Label>
                    <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência *</Label>
                    <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="bg-white" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adicionar itens por medida */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />Itens da venda</h3><p className="mt-1 text-xs text-muted-foreground">Escolha se o item será negociado pelo volume, por unidade ou por pacote.</p></div><div className="flex flex-wrap items-center gap-2"><select aria-label="Tipo de comercialização" value={tipoComercializacao} onChange={(e) => setTipoComercializacao(e.target.value as TipoComercializacaoVenda)} className="h-9 rounded-md border border-input bg-background px-2 text-xs font-medium"><option value="metro_cubico">{rotulosTipoComercializacaoVenda.metro_cubico}</option><option value="unidade">{rotulosTipoComercializacaoVenda.unidade}</option><option value="pacote">{rotulosTipoComercializacaoVenda.pacote}</option></select>{tipoComercializacao === "metro_cubico" && <><select aria-label="Aplicar modelo de medida" defaultValue="" onChange={(e) => { aplicarModeloMedida(e.target.value); e.currentTarget.value = ""; }} className="h-9 max-w-48 rounded-md border border-input bg-background px-2 text-xs"><option value="">Aplicar modelo...</option>{modelosMedida.data?.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}</select><Button type="button" size="sm" variant="outline" onClick={() => setModeloOpen(true)}><Save className="mr-1.5 h-3.5 w-3.5" />Guardar medida</Button></>}<span className="text-xs font-medium text-primary">{tipoComercializacao === "metro_cubico" ? "Medida em centímetros" : "Preço comercial direto"}</span></div></div>
              {tipoComercializacao === "metro_cubico" ? <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Madeira *</Label>
                    <SearchableEntitySelect value={grupoItem.madeiraId ? String(grupoItem.madeiraId) : ""} onValueChange={selecionarMadeira} options={opcoesMadeira} placeholder="Selecione a madeira" searchPlaceholder="Pesquisar madeira..." emptyLabel="Nenhuma madeira encontrada." createLabel="Criar nova madeira" onCreate={() => setNovaMadeiraOpen(true)} ariaLabel="Selecionar madeira" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço por m³ (R$) *</Label>
                    <Input value={grupoItem.precoM3} onChange={(e) => setGrupoItem({ ...grupoItem, precoM3: e.target.value })} type="text" inputMode="decimal" placeholder="2400,00" className="bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
                  <div className="space-y-2">
                    <Label>Bitola / espessura (cm) *</Label>
                    <Input value={grupoItem.espessuraCm} onChange={(e) => setGrupoItem({ ...grupoItem, espessuraCm: e.target.value })} type="text" inputMode="decimal" placeholder="2" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Largura (cm) *</Label>
                    <Input value={grupoItem.larguraCm} onChange={(e) => setGrupoItem({ ...grupoItem, larguraCm: e.target.value })} type="text" inputMode="decimal" placeholder="5" className="bg-white" />
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/70">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Comprimentos do romaneio</p>
                      <p className="text-xs text-muted-foreground">Grade de 2 m a 9 m. Use Tab na mesma coluna ou Enter para adicionar as medidas preenchidas.</p>
                    </div>
                    <span className="text-xs text-muted-foreground">m / peças</span>
                  </div>
                  <div className="venda-comprimentos overflow-x-auto">
                    <table className="min-w-[470px] w-full table-fixed text-sm">
                      <thead className="bg-muted/20 text-xs text-muted-foreground">
                        <tr><th className="w-[42%] px-3 py-2 text-left font-medium">Comprimento (m)</th><th className="w-[58%] px-3 py-2 text-left font-medium">Quantidade / estoque</th></tr>
                      </thead>
                      <tbody>
                        {linhasComprimento.map((linha, indice) => {
                          const disponibilidade = disponibilidadeLinha(linha.comprimento);
                          const quantidadeInformada = Number(linha.quantidade);
                          const deficit = disponibilidade !== null && Number.isFinite(quantidadeInformada) && quantidadeInformada > disponibilidade;
                          return <tr key={linha.id} className="border-t border-border/50">
                            <td className="p-2">
                              <Input
                                data-romaneio-venda={`comprimento-${indice}`}
                                aria-label={`Comprimento da linha ${indice + 1}`}
                                value={linha.comprimento}
                                onChange={(e) => atualizarLinhaComprimento(linha.id, "comprimento", e.target.value)}
                                onKeyDown={(evento) => { navegarColunaRomaneio(evento, "comprimento", indice); confirmarGrupoComEnter(evento); }}
                                inputMode="decimal"
                                className="h-9 bg-white"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                data-romaneio-venda={`quantidade-${indice}`}
                                aria-label={`Quantidade da linha ${indice + 1}`}
                                value={linha.quantidade}
                                onChange={(e) => atualizarLinhaComprimento(linha.id, "quantidade", e.target.value)}
                                onKeyDown={(evento) => { navegarColunaRomaneio(evento, "quantidade", indice); confirmarGrupoComEnter(evento); }}
                                type="number"
                                min="1"
                                placeholder="Ex.: 20"
                                className="h-9 bg-white"
                              />
                              <p className={`mt-1 text-[11px] font-medium ${disponibilidade === null ? "text-muted-foreground" : deficit ? "text-rose-700" : "text-emerald-700"}`}>
                                {disponibilidade === null ? "Informe a medida" : deficit ? `Déficit de ${quantidadeInformada - disponibilidade} peça(s)` : `${disponibilidade} peça(s) em estoque`}
                              </p>
                            </td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Button type="button" onClick={adicionarGrupoItens} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />Adicionar comprimentos à venda
                </Button>
              </div> : <div className="space-y-4 rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
                <div className="flex flex-col gap-3 rounded-md border border-dashed border-primary/30 bg-background/70 p-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2"><Label>Produto comercial recorrente</Label><select aria-label="Selecionar produto comercial recorrente" value={produtoComercialId} onChange={(e) => selecionarProdutoComercial(e.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Preencher manualmente</option>{(produtosComerciais.data ?? []).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {produto.tipoComercializacao === "pacote" ? "Pacote" : "Unidade"} · {formatCurrency(produto.precoPadrao)}</option>)}</select></div>
                  <Button type="button" variant="outline" onClick={() => setProdutoComercialOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Cadastrar produto</Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-2"><Label>{tipoComercializacao === "unidade" ? "Produto / item *" : "Madeira ou produto do pacote *"}</Label><Input value={itemComercial.madeiraNome} onChange={(e) => setItemComercial((item) => ({ ...item, madeiraNome: e.target.value }))} placeholder={tipoComercializacao === "unidade" ? "Ex.: Portal" : "Ex.: Pacote de cedrinho"} className="bg-white" /></div>
                  <div className="space-y-2"><Label>Quantidade de {tipoComercializacao === "unidade" ? "unidades" : "pacotes"} *</Label><Input value={itemComercial.quantidade} onChange={(e) => setItemComercial((item) => ({ ...item, quantidade: e.target.value }))} type="number" min="1" step="1" placeholder="1" className="bg-white" /></div>
                  <div className="space-y-2"><Label>Preço por {tipoComercializacao === "unidade" ? "unidade" : "pacote"} (R$) *</Label><Input value={itemComercial.precoComercial} onChange={(e) => setItemComercial((item) => ({ ...item, precoComercial: e.target.value }))} inputMode="decimal" placeholder="0,00" className="bg-white" /></div>
                </div>
                {tipoComercializacao === "pacote" && <div className="space-y-3 rounded-md border border-primary/20 bg-white/70 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Composição do pacote</p><p className="text-xs text-muted-foreground">Detalhe cada peça incluída em um pacote. Esta composição ficará vinculada à Venda.</p></div><Button type="button" size="sm" variant="outline" onClick={adicionarComponentePacote}><Plus className="mr-1 h-3.5 w-3.5" />Peça</Button></div>{componentesPacote.length === 0 ? <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">Adicione as peças que formam este pacote.</p> : <div className="space-y-2">{componentesPacote.map((componente, indice) => <div key={indice} className="grid grid-cols-1 gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-[1.5fr_.9fr_.7fr_.7fr_.7fr_auto]"><Input aria-label={`Descrição da peça ${indice + 1}`} value={componente.descricao} onChange={(e) => atualizarComponentePacote(indice, "descricao", e.target.value)} placeholder="Descrição da peça" className="h-9 bg-white" /><Input aria-label={`Madeira da peça ${indice + 1}`} value={componente.madeiraNome ?? ""} onChange={(e) => atualizarComponentePacote(indice, "madeiraNome", e.target.value)} placeholder="Madeira" className="h-9 bg-white" /><Input aria-label={`Espessura da peça ${indice + 1}`} value={componente.espessura ?? ""} onChange={(e) => atualizarComponentePacote(indice, "espessura", e.target.value)} placeholder="Esp." className="h-9 bg-white" /><Input aria-label={`Largura da peça ${indice + 1}`} value={componente.largura ?? ""} onChange={(e) => atualizarComponentePacote(indice, "largura", e.target.value)} placeholder="Larg." className="h-9 bg-white" /><Input aria-label={`Comprimento da peça ${indice + 1}`} value={componente.comprimento ?? ""} onChange={(e) => atualizarComponentePacote(indice, "comprimento", e.target.value)} placeholder="Comp." className="h-9 bg-white" /><div className="flex gap-1"><Input aria-label={`Quantidade da peça ${indice + 1}`} value={componente.quantidade} onChange={(e) => atualizarComponentePacote(indice, "quantidade", Number(e.target.value))} type="number" min="1" className="h-9 w-16 bg-white" /><Button type="button" size="icon" variant="ghost" aria-label={`Remover peça ${indice + 1}`} onClick={() => removerComponentePacote(indice)} className="h-9 w-9 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div>}</div>}
                <p className="text-xs text-muted-foreground">Itens por unidade e pacote usam preço direto e não exigem metragem cúbica. Eles não movimentam automaticamente o estoque de madeira serrada.</p>
                <Button type="button" onClick={adicionarItemComercial} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Adicionar {tipoComercializacao === "unidade" ? "unidade" : "pacote"} à venda</Button>
              </div>}
            </CardContent>
          </Card>

          <Card className="border border-amber-200 bg-amber-50/35 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4"><h3 className="font-semibold text-sm">Aproveitamento em estoque</h3><p className="mt-1 text-xs text-muted-foreground">Registre metros cúbicos de peças abaixo de 2 m. A baixa física será vinculada à entrega desta venda.</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_.8fr_.8fr_auto] sm:items-end">
                <div className="space-y-2"><Label>Aproveitamento disponível</Label><select aria-label="Selecionar aproveitamento" value={aproveitamentoForm.madeiraNome} onChange={(e) => setAproveitamentoForm((form) => ({ ...form, madeiraNome: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Selecione a essência</option>{aproveitamentosDisponiveis.map((item) => <option key={item.madeiraNome} value={item.madeiraNome}>{item.madeiraNome} · {formatMeasurement(item.volumeDisponivel ?? 0)} m³ disponíveis</option>)}</select></div>
                <div className="space-y-2"><Label>Volume (m³)</Label><Input aria-label="Volume de aproveitamento" value={aproveitamentoForm.volume} onChange={(e) => setAproveitamentoForm((form) => ({ ...form, volume: e.target.value }))} inputMode="decimal" placeholder="0,250" className="bg-white" /></div>
                <div className="space-y-2"><Label>Preço/m³ (R$)</Label><Input aria-label="Preço por metro cúbico do aproveitamento" value={aproveitamentoForm.precoM3} onChange={(e) => setAproveitamentoForm((form) => ({ ...form, precoM3: e.target.value }))} inputMode="decimal" placeholder="2.700,00" className="bg-white" /></div>
                <Button type="button" variant="outline" onClick={adicionarAproveitamento}><Plus className="mr-1.5 h-4 w-4" />Adicionar</Button>
              </div>
              {aproveitamentosDisponiveis.length === 0 && <p className="mt-3 text-xs text-muted-foreground">Nenhum aproveitamento disponível no estoque neste momento.</p>}
              {aproveitamentosVenda.length > 0 && <div className="mt-4 space-y-2">{aproveitamentosVenda.map((item, index) => <div key={`${item.madeiraNome}-${index}`} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2"><div><p className="text-sm font-medium">{item.madeiraNome}</p><p className="text-xs text-muted-foreground">{formatMeasurement(item.volume)} m³ × {formatCurrency(item.precoM3)}/m³ = {formatCurrency(totalsPreview?.aproveitamentos[index]?.valorTotal ?? "0.00")}</p></div><Button type="button" aria-label={`Remover ${item.madeiraNome}`} variant="ghost" size="icon" className="text-destructive" onClick={() => setAproveitamentosVenda((atuais) => atuais.filter((_, atual) => atual !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
            </CardContent>
          </Card>

          {/* Itens */}
          {itens.length > 0 && (
            <Card className="border border-border/50 shadow-sm">
              <CardContent className="p-5">
                <h3 className="font-semibold text-sm mb-4">Itens da Venda ({itens.length})</h3>
                <div className="space-y-2">
                  {itensComPrevia.map((item, idx) => (
                    <div key={`${idx}-${item.tipoComercializacao}`} className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                        <div className="flex items-center gap-2">
                        <div className="flex-1 space-y-1"><Label htmlFor={`item-nome-${idx}`}>Produto / madeira</Label><Input id={`item-nome-${idx}`} value={item.madeiraNome} onChange={(e) => atualizarItem(idx, { madeiraNome: e.target.value, madeiraId: null, bitolaId: null, produtoComercialId: null })} /></div>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Excluir item ${item.madeiraNome || idx + 1}`} className="mt-5 h-9 w-9 shrink-0 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      {item.tipoComercializacao === "metro_cubico" ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <div className="space-y-1"><Label htmlFor={`item-esp-${idx}`}>Espessura (mm)</Label><Input id={`item-esp-${idx}`} inputMode="decimal" value={item.espessura} onChange={(e) => atualizarItem(idx, { espessura: e.target.value })} /></div>
                          <div className="space-y-1"><Label htmlFor={`item-larg-${idx}`}>Largura (mm)</Label><Input id={`item-larg-${idx}`} inputMode="decimal" value={item.largura} onChange={(e) => atualizarItem(idx, { largura: e.target.value })} /></div>
                          <div className="space-y-1"><Label htmlFor={`item-comp-${idx}`}>Comprimento (m)</Label><Input id={`item-comp-${idx}`} inputMode="decimal" value={item.comprimento} onChange={(e) => atualizarItem(idx, { comprimento: e.target.value })} /></div>
                          <div className="space-y-1"><Label htmlFor={`item-qtd-${idx}`}>Peças</Label><Input id={`item-qtd-${idx}`} type="number" min="1" step="1" value={item.quantidade} onChange={(e) => atualizarItem(idx, { quantidade: Number(e.target.value) })} /></div>
                          <div className="space-y-1"><Label htmlFor={`item-preco-${idx}`}>Preço por m³ (R$)</Label><Input id={`item-preco-${idx}`} inputMode="decimal" value={item.precoM3} onChange={(e) => atualizarItem(idx, { precoM3: e.target.value })} /></div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="space-y-1"><Label htmlFor={`item-qtd-${idx}`}>{item.tipoComercializacao === "unidade" ? "Quantidade de unidades" : "Quantidade de pacotes"}</Label><Input id={`item-qtd-${idx}`} type="number" min="1" step="1" value={item.quantidade} onChange={(e) => atualizarItem(idx, { quantidade: Number(e.target.value) })} /></div>
                          <div className="space-y-1"><Label htmlFor={`item-preco-${idx}`}>Preço por {item.tipoComercializacao === "unidade" ? "unidade" : "pacote"} (R$)</Label><Input id={`item-preco-${idx}`} inputMode="decimal" value={item.precoM3} onChange={(e) => atualizarItem(idx, { precoM3: e.target.value })} /></div>
                          <div className="space-y-1"><Label htmlFor={`produto-catalogo-${idx}`}>Vincular produto cadastrado</Label><select id={`produto-catalogo-${idx}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={item.produtoComercialId ? String(item.produtoComercialId) : "livre"} onChange={(e) => { const produto = produtosComerciais.data?.find((candidato) => candidato.id === Number(e.target.value)); atualizarItem(idx, { produtoComercialId: produto?.id ?? null, ...(produto ? { madeiraNome: produto.nome } : {}) }); }}><option value="livre">Produto descrito livremente</option>{item.produtoComercialId && !produtosComerciais.data?.some((produto) => produto.id === item.produtoComercialId) && <option value={String(item.produtoComercialId)}>{item.madeiraNome} (referência atual indisponível)</option>}{(produtosComerciais.data ?? []).filter((produto) => produto.tipoComercializacao === item.tipoComercializacao).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select></div>
                        </div>
                      )}
                      {item.tipoComercializacao === "metro_cubico" && <div className="space-y-1"><Label>Vincular madeira cadastrada (opcional)</Label><SearchableEntitySelect value={item.madeiraId ? String(item.madeiraId) : ""} onValueChange={(value) => { const madeira = madeiras.data?.find((candidata) => candidata.id === Number(value)); atualizarItem(idx, { madeiraId: madeira?.id ?? null, bitolaId: null, madeiraNome: madeira?.nome ?? item.madeiraNome }); }} options={opcoesMadeiraItem(item)} placeholder="Manter nome livre ou selecionar madeira" searchPlaceholder="Pesquisar madeira..." emptyLabel="Nenhuma madeira encontrada." ariaLabel={`Vincular madeira do item ${idx + 1}`} /></div>}
                      {item.tipoComercializacao === "pacote" && <div className="space-y-2 rounded-md border bg-white p-3">
                        <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-medium">Componentes do pacote</p><p className="text-xs text-muted-foreground">A composição por pacote é preservada e pode ser editada.</p></div><Button type="button" size="sm" variant="outline" onClick={() => adicionarComponenteItem(idx)}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar componente</Button></div>
                        {item.componentesPacote.map((componente, componenteIdx) => <div key={componenteIdx} className="grid grid-cols-2 gap-2 rounded border p-2 sm:grid-cols-[1.4fr_1fr_.7fr_.7fr_.7fr_.7fr_auto]">
                          <Input aria-label={`Descrição do componente ${componenteIdx + 1} de ${item.madeiraNome}`} value={componente.descricao} onChange={(e) => atualizarComponenteItem(idx, componenteIdx, "descricao", e.target.value)} placeholder="Descrição" />
                          <Input aria-label={`Madeira do componente ${componenteIdx + 1} de ${item.madeiraNome}`} value={componente.madeiraNome ?? ""} onChange={(e) => atualizarComponenteItem(idx, componenteIdx, "madeiraNome", e.target.value)} placeholder="Madeira" />
                          <Input aria-label={`Espessura do componente ${componenteIdx + 1} de ${item.madeiraNome}`} value={componente.espessura ?? ""} onChange={(e) => atualizarComponenteItem(idx, componenteIdx, "espessura", e.target.value)} placeholder="Espessura" />
                          <Input aria-label={`Largura do componente ${componenteIdx + 1} de ${item.madeiraNome}`} value={componente.largura ?? ""} onChange={(e) => atualizarComponenteItem(idx, componenteIdx, "largura", e.target.value)} placeholder="Largura" />
                          <Input aria-label={`Comprimento do componente ${componenteIdx + 1} de ${item.madeiraNome}`} value={componente.comprimento ?? ""} onChange={(e) => atualizarComponenteItem(idx, componenteIdx, "comprimento", e.target.value)} placeholder="Comprimento" />
                          <Input aria-label={`Quantidade do componente ${componenteIdx + 1} de ${item.madeiraNome}`} type="number" min="1" value={componente.quantidade} onChange={(e) => atualizarComponenteItem(idx, componenteIdx, "quantidade", Number(e.target.value))} />
                          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir componente ${componenteIdx + 1} de ${item.madeiraNome}`} className="text-destructive" onClick={() => removerComponenteItem(idx, componenteIdx)}><Trash2 className="h-4 w-4" /></Button>
                        </div>)}
                      </div>}
                      <p className="text-xs text-muted-foreground">{previaCorrigida.erro ? "Prévia da linha indisponível" : <>{item.quantidade} {item.tipoComercializacao === "unidade" ? "un." : item.tipoComercializacao === "pacote" ? "pacote(s)" : "peças"} × {formatCurrency(item.valorPeca)} = <strong>{formatCurrency(item.valorTotal)}</strong></>} · {rotulosTipoComercializacaoVenda[item.tipoComercializacao]}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {resumoPorBitola.length > 0 && (
            <Card className="border border-emerald-200 bg-emerald-50/30 shadow-sm">
              <CardContent className="p-5">
                <div className="mb-4"><h3 className="font-semibold text-sm">Resumo por bitola</h3><p className="mt-1 text-xs text-muted-foreground">Quantidade de peças e participação no volume total de madeira serrada desta venda.</p></div>
                <div className="overflow-x-auto rounded-lg border border-emerald-100 bg-white"><table className="w-full min-w-[520px] text-sm"><thead className="bg-emerald-50 text-xs text-emerald-900"><tr><th className="px-3 py-2 text-left font-medium">Bitola</th><th className="px-3 py-2 text-right font-medium">Peças</th><th className="px-3 py-2 text-right font-medium">Volume</th><th className="px-3 py-2 text-right font-medium">Participação</th></tr></thead><tbody>{resumoPorBitola.map((linha) => <tr key={linha.bitolaDescricao} className="border-t border-emerald-100"><td className="px-3 py-2 font-medium">{linha.bitolaDescricao}</td><td className="px-3 py-2 text-right tabular-nums">{linha.quantidadePecas}</td><td className="px-3 py-2 text-right tabular-nums">{formatMeasurement(linha.volume)} m³</td><td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-800">{Math.round(linha.percentualVolume)}%</td></tr>)}</tbody></table></div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary */}
        <div className="space-y-4">
          <Card className="border border-border/50 shadow-sm sticky top-6">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">Resumo da Venda</h3>
              {previaCorrigida.erro && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">Não é possível calcular a prévia: {previaCorrigida.erro}. Os dados digitados foram preservados; revise os valores.</div>}
              <Separator />
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal bruto</span><span className="font-medium">{formatCurrency(totalsPreview?.subtotal ?? "0.00")}</span></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Desconto</Label>
                    <Input type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} className="w-24 h-8 text-right bg-white" />
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-900">Frete abatido do pedido (opcional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">R$/tonelada</Label><Input aria-label="Frete por tonelada" type="number" value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" className="h-8 bg-white text-right" /></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Peso (t)</Label><Input aria-label="Peso da carga em toneladas" type="number" value={pesoCargaToneladas} onChange={(e) => setPesoCargaToneladas(e.target.value)} placeholder="0,000" className="h-8 bg-white text-right" /></div>
                    </div>
                    <div className="flex justify-between text-xs"><span>Abatimento de frete</span><span className="font-semibold text-amber-800">− {formatCurrency(totalsPreview?.abatimentoFrete ?? "0.00")}</span></div>
                  </div>
                  <div className="flex justify-between text-sm rounded bg-muted/50 px-2 py-1.5"><span className="text-muted-foreground">Base após frete</span><span className="font-semibold">{formatCurrency(totalsPreview?.baseAposFrete ?? "0.00")}</span></div>
                  <div className="rounded-md border border-border/70 p-3 space-y-2">
                    <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Comissão do vendedor</Label><select aria-label="Tipo de comissão" value={comissaoTipo} onChange={(e) => setComissaoTipo(e.target.value as "percentual" | "fixo")} className="h-7 rounded border bg-white px-1 text-xs"><option value="percentual">%</option><option value="fixo">R$ fixo</option></select></div>
                    <div className="flex gap-2"><Input aria-label="Valor da comissão" type="number" value={comissaoValor} onChange={(e) => setComissaoValor(e.target.value)} placeholder={comissaoTipo === "percentual" ? "0,00 %" : "0,00"} className="h-8 bg-white text-right" /><span className="flex items-center whitespace-nowrap text-xs font-medium">− {formatCurrency(totalsPreview?.comissaoCalculada ?? "0.00")}</span></div>
                  </div>
                  <div className="rounded-md border border-border/70 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3"><div><Label className="text-xs font-semibold">Taxas adicionais</Label><p className="mt-0.5 text-[11px] text-muted-foreground">São cobradas do cliente e somadas ao valor final.</p></div><Button type="button" variant="outline" size="sm" onClick={adicionarTaxaAdicional} className="h-7 px-2 text-xs"><Plus className="mr-1 h-3.5 w-3.5" />Adicionar taxa</Button></div>
                    {taxasAdicionais.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma taxa adicional aplicada.</p> : taxasAdicionais.map((taxa, indice) => (
                      <div key={indice} className="rounded border border-dashed border-border/80 p-2 space-y-2">
                        <div className="flex items-center gap-2"><Input aria-label={`Descrição da taxa ${indice + 1}`} value={taxa.descricao} onChange={(e) => atualizarTaxaAdicional(indice, "descricao", e.target.value)} placeholder="Ex.: ICMS do frete" className="h-8 bg-white text-sm" /><Button type="button" variant="ghost" size="icon" onClick={() => removerTaxaAdicional(indice)} aria-label={`Remover taxa ${indice + 1}`} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                        <div className="flex gap-2"><select aria-label={`Tipo de taxa ${indice + 1}`} value={taxa.tipo} onChange={(e) => atualizarTaxaAdicional(indice, "tipo", e.target.value)} className="h-8 rounded border bg-white px-2 text-xs"><option value="percentual">%</option><option value="fixo">R$ fixo</option></select><Input aria-label={`Valor da taxa ${indice + 1}`} type="number" value={taxa.valor} onChange={(e) => atualizarTaxaAdicional(indice, "valor", e.target.value)} placeholder={taxa.tipo === "percentual" ? "0,00 %" : "0,00"} className="h-8 bg-white text-right" /><span className="flex items-center whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-300">+ {formatCurrency(totalsPreview?.taxasCalculadas[indice]?.calculado ?? "0.00")}</span></div>
                      </div>
                    ))}
                    {taxasAdicionais.length > 0 && <div className="flex justify-between text-xs"><span>Total das taxas</span><span className="font-semibold text-emerald-700 dark:text-emerald-300">+ {formatCurrency(totalsPreview?.taxaCalculada ?? "0.00")}</span></div>}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span>Valor final da prévia</span><span className="text-primary">{formatCurrency(totalsPreview?.total ?? "0.00")}</span></div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Itens</p><p className="font-semibold text-sm">{totalsPreview?.totalPecas ?? 0}</p></div>
                <div><p className="text-xs text-muted-foreground">M. Linear</p><p className="font-semibold text-sm">{formatMeasurement(totalsPreview?.totalMetroLinear ?? "0.0000")} m</p></div>
                <div><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold text-sm">{formatMeasurement(totalsPreview?.totalVolume ?? "0.000000")} m³</p></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="space-y-2"><Label className="text-sm">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas adicionais" className="bg-white text-sm" rows={3} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => handleSave("rascunho")} disabled={!clienteId || (itens.length === 0 && aproveitamentosVenda.length === 0) || Boolean(previaCorrigida.erro) || create.isPending || revisarInterna.isPending || (revisarId !== null && motivoRevisao.trim().length < 3)} className="flex-1">
                  {create.isPending || revisarInterna.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{revisarId !== null ? "Salvar revisão" : duplicarId !== null ? "Salvar cópia como rascunho" : "Salvar venda"}
                </Button>
                {duplicarId === null && revisarId === null && <Button type="button" onClick={() => handleSave("enviado")} disabled={!clienteId || itens.length === 0 || Boolean(previaCorrigida.erro) || create.isPending || revisarInterna.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Send className="h-4 w-4 mr-2" />Enviar venda
                </Button>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={novaMadeiraOpen} onOpenChange={setNovaMadeiraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Madeira</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2"><Label>Nome *</Label><Input value={novaMadeiraForm.nome} onChange={(e) => setNovaMadeiraForm({ ...novaMadeiraForm, nome: e.target.value })} placeholder="Ex.: Guarandi" className="bg-white" autoFocus /></div>
            <div className="space-y-2"><Label>Preço padrão por m³ (R$) *</Label><Input value={novaMadeiraForm.precoM3} onChange={(e) => setNovaMadeiraForm({ ...novaMadeiraForm, precoM3: e.target.value })} inputMode="decimal" placeholder="2400,00" className="bg-white" /></div>
            <div className="space-y-2"><Label>Observação</Label><Textarea value={novaMadeiraForm.descricao} onChange={(e) => setNovaMadeiraForm({ ...novaMadeiraForm, descricao: e.target.value })} placeholder="Opcional" className="bg-white" rows={2} /></div>
            <Button type="button" onClick={criarMadeiraEmContexto} disabled={createMadeira.isPending} className="w-full">{createMadeira.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Criar e selecionar madeira</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modeloOpen} onOpenChange={setModeloOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Guardar modelo de medida</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1"><p className="text-sm text-muted-foreground">O modelo guardará a madeira, o preço, a bitola, a largura e todos os comprimentos preenchidos neste romaneio.</p><div className="space-y-2"><Label>Nome do modelo *</Label><Input value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} placeholder="Ex.: Cedrinho 2 × 5" className="bg-white" autoFocus /></div><Button type="button" onClick={salvarModeloMedida} disabled={criarModeloMedida.isPending} className="w-full">{criarModeloMedida.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar modelo</Button><div className="border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Modelos guardados</p><div className="max-h-36 space-y-1 overflow-y-auto">{modelosMedida.data?.length ? modelosMedida.data.map((modelo) => <div key={modelo.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-sm"><span className="truncate">{modelo.nome}</span><Button type="button" size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => excluirModeloMedida.mutate({ id: modelo.id }, { onSuccess: () => utils.orcamento.modelosMedida.list.invalidate() })}>Excluir</Button></div>) : <p className="text-xs text-muted-foreground">Nenhum modelo guardado.</p>}</div></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={produtoComercialOpen} onOpenChange={setProdutoComercialOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastrar produto comercial recorrente</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">Cadastre produtos por unidade ou pacotes para reutilizá-los no preenchimento rápido de novas vendas.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2"><Label>Nome do produto *</Label><Input value={produtoForm.nome} onChange={(e) => setProdutoForm((form) => ({ ...form, nome: e.target.value }))} placeholder="Ex.: Portal padrão 80 cm" className="bg-white" autoFocus /></div>
              <div className="space-y-2"><Label>Tipo *</Label><select aria-label="Tipo do produto comercial" value={produtoForm.tipoComercializacao} onChange={(e) => setProdutoForm((form) => ({ ...form, tipoComercializacao: e.target.value as "unidade" | "pacote", componentes: e.target.value === "unidade" ? [] : form.componentes }))} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="unidade">Por unidade</option><option value="pacote">Por pacote</option></select></div>
              <div className="space-y-2"><Label>Preço padrão (R$) *</Label><Input value={produtoForm.precoPadrao} onChange={(e) => setProdutoForm((form) => ({ ...form, precoPadrao: e.target.value }))} inputMode="decimal" placeholder="0,00" className="bg-white" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Input value={produtoForm.observacoes} onChange={(e) => setProdutoForm((form) => ({ ...form, observacoes: e.target.value }))} placeholder="Opcional" className="bg-white" /></div>
            </div>
            {produtoForm.tipoComercializacao === "pacote" && <div className="space-y-3 rounded-md border border-primary/20 bg-primary/[0.03] p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Peças incluídas no pacote</p><p className="text-xs text-muted-foreground">Registre a composição que será copiada para cada Venda.</p></div><Button type="button" size="sm" variant="outline" onClick={adicionarComponenteProduto}><Plus className="mr-1 h-3.5 w-3.5" />Peça</Button></div>{produtoForm.componentes.length === 0 ? <p className="rounded-md border border-dashed bg-white px-3 py-2 text-xs text-muted-foreground">Inclua ao menos uma peça para definir este pacote.</p> : produtoForm.componentes.map((componente, indice) => <div key={indice} className="grid grid-cols-1 gap-2 rounded-md border border-border/60 bg-white p-2 sm:grid-cols-[1.5fr_.9fr_.7fr_.7fr_.7fr_auto]"><Input aria-label={`Descrição do componente do produto ${indice + 1}`} value={componente.descricao} onChange={(e) => atualizarComponenteProduto(indice, "descricao", e.target.value)} placeholder="Descrição" className="h-9" /><Input aria-label={`Madeira do componente do produto ${indice + 1}`} value={componente.madeiraNome ?? ""} onChange={(e) => atualizarComponenteProduto(indice, "madeiraNome", e.target.value)} placeholder="Madeira" className="h-9" /><Input aria-label={`Espessura do componente do produto ${indice + 1}`} value={componente.espessura ?? ""} onChange={(e) => atualizarComponenteProduto(indice, "espessura", e.target.value)} placeholder="Esp." className="h-9" /><Input aria-label={`Largura do componente do produto ${indice + 1}`} value={componente.largura ?? ""} onChange={(e) => atualizarComponenteProduto(indice, "largura", e.target.value)} placeholder="Larg." className="h-9" /><Input aria-label={`Comprimento do componente do produto ${indice + 1}`} value={componente.comprimento ?? ""} onChange={(e) => atualizarComponenteProduto(indice, "comprimento", e.target.value)} placeholder="Comp." className="h-9" /><div className="flex gap-1"><Input aria-label={`Quantidade do componente do produto ${indice + 1}`} value={componente.quantidade} onChange={(e) => atualizarComponenteProduto(indice, "quantidade", Number(e.target.value))} type="number" min="1" className="h-9 w-16" /><Button type="button" size="icon" variant="ghost" aria-label={`Remover componente do produto ${indice + 1}`} onClick={() => removerComponenteProduto(indice)} className="h-9 w-9 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div>}
            <Button type="button" onClick={salvarProdutoComercial} disabled={criarProdutoComercial.isPending} className="w-full">{criarProdutoComercial.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Cadastrar e usar na Venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar cliente em contexto */}
      <Dialog open={novoClienteOpen} onOpenChange={setNovoClienteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={novoClienteForm.nome}
                onChange={(e) => setNovoClienteForm({ ...novoClienteForm, nome: e.target.value })}
                placeholder="Nome completo"
                className="bg-white"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input
                  value={novoClienteForm.contacto}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, contacto: e.target.value })}
                  placeholder="+55 ..."
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={novoClienteForm.nif}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, nif: e.target.value })}
                  placeholder="000.000.000-00"
                  className="bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={novoClienteForm.email}
                onChange={(e) => setNovoClienteForm({ ...novoClienteForm, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={novoClienteForm.morada}
                onChange={(e) => setNovoClienteForm({ ...novoClienteForm, morada: e.target.value })}
                placeholder="Endereço completo"
                className="bg-white"
              />
            </div>
            <Button
              onClick={handleCriarCliente}
              disabled={createCliente.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Criar e Selecionar Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
