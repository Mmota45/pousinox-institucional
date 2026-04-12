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
import FixadorFachadas from './pages/FixadorFachadas'
import FixadorEnsaios from './pages/FixadorEnsaios'
import FixadorNormas from './pages/FixadorNormas'
import FixadorOrcamento from './pages/FixadorOrcamento'
import Outlet from './pages/Outlet'
import Obrigado from './pages/Obrigado'
import AdminLayout from './components/AdminLayout/AdminLayout'
import AdminDashboard from './pages/AdminDashboard'
import AdminOutlet from './pages/AdminOutlet'
import AdminEstoque from './pages/AdminEstoque'
import AdminVendas from './pages/AdminVendas'
import AdminRelatorios from './pages/AdminRelatorios'
import AdminAnaliseNF from './pages/AdminAnaliseNF'
import AdminOrcamento from './pages/AdminOrcamento'
import AdminUsuarios from './pages/AdminUsuarios'
import AdminConteudo from './pages/AdminConteudo'
import AdminAnalytics from './pages/AdminAnalytics'
import AdminProspeccao from './pages/AdminProspeccao'
import AdminCobertura from './pages/AdminCobertura'
import AdminFunil from './pages/AdminFunil'
import AdminLeads from './pages/AdminLeads'
import AdminClientes from './pages/AdminClientes'
import AdminProdutos from './pages/AdminProdutos'
import AdminProjetos from './pages/AdminProjetos'

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

  // Troca manifest e título PWA conforme seção (site vs admin)
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null
    if (link) link.href = isAdmin ? '/admin-manifest.json' : '/manifest.json'
    if (appleTitle) appleTitle.content = isAdmin ? 'Admin' : 'Pousinox'
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
    <>
      {!isAdmin && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/segmentos/:slug" element={<Segmento />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Blog />} />
          <Route path="/servicos/corte-laser" element={<CorteLaser />} />
          <Route path="/fixador-porcelanato" element={<FixadorPorcelanato />} />
          <Route path="/fixador-porcelanato/fachadas" element={<FixadorFachadas />} />
          <Route path="/fixador-porcelanato/ensaios" element={<FixadorEnsaios />} />
          <Route path="/fixador-porcelanato/testes-lamat" element={<Navigate to="/fixador-porcelanato/ensaios" replace />} />
          <Route path="/fixador-porcelanato/normas" element={<FixadorNormas />} />
          <Route path="/fixador-porcelanato/orcamento" element={<FixadorOrcamento />} />
          <Route path="/pronta-entrega" element={<Outlet />} />
          <Route path="/outlet" element={<Navigate to="/pronta-entrega" replace />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="outlet" element={<AdminOutlet />} />
            <Route path="estoque" element={<AdminEstoque />} />
            <Route path="vendas" element={<AdminVendas />} />
            <Route path="relatorios" element={<AdminRelatorios />} />
            <Route path="analise-nf" element={<AdminAnaliseNF />} />
            <Route path="orcamento" element={<AdminOrcamento />} />
            <Route path="usuarios" element={<AdminUsuarios />} />
            <Route path="conteudo" element={<AdminConteudo />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="prospeccao" element={<AdminProspeccao />} />
            <Route path="cobertura" element={<AdminCobertura />} />
            <Route path="funil" element={<AdminFunil />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="clientes" element={<AdminClientes />} />
            <Route path="produtos" element={<AdminProdutos />} />
            <Route path="projetos" element={<AdminProjetos />} />
          </Route>
          <Route path="/obrigado" element={<Obrigado />} />
        </Routes>
      </main>

      {!isAdmin && <Footer />}

      {!isAdmin && (
        <a href={WA_LINK} target="_blank" rel="noopener noreferrer" aria-label="Falar pelo WhatsApp" className="wa-float" data-source="botao-flutuante">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </a>
      )}
    </>
  )
}

export default App
