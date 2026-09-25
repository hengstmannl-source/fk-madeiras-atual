import { type KeyboardEvent, useState, useMemo } from "react";
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
import {
  calculateVolume,
  formatCurrency,
  formatMeasurement,
} from "@/lib/utils";
import { criarItemVendaComercial, criarItensVendaPorMedida, criarLinhasComprimentoPadraoVenda, obterIndiceTabPorColunaVenda, resumirItensVendaPorBitola, rotulosTipoComercializacaoVenda, type ComponentePacoteVenda, type LinhaComprimentoVenda, type TipoComercializacaoVenda } from "@/lib/vendaItemGroup";
import { disponibilidadeEstoqueVenda, prepararModeloMedida } from "@/lib/vendaMedidas";
import { calcularAcertoComercial, type TaxaAdicionalComercial } from "@/lib/acertoComercial";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ItemOrcamento {
  madeiraId: number | null;
  bitolaId: number | null;
  produtoComercialId: number | null;
  madeiraNome: string;
  bitolaDescricao: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  tipoComercializacao: TipoComercializacaoVenda;
  unidadesPorComercializacao: number;
  precoM3: string;
  precoLinear: string;
  valorPeca: string;
  valorTotal: string;
  componentesPacote: ComponentePacoteVenda[];
}

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
  const clientes = trpc.cliente.list.useQuery();

  const [clienteId, setClienteId] = useState("");
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

  const clienteSelecionado = clientes.data?.find((cliente) => cliente.id === Number(clienteId));
  const opcoesMadeira = useMemo(() => (madeiras.data ?? []).map((madeira) => ({
    value: String(madeira.id),
    label: madeira.nome,
    details: `Preço padrão: ${formatCurrency(madeira.precoM3)}/m³`,
  })), [madeiras.data]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalPecas = 0;
    let totalMetroLinear = 0;
    let totalVolume = 0;
    for (const item of itens) {
      const q = item.quantidade;
      const vp = parseFloat(item.valorPeca) || 0;
      const comp = parseFloat(item.comprimento) || 0;
      const esp = parseFloat(item.espessura) || 0;
      const larg = parseFloat(item.largura) || 0;
      subtotal += vp * q;
      totalPecas += q;
      totalMetroLinear += comp * q;
      totalVolume += calculateVolume(esp, larg, comp, q);
    }
    for (const item of aproveitamentosVenda) {
      const volume = Number(item.volume.replace(",", ".")) || 0;
      const precoM3 = Number(item.precoM3.replace(",", ".")) || 0;
      subtotal += volume * precoM3;
      totalVolume += volume;
    }
    const acerto = calcularAcertoComercial({ subtotal, desconto, fretePorTonelada: frete, pesoCargaToneladas, comissaoTipo, comissaoValor, taxas: taxasAdicionais });
    return { subtotal, totalPecas, totalMetroLinear, totalVolume, ...acerto };
  }, [itens, aproveitamentosVenda, desconto, frete, pesoCargaToneladas, comissaoTipo, comissaoValor, taxasAdicionais]);

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

  const adicionarTaxaAdicional = () => setTaxasAdicionais((taxas) => [...taxas, { descricao: "", tipo: "percentual", valor: "0" }]);
  const atualizarTaxaAdicional = (indice: number, campo: keyof TaxaAdicionalComercial, valor: string) => setTaxasAdicionais((taxas) => taxas.map((taxa, index) => index === indice ? { ...taxa, [campo]: valor } : taxa));
  const removerTaxaAdicional = (indice: number) => setTaxasAdicionais((taxas) => taxas.filter((_, index) => index !== indice));

  const aproveitamentosDisponiveis = useMemo(() => (estoqueSerrado.data ?? [])
    .filter((item) => String(item.madeiraNome ?? "").toLocaleLowerCase("pt-BR").startsWith("aproveitamento de ")),
    [estoqueSerrado.data]);

  const adicionarAproveitamento = () => {
    const volume = Number(aproveitamentoForm.volume.replace(",", "."));
    const precoM3 = Number(aproveitamentoForm.precoM3.replace(",", "."));
    if (!aproveitamentoForm.madeiraNome || !Number.isFinite(volume) || volume <= 0) { toast.error("Selecione o aproveitamento e informe um volume positivo"); return; }
    if (!Number.isFinite(precoM3) || precoM3 < 0) { toast.error("Informe um preço por m³ válido"); return; }
    setAproveitamentosVenda((atuais) => [...atuais, { ...aproveitamentoForm, volume: String(volume), precoM3: String(precoM3) }]);
    setAproveitamentoForm({ madeiraNome: "", volume: "", precoM3: "" });
  };

  const create = trpc.orcamento.create.useMutation();
  const utils = trpc.useUtils();

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
    if (!clienteId) { toast.error("Selecione um cliente"); return; }
    if (itens.length === 0 && aproveitamentosVenda.length === 0) { toast.error("Adicione pelo menos um item ou aproveitamento"); return; }
    create.mutate({
      clienteId: Number(clienteId),
      estado,
      desconto,
      frete: String(totals.abatimentoFrete.toFixed(2)),
      fretePorTonelada: frete || undefined,
      pesoCargaToneladas: pesoCargaToneladas || undefined,
      abatimentoFrete: String(totals.abatimentoFrete.toFixed(2)),
      baseAposFrete: String(totals.baseAposFrete.toFixed(2)),
      comissaoTipo,
      comissaoValor: comissaoValor || undefined,
      comissaoCalculada: String(totals.comissaoCalculada.toFixed(2)),
      taxasAdicionais: totals.taxasCalculadas
        .filter((taxa) => taxa.descricao.trim() || Number(taxa.valor.replace(",", ".")) > 0)
        .map((taxa) => ({ descricao: taxa.descricao.trim(), tipo: taxa.tipo, valor: taxa.valor })),
      subtotal: String(totals.subtotal.toFixed(2)),
      total: String(totals.total.toFixed(2)),
      totalPecas: totals.totalPecas,
      totalMetroLinear: String(totals.totalMetroLinear.toFixed(2)),
      totalVolume: String(totals.totalVolume.toFixed(4)),
      observacoes: observacoes || undefined,
      vendedor: vendedor || undefined,
      dataVencimento,
      competencia,
      itens,
      aproveitamentos: aproveitamentosVenda,
    }, {
      onSuccess: () => { toast.success(estado === "enviado" ? "Venda enviada!" : "Venda salva!"); utils.orcamento.list.invalidate(); setLocation("/orcamentos"); },
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/orcamentos")} className="mb-2 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nova Venda</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre a venda de madeira serrada e programe o recebimento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-4">Dados da Venda</h3>
              <div className="space-y-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Nome do vendedor" className="bg-white" />
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
              {aproveitamentosVenda.length > 0 && <div className="mt-4 space-y-2">{aproveitamentosVenda.map((item, index) => <div key={`${item.madeiraNome}-${index}`} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2"><div><p className="text-sm font-medium">{item.madeiraNome}</p><p className="text-xs text-muted-foreground">{formatMeasurement(item.volume)} m³ × {formatCurrency(item.precoM3)}/m³ = {formatCurrency(String(Number(item.volume.replace(",", ".")) * Number(item.precoM3.replace(",", "."))))}</p></div><Button type="button" aria-label={`Remover ${item.madeiraNome}`} variant="ghost" size="icon" className="text-destructive" onClick={() => setAproveitamentosVenda((atuais) => atuais.filter((_, atual) => atual !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
            </CardContent>
          </Card>

          {/* Itens */}
          {itens.length > 0 && (
            <Card className="border border-border/50 shadow-sm">
              <CardContent className="p-5">
                <h3 className="font-semibold text-sm mb-4">Itens da Venda ({itens.length})</h3>
                <div className="space-y-2">
                  {itens.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.madeiraNome}{item.tipoComercializacao === "metro_cubico" ? ` — ${item.bitolaDescricao} × ${item.comprimento}m` : ` — ${rotulosTipoComercializacaoVenda[item.tipoComercializacao]}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantidade} {item.tipoComercializacao === "unidade" ? "un." : item.tipoComercializacao === "pacote" ? "pacote(s)" : "pcs"} × {formatCurrency(item.valorPeca)} = {formatCurrency(item.valorTotal)}
                        </p>
                        {item.tipoComercializacao === "pacote" && item.componentesPacote.length > 0 && <p className="mt-1 text-xs text-primary">Composição: {item.componentesPacote.map((componente) => `${componente.quantidade}× ${componente.descricao}`).join(" · ")}</p>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
              <Separator />
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal bruto</span><span className="font-medium">{formatCurrency(String(totals.subtotal))}</span></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Desconto</Label>
                    <Input type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} className="w-24 h-8 text-right bg-white" />
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-900">Frete abatido do pedido</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">R$/tonelada</Label><Input aria-label="Frete por tonelada" type="number" value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" className="h-8 bg-white text-right" /></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Peso (t)</Label><Input aria-label="Peso da carga em toneladas" type="number" value={pesoCargaToneladas} onChange={(e) => setPesoCargaToneladas(e.target.value)} placeholder="0,000" className="h-8 bg-white text-right" /></div>
                    </div>
                    <div className="flex justify-between text-xs"><span>Abatimento de frete</span><span className="font-semibold text-amber-800">− {formatCurrency(String(totals.abatimentoFrete))}</span></div>
                  </div>
                  <div className="flex justify-between text-sm rounded bg-muted/50 px-2 py-1.5"><span className="text-muted-foreground">Base após frete</span><span className="font-semibold">{formatCurrency(String(totals.baseAposFrete))}</span></div>
                  <div className="rounded-md border border-border/70 p-3 space-y-2">
                    <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Comissão do vendedor</Label><select aria-label="Tipo de comissão" value={comissaoTipo} onChange={(e) => setComissaoTipo(e.target.value as "percentual" | "fixo")} className="h-7 rounded border bg-white px-1 text-xs"><option value="percentual">%</option><option value="fixo">R$ fixo</option></select></div>
                    <div className="flex gap-2"><Input aria-label="Valor da comissão" type="number" value={comissaoValor} onChange={(e) => setComissaoValor(e.target.value)} placeholder={comissaoTipo === "percentual" ? "0,00 %" : "0,00"} className="h-8 bg-white text-right" /><span className="flex items-center whitespace-nowrap text-xs font-medium">− {formatCurrency(String(totals.comissaoCalculada))}</span></div>
                  </div>
                  <div className="rounded-md border border-border/70 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3"><div><Label className="text-xs font-semibold">Taxas adicionais</Label><p className="mt-0.5 text-[11px] text-muted-foreground">São cobradas do cliente e somadas ao valor final.</p></div><Button type="button" variant="outline" size="sm" onClick={adicionarTaxaAdicional} className="h-7 px-2 text-xs"><Plus className="mr-1 h-3.5 w-3.5" />Adicionar taxa</Button></div>
                    {taxasAdicionais.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma taxa adicional aplicada.</p> : taxasAdicionais.map((taxa, indice) => (
                      <div key={indice} className="rounded border border-dashed border-border/80 p-2 space-y-2">
                        <div className="flex items-center gap-2"><Input aria-label={`Descrição da taxa ${indice + 1}`} value={taxa.descricao} onChange={(e) => atualizarTaxaAdicional(indice, "descricao", e.target.value)} placeholder="Ex.: ICMS do frete" className="h-8 bg-white text-sm" /><Button type="button" variant="ghost" size="icon" onClick={() => removerTaxaAdicional(indice)} aria-label={`Remover taxa ${indice + 1}`} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                        <div className="flex gap-2"><select aria-label={`Tipo de taxa ${indice + 1}`} value={taxa.tipo} onChange={(e) => atualizarTaxaAdicional(indice, "tipo", e.target.value)} className="h-8 rounded border bg-white px-2 text-xs"><option value="percentual">%</option><option value="fixo">R$ fixo</option></select><Input aria-label={`Valor da taxa ${indice + 1}`} type="number" value={taxa.valor} onChange={(e) => atualizarTaxaAdicional(indice, "valor", e.target.value)} placeholder={taxa.tipo === "percentual" ? "0,00 %" : "0,00"} className="h-8 bg-white text-right" /><span className="flex items-center whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-300">+ {formatCurrency(String(totals.taxasCalculadas[indice]?.calculado ?? 0))}</span></div>
                      </div>
                    ))}
                    {taxasAdicionais.length > 0 && <div className="flex justify-between text-xs"><span>Total das taxas</span><span className="font-semibold text-emerald-700 dark:text-emerald-300">+ {formatCurrency(String(totals.taxaCalculada))}</span></div>}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span>Valor final do pedido</span><span className="text-primary">{formatCurrency(String(totals.total))}</span></div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Itens</p><p className="font-semibold text-sm">{totals.totalPecas}</p></div>
                <div><p className="text-xs text-muted-foreground">M. Linear</p><p className="font-semibold text-sm">{formatMeasurement(totals.totalMetroLinear)} m</p></div>
                <div><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold text-sm">{formatMeasurement(totals.totalVolume)} m³</p></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="space-y-2"><Label className="text-sm">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas adicionais" className="bg-white text-sm" rows={3} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => handleSave("rascunho")} disabled={!clienteId || itens.length === 0} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />Salvar venda
                </Button>
                <Button onClick={() => handleSave("enviado")} disabled={!clienteId || itens.length === 0} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Send className="h-4 w-4 mr-2" />Enviar venda
                </Button>
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
