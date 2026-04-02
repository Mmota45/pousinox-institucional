import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import styles from './AdminUsuarios.module.css'

async function contarInteressados(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('interesses')
    .select('id', { count: 'exact', head: true })
  return count ?? 0
}

interface UsuarioAdmin {
  id: string
  user_id: string
  email: string
  nome: string
  permissoes: string[]
  ativo: boolean
}

const PERMISSOES_LISTA = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'outlet',      label: 'Produtos / Outlet' },
  { key: 'estoque',     label: 'Estoque' },
  { key: 'vendas',      label: 'Vendas' },
  { key: 'relatorios',  label: 'Relatórios' },
  { key: 'analise-nf',  label: 'Análise NF' },
  { key: 'orcamento',   label: 'Orçamento' },
  { key: 'usuarios',    label: 'Gerenciar Usuários' },
  { key: 'conteudo',    label: 'Conteúdo' },
]

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [meuUserId, setMeuUserId] = useState<string | null>(null)
  const [totalInteressados, setTotalInteressados] = useState<number | null>(null)
  const [limpando, setLimpando] = useState(false)
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null)
  const [selecionado, setSelecionado] = useState<UsuarioAdmin | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Campos do formulário
  const [fNome, setFNome] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fSenha, setFSenha] = useState('')
  const [fPermissoes, setFPermissoes] = useState<string[]>([])
  const [fAtivo, setFAtivo] = useState(true)
  const [fErro, setFErro] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMeuUserId(user.id)
    })
    fetchUsuarios()
    contarInteressados().then(setTotalInteressados)
  }, [])

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3500)
      return () => clearTimeout(t)
    }
  }, [msg])

  async function fetchUsuarios() {
    setLoading(true)
    const [{ data: perfis }, { data: authData }] = await Promise.all([
      supabaseAdmin.from('admin_perfis').select('*').order('created_at'),
      supabaseAdmin.auth.admin.listUsers(),
    ])
    const authUsers = authData?.users ?? []
    const lista: UsuarioAdmin[] = (perfis ?? []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      email: authUsers.find(u => u.id === p.user_id)?.email ?? '',
      nome: p.nome,
      permissoes: p.permissoes ?? [],
      ativo: p.ativo,
    }))
    setUsuarios(lista)
    setLoading(false)
  }

  function abrirNovo() {
    setFNome('')
    setFEmail('')
    setFSenha('')
    setFPermissoes([])
    setFAtivo(true)
    setFErro('')
    setSelecionado(null)
    setModal('novo')
  }

  function abrirEditar(u: UsuarioAdmin) {
    setFNome(u.nome)
    setFEmail(u.email)
    setFSenha('')
    setFPermissoes([...u.permissoes])
    setFAtivo(u.ativo)
    setFErro('')
    setSelecionado(u)
    setModal('editar')
  }

  function fecharModal() {
    setModal(null)
    setSelecionado(null)
  }

  function togglePermissao(key: string) {
    const ehMinhaPermUsuarios = selecionado?.user_id === meuUserId && key === 'usuarios'
    if (ehMinhaPermUsuarios) return
    setFPermissoes(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    )
  }

  async function salvarNovo(e: React.FormEvent) {
    e.preventDefault()
    setFErro('')
    if (fSenha.length < 6) { setFErro('A senha deve ter no mínimo 6 caracteres.'); return }
    setSalvando(true)

    const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
      email: fEmail.trim(),
      password: fSenha,
      email_confirm: true,
    })

    if (error || !user) {
      setFErro(error?.message ?? 'Erro ao criar usuário.')
      setSalvando(false)
      return
    }

    await supabaseAdmin.from('admin_perfis').insert({
      user_id: user.id,
      nome: fNome.trim(),
      permissoes: fPermissoes,
      ativo: true,
    })

    setMsg({ tipo: 'ok', texto: `Usuário "${fNome.trim()}" criado com sucesso!` })
    fecharModal()
    fetchUsuarios()
    setSalvando(false)
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!selecionado) return
    setFErro('')
    if (fSenha && fSenha.length < 6) { setFErro('A nova senha deve ter no mínimo 6 caracteres.'); return }
    setSalvando(true)

    await supabaseAdmin.from('admin_perfis')
      .update({ nome: fNome.trim(), permissoes: fPermissoes, ativo: fAtivo })
      .eq('id', selecionado.id)

    if (fSenha) {
      await supabaseAdmin.auth.admin.updateUserById(selecionado.user_id, { password: fSenha })
    }

    setMsg({ tipo: 'ok', texto: 'Usuário atualizado!' })
    fecharModal()
    fetchUsuarios()
    setSalvando(false)
  }

  const ehMinhaContaAtivo = selecionado?.user_id === meuUserId

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Usuários</h1>
          <p className={styles.pageSub}>Gerencie o acesso ao painel por colaborador</p>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNovo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo usuário
        </button>
      </div>

      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      {loading ? (
        <p className={styles.loadingMsg}>Carregando...</p>
      ) : (
        <div className={styles.lista}>
          {usuarios.map(u => (
            <div key={u.id} className={`${styles.userCard} ${!u.ativo ? styles.userCardInativo : ''}`}>
              <div className={styles.userAvatar} style={{ background: stringToColor(u.nome) }}>
                {u.nome.charAt(0).toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userNomeRow}>
                  <span className={styles.userNome}>{u.nome}</span>
                  {u.user_id === meuUserId && <span className={styles.badgeVoce}>você</span>}
                  {!u.ativo && <span className={styles.badgeInativo}>inativo</span>}
                </div>
                <div className={styles.userEmail}>{u.email}</div>
                <div className={styles.userPerms}>
                  {u.permissoes.length === 0
                    ? <span className={styles.semPerm}>Sem permissões</span>
                    : u.permissoes.map(p => (
                      <span key={p} className={styles.permChip}>
                        {PERMISSOES_LISTA.find(pl => pl.key === p)?.label ?? p}
                      </span>
                    ))
                  }
                </div>
              </div>
              <button className={styles.btnEditar} onClick={() => abrirEditar(u)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manutenção */}
      <div className={styles.manutencao}>
        <div className={styles.manutencaoHeader}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
          </svg>
          Manutenção de dados
        </div>
        <div className={styles.manutencaoBody}>
          <div className={styles.manutencaoItem}>
            <div>
              <span className={styles.manutencaoLabel}>Lista de interessados</span>
              <span className={styles.manutencaoDesc}>
                Registros de clientes que clicaram em "Tenho interesse" nos produtos.
                {totalInteressados !== null && (
                  <> Atualmente: <strong>{totalInteressados} {totalInteressados === 1 ? 'registro' : 'registros'}</strong>.</>
                )}
              </span>
            </div>
            <button
              className={styles.btnLimpar}
              disabled={limpando || totalInteressados === 0}
              onClick={async () => {
                if (!confirm(`Limpar todos os registros de interessados? Esta ação não pode ser desfeita.`)) return
                setLimpando(true)
                const { data: deletados, error } = await supabaseAdmin.rpc('admin_limpar_interesses')
                if (error) {
                  setMsg({ tipo: 'erro', texto: 'Erro ao limpar: ' + error.message })
                } else {
                  setMsg({ tipo: 'ok', texto: `${deletados ?? 0} registro(s) removido(s).` })
                }
                const novo = await contarInteressados()
                setTotalInteressados(novo)
                setLimpando(false)
              }}
            >
              {limpando ? 'Limpando...' : 'Limpar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modal === 'novo' ? 'Novo usuário' : `Editar — ${selecionado?.nome}`}
              </h2>
              <button className={styles.modalClose} onClick={fecharModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={modal === 'novo' ? salvarNovo : salvarEdicao} className={styles.modalForm}>

              <div className={styles.formRow2}>
                <div className={styles.fg}>
                  <label>Nome</label>
                  <input className={styles.input} value={fNome} required placeholder="Nome completo"
                    onChange={e => setFNome(e.target.value)} />
                </div>
                <div className={styles.fg}>
                  <label>E-mail</label>
                  <input className={styles.input} type="email" value={fEmail} required
                    placeholder="email@empresa.com.br"
                    readOnly={modal === 'editar'}
                    onChange={e => setFEmail(e.target.value)}
                    style={modal === 'editar' ? { background: '#f1f5f9', color: '#64748b' } : {}}
                  />
                </div>
              </div>

              <div className={styles.fg}>
                <label>{modal === 'novo' ? 'Senha' : 'Nova senha (deixe em branco para manter)'}</label>
                <input className={styles.input} type="password" value={fSenha}
                  required={modal === 'novo'} minLength={6}
                  placeholder={modal === 'novo' ? 'Mínimo 6 caracteres' : '••••••••  (opcional)'}
                  onChange={e => setFSenha(e.target.value)} />
              </div>

              <div className={styles.fg}>
                <label>Permissões de acesso</label>
                <div className={styles.permGrid}>
                  {PERMISSOES_LISTA.map(p => {
                    const bloqueada = selecionado?.user_id === meuUserId && p.key === 'usuarios'
                    return (
                      <label
                        key={p.key}
                        className={`${styles.permLabel} ${bloqueada ? styles.permBloqueada : ''}`}
                        title={bloqueada ? 'Não é possível remover sua própria permissão de Usuários' : ''}
                      >
                        <input
                          type="checkbox"
                          checked={fPermissoes.includes(p.key)}
                          disabled={bloqueada}
                          onChange={() => togglePermissao(p.key)}
                        />
                        {p.label}
                      </label>
                    )
                  })}
                </div>
              </div>

              {modal === 'editar' && (
                <label className={styles.ativoLabel}>
                  <input
                    type="checkbox"
                    checked={fAtivo}
                    disabled={ehMinhaContaAtivo}
                    onChange={e => setFAtivo(e.target.checked)}
                  />
                  <span>Conta ativa</span>
                  {ehMinhaContaAtivo && (
                    <span className={styles.ativoHint}>Não é possível desativar a própria conta</span>
                  )}
                </label>
              )}

              {fErro && <p className={styles.formErro}>{fErro}</p>}

              <div className={styles.modalAcoes}>
                <button type="button" className={styles.btnSecondary} onClick={fecharModal}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                  {salvando ? 'Salvando...' : modal === 'novo' ? 'Criar usuário' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function stringToColor(str: string) {
  const colors = ['#1a5fa8', '#0a1628', '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
