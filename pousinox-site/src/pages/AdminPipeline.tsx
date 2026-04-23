import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminPipeline.module.css'

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
  ganho:       { label: '✓ Ganho',     css: 'badgeGanho',      terminal: true,  cor: '#16a34a' },
  perdido:     { label: '✕ Perdido',   css: 'badgePerdido',    terminal: true,  cor: '#6b7280' },
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

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminPipeline() {
  const [deals,      setDeals]      = useState<Deal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filtro,     setFiltro]     = useState<Estagio | 'todos'>('todos')
  const [formAberto, setFormAberto] = useState(false)
  const [form,       setForm]       = useState(FORM_VAZIO)
  const [salvando,   setSalvando]   = useState(false)
  const [movendo,    setMovendo]    = useState<number | null>(null)
  const [msg,        setMsg]        = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [perdendoId, setPerdendoId] = useState<number | null>(null)
  const [motivoPerda, setMotivoPerda] = useState('')
  const [gerandoId,   setGerandoId]   = useState<number | null>(null)
  // prospect lookup no form
  const [formProspect, setFormProspect] = useState<ProspectEncontrado | null | 'buscando'>(null)
  // prospect lookup inline em cards existentes
  const [vinculando,   setVinculando]   = useState<number | null>(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  // ── Carregar ───────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('pipeline_deals')
      .select('*')
      .order('updated_at', { ascending: false })
    setDeals((data ?? []) as Deal[])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Criar deal ─────────────────────────────────────────────────────────────

  // ── Buscar prospect por CNPJ ──────────────────────────────────────────────

  async function buscarProspect(cnpj: string): Promise<ProspectEncontrado | null> {
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) return null
    const { data } = await supabaseAdmin
      .from('prospeccao')
      .select('id, razao_social, nome_fantasia, cnpj')
      .eq('cnpj', cnpjLimpo)
      .maybeSingle()
    return data as ProspectEncontrado | null
  }

  async function handleCnpjChange(cnpj: string) {
    setForm(f => ({ ...f, empresa_cnpj: cnpj }))
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) { setFormProspect(null); return }
    setFormProspect('buscando')
    const found = await buscarProspect(cnpjLimpo)
    setFormProspect(found)
    // Se encontrou prospect e o campo empresa_nome está vazio, preenche automaticamente
    if (found) {
      setForm(f => ({ ...f, empresa_nome: f.empresa_nome || found.razao_social || found.nome_fantasia || '' }))
    }
  }

  async function vincularProspect(deal: Deal) {
    if (!deal.empresa_cnpj) return
    setVinculando(deal.id)
    const found = await buscarProspect(deal.empresa_cnpj)
    if (!found) {
      setMsg({ tipo: 'erro', texto: 'Nenhum prospect encontrado com este CNPJ na base.' })
      setVinculando(null)
      return
    }
    await supabaseAdmin.from('pipeline_deals').update({ prospect_id: found.id }).eq('id', deal.id)
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, prospect_id: found.id } : d))
    setMsg({ tipo: 'ok', texto: `Vinculado: ${found.razao_social ?? found.cnpj}` })
    setVinculando(null)
  }

  async function desvincularProspect(deal: Deal) {
    await supabaseAdmin.from('pipeline_deals').update({ prospect_id: null }).eq('id', deal.id)
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, prospect_id: null } : d))
  }

  // ── Criar deal ─────────────────────────────────────────────────────────────

  async function criarDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)

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
    setSalvando(false)
  }

  // ── Mover estágio ──────────────────────────────────────────────────────────

  async function avancarEstagio(deal: Deal) {
    const proximo = PROXIMO[deal.estagio]
    if (!proximo) return
    setMovendo(deal.id)
    await supabaseAdmin.from('pipeline_deals').update({ estagio: proximo }).eq('id', deal.id)
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: proximo } : d))
    setMovendo(null)
  }

  async function marcarGanho(deal: Deal) {
    setMovendo(deal.id)
    await supabaseAdmin.from('pipeline_deals').update({ estagio: 'ganho' }).eq('id', deal.id)
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: 'ganho' } : d))
    setMovendo(null)
    setMsg({ tipo: 'ok', texto: 'Deal marcado como ganho. Gere o recebível para registrar no financeiro.' })
  }

  async function marcarPerdido(deal: Deal, motivo: string) {
    setMovendo(deal.id)
    await supabaseAdmin.from('pipeline_deals')
      .update({ estagio: 'perdido', motivo_perda: motivo || null })
      .eq('id', deal.id)
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, estagio: 'perdido', motivo_perda: motivo || null } : d))
    setMovendo(null)
    setPerdendoId(null)
    setMotivoPerda('')
  }

  // ── Gerar recebível ────────────────────────────────────────────────────────

  async function gerarRecebivel(deal: Deal) {
    if (!deal.valor_estimado) {
      setMsg({ tipo: 'erro', texto: 'Informe o valor estimado antes de gerar o recebível.' })
      return
    }
    if (!confirm(`Gerar recebível de ${fmtBRL(deal.valor_estimado)} para "${deal.titulo}"?\n\nUm lançamento será criado no Financeiro com status "pendente".`)) return

    setGerandoId(deal.id)

    // Verifica no banco se já existe lançamento (evita duplicata por duplo clique)
    const { data: check } = await supabaseAdmin
      .from('pipeline_deals')
      .select('fin_lancamento_id')
      .eq('id', deal.id)
      .single()
    if (check?.fin_lancamento_id) {
      setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, fin_lancamento_id: check.fin_lancamento_id } : d))
      setMsg({ tipo: 'erro', texto: 'Este deal já possui um recebível vinculado.' })
      setGerandoId(null)
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
      setGerandoId(null)
      return
    }

    await supabaseAdmin.from('pipeline_deals').update({ fin_lancamento_id: lanc.id }).eq('id', deal.id)
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, fin_lancamento_id: lanc.id } : d))
    setMsg({ tipo: 'ok', texto: 'Recebível criado. Acesse Financeiro → Lançamentos para acompanhar.' })
    setGerandoId(null)
  }

  // ── Excluir ────────────────────────────────────────────────────────────────

  async function excluir(deal: Deal) {
    if (!confirm(`Excluir deal "${deal.titulo}"?`)) return
    await supabaseAdmin.from('pipeline_deals').delete().eq('id', deal.id)
    setDeals(ds => ds.filter(d => d.id !== deal.id))
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const ativos  = deals.filter(d => !ESTAGIO_CONFIG[d.estagio].terminal)
  const ganhos  = deals.filter(d => d.estagio === 'ganho')
  const perdidos = deals.filter(d => d.estagio === 'perdido')
  const valorPotencial = ativos.reduce((s, d) => s + (d.valor_estimado ?? 0), 0)
  const valorGanho     = ganhos.reduce((s, d) => s + (d.valor_estimado ?? 0), 0)

  const dealsFiltrados = filtro === 'todos'
    ? deals
    : deals.filter(d => d.estagio === filtro)

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
          <div className={styles.pageTitle}>🎯 Pipeline Comercial</div>
          <div className={styles.pageSubtitle}>Deals individuais por prospect ou cliente</div>
        </div>
        <button className={styles.btnPrimary} onClick={() => setFormAberto(f => !f)}>
          {formAberto ? '✕ Fechar' : '+ Novo Deal'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{ativos.length}</span>
          <span className={styles.statLabel}>em andamento</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statVal}>{valorPotencial > 0 ? fmtBRL(valorPotencial) : '—'}</span>
          <span className={styles.statLabel}>valor potencial</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={`${styles.statVal} ${styles.statGanho}`}>{ganhos.length}</span>
          <span className={styles.statLabel}>ganhos {valorGanho > 0 ? `· ${fmtBRL(valorGanho)}` : ''}</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={`${styles.statVal} ${styles.statPerdido}`}>{perdidos.length}</span>
          <span className={styles.statLabel}>perdidos</span>
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
                placeholder="Ex: Revestimento fachada — Edifício Central" required />
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
              {formProspect === null && form.empresa_cnpj.replace(/\D/g,'').length === 14 && (
                <span className={styles.prospectNaoEncontrado}>Não encontrado na base de prospects</span>
              )}
            </div>
            <div className={styles.field}>
              <label>Estágio inicial</label>
              <select className={styles.input} value={form.estagio}
                onChange={e => setForm(f => ({ ...f, estagio: e.target.value as Estagio }))}>
                {ESTAGIOS_ATIVOS.map(e => (
                  <option key={e} value={e}>{ESTAGIO_CONFIG[e].label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Valor estimado (R$)</label>
              <input className={styles.input} type="number" step="0.01" min="0"
                value={form.valor_estimado}
                onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                placeholder="0,00" />
            </div>
            <div className={styles.fieldFull}>
              <label>Observação</label>
              <input className={styles.input} value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Contexto comercial, contato, próximo passo..." />
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

      {/* Filtro por estágio */}
      <div className={styles.filtros}>
        {(['todos', ...ESTAGIOS] as const).map(e => (
          <button key={e}
            className={`${styles.filtroBtn} ${filtro === e ? styles.filtroBtnAtivo : ''}`}
            onClick={() => setFiltro(e)}>
            {e === 'todos' ? `Todos (${deals.length})` : `${ESTAGIO_CONFIG[e].label.replace('✓ ', '').replace('✕ ', '')} (${deals.filter(d => d.estagio === e).length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : dealsFiltrados.length === 0 ? (
        <div className={styles.vazio}>
          {filtro === 'todos'
            ? 'Nenhum deal. Clique em "+ Novo Deal" para começar.'
            : `Nenhum deal em "${ESTAGIO_CONFIG[filtro as Estagio]?.label ?? filtro}".`}
        </div>
      ) : (
        <div className={styles.lista}>
          {dealsFiltrados.map(deal => {
            const cfg = ESTAGIO_CONFIG[deal.estagio]
            const proximo = PROXIMO[deal.estagio]
            const isPerdendo = perdendoId === deal.id

            return (
              <div key={deal.id} className={`${styles.card} ${deal.estagio === 'ganho' ? styles.cardGanho : deal.estagio === 'perdido' ? styles.cardPerdido : ''}`}>

                {/* Topo: empresa + título + valor + badge */}
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardEmpresaRow}>
                      {deal.empresa_nome && (
                        <span className={styles.cardEmpresa}>{deal.empresa_nome}</span>
                      )}
                      {deal.prospect_id ? (
                        <span className={styles.badgeProspect}
                          title={`Prospect #${deal.prospect_id} — clique × para desvincular`}>
                          🔗 prospect
                          <button className={styles.btnDesvincular}
                            onClick={() => desvincularProspect(deal)}
                            title="Desvincular prospect">×</button>
                        </span>
                      ) : deal.empresa_cnpj ? (
                        <button className={styles.btnVincularProspect}
                          disabled={vinculando === deal.id}
                          onClick={() => vincularProspect(deal)}>
                          {vinculando === deal.id ? '...' : '⊕ Vincular prospect'}
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.cardTitulo}>{deal.titulo}</div>
                    {deal.observacao && (
                      <div className={styles.cardObs}>{deal.observacao}</div>
                    )}
                    {deal.estagio === 'perdido' && deal.motivo_perda && (
                      <div className={styles.cardMotivo}>Motivo: {deal.motivo_perda}</div>
                    )}
                  </div>
                  <div className={styles.cardDireita}>
                    <span className={styles[cfg.css as keyof typeof styles]}>{cfg.label}</span>
                    {deal.valor_estimado != null && (
                      <div className={styles.cardValor}>{fmtBRL(deal.valor_estimado)}</div>
                    )}
                    <div className={styles.cardData}>{fmtData(deal.updated_at)}</div>
                  </div>
                </div>

                {/* Ações */}
                <div className={styles.cardAcoes}>
                  {/* Deals ativos: avançar, ganho, perdido */}
                  {!cfg.terminal && (
                    <>
                      {proximo && (
                        <button className={styles.btnAvancar}
                          disabled={movendo === deal.id}
                          onClick={() => avancarEstagio(deal)}>
                          {movendo === deal.id ? '...' : `→ ${ESTAGIO_CONFIG[proximo].label}`}
                        </button>
                      )}
                      <button className={styles.btnGanho}
                        disabled={movendo === deal.id}
                        onClick={() => marcarGanho(deal)}>
                        ✓ Ganho
                      </button>
                      {!isPerdendo ? (
                        <button className={styles.btnPerdido}
                          disabled={movendo === deal.id}
                          onClick={() => { setPerdendoId(deal.id); setMotivoPerda('') }}>
                          ✕ Perdido
                        </button>
                      ) : (
                        <div className={styles.motivoWrap}>
                          <input className={styles.motivoInput}
                            placeholder="Motivo da perda (opcional)"
                            value={motivoPerda}
                            onChange={e => setMotivoPerda(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && marcarPerdido(deal, motivoPerda)} />
                          <button className={styles.btnPerdido}
                            onClick={() => marcarPerdido(deal, motivoPerda)}>
                            Confirmar
                          </button>
                          <button className={styles.btnCancelar}
                            onClick={() => { setPerdendoId(null); setMotivoPerda('') }}>
                            ✕
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Deal ganho: gerar recebível */}
                  {deal.estagio === 'ganho' && !deal.fin_lancamento_id && (
                    <button className={styles.btnRecebivel}
                      disabled={gerandoId === deal.id}
                      onClick={() => gerarRecebivel(deal)}>
                      {gerandoId === deal.id ? 'Criando...' : '💰 Gerar Recebível'}
                    </button>
                  )}
                  {deal.estagio === 'ganho' && deal.fin_lancamento_id && (
                    <span className={styles.badgeRecebivel}>
                      ✓ Recebível #{deal.fin_lancamento_id}
                    </span>
                  )}

                  <button className={styles.btnExcluir} onClick={() => excluir(deal)}>Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
