import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, Outlet as RouterOutlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { AdminContext } from '../../contexts/AdminContext'
import logomarca from '../../assets/logomarca.png'
import styles from './AdminLayout.module.css'

interface Perfil {
  nome: string
  permissoes: string[]
  ativo: boolean
}

const ROTA_PERMISSAO: Record<string, string> = {
  '': 'dashboard',
  outlet: 'outlet',
  estoque: 'estoque',
  vendas: 'vendas',
  relatorios: 'relatorios',
  'analise-nf': 'analise-nf',
  orcamento: 'orcamento',
  usuarios: 'usuarios',
  conteudo: 'conteudo',
  analytics: 'analytics',
  produtos: 'produtos',
  projetos: 'projetos',
  fornecedores: 'fornecedores',
  financeiro: 'financeiro',
  campanhas:    'campanhas',
  conciliacao:  'conciliacao',
  pipeline:     'pipeline',
  producao:              'producao',
  qualidade:             'qualidade',
  manutencao:            'manutencao',
  'bens-frota':          'bens-frota',
  'solicitacoes-compra': 'solicitacoes-compra',
  'cotacoes-compra':     'cotacoes-compra',
  'pedidos-compra':      'pedidos-compra',
  'recebimentos-compra': 'recebimentos-compra',
  'estoque-mp':          'estoque-mp',
  'estoque-pa':          'estoque-pa',
  inventario:            'inventario',
  'docs-recebidos':      'docs-recebidos',
  'docs-emitidos':       'docs-emitidos',
  'configuracao-financeiro': 'configuracao-financeiro',
}

const TODAS_PERMISSOES = ['dashboard', 'outlet', 'estoque', 'vendas', 'relatorios', 'analise-nf', 'orcamento', 'usuarios', 'conteudo', 'analytics', 'prospeccao', 'cobertura', 'funil', 'clientes', 'produtos', 'projetos', 'fornecedores', 'financeiro', 'campanhas', 'conciliacao', 'pipeline', 'producao', 'qualidade', 'manutencao', 'solicitacoes-compra', 'cotacoes-compra', 'pedidos-compra', 'recebimentos-compra', 'estoque-mp', 'estoque-pa', 'inventario', 'docs-recebidos', 'docs-emitidos', 'bens-frota', 'estudo-mercado', 'configuracao-financeiro']

interface NavItem {
  to: string
  end?: boolean
  label: string
  permissao: string | null
  badge?: string
  section?: string  // quando definido, renderiza separador com esse título antes do item
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  // ── Dashboard ────────────────────────────────────────────────────────────────
  {
    to: '/admin',
    end: true,
    label: 'Dashboard',
    permissao: 'dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },

  // ── Comercial ────────────────────────────────────────────────────────────────
  {
    section: 'Comercial',
    to: '/admin/prospeccao',
    label: 'Prospecção',
    permissao: 'prospeccao',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    ),
  },
  {
    to: '/admin/cobertura',
    label: 'Cobertura',
    permissao: 'cobertura',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
    ),
  },
  {
    to: '/admin/funil',
    label: 'Funil',
    permissao: 'funil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
    ),
  },
  {
    to: '/admin/estudo-mercado',
    label: 'Estudo de Mercado',
    permissao: 'estudo-mercado',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    to: '/admin/pipeline',
    label: 'Pipeline',
    permissao: 'pipeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        <line x1="12" y1="7" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/admin/orcamento',
    label: 'Orçamentos',
    permissao: 'orcamento',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/admin/vendas',
    label: 'Pedidos / Vendas',
    permissao: 'vendas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
    to: '/admin/clientes',
    label: 'Clientes',
    permissao: 'clientes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },

  // ── Marketing ────────────────────────────────────────────────────────────────
  {
    section: 'Marketing',
    to: '/admin/leads',
    label: 'Leads do Site',
    permissao: 'prospeccao',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    to: '/admin/campanhas',
    label: 'Campanhas WPP',
    permissao: 'campanhas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
      </svg>
    ),
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    permissao: 'analytics',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <polyline points="22 12 18 16 14 12"/>
      </svg>
    ),
  },
  {
    to: '/admin/conteudo',
    label: 'Conteúdo do Site',
    permissao: 'conteudo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },

  // ── Catálogo ─────────────────────────────────────────────────────────────────
  {
    section: 'Catálogo',
    to: '/admin/produtos',
    label: 'Produtos',
    permissao: 'produtos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    to: '/admin/outlet',
    label: 'Pronta Entrega',
    permissao: 'outlet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
  },

  // ── Compras ──────────────────────────────────────────────────────────────────
  {
    section: 'Compras',
    to: '/admin/fornecedores',
    label: 'Fornecedores',
    permissao: 'fornecedores',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to: '/admin/solicitacoes-compra',
    label: 'Solicitações',
    permissao: 'solicitacoes-compra',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
    ),
  },
  {
    to: '/admin/cotacoes-compra',
    label: 'Cotações',
    permissao: 'cotacoes-compra',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
  },
  {
    to: '/admin/pedidos-compra',
    label: 'Pedidos de Compra',
    permissao: 'pedidos-compra',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    to: '/admin/recebimentos-compra',
    label: 'Recebimentos',
    permissao: 'recebimentos-compra',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12"/>
        <rect x="2" y="7" width="20" height="5"/>
        <line x1="12" y1="22" x2="12" y2="7"/>
        <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
        <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
      </svg>
    ),
  },

  // ── Estoque ──────────────────────────────────────────────────────────────────
  {
    section: 'Estoque',
    to: '/admin/estoque',
    label: 'Estoque Outlet',
    permissao: 'estoque',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    to: '/admin/estoque-mp',
    label: 'Matéria-Prima',
    permissao: 'estoque-mp',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    to: '/admin/estoque-pa',
    label: 'Produto Acabado',
    permissao: 'estoque-pa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
  {
    to: '/admin/inventario',
    label: 'Inventário',
    permissao: 'inventario',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },

  // ── Operação ─────────────────────────────────────────────────────────────────
  {
    section: 'Operação',
    to: '/admin/projetos',
    label: 'Projetos Sob Medida',
    permissao: 'projetos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
  },
  {
    to: '/admin/producao',
    label: 'Produção / PCP',
    permissao: 'producao',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    to: '/admin/qualidade',
    label: 'Qualidade',
    permissao: 'qualidade',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
  {
    to: '/admin/manutencao',
    label: 'Manutenção',
    permissao: 'manutencao',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },

  {
    to: '/admin/bens-frota',
    label: 'Bens & Frota',
    permissao: 'bens-frota',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 4v4h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },

  // ── Fiscal ───────────────────────────────────────────────────────────────────
  {
    section: 'Fiscal',
    to: '/admin/docs-recebidos',
    label: 'Docs Recebidos',
    permissao: 'docs-recebidos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <polyline points="8 13 12 17 16 13"/>
        <line x1="12" y1="17" x2="12" y2="9"/>
      </svg>
    ),
  },
  {
    to: '/admin/docs-emitidos',
    label: 'Docs Emitidos',
    permissao: 'docs-emitidos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <polyline points="8 17 12 13 16 17"/>
        <line x1="12" y1="13" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    to: '/admin/analise-nf',
    label: 'Análise NF',
    permissao: 'analise-nf',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },

  // ── Financeiro ───────────────────────────────────────────────────────────────
  {
    section: 'Financeiro',
    to: '/admin/financeiro',
    label: 'Financeiro',
    permissao: 'financeiro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
    to: '/admin/conciliacao',
    label: 'Conciliação',
    permissao: 'conciliacao',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },

  // ── Relatórios ───────────────────────────────────────────────────────────────
  {
    section: 'Relatórios',
    to: '/admin/relatorios',
    label: 'Relatórios',
    permissao: 'relatorios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },

  // ── Configuração ─────────────────────────────────────────────────────────────
  {
    section: 'Configuração',
    to: '/admin/configuracao-financeiro',
    label: 'Config. Financeiro',
    permissao: 'configuracao-financeiro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    to: '/admin/usuarios',
    label: 'Usuários',
    permissao: 'usuarios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
]

export default function AdminLayout() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [verSenha, setVerSenha] = useState(false)
  const [tabelaPendente, setTabelaPendente] = useState(false)
  const [ocultarValores, setOcultarValores] = useState(false)
  const [secoesRecolhidas, setSecoesRecolhidas] = useState<Set<string>>(() => {
    try {
      const salvo = localStorage.getItem('pousinox_nav_recolhidas')
      return salvo ? new Set(JSON.parse(salvo)) : new Set()
    } catch { return new Set() }
  })

  // Login
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  // Primeiro acesso
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false)
  const [setupNome, setSetupNome] = useState('')
  const [setupEmail, setSetupEmail] = useState('')
  const [setupSenha, setSetupSenha] = useState('')
  const [setupErro, setSetupErro] = useState('')
  const [setupSalvando, setSetupSalvando] = useState(false)

  const [notificacoes, setNotificacoes] = useState<{ id: number; texto: string }[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)

  const navigate = useNavigate()
  const location = useLocation()

  // ── Som de alerta via Web Audio API ──────────────────────────────────────
  const tocarAlerta = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') ctx.resume()

      function nota(freq: number, inicio: number, dur: number) {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, ctx.currentTime + inicio)
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + dur)
        osc.start(ctx.currentTime + inicio)
        osc.stop(ctx.currentTime + inicio + dur)
      }

      nota(880,  0,    0.35)  // A5
      nota(1108, 0.18, 0.40)  // C#6
      nota(1318, 0.34, 0.55)  // E6
    } catch { /* navegador sem suporte */ }
  }, [])

  // ── Realtime: alerta quando chega novo interesse ──────────────────────────
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('admin-alertas-interesses')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'interesses' },
        (payload) => {
          const rec = payload.new as Record<string, string>
          const nome    = rec.cliente_nome    || 'Cliente'
          const produto = rec.produto_titulo  || 'produto'
          const texto   = `${nome} → ${produto}`

          tocarAlerta()

          const id = Date.now()
          setNotificacoes(prev => [...prev, { id, texto }])
          setTimeout(() => setNotificacoes(prev => prev.filter(n => n.id !== id)), 8000)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, tocarAlerta])

  // Fecha drawer ao navegar
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  useEffect(() => {
    let isMounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session?.user) {
        localStorage.setItem('pousinox_internal', '1')
        setUser(session.user)
        await carregarPerfil(session.user.id, isMounted)
      } else {
        // Verifica se a tabela existe e quantos usuários há
        const { count, error: errCount } = await supabaseAdmin
          .from('admin_perfis')
          .select('id', { count: 'exact', head: true })

        if (errCount) {
          // Tabela não existe ou outro erro de banco
          console.error('[AdminLayout] Erro ao verificar admin_perfis:', errCount.message)
          if (isMounted) setTabelaPendente(true)
        } else if (isMounted && count === 0) {
          setPrimeiroAcesso(true)
        }
      }

      if (isMounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && isMounted) {
        localStorage.removeItem('pousinox_internal')
        setUser(null)
        setPerfil(null)
      }
    })

    return () => { isMounted = false; subscription.unsubscribe() }
  }, [])

  function toggleSecao(secao: string) {
    setSecoesRecolhidas(prev => {
      const novo = new Set(prev)
      if (novo.has(secao)) novo.delete(secao)
      else novo.add(secao)
      localStorage.setItem('pousinox_nav_recolhidas', JSON.stringify([...novo]))
      return novo
    })
  }

  async function carregarPerfil(userId: string, isMounted = true) {
    const { data, error: errPerfil } = await supabaseAdmin
      .from('admin_perfis')
      .select('nome, permissoes, ativo')
      .eq('user_id', userId)
      .single()

    if (!isMounted) return

    if (errPerfil || !data) {
      console.error('[AdminLayout] Perfil não encontrado para userId:', userId, errPerfil?.message)
      await supabase.auth.signOut()
      setErro('Perfil não encontrado. Execute o SQL de configuração no Supabase e use a tela de primeiro acesso.')
      setLoading(false)
      return
    }

    if (!data.ativo) {
      await supabase.auth.signOut()
      setErro('Conta desativada. Contate o administrador.')
      setLoading(false)
      return
    }

    setPerfil(data)
  }

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setErro('E-mail não confirmado. Verifique sua caixa de entrada ou peça ao administrador para confirmar.')
      } else if (error.message.includes('Invalid login credentials')) {
        setErro('E-mail ou senha incorretos.')
      } else {
        setErro(error.message)
      }
      setSenha('')
      return
    }
    if (data.user) {
      localStorage.setItem('pousinox_internal', '1')
      setUser(data.user)
      await carregarPerfil(data.user.id)
    }
  }

  async function criarPrimeiroAdmin(e: React.FormEvent) {
    e.preventDefault()
    setSetupErro('')
    setSetupSalvando(true)

    let userId: string

    const { data: { user: novoUser }, error: errAuth } = await supabaseAdmin.auth.admin.createUser({
      email: setupEmail.trim(),
      password: setupSenha,
      email_confirm: true,
    })

    if (errAuth) {
      if (errAuth.message.toLowerCase().includes('already')) {
        // Usuário já existe — busca o ID e atualiza a senha
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existente = users.find(u => u.email === setupEmail.trim())
        if (!existente) {
          setSetupErro('Usuário já existe mas não foi localizado. Tente outro e-mail.')
          setSetupSalvando(false)
          return
        }
        userId = existente.id
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: setupSenha,
          email_confirm: true,
        })
      } else {
        setSetupErro(errAuth.message)
        setSetupSalvando(false)
        return
      }
    } else if (!novoUser) {
      setSetupErro('Erro ao criar conta.')
      setSetupSalvando(false)
      return
    } else {
      userId = novoUser.id
    }

    // Upsert do perfil (insert ou update se já existir)
    const { error: errPerfil } = await supabaseAdmin.from('admin_perfis').upsert(
      { user_id: userId, nome: setupNome.trim(), permissoes: TODAS_PERMISSOES, ativo: true },
      { onConflict: 'user_id' }
    )

    if (errPerfil) {
      setSetupErro('Erro ao salvar perfil: ' + errPerfil.message)
      setSetupSalvando(false)
      return
    }

    const { data: signInData, error: errLogin } = await supabase.auth.signInWithPassword({
      email: setupEmail.trim(),
      password: setupSenha,
    })

    if (errLogin || !signInData.user) {
      setSetupErro('Conta configurada. Faça login na próxima tela com o e-mail e a senha acima.')
      setPrimeiroAcesso(false)
      setSetupSalvando(false)
      return
    }

    setUser(signInData.user)
    await carregarPerfil(signInData.user.id)
    setPrimeiroAcesso(false)
    setSetupSalvando(false)
  }

  async function logout() {
    localStorage.removeItem('pousinox_internal')
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
    setEmail('')
    setSenha('')
    navigate('/admin')
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingSpinner} />
      </div>
    )
  }

  if (tabelaPendente) {
    return (
      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <img src={logomarca} alt="Pousinox" className={styles.loginLogo} />
          <p className={styles.loginSub}>Configuração necessária</p>
          <p className={styles.setupInfo} style={{ color: '#dc2626', fontWeight: 600 }}>
            A tabela <code>admin_perfis</code> não existe no Supabase.
          </p>
          <p className={styles.setupInfo}>
            Acesse o Supabase → <strong>SQL Editor</strong> e execute o script de criação da tabela enviado anteriormente. Depois recarregue esta página.
          </p>
          <button className={styles.loginBtn} onClick={() => window.location.reload()}>
            Recarregar após executar o SQL
          </button>
        </div>
      </div>
    )
  }

  if (primeiroAcesso) {
    return (
      <div className={styles.loginWrap}>
        <form className={styles.loginCard} onSubmit={criarPrimeiroAdmin}>
          <img src={logomarca} alt="Pousinox" className={styles.loginLogo} />
          <p className={styles.loginSub}>Configurar administrador principal</p>
          <p className={styles.setupInfo}>Nenhum usuário cadastrado. Crie sua conta de administrador para começar.</p>
          <input
            type="text"
            placeholder="Seu nome"
            value={setupNome}
            autoFocus
            required
            onChange={e => { setSetupNome(e.target.value); setSetupErro('') }}
            className={styles.loginInput}
          />
          <input
            type="email"
            placeholder="E-mail"
            value={setupEmail}
            required
            onChange={e => { setSetupEmail(e.target.value); setSetupErro('') }}
            className={styles.loginInput}
          />
          <input
            type="password"
            placeholder="Senha (mínimo 6 caracteres)"
            value={setupSenha}
            required
            minLength={6}
            onChange={e => { setSetupSenha(e.target.value); setSetupErro('') }}
            className={`${styles.loginInput} ${setupErro ? styles.loginInputErro : ''}`}
          />
          {setupErro && <p className={styles.loginErro}>{setupErro}</p>}
          <button type="submit" className={styles.loginBtn} disabled={setupSalvando}>
            {setupSalvando ? 'Criando...' : 'Criar conta e entrar'}
          </button>
        </form>
      </div>
    )
  }

  if (!user || !perfil) {
    return (
      <div className={styles.loginWrap}>
        <form className={styles.loginCard} onSubmit={login} autoComplete="off">
          <img src={logomarca} alt="Pousinox" className={styles.loginLogo} />
          <p className={styles.loginSub}>Painel de Gestão</p>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            autoFocus
            autoComplete="off"
            onChange={e => { setEmail(e.target.value); setErro('') }}
            className={`${styles.loginInput} ${erro ? styles.loginInputErro : ''}`}
          />
          <div className={styles.senhaWrap}>
            <input
              type={verSenha ? 'text' : 'password'}
              placeholder="Senha"
              value={senha}
              autoComplete="current-password"
              onChange={e => { setSenha(e.target.value); setErro('') }}
              className={`${styles.loginInput} ${erro ? styles.loginInputErro : ''}`}
            />
            <button type="button" className={styles.verSenhaBtn} onClick={() => setVerSenha(v => !v)} tabIndex={-1} title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
              {verSenha ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {erro && <p className={styles.loginErro}>{erro}</p>}
          <button type="submit" className={styles.loginBtn}>Entrar</button>
        </form>
      </div>
    )
  }

  const navVisivel = NAV_ITEMS.filter(item => !item.permissao || perfil.permissoes.includes(item.permissao))

  // Rastreia qual seção cada item pertence
  let secaoAtual = ''

  const segmento = location.pathname.replace(/^\/admin\/?/, '').split('/')[0]
  const permissaoNecessaria = ROTA_PERMISSAO[segmento]
  const semPermissao = !!(permissaoNecessaria && !perfil.permissoes.includes(permissaoNecessaria))
  const primeiroAcessivel = navVisivel[0]?.to ?? '/admin/outlet'

  return (
    <AdminContext.Provider value={{ ocultarValores, toggleOcultarValores: () => setOcultarValores(v => !v) }}>
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ''} ${drawerOpen ? styles.shellDrawerOpen : ''}`}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            className={styles.collapseBtn}
            onClick={() => {
              if (window.innerWidth <= 768) setDrawerOpen(d => !d)
              else setCollapsed(c => !c)
            }}
            title="Menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <img src={logomarca} alt="Pousinox" className={styles.topbarLogo} />
          <span className={styles.topbarTitle}>Painel de Gestão</span>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.topbarUser}>{perfil.nome}</span>
          <button
            className={`${styles.privacyBtn} ${ocultarValores ? styles.privacyBtnAtivo : ''}`}
            onClick={() => setOcultarValores(v => !v)}
            title={ocultarValores ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {ocultarValores ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
          <a href="/" target="_blank" rel="noopener" className={styles.topbarLink}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span className={styles.topbarLinkText}>Ver site</span>
          </a>
          <button className={styles.logoutBtn} onClick={logout} title="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.overlay} onClick={() => setDrawerOpen(false)} />
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            {navVisivel.map(item => {
              if (item.section) secaoAtual = item.section
              const recolhida = secoesRecolhidas.has(secaoAtual)
              return (
                <div key={item.to}>
                  {item.section && (
                    <button
                      className={styles.navSection}
                      onClick={() => toggleSecao(item.section!)}
                      title={recolhida ? 'Expandir' : 'Recolher'}
                    >
                      <span className={styles.navSectionLabel}>{item.section}</span>
                      <span className={styles.navSectionChevron} style={{ transform: recolhida ? 'rotate(-90deg)' : 'none' }}>▾</span>
                    </button>
                  )}
                  {!recolhida && (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                    </NavLink>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className={styles.content}>
          {semPermissao ? <Navigate to={primeiroAcessivel} replace /> : <RouterOutlet />}
        </main>
      </div>
    </div>
      {/* ── Toasts de alerta ── */}
      {notificacoes.length > 0 && (
        <div className={styles.toastWrap}>
          {notificacoes.map(n => (
            <div key={n.id} className={styles.toast}>
              <div className={styles.toastIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <div className={styles.toastBody}>
                <div className={styles.toastTitle}>Novo interesse — Pousinox® Bot</div>
                <div className={styles.toastMsg}>{n.texto}</div>
              </div>
              <button
                className={styles.toastClose}
                onClick={() => setNotificacoes(prev => prev.filter(x => x.id !== n.id))}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </AdminContext.Provider>
  )
}
