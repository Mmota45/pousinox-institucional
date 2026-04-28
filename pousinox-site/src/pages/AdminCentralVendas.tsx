import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminCentralVendas.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProspectScore {
  prospect_id: number
  score_total: number
  score_demanda: number
  score_segmento: number
  score_porte: number
  score_distancia: number
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  uf: string
  cidade: string
  segmento: string | null
  porte: string | null
  telefone1: string | null
  telefone2: string | null
  email: string | null
  status_contato: string | null
  ultimo_contato: string | null
}

interface Followup {
  id: number
  prospect_id: number
  deal_id: number | null
  tipo: string
  data_prevista: string
  data_realizada: string | null
  status: string
  observacao: string | null
  created_by: string | null
  created_at: string
  prospeccao: { id: number; razao_social: string; nome_fantasia: string | null; cnpj: string; uf: string; cidade: string; telefone1: string | null; email: string | null }
  pipeline_deals: { id: number; titulo: string; estagio: string; valor_estimado: number } | null
}

interface Material {
  id: number; titulo: string; tipo: string; url: string; descricao: string | null; ativo: boolean; envios: number
}

interface DashData {
  contactados: number; materiaisEnviados: number
  followupsAtrasados: number; followupsHoje: number
  dealsAbertos: number; dealsGanhos: number; receitaPipeline: number
}

type Aba = 'radar' | 'hotlist' | 'followups' | 'materiais' | 'dashboard'

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoje = new Date().toISOString().slice(0, 10)
const fmtBRL = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fmtData = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
const diasAte = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

const ABAS: { key: Aba; label: string; icon: string }[] = [
  { key: 'hotlist', label: 'Hot List', icon: '🔥' },
  { key: 'followups', label: 'Follow-ups', icon: '📅' },
  { key: 'materiais', label: 'Materiais', icon: '📎' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'radar', label: 'Radar', icon: '📡' },
]

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminCentralVendas() {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)

  const [aba, setAba] = useState<Aba>('hotlist')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const showMsg = useCallback((tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3500)
  }, [])

  // ── Hot List ──
  const [hotlist, setHotlist] = useState<ProspectScore[]>([])
  const [loadingHot, setLoadingHot] = useState(false)
  const [filtroUFs, setFiltroUFs] = useState<string[]>([])
  const [filtroSegmentos, setFiltroSegmentos] = useState<string[]>([])
  const [filtroDemanda, setFiltroDemanda] = useState('')
  const [showUFDrop, setShowUFDrop] = useState(false)
  const [showSegDrop, setShowSegDrop] = useState(false)

  // ── Follow-ups ──
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loadingFup, setLoadingFup] = useState(false)

  // ── Materiais ──
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loadingMat, setLoadingMat] = useState(false)
  const [formMat, setFormMat] = useState({ titulo: '', tipo: 'apresentacao', url: '', descricao: '' })
  const [showFormMat, setShowFormMat] = useState(false)

  // ── Dashboard ──
  const [dash, setDash] = useState<DashData | null>(null)
  const [loadingDash, setLoadingDash] = useState(false)

  // ── Funnel data ──
  const [funnelData, setFunnelData] = useState<{ total: number; contactados: number; deals: number; propostas: number; ganhos: number }>({ total: 0, contactados: 0, deals: 0, propostas: 0, ganhos: 0 })

  // ── Loads ───────────────────────────────────────────────────────────────────

  const carregarHotList = useCallback(async () => {
    setLoadingHot(true)
    if (filtroUFs.length === 1) {
      const { data } = await supabaseAdmin.rpc('fn_top_prospects', { n: 50, filtro_uf: filtroUFs[0] })
      setHotlist((data ?? []) as ProspectScore[])
    } else if (filtroUFs.length > 1) {
      const results = await Promise.all(
        filtroUFs.map(uf => supabaseAdmin.rpc('fn_top_prospects', { n: Math.ceil(50 / filtroUFs.length), filtro_uf: uf }))
      )
      const merged = results.flatMap(r => (r.data ?? []) as ProspectScore[])
      merged.sort((a, b) => Number(b.score_total) - Number(a.score_total))
      setHotlist(merged.slice(0, 50))
    } else {
      const { data } = await supabaseAdmin.rpc('fn_top_prospects', { n: 50, filtro_uf: null })
      setHotlist((data ?? []) as ProspectScore[])
    }
    setLoadingHot(false)
  }, [filtroUFs])

  const carregarFollowups = useCallback(async () => {
    setLoadingFup(true)
    const { data } = await supabaseAdmin
      .from('followups')
      .select('*, prospeccao(id,razao_social,nome_fantasia,cnpj,uf,cidade,telefone1,email), pipeline_deals(id,titulo,estagio,valor_estimado)')
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true })
      .limit(100)
    setFollowups((data ?? []) as Followup[])
    setLoadingFup(false)
  }, [])

  const carregarMateriais = useCallback(async () => {
    setLoadingMat(true)
    const { data } = await supabaseAdmin
      .from('materiais_comerciais')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
    setMateriais((data ?? []) as Material[])
    setLoadingMat(false)
  }, [])

  const carregarDashboard = useCallback(async () => {
    setLoadingDash(true)
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString()

    const [atRes, fupRes, dealsRes, totalRes] = await Promise.all([
      supabaseAdmin.from('activity_log').select('id,tipo', { count: 'exact' }).gte('created_at', semanaAtras),
      supabaseAdmin.from('followups').select('id,status,data_prevista').eq('status', 'pendente'),
      supabaseAdmin.from('pipeline_deals').select('id,estagio,valor_estimado'),
      supabaseAdmin.from('prospeccao').select('id', { count: 'exact', head: true }),
    ])

    const atividades = atRes.data ?? []
    const fups = fupRes.data ?? []
    const deals = dealsRes.data ?? []

    setDash({
      contactados: atividades.filter(a => a.tipo === 'contacted').length,
      materiaisEnviados: atividades.filter(a => a.tipo === 'material_sent').length,
      followupsAtrasados: fups.filter(f => f.data_prevista < hoje).length,
      followupsHoje: fups.filter(f => f.data_prevista === hoje).length,
      dealsAbertos: deals.filter(d => !['ganho', 'perdido'].includes(d.estagio)).length,
      dealsGanhos: deals.filter(d => d.estagio === 'ganho').length,
      receitaPipeline: deals.filter(d => d.estagio === 'ganho').reduce((s, d) => s + (d.valor_estimado ?? 0), 0),
    })

    // Funnel
    const contactadosTotal = await supabaseAdmin.from('prospeccao').select('id', { count: 'exact' }).not('ultimo_contato', 'is', null)
    setFunnelData({
      total: totalRes.count ?? 0,
      contactados: contactadosTotal.count ?? 0,
      deals: deals.filter(d => !['ganho', 'perdido'].includes(d.estagio)).length,
      propostas: deals.filter(d => ['proposta', 'negociacao'].includes(d.estagio)).length,
      ganhos: deals.filter(d => d.estagio === 'ganho').length,
    })

    setLoadingDash(false)
  }, [])

  useEffect(() => {
    if (aba === 'hotlist') carregarHotList()
    if (aba === 'followups') carregarFollowups()
    if (aba === 'materiais') carregarMateriais()
    if (aba === 'dashboard') carregarDashboard()
  }, [aba, carregarHotList, carregarFollowups, carregarMateriais, carregarDashboard])

  // Recarregar quando filtro UF muda
  useEffect(() => {
    if (aba === 'hotlist') carregarHotList()
  }, [filtroUFs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ações ───────────────────────────────────────────────────────────────────

  async function marcarContactado(ps: ProspectScore) {
    const agora = new Date().toISOString()
    const followupDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

    await Promise.all([
      supabaseAdmin.from('activity_log').insert({
        prospect_id: ps.prospect_id, tipo: 'contacted', canal: 'whatsapp',
        detalhes: { score: ps.score_total }, created_by: 'admin',
      }),
      supabaseAdmin.from('followups').insert({
        prospect_id: ps.prospect_id, tipo: '3d', data_prevista: followupDate,
        status: 'pendente', created_by: 'admin',
      }),
      supabaseAdmin.from('prospeccao').update({
        ultimo_contato: agora, proximo_followup: followupDate,
      }).eq('id', ps.prospect_id),
    ])

    showMsg('ok', `Contactado! Follow-up agendado para ${fmtData(followupDate)}`)
    carregarHotList()
  }

  function abrirWhatsApp(tel: string | null, nome: string) {
    if (!tel) { showMsg('erro', 'Sem telefone cadastrado'); return }
    const num = tel.replace(/\D/g, '')
    const numFull = num.length <= 11 ? `55${num}` : num
    const msg = encodeURIComponent(`Olá! Sou da Pousinox, fabricante de fixadores de porcelanato em aço inox. Gostaria de apresentar nossos produtos. Podemos conversar?`)
    window.open(`https://wa.me/${numFull}?text=${msg}`, '_blank')
  }

  function enviarMaterial(tel: string | null, material: Material, prospectId?: number) {
    if (!tel) { showMsg('erro', 'Sem telefone cadastrado'); return }
    const num = tel.replace(/\D/g, '')
    const numFull = num.length <= 11 ? `55${num}` : num
    const msg = encodeURIComponent(`Olá! Segue ${material.titulo} da Pousinox: ${material.url}`)
    window.open(`https://wa.me/${numFull}?text=${msg}`, '_blank')

    // Registrar envio
    supabaseAdmin.from('activity_log').insert({
      prospect_id: prospectId ?? null, tipo: 'material_sent', canal: 'whatsapp',
      detalhes: { material_id: material.id, titulo: material.titulo },
      created_by: 'admin',
    })
    supabaseAdmin.from('materiais_comerciais').update({ envios: material.envios + 1 }).eq('id', material.id)
  }

  async function marcarFollowupFeito(fup: Followup) {
    const proximoDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    await Promise.all([
      supabaseAdmin.from('followups').update({
        status: 'realizado', data_realizada: new Date().toISOString(),
      }).eq('id', fup.id),
      supabaseAdmin.from('activity_log').insert({
        prospect_id: fup.prospect_id, deal_id: fup.deal_id,
        tipo: 'follow_up', canal: 'whatsapp', created_by: 'admin',
      }),
      supabaseAdmin.from('followups').insert({
        prospect_id: fup.prospect_id, deal_id: fup.deal_id,
        tipo: '7d', data_prevista: proximoDate, status: 'pendente', created_by: 'admin',
      }),
      supabaseAdmin.from('prospeccao').update({
        ultimo_contato: new Date().toISOString(), proximo_followup: proximoDate,
      }).eq('id', fup.prospect_id),
    ])

    showMsg('ok', `Follow-up realizado! Próximo em ${fmtData(proximoDate)}`)
    carregarFollowups()
  }

  async function adiarFollowup(fup: Followup, dias: number) {
    const novaData = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
    await supabaseAdmin.from('followups').update({ data_prevista: novaData }).eq('id', fup.id)
    showMsg('ok', `Adiado para ${fmtData(novaData)}`)
    carregarFollowups()
  }

  async function salvarMaterial(e: React.FormEvent) {
    e.preventDefault()
    await supabaseAdmin.from('materiais_comerciais').insert({
      titulo: formMat.titulo, tipo: formMat.tipo, url: formMat.url,
      descricao: formMat.descricao || null,
    })
    setFormMat({ titulo: '', tipo: 'apresentacao', url: '', descricao: '' })
    setShowFormMat(false)
    showMsg('ok', 'Material cadastrado')
    carregarMateriais()
  }

  async function computarScores() {
    await carregarHotList()
    showMsg('ok', 'Hot list atualizada!')
  }

  // ── Filtros Hot List ──
  const UFS_DISPONIVEIS = ['MG','SP','RJ','ES','PR','SC','RS','GO','DF','BA','MT','MS','CE','PE','PA','AM','MA','RN','PB','PI','SE','AL','RO','AC','AP','TO','RR']
  const SEGMENTOS_DISPONIVEIS = ['Construtoras','Revestimentos','Arquitetura','Restaurantes','Supermercados','Panificação','Hospitalar','Açougues','Veterinária','Hotelaria','Peixarias','Laboratórios']

  const hotlistFiltrada = hotlist.filter(h => {
    if (filtroSegmentos.length > 0 && !filtroSegmentos.includes(h.segmento ?? '')) return false
    const dem = Number(h.score_demanda)
    if (filtroDemanda === 'alta' && dem < 7) return false
    if (filtroDemanda === 'media' && (dem < 3 || dem >= 7)) return false
    if (filtroDemanda === 'baixa' && dem >= 3) return false
    return true
  })

  // ── Follow-ups separados ──
  const fupAtrasados = followups.filter(f => f.data_prevista < hoje)
  const fupHoje = followups.filter(f => f.data_prevista === hoje)
  const fupProximos = followups.filter(f => f.data_prevista > hoje)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

      {/* Abas */}
      <div className={styles.tabs}>
        {ABAS.map(a => (
          <button key={a.key} className={`${styles.tab} ${aba === a.key ? styles.tabAtivo : ''}`}
            onClick={() => setAba(a.key)}>
            <span className={styles.tabIcon}>{a.icon}</span> {a.label}
            {a.key === 'followups' && fupAtrasados.length > 0 && (
              <span className={styles.badgeAlerta}>{fupAtrasados.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOT LIST */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'hotlist' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Prospectar Hoje</h2>
            <button className={styles.btnPrimary} onClick={computarScores} disabled={loadingHot}>
              {loadingHot ? 'Calculando...' : 'Atualizar Scores'}
            </button>
          </div>

          <div className={styles.filtros}>
            <div className={styles.multiSelect}>
              <button className={styles.multiBtn} onClick={() => setShowUFDrop(!showUFDrop)}>
                {filtroUFs.length === 0 ? 'Todos os estados' : filtroUFs.join(', ')}
                <span className={styles.arrow}>▾</span>
              </button>
              {showUFDrop && (
                <>
                  <div className={styles.backdrop} onClick={() => setShowUFDrop(false)} />
                  <div className={styles.multiDrop}>
                    {filtroUFs.length > 0 && (
                      <button className={styles.multiOptClear} onClick={() => { setFiltroUFs([]); setShowUFDrop(false) }}>✕ Limpar</button>
                    )}
                    {UFS_DISPONIVEIS.map(uf => (
                      <label key={uf} className={styles.multiOpt}>
                        <input type="checkbox" checked={filtroUFs.includes(uf)}
                          onChange={() => setFiltroUFs(prev => prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf])} />
                        {uf}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className={styles.multiSelect}>
              <button className={styles.multiBtn} onClick={() => setShowSegDrop(!showSegDrop)}>
                {filtroSegmentos.length === 0 ? 'Todos os segmentos' : filtroSegmentos.join(', ')}
                <span className={styles.arrow}>▾</span>
              </button>
              {showSegDrop && (
                <>
                  <div className={styles.backdrop} onClick={() => setShowSegDrop(false)} />
                  <div className={styles.multiDrop}>
                    {filtroSegmentos.length > 0 && (
                      <button className={styles.multiOptClear} onClick={() => { setFiltroSegmentos([]); setShowSegDrop(false) }}>✕ Limpar</button>
                    )}
                    {SEGMENTOS_DISPONIVEIS.map(s => (
                      <label key={s} className={styles.multiOpt}>
                        <input type="checkbox" checked={filtroSegmentos.includes(s)}
                          onChange={() => setFiltroSegmentos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                        {s}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <select className={styles.input} value={filtroDemanda} onChange={e => setFiltroDemanda(e.target.value)}>
              <option value="">Demanda: Todas</option>
              <option value="alta">🟢 Alta (≥ 7)</option>
              <option value="media">🟡 Média (3–7)</option>
              <option value="baixa">🔴 Baixa (&lt; 3)</option>
            </select>
            <span className={styles.countLabel}>{hotlistFiltrada.length} prospects</span>
          </div>

          {loadingHot ? (
            <p className={styles.vazio}>Carregando...</p>
          ) : hotlistFiltrada.length === 0 ? (
            <p className={styles.vazio}>Clique em "Atualizar Scores" para gerar a hot list.</p>
          ) : (
            <div className={styles.cardGrid}>
              {hotlistFiltrada.map((ps, idx) => {
                const nome = ps.nome_fantasia || ps.razao_social
                return (
                  <div key={ps.prospect_id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.rank}>#{idx + 1}</span>
                      <span className={styles.scoreTotal}>{Number(ps.score_total)?.toFixed(1)}</span>
                    </div>
                    <h3 className={styles.cardNome} title={ps.razao_social}>{nome}</h3>
                    <div className={styles.cardMeta}>
                      <span>{ps.cidade}/{ps.uf}</span>
                      {ps.segmento && <span className={styles.badge}>{ps.segmento}</span>}
                      {ps.porte && <span className={styles.badgePorte}>{ps.porte}</span>}
                    </div>
                    <div className={styles.scores}>
                      <div className={styles.scoreBar}>
                        <span>Demanda</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_demanda) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                      <div className={styles.scoreBar}>
                        <span>Segmento</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_segmento) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                      <div className={styles.scoreBar}>
                        <span>Porte</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_porte) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                      <div className={styles.scoreBar}>
                        <span>Proximidade</span>
                        <div className={styles.bar}><div style={{ width: `${(Number(ps.score_distancia) / 10) * 100}%` }} className={styles.barFill} /></div>
                      </div>
                    </div>
                    {ps.telefone1 && <div className={styles.cardTel}>{ps.telefone1}</div>}
                    {ps.ultimo_contato && <div className={styles.cardUltimo}>Último contato: {fmtData(ps.ultimo_contato)}</div>}
                    <div className={styles.cardActions}>
                      <button className={styles.btnContactar} onClick={() => marcarContactado(ps)}>Contactei</button>
                      <button className={styles.btnWpp} onClick={() => abrirWhatsApp(ps.telefone1, nome)}>WhatsApp</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOLLOW-UPS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'followups' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Follow-ups</h2>
            <button className={styles.btnSecondary} onClick={carregarFollowups} disabled={loadingFup}>Atualizar</button>
          </div>

          {loadingFup ? (
            <p className={styles.vazio}>Carregando...</p>
          ) : followups.length === 0 ? (
            <p className={styles.vazio}>Nenhum follow-up pendente. Comece contactando prospects na Hot List!</p>
          ) : (
            <div className={styles.kanban}>
              {/* Atrasados */}
              <div className={styles.kanbanCol}>
                <h3 className={styles.kanbanTitulo} style={{ color: '#dc2626' }}>
                  Atrasados ({fupAtrasados.length})
                </h3>
                {fupAtrasados.map(f => (
                  <FollowupCard key={f.id} fup={f}
                    onFeito={() => marcarFollowupFeito(f)}
                    onAdiar={(d) => adiarFollowup(f, d)}
                    onWpp={() => abrirWhatsApp(f.prospeccao?.telefone1, f.prospeccao?.razao_social)}
                    corBorda="#fca5a5"
                  />
                ))}
              </div>
              {/* Hoje */}
              <div className={styles.kanbanCol}>
                <h3 className={styles.kanbanTitulo} style={{ color: '#d97706' }}>
                  Hoje ({fupHoje.length})
                </h3>
                {fupHoje.map(f => (
                  <FollowupCard key={f.id} fup={f}
                    onFeito={() => marcarFollowupFeito(f)}
                    onAdiar={(d) => adiarFollowup(f, d)}
                    onWpp={() => abrirWhatsApp(f.prospeccao?.telefone1, f.prospeccao?.razao_social)}
                    corBorda="#fde68a"
                  />
                ))}
              </div>
              {/* Próximos */}
              <div className={styles.kanbanCol}>
                <h3 className={styles.kanbanTitulo} style={{ color: '#16a34a' }}>
                  Próximos 7d ({fupProximos.length})
                </h3>
                {fupProximos.map(f => (
                  <FollowupCard key={f.id} fup={f}
                    onFeito={() => marcarFollowupFeito(f)}
                    onAdiar={(d) => adiarFollowup(f, d)}
                    onWpp={() => abrirWhatsApp(f.prospeccao?.telefone1, f.prospeccao?.razao_social)}
                    corBorda="#bbf7d0"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MATERIAIS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'materiais' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Materiais de Venda</h2>
            <button className={styles.btnPrimary} onClick={() => setShowFormMat(!showFormMat)}>
              {showFormMat ? 'Cancelar' : '+ Novo Material'}
            </button>
          </div>

          {showFormMat && (
            <form className={styles.formMat} onSubmit={salvarMaterial}>
              <div className={styles.filtros}>
                <input className={styles.input} placeholder="Título *" required
                  value={formMat.titulo} onChange={e => setFormMat(f => ({ ...f, titulo: e.target.value }))} />
                <select className={styles.input} value={formMat.tipo}
                  onChange={e => setFormMat(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="apresentacao">Apresentação</option>
                  <option value="ficha_tecnica">Ficha Técnica</option>
                  <option value="laudo">Laudo</option>
                  <option value="cartao">Cartão Digital</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <input className={styles.input} placeholder="URL do material *" required
                value={formMat.url} onChange={e => setFormMat(f => ({ ...f, url: e.target.value }))} />
              <input className={styles.input} placeholder="Descrição (opcional)"
                value={formMat.descricao} onChange={e => setFormMat(f => ({ ...f, descricao: e.target.value }))} />
              <button type="submit" className={styles.btnPrimary}>Salvar</button>
            </form>
          )}

          {loadingMat ? (
            <p className={styles.vazio}>Carregando...</p>
          ) : materiais.length === 0 ? (
            <p className={styles.vazio}>Nenhum material cadastrado. Adicione apresentações, fichas técnicas e laudos.</p>
          ) : (
            <div className={styles.matGrid}>
              {materiais.map(m => (
                <div key={m.id} className={styles.matCard}>
                  <div className={styles.matTop}>
                    <span className={styles.matTipo}>
                      {m.tipo === 'apresentacao' ? '📊' : m.tipo === 'ficha_tecnica' ? '📋' : m.tipo === 'laudo' ? '🔬' : m.tipo === 'cartao' ? '💳' : '📎'}
                    </span>
                    <span className={styles.matEnvios}>{m.envios} envios</span>
                  </div>
                  <h3>{m.titulo}</h3>
                  {m.descricao && <p className={styles.matDesc}>{m.descricao}</p>}
                  <div className={styles.matActions}>
                    <a href={m.url} target="_blank" rel="noreferrer" className={styles.btnSecondary}>Abrir</a>
                    <button className={styles.btnWpp}
                      onClick={() => {
                        const tel = prompt('Telefone do prospect (DDD+número):')
                        if (tel) enviarMaterial(tel, m)
                      }}>
                      Enviar WPP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DASHBOARD */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'dashboard' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Dashboard Comercial</h2>
            <span className={styles.countLabel}>Últimos 7 dias</span>
          </div>

          {loadingDash ? (
            <p className={styles.vazio}>Carregando...</p>
          ) : dash ? (
            <>
              <div className={styles.kpiGrid}>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Prospects contactados</span>
                  <strong className={styles.kpiVal}>{dash.contactados}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Materiais enviados</span>
                  <strong className={styles.kpiVal}>{dash.materiaisEnviados}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Follow-ups atrasados</span>
                  <strong className={styles.kpiVal} style={{ color: dash.followupsAtrasados > 0 ? '#dc2626' : undefined }}>{dash.followupsAtrasados}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Follow-ups hoje</span>
                  <strong className={styles.kpiVal} style={{ color: dash.followupsHoje > 0 ? '#d97706' : undefined }}>{dash.followupsHoje}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Deals abertos</span>
                  <strong className={styles.kpiVal}>{dash.dealsAbertos}</strong>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Deals ganhos</span>
                  <strong className={styles.kpiVal} style={{ color: '#16a34a' }}>{dash.dealsGanhos}</strong>
                </div>
              </div>

              {/* Funil */}
              <div className={styles.funnel}>
                <h3>Funil Comercial</h3>
                <div className={styles.funnelBars}>
                  {[
                    { label: 'Prospects (scored)', val: funnelData.total, color: '#6366f1' },
                    { label: 'Contactados', val: funnelData.contactados, color: '#0ea5e9' },
                    { label: 'Deals abertos', val: funnelData.deals, color: '#f59e0b' },
                    { label: 'Propostas', val: funnelData.propostas, color: '#f97316' },
                    { label: 'Ganhos', val: funnelData.ganhos, color: '#16a34a' },
                  ].map((step, i) => {
                    const maxVal = Math.max(funnelData.total, 1)
                    const pct = Math.max((step.val / maxVal) * 100, 4)
                    return (
                      <div key={i} className={styles.funnelStep}>
                        <span className={styles.funnelLabel}>{step.label}</span>
                        <div className={styles.funnelBar}>
                          <div style={{ width: `${pct}%`, background: step.color }} className={styles.funnelFill}>
                            <span>{step.val}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={styles.kpi} style={{ marginTop: 16 }}>
                <span className={styles.kpiLabel}>Receita pipeline (ganhos)</span>
                <strong className={styles.kpiVal} style={{ color: '#16a34a', fontSize: '1.8rem' }}>{fmt(dash.receitaPipeline)}</strong>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* RADAR */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'radar' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Radar de Demanda</h2>
          </div>
          <div className={styles.radarPlaceholder}>
            <p>Google Search Console, Mercado Livre API e Google Trends serão integrados aqui.</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Fase 4 do plano — requer configuração de credenciais GSC e OAuth do Mercado Livre.
            </p>
            <div className={styles.radarCards}>
              <div className={styles.radarCard}>
                <h4>Google Search Console</h4>
                <p>Queries reais de busca por estado — onde o cliente está pesquisando</p>
                <span className={styles.badgePendente}>Pendente</span>
              </div>
              <div className={styles.radarCard}>
                <h4>Mercado Livre</h4>
                <p>Perguntas nos anúncios em tempo real — intenção de compra</p>
                <span className={styles.badgePendente}>Pendente</span>
              </div>
              <div className={styles.radarCard}>
                <h4>Google Trends</h4>
                <p>Tendências de interesse por estado — mercados emergentes</p>
                <span className={styles.badgePendente}>Pendente</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente Follow-up Card ─────────────────────────────────────────────────

function FollowupCard({ fup, onFeito, onAdiar, onWpp, corBorda }: {
  fup: Followup; onFeito: () => void; onAdiar: (dias: number) => void; onWpp: () => void; corBorda: string
}) {
  const dias = diasAte(fup.data_prevista)
  const nome = fup.prospeccao?.nome_fantasia || fup.prospeccao?.razao_social || '—'

  return (
    <div className={styles.fupCard} style={{ borderLeftColor: corBorda }}>
      <div className={styles.fupTop}>
        <strong>{nome}</strong>
        <span className={styles.fupDias}>
          {dias < 0 ? `${Math.abs(dias)}d atrás` : dias === 0 ? 'Hoje' : `em ${dias}d`}
        </span>
      </div>
      {fup.prospeccao?.cidade && (
        <span className={styles.fupMeta}>{fup.prospeccao.cidade}/{fup.prospeccao.uf}</span>
      )}
      {fup.pipeline_deals && (
        <span className={styles.fupDeal}>Deal: {fup.pipeline_deals.titulo}</span>
      )}
      {fup.observacao && <p className={styles.fupObs}>{fup.observacao}</p>}
      <div className={styles.fupActions}>
        <button className={styles.btnFeito} onClick={onFeito}>Feito</button>
        <button className={styles.btnAdiar} onClick={() => onAdiar(3)}>+3d</button>
        <button className={styles.btnAdiar} onClick={() => onAdiar(7)}>+7d</button>
        <button className={styles.btnWppSmall} onClick={onWpp}>WPP</button>
      </div>
    </div>
  )
}
