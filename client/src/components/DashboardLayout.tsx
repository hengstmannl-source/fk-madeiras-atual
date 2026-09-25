import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Bell, ChevronDown, CircleDollarSign, LayoutDashboard, LogOut, Moon, PanelLeft, Search, Sun, Users,
  FileText, Building2, BadgeCheck, WalletCards, ArrowDownToLine,
  ArrowUpFromLine, Warehouse, Factory, Fuel, ClipboardCheck, Landmark, FileWarning, Truck, CircleCheckBig, ReceiptText, TreePine,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

type NavigationItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  disabled?: boolean;
};

export const dashboardNavigation = {
  principal: [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  ],
  financeiro: [
    { icon: WalletCards, label: "Financeiro", path: "/financeiro" },
    { icon: ArrowUpFromLine, label: "Contas a pagar", path: "/financeiro?tipo=pagar" },
    { icon: ArrowDownToLine, label: "Contas a receber", path: "/financeiro?tipo=receber" },
    { icon: BadgeCheck, label: "Contas pagas", path: "/financeiro?tipo=pagas" },
    { icon: CircleDollarSign, label: "Contas recebidas", path: "/financeiro?tipo=recebidas" },
    { icon: ReceiptText, label: "Caixa Cheque", path: "/financeiro/caixa-cheque" },
    { icon: Landmark, label: "Conciliação bancária", path: "/conciliacao-bancaria" },
    { icon: TreePine, label: "Rentabilidade da madeira", path: "/financeiro/rentabilidade-madeira" },
  ],
  vendas: [
    { icon: FileText, label: "Vendas", path: "/orcamentos" },
    { icon: BadgeCheck, label: "Aprovados", path: "/orcamentos/aprovados" },
    { icon: CircleDollarSign, label: "Pagas", path: "/orcamentos/pagas" },
    { icon: Truck, label: "Entregues", path: "/orcamentos/entregues" },
    { icon: CircleCheckBig, label: "Concluídas", path: "/orcamentos/concluidas" },
    { icon: CircleDollarSign, label: "Acerto comercial", path: "/orcamentos/margem" },
  ],
  gestao: [
    { icon: Users, label: "Clientes", path: "/clientes" },
    { icon: Building2, label: "Empresa", path: "/empresa" },
    { icon: Users, label: "RH — Funcionários", path: "/rh" },
  ],
  producao: [
    { icon: Factory, label: "Produção", path: "/producao" },
    { icon: Warehouse, label: "Estoque", path: "/estoque" },
    { icon: FileWarning, label: "Relatório de plaquetas", path: "/estoque/plaquetas" },
    { icon: ClipboardCheck, label: "Inventário", path: "/inventario" },
  ],
  combustivel: [
    { icon: Fuel, label: "Diesel", path: "/diesel" },
  ],
} satisfies Record<string, NavigationItem[]>;

export const dashboardMenuItems = Object.values(dashboardNavigation).flat();

export function getNavigationPresentation(isMobile: boolean) {
  return {
    collapsible: "icon" as const,
    showMobileHeader: isMobile,
    groups: ["Financeiro", "Vendas", "Gestão", "Produção", "Combustível"],
  };
}

export function handleNavigationItemClick(
  item: NavigationItem,
  navigate: (path: string) => void,
  notify: (message: string) => void,
) {
  if (item.disabled) {
    notify(getFutureModuleMessage(item.label));
    return;
  }
  navigate(item.path);
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const SIDEBAR_GROUPS_KEY = "sidebar-expanded-groups";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export function gruposExpandidosIniciais(valorSalvo: string | null): Record<string, boolean> {
  const padrao = Object.fromEntries(getNavigationPresentation(false).groups.map((grupo) => [grupo, true]));
  if (!valorSalvo) return padrao;
  try {
    const grupos = JSON.parse(valorSalvo) as Record<string, unknown>;
    return Object.fromEntries(Object.keys(padrao).map((grupo) => [grupo, grupos[grupo] !== false]));
  } catch {
    return padrao;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const contextoQuery = trpc.auth.contexto.useQuery(undefined, { retry: false, staleTime: 0 });
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { theme, toggleTheme } = useTheme();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = dashboardMenuItems.find((item) => isItemActive(item, location, search));
  const isMobile = useIsMobile();
  const navigationPresentation = getNavigationPresentation(isMobile);
  const [gruposExpandidos, setGruposExpandidos] = useState(() => gruposExpandidosIniciais(localStorage.getItem(SIDEBAR_GROUPS_KEY)));
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const empresa = contextoQuery.data?.empresa;
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.nome || "FK Madeiras";
  const alertas = trpc.financeiro.alertas.list.useQuery(undefined, { staleTime: 60_000 });
  const resultadosBusca = dashboardMenuItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(termoBusca.toLocaleLowerCase("pt-BR"))).slice(0, 7);

  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);
  useEffect(() => { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(gruposExpandidos)); }, [gruposExpandidos]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible={navigationPresentation.collapsible} className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-[4.25rem] justify-center border-b border-sidebar-border/70">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-sidebar-primary-foreground text-xs font-extrabold">FK</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold tracking-tight truncate text-sm text-sidebar-foreground">FK Madeiras</span>
                    <span className="text-[10px] text-sidebar-foreground/65 truncate" title={nomeEmpresa}>{nomeEmpresa}</span>
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                  <span className="text-sidebar-primary-foreground text-xs font-bold">FK</span>
                </div>
              )}
              {!isCollapsed && <button onClick={toggleTheme} title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-3">
            <SidebarMenu>
              {dashboardNavigation.principal.map((item) => <NavigationButton key={item.path} item={item} location={location} search={search} navigate={setLocation} />)}
            </SidebarMenu>
            <NavigationGroup label="Financeiro" items={dashboardNavigation.financeiro} location={location} search={search} navigate={setLocation} renderPrincipal open={gruposExpandidos.Financeiro} onOpenChange={(aberto) => setGruposExpandidos((grupos) => ({ ...grupos, Financeiro: aberto }))} />
            <NavigationGroup label="Vendas" items={dashboardNavigation.vendas} location={location} search={search} navigate={setLocation} open={gruposExpandidos.Vendas} onOpenChange={(aberto) => setGruposExpandidos((grupos) => ({ ...grupos, Vendas: aberto }))} />
            <NavigationGroup label="Gestão" items={dashboardNavigation.gestao} location={location} search={search} navigate={setLocation} open={gruposExpandidos.Gestão} onOpenChange={(aberto) => setGruposExpandidos((grupos) => ({ ...grupos, Gestão: aberto }))} />
            <NavigationGroup label="Produção" items={dashboardNavigation.producao} location={location} search={search} navigate={setLocation} open={gruposExpandidos.Produção} onOpenChange={(aberto) => setGruposExpandidos((grupos) => ({ ...grupos, Produção: aberto }))} />
            <NavigationGroup label="Combustível" items={dashboardNavigation.combustivel} location={location} search={search} navigate={setLocation} open={gruposExpandidos.Combustível} onOpenChange={(aberto) => setGruposExpandidos((grupos) => ({ ...grupos, Combustível: aberto }))} />
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user?.name || "Utilizador"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem disabled className="gap-2 opacity-100">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate font-medium">{nomeEmpresa}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Terminar Sessão</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  <span>{theme === "dark" ? "Usar modo claro" : "Usar modo escuro"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (isCollapsed) return; setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="fk-workspace">
        <header className="fk-topbar sticky top-0 z-30">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg border border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground" />
            <div className="hidden min-w-0 sm:block">
              <p className="fk-eyebrow">Operação FK Madeiras</p>
              <p className="truncate text-sm font-semibold text-foreground">{activeMenuItem?.label ?? "Dashboard"}</p>
            </div>
            <div className="relative ml-auto hidden w-full max-w-sm md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Pesquisar módulos" value={termoBusca} onFocus={() => setBuscaAberta(true)} onChange={(event) => { setTermoBusca(event.target.value); setBuscaAberta(true); }} onKeyDown={(event) => { if (event.key === "Escape") setBuscaAberta(false); if (event.key === "Enter" && resultadosBusca[0]) { setLocation(resultadosBusca[0].path); setBuscaAberta(false); setTermoBusca(""); } }} placeholder="Pesquisar módulos…" className="h-9 w-full rounded-lg border border-border/70 bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />
              {buscaAberta && termoBusca.trim() ? <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"><p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ir para</p>{resultadosBusca.length ? resultadosBusca.map((item) => <button key={item.path} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setLocation(item.path); setBuscaAberta(false); setTermoBusca(""); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"><item.icon className="h-4 w-4 text-primary" /><span>{item.label}</span></button>) : <p className="px-2 py-2 text-sm text-muted-foreground">Nenhum módulo encontrado.</p>}</div> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={toggleTheme} title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <button type="button" onClick={() => setLocation("/financeiro")} aria-label="Ver alertas financeiros" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Bell className="h-4 w-4" />{alertas.data?.length ? <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-4 text-white">{alertas.data.length > 9 ? "9+" : alertas.data.length}</span> : null}</button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </SidebarInset>
    </>
  );
}

export function isItemActive(item: NavigationItem, location: string, search = "") {
  if (item.path === "/") return location === "/";
  if (item.path === "/orcamentos") return location === "/orcamentos" || (location.startsWith("/orcamentos/") && !["/orcamentos/aprovados", "/orcamentos/pagas", "/orcamentos/entregues", "/orcamentos/concluidas"].some((rota) => location.startsWith(rota)));
  if (item.path.startsWith("/financeiro?")) {
    const [, itemSearch = ""] = item.path.split("?");
    return location === "/financeiro" && new URLSearchParams(search).get("tipo") === new URLSearchParams(itemSearch).get("tipo");
  }
  return location === item.path || (item.path !== "/financeiro" && location.startsWith(item.path));
}

function NavigationButton({ item, location, search, navigate }: { item: NavigationItem; location: string; search: string; navigate: (path: string) => void }) {
  const active = isItemActive(item, location, search);
  return <SidebarMenuItem><SidebarMenuButton isActive={active} onClick={() => navigate(item.path)} tooltip={item.label} className="h-10 transition-all font-medium text-sm"><item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
}

export function getFutureModuleMessage(label: string) {
  return `${label} será disponibilizado em uma próxima etapa.`;
}

function NavigationGroup({ label, items, location, search, navigate, renderPrincipal = false, open, onOpenChange }: { label: string; items: NavigationItem[]; location: string; search: string; navigate: (path: string) => void; renderPrincipal?: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const principal = renderPrincipal ? items[0] : undefined;
  const subitems = renderPrincipal ? items.slice(1) : items;
  return <Collapsible open={open} onOpenChange={onOpenChange} className="mt-2"><div className="flex items-center px-2 pb-1 group-data-[collapsible=icon]:hidden"><p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/80">{label}</p><CollapsibleTrigger asChild><button type="button" aria-label={`${open ? "Recolher" : "Expandir"} grupo ${label}`} className="flex h-5 w-5 items-center justify-center rounded text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} /></button></CollapsibleTrigger></div><CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 group-data-[collapsible=icon]:hidden"><SidebarMenu>{principal ? <NavigationButton item={principal} location={location} search={search} navigate={navigate} /> : null}<SidebarMenuSub>{subitems.map((item) => { const active = isItemActive(item, location, search); return <SidebarMenuSubItem key={item.path}><SidebarMenuSubButton isActive={active} onClick={() => handleNavigationItemClick(item, navigate, toast.info)} className={item.disabled ? "text-sidebar-foreground/60" : "font-medium"}><item.icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-sidebar-foreground"}`} /><span>{item.label}</span>{item.disabled ? <span className="ml-auto text-[10px] text-sidebar-foreground/70">Em breve</span> : null}</SidebarMenuSubButton></SidebarMenuSubItem>; })}</SidebarMenuSub></SidebarMenu></CollapsibleContent></Collapsible>;
}
