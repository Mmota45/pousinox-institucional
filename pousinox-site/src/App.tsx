import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import Home from './pages/Home'
import Produtos from './pages/Produtos'
import Sobre from './pages/Sobre'
import Contato from './pages/Contato'
import Blog from './pages/Blog'
import Segmento from './pages/Segmento'
import CorteLaser from './pages/CorteLaser'
import FixadorPorcelanato from './pages/FixadorPorcelanato'
import FixadorEnsaios from './pages/FixadorEnsaios'
import FixadorNormas from './pages/FixadorNormas'
import FixadorOrcamento from './pages/FixadorOrcamento'
import Outlet from './pages/Outlet'
import ProdutoDetalhe from './pages/ProdutoDetalhe'
import Obrigado from './pages/Obrigado'
import LaudoAcesso from './pages/LaudoAcesso'
import PropostaAcesso from './pages/PropostaAcesso'
import AdminLayout from './components/AdminLayout/AdminLayout'
import AdminCockpit from './pages/AdminCockpit'
import AdminDashboard from './pages/AdminDashboard'
import AdminOutlet from './pages/AdminOutlet'
import AdminEstoque from './pages/AdminEstoque'
import AdminVendas from './pages/AdminVendas'
import AdminCentralVendas from './pages/AdminCentralVendas'
// AdminIA unificado no AdminAssistente
import AdminRelatorios from './pages/AdminRelatorios'
import AdminCanvaCallback from './pages/AdminCanvaCallback'
import AdminAnaliseNF from './pages/AdminAnaliseNF'
import AdminOrcamento from './pages/AdminOrcamento'
import AdminFrete from './pages/AdminFrete'
import AdminPedidosOutlet from './pages/AdminPedidosOutlet'
import Checkout from './pages/Checkout'
import { CartProvider } from './contexts/CartContext'
import CartDrawer from './components/CartDrawer/CartDrawer'
import PedidoStatus from './pages/PedidoStatus'
import AdminCartoes from './pages/AdminCartoes'
import ViewCartao from './pages/ViewCartao'
import AdminUsuarios from './pages/AdminUsuarios'
import AdminConteudo from './pages/AdminConteudo'
import AdminAnalytics from './pages/AdminAnalytics'
import AdminProspeccao from './pages/AdminProspeccao'
import AdminEstudoMercado from './pages/AdminEstudoMercado'
import AdminClientes from './pages/AdminClientes'
import AdminProdutos from './pages/AdminProdutos'
import AdminProjetos from './pages/AdminProjetos'
import AdminFornecedores from './pages/AdminFornecedores'
import AdminFinanceiro from './pages/AdminFinanceiro'
import AdminCampanhas from './pages/AdminCampanhas'
import AdminConciliacao from './pages/AdminConciliacao'
import AdminPipeline from './pages/AdminPipeline'
import AdminProducao from './pages/AdminProducao'
import AdminQualidade from './pages/AdminQualidade'
import AdminManutencao from './pages/AdminManutencao'
import AdminDocsRecebidos from './pages/AdminDocsRecebidos'
import AdminDocsEmitidos from './pages/AdminDocsEmitidos'
import AdminEstoqueMp from './pages/AdminEstoqueMp'
import AdminEstoquePa from './pages/AdminEstoquePa'
import AdminInventario from './pages/AdminInventario'
import AdminSolicitacoesCompra from './pages/AdminSolicitacoesCompra'
import AdminCotacoesCompra from './pages/AdminCotacoesCompra'
import AdminPedidosCompra from './pages/AdminPedidosCompra'
import AdminRecebimentosCompra from './pages/AdminRecebimentosCompra'
import AdminBensFrota from './pages/AdminBensFrota'
import AdminConfiguracaoFinanceiro from './pages/AdminConfiguracaoFinanceiro'
import AdminFeatureFlags from './pages/AdminFeatureFlags'
import AdminFixadores from './pages/AdminFixadores'
import AdminAssistente from './pages/AdminAssistente'
import AdminBancoImagens from './pages/AdminBancoImagens'
import AdminUso from './pages/AdminUso'
// AdminKnowledge unificado no AdminAssistente
import AdminPortfolio from './pages/AdminPortfolio'
import AdminSite from './pages/AdminSite'
import Privacidade from './pages/Privacidade'
import LgpdBanner from './components/LgpdBanner/LgpdBanner'
import PrintOrcamento from './pages/PrintOrcamento'
import PrintEspecificacao from './pages/PrintEspecificacao'
import CalculadoraFixador from './pages/CalculadoraFixador'
import ViewOrcamento from './pages/ViewOrcamento'
import RedirectShortLink from './pages/RedirectShortLink'

const WA_LINK = 'https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento.'

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params: Record<string, string>) {
  window.gtag?.('event', name, params)
}

function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const isFullscreen = location.pathname.startsWith('/print/') || location.pathname.startsWith('/view/') || location.pathname.startsWith('/c/')

  // Troca manifest e título PWA conforme seção (site vs admin)
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null
    if (link) link.href = isAdmin ? '/admin-manifest.json' : '/manifest.json'
    if (appleTitle) appleTitle.content = isAdmin ? 'Admin' : 'Pousinox®'
  }, [isAdmin])

  // Rastreia cliques no WhatsApp
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (!href.includes('wa.me')) return
      trackEvent('whatsapp_click', {
        page: location.pathname || '/',
        source: a.getAttribute('data-source') ?? 'link',
      })
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [location.pathname])

  // Rastreia mudança de página
  useEffect(() => {
    window.gtag?.('event', 'page_view', { page_path: location.pathname })
  }, [location.pathname])

  return (
    <CartProvider>
      {!isAdmin && !isFullscreen && <Header />}
      {!isAdmin && !isFullscreen && <CartDrawer />}
      <main>
        <Routes>
          <Route path="/" element={window.location.hostname.includes('fixadorporcelanato') ? <Navigate to="/fixador-porcelanato/calculadora" replace /> : <Home />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/segmentos/:slug" element={<Segmento />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Blog />} />
          <Route path="/servicos/corte-laser" element={<CorteLaser />} />
          <Route path="/fixador-porcelanato" element={<Navigate to="/fixador-porcelanato/calculadora" replace />} />
          <Route path="/fixador-porcelanato/fachadas" element={<Navigate to="/fixador-porcelanato/calculadora" replace />} />
          <Route path="/fixador-porcelanato/ensaios" element={<FixadorEnsaios />} />
          <Route path="/fixador-porcelanato/testes-lamat" element={<Navigate to="/fixador-porcelanato/ensaios" replace />} />
          <Route path="/fixador-porcelanato/normas" element={<FixadorNormas />} />
          <Route path="/fixador-porcelanato/orcamento" element={<FixadorOrcamento />} />
          <Route path="/fixador-porcelanato/calculadora" element={<CalculadoraFixador />} />
          <Route path="/pronta-entrega" element={<Outlet />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pedido/:codigo" element={<PedidoStatus />} />
          <Route path="/outlet" element={<Navigate to="/pronta-entrega" replace />} />
          <Route path="/produto/:id" element={<ProdutoDetalhe />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="cockpit" element={<AdminCockpit />} />
            <Route path="outlet" element={<AdminOutlet />} />
            <Route path="estoque" element={<AdminEstoque />} />
            <Route path="vendas" element={<AdminVendas />} />
            <Route path="central-vendas" element={<AdminCentralVendas />} />
            <Route path="ia" element={<Navigate to="/admin/assistente" replace />} />
            <Route path="relatorios" element={<AdminRelatorios />} />
            <Route path="configuracao-financeiro" element={<AdminConfiguracaoFinanceiro />} />
            <Route path="analise-nf" element={<AdminAnaliseNF />} />
            <Route path="cartoes" element={<AdminCartoes />} />
            <Route path="orcamento" element={<AdminOrcamento />} />
            <Route path="frete" element={<AdminFrete />} />
            <Route path="pedidos-outlet" element={<AdminPedidosOutlet />} />
            <Route path="usuarios" element={<AdminUsuarios />} />
            <Route path="conteudo" element={<AdminConteudo />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="prospeccao" element={<AdminProspeccao />} />
            <Route path="estudo-mercado" element={<AdminEstudoMercado />} />
            <Route path="clientes" element={<AdminClientes />} />
            <Route path="produtos" element={<AdminProdutos />} />
            <Route path="projetos" element={<AdminProjetos />} />
            <Route path="fornecedores" element={<AdminFornecedores />} />
            <Route path="financeiro" element={<AdminFinanceiro />} />
            <Route path="campanhas"    element={<AdminCampanhas />} />
            <Route path="conciliacao" element={<AdminConciliacao />} />
            <Route path="pipeline"    element={<AdminPipeline />} />
            <Route path="producao"             element={<AdminProducao />} />
            <Route path="qualidade"            element={<AdminQualidade />} />
            <Route path="manutencao"           element={<AdminManutencao />} />
            <Route path="bens-frota"           element={<AdminBensFrota />} />
            <Route path="solicitacoes-compra"  element={<AdminSolicitacoesCompra />} />
            <Route path="cotacoes-compra"      element={<AdminCotacoesCompra />} />
            <Route path="pedidos-compra"       element={<AdminPedidosCompra />} />
            <Route path="recebimentos-compra"  element={<AdminRecebimentosCompra />} />
            <Route path="estoque-mp"           element={<AdminEstoqueMp />} />
            <Route path="estoque-pa"           element={<AdminEstoquePa />} />
            <Route path="inventario"           element={<AdminInventario />} />
            <Route path="docs-recebidos"       element={<AdminDocsRecebidos />} />
            <Route path="docs-emitidos"        element={<AdminDocsEmitidos />} />
            <Route path="feature-flags"       element={<AdminFeatureFlags />} />
            <Route path="fixadores"           element={<AdminFixadores />} />
            <Route path="portfolio"          element={<AdminPortfolio />} />
            <Route path="assistente"          element={<AdminAssistente />} />
            <Route path="banco-imagens"      element={<AdminBancoImagens />} />
            <Route path="uso"                element={<AdminUso />} />
            <Route path="knowledge"          element={<Navigate to="/admin/assistente" replace />} />
            <Route path="site"               element={<AdminSite />} />
            <Route path="canva-callback"    element={<AdminCanvaCallback />} />
          </Route>
          <Route path="/print/orcamento/:id" element={<PrintOrcamento />} />
          <Route path="/print/especificacao/:id" element={<PrintEspecificacao />} />
          <Route path="/c/:slug" element={<ViewCartao />} />
          <Route path="/view/orcamento/:token" element={<ViewOrcamento />} />
          <Route path="/p/:code" element={<RedirectShortLink />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/laudo/:id" element={<LaudoAcesso />} />
          <Route path="/proposta/:id" element={<PropostaAcesso />} />
          <Route path="/obrigado" element={<Obrigado />} />
        </Routes>
      </main>

      {!isAdmin && !isFullscreen && <Footer />}

      {!isAdmin && !isFullscreen && (
        <a href={WA_LINK} target="_blank" rel="noopener noreferrer" aria-label="Falar pelo WhatsApp" className="wa-float" data-source="botao-flutuante">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </a>
      )}

      {!isAdmin && !isFullscreen && <LgpdBanner />}
    </CartProvider>
  )
}

export default App
