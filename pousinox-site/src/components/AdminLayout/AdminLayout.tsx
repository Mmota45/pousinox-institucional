import { useState, useEffect } from 'react'
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
}

const TODAS_PERMISSOES = ['dashboard', 'outlet', 'estoque', 'vendas', 'relatorios', 'analise-nf', 'orcamento', 'usuarios', 'conteudo', 'analytics', 'prospeccao']

const NAV_ITEMS = [
  {
    to: '/admin',
    end: true,
    label: 'Dashboard',
    permissao: 'dashboard' as string | null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    to: '/admin/outlet',
    label: 'Produtos / Outlet',
    permissao: 'outlet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
  },
  {
    to: '/admin/estoque',
    label: 'Estoque',
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
    to: '/admin/vendas',
    label: 'Vendas',
    permissao: 'vendas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
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
  {
    to: '/admin/orcamento',
    label: 'Orçamento',
    permissao: 'orcamento',
    badge: 'novo' as string | undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
  },
  {
    to: '/admin/usuarios',
    label: 'Usuários',
    permissao: 'usuarios',
    badge: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    to: '/admin/conteudo',
    label: 'Conteúdo',
    permissao: 'conteudo',
    badge: 'novo' as string | undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    permissao: 'analytics',
    badge: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <polyline points="22 12 18 16 14 12"/>
      </svg>
    ),
  },
  {
    to: '/admin/prospeccao',
    label: 'Prospecção',
    permissao: 'analytics',
    badge: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
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

  const navigate = useNavigate()
  const location = useLocation()

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
            {navVisivel.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className={styles.content}>
          {semPermissao ? <Navigate to={primeiroAcessivel} replace /> : <RouterOutlet />}
        </main>
      </div>
    </div>
    </AdminContext.Provider>
  )
}
