import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminPipeline.module.css'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'
import AgentFollowUp from '../components/assistente/AgentFollowUp'

// ── Constantes ────────────────────────────────────────────────────────────────

const CNPJ_LENGTH = 14
const MSG_TIMEOUT = 4000
const SEARCH_DEBOUNCE = 500

// ── Tipos ─────────────────────────────────────────────────────────────────────

const ESTAGIOS = ['entrada', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] as const
const ESTAGIOS_ATIVOS = ['entrada', 'qualificado', 'proposta', 'negociacao'] as const
type Estagio = typeof ESTAGIOS[number]

interface EstagioConfig {
  label: string
  css: string
  terminal: boolean
  cor: string
}

const ESTAGIO_CONFIG: Record<Estagio, EstagioConfig> = {
  entrada:     { label: 'Entrada',     css: 'badgeEntrada',    terminal: false, cor: '#6366f1' },
  qualificado: { label: 'Qualificado', css: 'badgeQualif',     terminal: false, cor: '#0ea5e9' },
  proposta:    { label: 'Proposta',    css: 'badgeProposta',   terminal: false, cor: '#f59e0b' },
  negociacao:  { label: 'Negociação',  css: 'badgeNegoc',      terminal: false, cor: '#f97316' },
  ganho:       { label: 'Ganho',       css: 'badgeGanho',      terminal: true,  cor: '#16a34a' },
  perdido:     { label: 'Perdido',     css: 'badgePerdido',    terminal: true,  cor: '#6b7280' },
}

const PROXIMO: Partial<Record<Estagio, Estagio>> = {
  entrada:     'qualificado',
  qualificado: 'proposta',
  proposta:    'negociacao',
}

interface Deal {
  id: number
  titulo: string
  empresa_nome: string | null
  empresa_cnpj: string | null
  prospect_id: number | null
  estagio: Estagio
  valor_estimado: number | null
  observacao: string | null
  motivo_perda: string | null
  fin_lancamento_id: number | null
  created_at: string
  updated_at: string
}

interface ProspectEncontrado {
  id: number
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string
}

const FORM_VAZIO = {
  titulo:          '',
  empresa_nome:    '',
  empresa_cnpj:    '',
  estagio:         'entrada' as Estagio,
  valor_estimado:  '',
  observacao:      '',
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(v: string) {
  return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type Vista = 'tabela' | 'lista' | 'kanban'

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminPipeline() {
  const [deals,      setDeals]      = useState<Deal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filtro,     setFiltro]     = useState<Estagio | 'todos'>('todos')
  const [formAberto, setFormAberto] = useState(false)
  const [agentFollowUp, setAgentFollowUp] = useState(false)
  const [form,       setForm]       = useState(FORM_VAZIO)
  const [salvando,   setSalvando]   = useState(false)
  const [movendo,    setMovendo]    = useState<number | null>(null)
  const [msg,        setMsg]        = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [perdendoId, setPerdendoId] = useState<number | null>(null)
  const [motivoPerda, setMotivoPerda] = useState('')
  const [gerandoId,   setGerandoId]   = useState<number | null>(null)
  const [formProspect, setFormProspect] = useState<ProspectEncontrado | null | 'buscando'>(null)
  const [vinculando,   setVinculando]   = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [vista, setVista] = useState<Vista>('tabela')
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Estagio | null>(null)
  const [menuAberto, setMenuAberto] = useState<number | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), MSG_TIMEOUT)
    return () => clearTimeout(t)
  }, [msg])

  // ── Carregar ───────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseAdmin
        .from('pipeline_deals')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      setDeals((data ?? []) as Deal[])
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao carregar deals.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Buscar prospect por CNPJ ──────────────────────────────────────────────

  async function buscarProspect(cnpj: string): Promise<ProspectEncontrado | null> {
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== CNPJ_LENGTH) return null
    try {
      const { data, error } = await supabaseAdmin
        .from('prospeccao')
        .select('id, razao_social, nome_fantasia, cnpj')
        .eq('cnpj', cnpjLimpo)
        .maybeSingle()
      if (error) throw error
      return data as ProspectEncontrado | null
    } catch (err: unknown) {
      console.error(err)
      return null
    }
  }

  function handleCnpjChange(cnpj: string) {
    setForm(f => ({ ...f, empresa_cnpj: cnpj }))
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== CNPJ_LENGTH) { setFormProspect(null); return }
    setFormProspect('buscando')
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      try {
        const found = await buscarProspect(cnpjLimpo)
        setFormProspect(found)
        if (found) {
          setForm(f => ({ ...f, empresa_nome: f.empresa_nome || found.razao_social || found.nome_fantasia || '' }))
        }
      } catch (err: unknown) {
        console.error(err)
        setFormProspect(null)
      }
    }, SEARCH_DEBOUNCE)
  }

  async function vincularProspect(deal: Deal) {
    if (!deal.empresa_cnpj) return
    setVinculando(deal.id)
    try {
      const found = await buscarProspect(deal.empresa_cnpj)
      if (!found) {
        setMsg({ tipo: 'erro', texto: 'Nenhum prospect encontrado com este CNPJ na base.' })
        return
      }
      const { error } = await supabaseAdmin.from('pipeline_deals').update({ prospect_id: found.id }).eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, prospect_id: found.id } : d))
      setMsg({ tipo: 'ok', texto: `Vinculado: ${found.razao_social ?? found.cnpj}` })
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao vincular prospect.' })
    } finally {
      setVinculando(null)
    }
  }

  async function desvincularProspect(deal: Deal) {
    try {
      const { error } = await supabaseAdmin.from('pipeline_deals').update({ prospect_id: null }).eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, prospect_id: null } : d))
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao desvincular prospect.' })
    }
  }

  // ── Criar deal ─────────────────────────────────────────────────────────────

  async function criarDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)
    try {
      const prospectId = formProspect && formProspect !== 'buscando' ? formProspect.id : null

      const { error } = await supabaseAdmin.from('pipeline_deals').insert({
        titulo:         form.titulo.trim(),
        empresa_nome:   form.empresa_nome.trim() || null,
        empresa_cnpj:   form.empresa_cnpj.replace(/\D/g, '') || null,
        prospect_id:    prospectId,
        estagio:        form.estagio,
        valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
        observacao:     form.observacao.trim() || null,
      })

      if (error) {
        setMsg({ tipo: 'erro', texto: 'Erro ao criar deal: ' + error.message })
      } else {
        setMsg({ tipo: 'ok', texto: 'Deal criado.' })
        setForm(FORM_VAZIO)
        setFormProspect(null)
        setFormAberto(false)
        carregar()
      }
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro inesperado ao criar deal.' })
    } finally {
      setSalvando(false)
    }
  }

  // ── Mover estágio ──────────────────────────────────────────────────────────

  async function avancarEstagio(deal: Deal) {
    const proximo = PROXIMO[deal.estagio]
    if (!proximo) return
    setMovendo(deal.id)
    try {
      const { error } = await supabaseAdmin.from('pipeline_deals').update({ estagio: proximo }).eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: proximo } : d))
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao avançar estágio.' })
    } finally {
      setMovendo(null)
    }
  }

  async function marcarGanho(deal: Deal) {
    if (!window.confirm('Confirmar deal como GANHO?')) return
    setMovendo(deal.id)
    try {
      const { error } = await supabaseAdmin.from('pipeline_deals').update({ estagio: 'ganho' }).eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: 'ganho' } : d))
      setMsg({ tipo: 'ok', texto: 'Deal ganho. Gere o recebível para registrar no financeiro.' })
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao marcar como ganho.' })
    } finally {
      setMovendo(null)
    }
  }

  async function marcarPerdido(deal: Deal, motivo: string) {
    setMovendo(deal.id)
    try {
      const { error } = await supabaseAdmin.from('pipeline_deals')
        .update({ estagio: 'perdido', motivo_perda: motivo || null })
        .eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: 'perdido', motivo_perda: motivo || null } : d))
      setPerdendoId(null)
      setMotivoPerda('')
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao marcar como perdido.' })
    } finally {
      setMovendo(null)
    }
  }

  // ── Gerar recebível ────────────────────────────────────────────────────────

  async function gerarRecebivel(deal: Deal) {
    if (!deal.valor_estimado) {
      setMsg({ tipo: 'erro', texto: 'Informe o valor estimado antes de gerar o recebível.' })
      return
    }
    if (!confirm(`Gerar recebível de ${fmtBRL(deal.valor_estimado)} para "${deal.titulo}"?`)) return

    setGerandoId(deal.id)
    try {
      const { data: check, error: checkErr } = await supabaseAdmin
        .from('pipeline_deals')
        .select('fin_lancamento_id')
        .eq('id', deal.id)
        .single()
      if (checkErr) throw checkErr
      if (check?.fin_lancamento_id) {
        setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, fin_lancamento_id: check.fin_lancamento_id } : d))
        setMsg({ tipo: 'erro', texto: 'Este deal já possui um recebível vinculado.' })
        return
      }

      const { data: cats } = await supabaseAdmin
        .from('fin_categorias')
        .select('id')
        .eq('tipo', 'receita')
        .ilike('nome', '%projeto%')
        .limit(1)
      const categoriaId = cats?.[0]?.id ?? null

      const descricao = ['Pipeline', deal.empresa_nome, deal.titulo].filter(Boolean).join(' — ')

      const { data: lanc, error } = await supabaseAdmin
        .from('fin_lancamentos')
        .insert({
          tipo:             'receita',
          descricao,
          valor:            deal.valor_estimado,
          status:           'pendente',
          data_vencimento:  new Date().toISOString().slice(0, 10),
          data_competencia: new Date().toISOString().slice(0, 10),
          categoria_id:     categoriaId,
          origem:           'pipeline',
        })
        .select('id')
        .single()

      if (error || !lanc) {
        setMsg({ tipo: 'erro', texto: 'Erro ao criar lançamento: ' + (error?.message ?? 'desconhecido') })
        return
      }

      const { error: updErr } = await supabaseAdmin.from('pipeline_deals').update({ fin_lancamento_id: lanc.id }).eq('id', deal.id)
      if (updErr) throw updErr
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, fin_lancamento_id: lanc.id } : d))
      setMsg({ tipo: 'ok', texto: 'Recebível criado no Financeiro.' })
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro inesperado ao gerar recebível.' })
    } finally {
      setGerandoId(null)
    }
  }

  // ── Excluir ────────────────────────────────────────────────────────────────

  async function excluir(deal: Deal) {
    if (!confirm(`Excluir deal "${deal.titulo}"?`)) return
    try {
      const { error } = await supabaseAdmin.from('pipeline_deals').delete().eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.filter(d => d.id !== deal.id))
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao excluir deal.' })
    }
  }

  // ── Mover estágio (kanban drag) ───────────────────────────────────────────

  async function moverParaEstagio(deal: Deal, novoEstagio: Estagio) {
    if (deal.estagio === novoEstagio) return
    if (novoEstagio === 'ganho') {
      if (!window.confirm('Confirmar deal como GANHO?')) return
    }
    setMovendo(deal.id)
    try {
      const { error } = await supabaseAdmin.from('pipeline_deals').update({ estagio: novoEstagio }).eq('id', deal.id)
      if (error) throw error
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: novoEstagio } : d))
      if (novoEstagio === 'ganho') {
        setMsg({ tipo: 'ok', texto: 'Deal ganho. Gere o recebível para registrar no financeiro.' })
      }
    } catch (err: unknown) {
      console.error(err)
      setMsg({ tipo: 'erro', texto: 'Erro ao mover deal.' })
    } finally {
      setMovendo(null)
    }
  }

  // ── Exportar CSV ──────────────────────────────────────────────────────────

  function exportarCSV() {
    const BOM = '\uFEFF'
    const header = 'Empresa;CNPJ;Título;Estágio;Valor;Criado em;Atualizado em'
    const rows = dealsFiltrados.map(d => [
      d.empresa_nome ?? '',
      d.empresa_cnpj ?? '',
      d.titulo,
      ESTAGIO_CONFIG[d.estagio].label,
      d.valor_estimado != null ? d.valor_estimado.toFixed(2).replace('.', ',') : '',
      fmtData(d.created_at),
      fmtData(d.updated_at),
    ].join(';'))
    const csv = BOM + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pipeline_deals_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const ativos  = deals.filter(d => !ESTAGIO_CONFIG[d.estagio].terminal)
  const ganhos  = deals.filter(d => d.estagio === 'ganho')
  const perdidos = deals.filter(d => d.estagio === 'perdido')
  const valorPotencial = ativos.reduce((s, d) => s + (d.valor_estimado ?? 0), 0)
  const valorGanho     = ganhos.reduce((s, d) => s + (d.valor_estimado ?? 0), 0)

  const buscaLower = busca.toLowerCase().trim()
  const dealsFiltrados = deals.filter(d => {
    if (filtro !== 'todos' && d.estagio !== filtro) return false
    if (buscaLower) {
      const nome = (d.empresa_nome ?? '').toLowerCase()
      const titulo = d.titulo.toLowerCase()
      const cnpj = d.empresa_cnpj ?? ''
      if (!nome.includes(buscaLower) && !titulo.includes(buscaLower) && !cnpj.includes(buscaLower)) return false
    }
    return true
  })

  // ── Funnel bar data ────────────────────────────────────────────────────────

  const total = deals.length || 1
  const funnelData = ESTAGIOS.map(e => ({
    estagio: e,
    cfg: ESTAGIO_CONFIG[e],
    count: deals.filter(d => d.estagio === e).length,
    pct: Math.round((deals.filter(d => d.estagio === e).length / total) * 100),
  })).filter(f => f.count > 0)

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderBadge(estagio: Estagio) {
    const cfg = ESTAGIO_CONFIG[estagio]
    return <span className={styles[cfg.css as keyof typeof styles]}>{cfg.label}</span>
  }

  function renderProspectLink(deal: Deal) {
    if (deal.prospect_id) {
      return (
        <span className={styles.badgeProspect} title={`Prospect #${deal.prospect_id}`}>
          🔗
          <button className={styles.btnDesvincular} onClick={() => desvincularProspect(deal)} title="Desvincular">×</button>
        </span>
      )
    }
    if (deal.empresa_cnpj) {
      return (
        <button className={styles.btnVincularProspect} disabled={vinculando === deal.id}
          onClick={() => vincularProspect(deal)}>
          {vinculando === deal.id ? '...' : '⊕'}
        </button>
      )
    }
    return null
  }

  function renderAcoesTabela(deal: Deal) {
    const cfg = ESTAGIO_CONFIG[deal.estagio]
    const proximo = PROXIMO[deal.estagio]
    return (
      <div className={styles.tdAcoes}>
        {!cfg.terminal && proximo && (
          <button className={`${styles.btnMini} ${styles.btnMiniAvancar}`}
            disabled={movendo === deal.id} onClick={() => avancarEstagio(deal)}>
            → {ESTAGIO_CONFIG[proximo].label}
          </button>
        )}
        {!cfg.terminal && (
          <>
            <button className={`${styles.btnMini} ${styles.btnMiniGanho}`}
              disabled={movendo === deal.id} onClick={() => marcarGanho(deal)}>✓</button>
            <button className={`${styles.btnMini} ${styles.btnMiniPerdido}`}
              disabled={movendo === deal.id} onClick={() => { setPerdendoId(deal.id); setMotivoPerda('') }}>✕</button>
          </>
        )}
        {deal.estagio === 'ganho' && !deal.fin_lancamento_id && (
          <button className={`${styles.btnMini} ${styles.btnMiniRecebivel}`}
            disabled={gerandoId === deal.id} onClick={() => gerarRecebivel(deal)}>
            💰
          </button>
        )}
        {deal.estagio === 'ganho' && deal.fin_lancamento_id && (
          <span className={styles.badgeRecebivel}>✓ #{deal.fin_lancamento_id}</span>
        )}
        <button className={`${styles.btnMini} ${styles.btnMiniExcluir}`} onClick={() => excluir(deal)}>🗑</button>
        <AiActionButton label="Proposta" icon="📝" small modelName="Groq" action={async () => {
          const r = await aiChat({
            prompt: `Deal: "${deal.titulo}"\nEmpresa: ${deal.empresa_nome || 'N/I'}\nCNPJ: ${deal.empresa_cnpj || 'N/I'}\nValor: R$ ${deal.valor_estimado || 0}\nEstágio: ${deal.estagio}\n\nGere uma proposta comercial profissional para fixadores de porcelanato em aço inox. Inclua: saudação, apresentação da Pousinox, benefícios do produto, condições comerciais sugeridas e fechamento.`,
            system: 'Você é o departamento comercial da Pousinox, fabricante de fixadores de porcelanato em aço inox em Pouso Alegre/MG. Gere propostas profissionais em português brasileiro.',
            model: 'groq',
          })
          return r.error ? `Erro: ${r.error}` : r.content
        }} />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {msg && (
        <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>
          {msg.texto}
        </div>
      )}

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Pipeline Comercial</div>
          <div className={styles.pageSubtitle}>{deals.length} deals · {ativos.length} ativos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setAgentFollowUp(true)}>🔄 Follow-up IA</button>
          <button className={styles.btnPrimary} onClick={() => setFormAberto(f => !f)}>
            {formAberto ? '✕ Fechar' : '+ Novo Deal'}
          </button>
        </div>
      </div>

      {/* Barra de distribuição % */}
      {deals.length > 0 && (
        <div>
          <div className={styles.funnelBar}>
            {funnelData.map(f => (
              <div key={f.estagio} className={styles.funnelSeg}
                style={{ flex: f.count, backgroundColor: f.cfg.cor }}
                title={`${f.cfg.label}: ${f.count} (${f.pct}%)`}>
                <span>{f.pct >= 8 ? `${f.cfg.label} ${f.pct}%` : f.pct >= 4 ? `${f.pct}%` : ''}</span>
              </div>
            ))}
          </div>
          <div className={styles.funnelLegend}>
            {funnelData.map(f => (
              <div key={f.estagio} className={styles.funnelLegItem}>
                <div className={styles.funnelDot} style={{ backgroundColor: f.cfg.cor }} />
                {f.cfg.label} {f.count} ({f.pct}%)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{ativos.length}</span>
          <span className={styles.statLabel}>Ativos</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{valorPotencial > 0 ? fmtBRL(valorPotencial) : '—'}</span>
          <span className={styles.statLabel}>Potencial</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statVal} ${styles.statGanho}`}>{ganhos.length}</span>
          <span className={styles.statLabel}>Ganhos {valorGanho > 0 ? fmtBRL(valorGanho) : ''}</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statVal} ${styles.statPerdido}`}>{perdidos.length}</span>
          <span className={styles.statLabel}>Perdidos</span>
        </div>
      </div>

      {/* Formulário novo deal */}
      {formAberto && (
        <form className={styles.form} onSubmit={criarDeal}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Título *</label>
              <input className={styles.input} value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Revestimento fachada" required />
            </div>
            <div className={styles.field}>
              <label>Empresa</label>
              <input className={styles.input} value={form.empresa_nome}
                onChange={e => setForm(f => ({ ...f, empresa_nome: e.target.value }))}
                placeholder="Nome da empresa" />
            </div>
            <div className={styles.field}>
              <label>CNPJ</label>
              <input className={styles.input} value={form.empresa_cnpj}
                onChange={e => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00" />
              {formProspect === 'buscando' && (
                <span className={styles.prospectBuscando}>buscando...</span>
              )}
              {formProspect && formProspect !== 'buscando' && (
                <span className={styles.prospectOk}>
                  🔗 {formProspect.razao_social ?? formProspect.nome_fantasia ?? formProspect.cnpj}
                </span>
              )}
              {formProspect === null && form.empresa_cnpj.replace(/\D/g,'').length === CNPJ_LENGTH && (
                <span className={styles.prospectNaoEncontrado}>Não encontrado na base</span>
              )}
            </div>
            <div className={styles.field}>
              <label>Estágio</label>
              <select className={styles.input} value={form.estagio}
                onChange={e => setForm(f => ({ ...f, estagio: e.target.value as Estagio }))}>
                {ESTAGIOS_ATIVOS.map(e => (
                  <option key={e} value={e}>{ESTAGIO_CONFIG[e].label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Valor (R$)</label>
              <input className={styles.input} type="number" step="0.01" min="0"
                value={form.valor_estimado}
                onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                placeholder="0,00" />
            </div>
            <div className={styles.fieldFull}>
              <label>Observação</label>
              <input className={styles.input} value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Contexto, contato, próximo passo..." />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={salvando}>
              {salvando ? 'Criando...' : 'Criar deal'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={() => { setFormAberto(false); setForm(FORM_VAZIO) }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filtros}>
          {(['todos', ...ESTAGIOS] as const).map(e => (
            <button key={e}
              className={`${styles.filtroBtn} ${filtro === e ? styles.filtroBtnAtivo : ''}`}
              onClick={() => setFiltro(e)}>
              {e === 'todos' ? `Todos ${deals.length}` : `${ESTAGIO_CONFIG[e].label} ${deals.filter(d => d.estagio === e).length}`}
            </button>
          ))}
        </div>
        <div className={styles.toolbarRight}>
          <input className={styles.buscaInput} type="text"
            placeholder="Buscar empresa, CNPJ..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <button className={styles.btnSecondary} onClick={exportarCSV} title="Exportar CSV">📥</button>
          <button className={`${styles.btnSecondary} ${vista === 'tabela' ? styles.filtroBtnAtivo : ''}`}
            onClick={() => setVista('tabela')} title="Tabela">▤</button>
          <button className={`${styles.btnSecondary} ${vista === 'lista' ? styles.filtroBtnAtivo : ''}`}
            onClick={() => setVista('lista')} title="Cards">☰</button>
          <button className={`${styles.btnSecondary} ${vista === 'kanban' ? styles.filtroBtnAtivo : ''}`}
            onClick={() => setVista('kanban')} title="Kanban">▦</button>
        </div>
      </div>

      {/* Motivo perda inline */}
      {perdendoId && (
        <div className={styles.motivoWrap}>
          <input className={styles.buscaInput}
            placeholder="Motivo da perda (opcional) — Enter para confirmar"
            value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const deal = deals.find(d => d.id === perdendoId)
                if (deal) marcarPerdido(deal, motivoPerda)
              }
            }}
            autoFocus />
          <button className={styles.btnPerdido} onClick={() => {
            const deal = deals.find(d => d.id === perdendoId)
            if (deal) marcarPerdido(deal, motivoPerda)
          }}>Confirmar</button>
          <button className={styles.btnCancelar} onClick={() => { setPerdendoId(null); setMotivoPerda('') }}>✕</button>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className={styles.skeletonWrap}>
          {[1,2,3,4,5].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : dealsFiltrados.length === 0 ? (
        <div className={styles.vazio}>
          {filtro === 'todos' && !busca
            ? 'Nenhum deal. Clique em "+ Novo Deal" para começar.'
            : busca ? `Nenhum deal para "${busca}".`
            : `Nenhum deal em "${ESTAGIO_CONFIG[filtro as Estagio]?.label ?? filtro}".`}
        </div>

      ) : vista === 'tabela' ? (
        /* ── Tabela compacta ── */
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Título</th>
                <th>Valor</th>
                <th>Estágio</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dealsFiltrados.map(deal => (
                <tr key={deal.id}>
                  <td className={styles.tdEmpresa}>
                    {deal.empresa_nome ?? '—'}
                    {' '}{renderProspectLink(deal)}
                  </td>
                  <td>{deal.titulo}</td>
                  <td className={styles.tdValor}>
                    {deal.valor_estimado != null ? fmtBRL(deal.valor_estimado) : '—'}
                  </td>
                  <td>{renderBadge(deal.estagio)}</td>
                  <td>{fmtData(deal.updated_at)}</td>
                  <td>{renderAcoesTabela(deal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      ) : vista === 'kanban' ? (
        /* ── Kanban ── */
        <div className={styles.kanban}>
          {ESTAGIOS.map(estagio => {
            const colDeals = dealsFiltrados.filter(d => d.estagio === estagio)
            const cfg = ESTAGIO_CONFIG[estagio]
            return (
              <div key={estagio}
                className={`${styles.kanbanCol} ${dragOverCol === estagio ? styles.kanbanColOver : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(estagio) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverCol(null)
                  const id = Number(e.dataTransfer.getData('text/plain'))
                  const deal = deals.find(d => d.id === id)
                  if (deal) moverParaEstagio(deal, estagio)
                  setDragId(null)
                }}>
                <div className={styles.kanbanColTitle} style={{ borderBottomColor: cfg.cor }}>
                  {cfg.label} ({colDeals.length})
                </div>
                {colDeals.map(deal => (
                  <div key={deal.id}
                    className={`${styles.kanbanCard} ${dragId === deal.id ? styles.kanbanCardDrag : ''}`}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', String(deal.id)); setDragId(deal.id) }}
                    onDragEnd={() => setDragId(null)}>
                    <div className={styles.kanbanNome}>{deal.titulo}</div>
                    {deal.empresa_nome && <div className={styles.kanbanCnpj}>{deal.empresa_nome}</div>}
                    {deal.valor_estimado != null && (
                      <div className={styles.kanbanValor}>{fmtBRL(deal.valor_estimado)}</div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

      ) : (
        /* ── Lista (cards compactos com menu ⋯) ── */
        <div className={styles.lista}>
          {dealsFiltrados.map(deal => {
            const cfg = ESTAGIO_CONFIG[deal.estagio]
            const proximo = PROXIMO[deal.estagio]

            return (
              <div key={deal.id} className={`${styles.card} ${deal.estagio === 'ganho' ? styles.cardGanho : deal.estagio === 'perdido' ? styles.cardPerdido : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardEmpresaRow}>
                      {deal.empresa_nome && <span className={styles.cardEmpresa}>{deal.empresa_nome}</span>}
                      {renderProspectLink(deal)}
                    </div>
                    <div className={styles.cardTitulo}>{deal.titulo}</div>
                    {deal.observacao && <div className={styles.cardObs}>{deal.observacao}</div>}
                    {deal.estagio === 'perdido' && deal.motivo_perda && (
                      <div className={styles.cardMotivo}>Motivo: {deal.motivo_perda}</div>
                    )}
                  </div>
                  <div className={styles.cardDireita}>
                    {renderBadge(deal.estagio)}
                    {deal.valor_estimado != null && (
                      <div className={styles.cardValor}>{fmtBRL(deal.valor_estimado)}</div>
                    )}
                    <div className={styles.cardData}>{fmtData(deal.updated_at)}</div>
                  </div>
                </div>

                <div className={styles.cardAcoes}>
                  {!cfg.terminal && proximo && (
                    <button className={styles.btnAvancar} disabled={movendo === deal.id}
                      onClick={() => avancarEstagio(deal)}>
                      → {ESTAGIO_CONFIG[proximo].label}
                    </button>
                  )}
                  {!cfg.terminal && (
                    <>
                      <button className={styles.btnGanho} disabled={movendo === deal.id}
                        onClick={() => marcarGanho(deal)}>✓ Ganho</button>
                      <button className={styles.btnPerdido} disabled={movendo === deal.id}
                        onClick={() => { setPerdendoId(deal.id); setMotivoPerda('') }}>✕ Perdido</button>
                    </>
                  )}
                  {deal.estagio === 'ganho' && !deal.fin_lancamento_id && (
                    <button className={styles.btnRecebivel} disabled={gerandoId === deal.id}
                      onClick={() => gerarRecebivel(deal)}>
                      {gerandoId === deal.id ? '...' : '💰 Recebível'}
                    </button>
                  )}
                  {deal.estagio === 'ganho' && deal.fin_lancamento_id && (
                    <span className={styles.badgeRecebivel}>✓ #{deal.fin_lancamento_id}</span>
                  )}

                  {/* Menu overflow */}
                  <div className={styles.menuWrap}>
                    <button className={styles.btnMenu} onClick={() => setMenuAberto(menuAberto === deal.id ? null : deal.id)}>⋯</button>
                    {menuAberto === deal.id && (
                      <>
                        <div className={styles.menuBackdrop} onClick={() => setMenuAberto(null)} />
                        <div className={styles.menuDrop}>
                          {deal.empresa_cnpj && !deal.prospect_id && (
                            <button className={styles.menuItem} onClick={() => { vincularProspect(deal); setMenuAberto(null) }}>
                              ⊕ Vincular prospect
                            </button>
                          )}
                          {deal.prospect_id && (
                            <button className={styles.menuItem} onClick={() => { desvincularProspect(deal); setMenuAberto(null) }}>
                              ✕ Desvincular prospect
                            </button>
                          )}
                          <button className={`${styles.menuItem} ${styles.menuItemDanger}`}
                            onClick={() => { excluir(deal); setMenuAberto(null) }}>
                            🗑 Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <AgentFollowUp aberto={agentFollowUp} onClose={() => setAgentFollowUp(false)} />
    </div>
  )
}
