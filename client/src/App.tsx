import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import MadeirasPage from "./pages/MadeirasPage";
import ClientesPage from "./pages/ClientesPage";
import ClientePerfilPage from "./pages/ClientePerfilPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import OrcamentoNovo from "./pages/OrcamentoNovo";
import OrcamentoEdit from "./pages/OrcamentoEdit";
import EmpresaPage from "./pages/EmpresaPage";
import OrcamentosAprovadosPage from "./pages/OrcamentosAprovadosPage";
import RelatorioMargemVendasPage from "./pages/RelatorioMargemVendasPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import CaixaChequePage from "./pages/CaixaChequePage";
import ConciliacaoBancariaPage from "./pages/ConciliacaoBancariaPage";
import ProducaoPage from "./pages/ProducaoPage";
import EstoquePage from "./pages/EstoquePage";
import RelatorioPlaquetasPage from "./pages/RelatorioPlaquetasPage";
import InventarioPage from "./pages/InventarioPage";
import DieselPage from "./pages/DieselPage";
import EquipePage from "./pages/EquipePage";
import { RhFichasFinanceiras } from "./pages/RhFichasFinanceiras";
import RentabilidadeMadeiraPage from "./pages/RentabilidadeMadeiraPage";
import { CadastroEmpresaPage, ConvitePage, LoginPage } from "./pages/AcessoPage";
import { tratarAtalhosProducao } from "./lib/producaoKeyboardShortcuts";

function ProducaoComAtalhos() {
  return <div onKeyDown={tratarAtalhosProducao}><ProducaoPage /></div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={CadastroEmpresaPage} />
      <Route path="/convite/:token" component={ConvitePage} />
      <Route>
        <DashboardLayout>
          <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/madeiras" component={MadeirasPage} />
        <Route path="/clientes/:id" component={ClientePerfilPage} />
        <Route path="/clientes" component={ClientesPage} />
        <Route path="/vendas/aprovadas" component={OrcamentosAprovadosPage} />
        <Route path="/vendas/pagas" component={OrcamentosAprovadosPage} />
        <Route path="/vendas/entregues" component={OrcamentosAprovadosPage} />
        <Route path="/vendas/concluidas" component={OrcamentosAprovadosPage} />
        <Route path="/orcamentos/aprovados" component={OrcamentosAprovadosPage} />
        <Route path="/orcamentos/pagas" component={OrcamentosAprovadosPage} />
        <Route path="/orcamentos/entregues" component={OrcamentosAprovadosPage} />
        <Route path="/orcamentos/concluidas" component={OrcamentosAprovadosPage} />
        <Route path="/vendas/margem" component={RelatorioMargemVendasPage} />
        <Route path="/orcamentos/margem" component={RelatorioMargemVendasPage} />
        <Route path="/vendas/novo" component={OrcamentoNovo} />
        <Route path="/vendas/:id" component={OrcamentoEdit} />
        <Route path="/vendas" component={OrcamentosPage} />
        <Route path="/orcamentos" component={OrcamentosPage} />
        <Route path="/orcamentos/novo" component={OrcamentoNovo} />
        <Route path="/orcamentos/:id" component={OrcamentoEdit} />
        <Route path="/financeiro" component={FinanceiroPage} />
        <Route path="/financeiro/rentabilidade-madeira" component={RentabilidadeMadeiraPage} />
        <Route path="/financeiro/caixa-cheque" component={CaixaChequePage} />
        <Route path="/conciliacao-bancaria" component={ConciliacaoBancariaPage} />
        <Route path="/producao" component={ProducaoComAtalhos} />
        <Route path="/estoque" component={EstoquePage} />
        <Route path="/estoque/plaquetas" component={RelatorioPlaquetasPage} />
        <Route path="/inventario" component={InventarioPage} />
        <Route path="/diesel" component={DieselPage} />
        <Route path="/rh" component={RhFichasFinanceiras} />
            <Route path="/empresa" component={EmpresaPage} />
            <Route path="/equipe" component={EquipePage} />
        <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
