import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminBensFrota.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Status    = 'ativo' | 'inativo' | 'em_manutencao' | 'vendido' | 'sucata'
type TipoBem   = 'veiculo' | 'maquina' | 'equipamento' | 'imovel' | 'outro'
type TipoCusto = 'combustivel' | 'seguro' | 'ipva' | 'licenciamento' | 'pneu' | 'revisao' | 'reparo' | 'multa' | 'outro'
type TipoManut = 'preventiva' | 'corretiva' | 'revisao'
type StatusManut = 'agendada' | 'em_execucao' | 'concluida' | 'cancelada'
type Vista     = 'lista' | 'form' | 'detalhe'
type AbaDetalhe = 'geral' | 'custos' | 'manutencoes' | 'vencimentos' | 'alocacao' | 'historico'

interface CentroCusto { id: number; nome: string }

interface Bem {
  id: number; codigo: string; tipo: TipoBem; nome: string; descricao: string | null
  fabricante: string | null; modelo: string | null; ano_fabricacao: number | null
  ano_aquisicao: number | null; numero_serie: string | null; placa: string | null
  renavam: string | null; chassi: string | null; status: Status
  centro_custo_id: number | null; valor_aquisicao: number | null; data_aquisicao: string | null
  localizacao: string | null; responsavel: string | null; foto_url: string | null
  observacao: string | null; created_at: string
  fin_centros_custo?: { nome: string } | null
}

interface Custo {
  id: number; bem_id: number; tipo_custo: TipoCusto; descricao: string
  valor: number; data_custo: string; fin_lancamento_id: number | null
  observacao: string | null; created_at: string
}

interface Manutencao {
  id: number; bem_id: number; tipo: TipoManut; descricao: string; status: StatusManut
  data_prevista: string | null; data_realizada: string | null
  km_previsto: number | null; km_realizado: number | null
  custo_realizado: number | null; om_referencia: string | null
  fin_lancamento_id: number | null; observacao: string | null; created_at: string
}

interface Alocacao {
  id: number; bem_id: number; projeto_id: number | null; descricao_uso: string
  data_inicio: string; data_fim: string | null; responsavel: string | null
  observacao: string | null; created_at: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { label: string; css: string }> = {
  ativo:          { label: 'Ativo',          css: styles.sAtivo         },
  inativo:        { label: 'Inativo',        css: styles.sInativo       },
  em_manutencao:  { label: 'Em manutenção',  css: styles.sManutencao    },
  vendido:        { label: 'Vendido',        css: styles.sVendido       },
  sucata:         { label: 'Sucata',         css: styles.sSucata        },
}

const TIPO_BEM_LABEL: Record<TipoBem, string> = {
  veiculo:      '🚗 Veículo', maquina: '⚙️ Máquina',
  equipamento:  '🔧 Equipamento', imovel: '🏠 Imóvel', outro: 'Outro',
}

const TIPO_CUSTO_LABEL: Record<TipoCusto, string> = {
  combustivel: 'Combustível', seguro: 'Seguro', ipva: 'IPVA',
  licenciamento: 'Licenciamento', pneu: 'Pneu', revisao: 'Revisão',
  reparo: 'Reparo', multa: 'Multa', outro: 'Outro',
}

const TIPO_MANUT_LABEL: Record<TipoManut, string> = {
  preventiva: 'Preventiva', corretiva: 'Corretiva', revisao: 'Revisão',
}

const STATUS_MANUT_CFG: Record<StatusManut, { label: string; css: string }> = {
  agendada:     { label: 'Agendada',     css: styles.mAgendada    },
  em_execucao:  { label: 'Em execução',  css: styles.mExecucao    },
  concluida:    { label: 'Concluída',    css: styles.mConcluida   },
  cancelada:    { label: 'Cancelada',    css: styles.mCancelada   },
}

// Tipos de custo que representam documentos anuais com vencimento
const TIPOS_VENCIMENTO: TipoCusto[] = ['ipva', 'seguro', 'licenciamento']

const FORM_BEM_VAZIO = {
  tipo: 'veiculo' as TipoBem, nome: '', descricao: '', fabricante: '', modelo: '',
  ano_fabricacao: '', ano_aquisicao: '', numero_serie: '', placa: '', renavam: '',
  chassi: '', status: 'ativo' as Status, centro_custo_id: '',
  valor_aquisicao: '', data_aquisicao: '', localizacao: '', responsavel: '',
  foto_url: '', observacao: '',
}

const FORM_CUSTO_VAZIO = {
  tipo_custo: 'reparo' as TipoCusto, descricao: '',
  valor: '', data_custo: new Date().toISOString().slice(0, 10), observacao: '',
}

const FORM_MANUT_VAZIO = {
  tipo: 'preventiva' as TipoManut, descricao: '', status: 'agendada' as StatusManut,
  data_prevista: '', data_realizada: '', km_previsto: '', km_realizado: '',
  custo_realizado: '', om_referencia: '', observacao: '',
}

const FORM_ALOC_VAZIO = {
  descricao_uso: '', data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: '', responsavel: '', observacao: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtData(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
function diasAte(data: string): number {
  return Math.ceil((new Date(data).getTime() - Date.now()) / 86400000)
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminBensFrota() {
  const [vista,   setVista]   = useState<Vista>('lista')
  const [bemAtual, setBemAtual] = useState<Bem | null>(null)
  const [aba,      setAba]     = useState<AbaDetalhe>('geral')

  const [bens,       setBens]       = useState<Bem[]>([])
  const [centros,    setCentros]    = useState<CentroCusto[]>([])
  const [custos,     setCustos]     = useState<Custo[]>([])
  const [manutencoes,setManutencoes]= useState<Manutencao[]>([])
  const [alocacoes,  setAlocacoes]  = useState<Alocacao[]>([])

  const [loading,  setLoading]  = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg,      setMsg]      = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Filtros lista
  const [filtroStatus, setFiltroStatus] = useState<'' | Status>('')
  const [filtroTipo,   setFiltroTipo]   = useState<'' | TipoBem>('')
  const [filtroBusca,  setFiltroBusca]  = useState('')

  // Formulários
  const [formBem,   setFormBem]   = useState(FORM_BEM_VAZIO)
  const [formCusto, setFormCusto] = useState(FORM_CUSTO_VAZIO)
  const [formManut, setFormManut] = useState(FORM_MANUT_VAZIO)
  const [formAloc,  setFormAloc]  = useState(FORM_ALOC_VAZIO)
  const [mostrarFormCusto, setMostrarFormCusto] = useState(false)
  const [mostrarFormManut, setMostrarFormManut] = useState(false)
  const [mostrarFormAloc,  setMostrarFormAloc]  = useState(false)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])

  // ── Carga ──────────────────────────────────────────────────────────────────

  const carregarCentros = useCallback(async () => {
    const { data } = await supabaseAdmin.from('fin_centros_custo').select('id, nome').eq('ativo', true).order('nome')
    setCentros((data ?? []) as CentroCusto[])
  }, [])

  const carregarBens = useCallback(async () => {
    setLoading(true)
    let q = supabaseAdmin.from('bens_frota').select('*, fin_centros_custo(nome)').order('codigo')
    if (filtroStatus) q = q.eq('status', filtroStatus)
    if (filtroTipo)   q = q.eq('tipo', filtroTipo)
    const { data } = await q
    setBens((data ?? []) as Bem[])
    setLoading(false)
  }, [filtroStatus, filtroTipo])

  const carregarDetalhes = useCallback(async (bemId: number) => {
    const [{ data: c }, { data: m }, { data: a }] = await Promise.all([
      supabaseAdmin.from('bens_frota_custos').select('*').eq('bem_id', bemId).order('data_custo', { ascending: false }),
      supabaseAdmin.from('bens_frota_manutencoes').select('*').eq('bem_id', bemId).order('data_prevista', { ascending: false }),
      supabaseAdmin.from('bens_frota_alocacoes').select('*').eq('bem_id', bemId).order('data_inicio', { ascending: false }),
    ])
    setCustos((c ?? []) as Custo[])
    setManutencoes((m ?? []) as Manutencao[])
    setAlocacoes((a ?? []) as Alocacao[])
  }, [])

  useEffect(() => { carregarCentros(); carregarBens() }, [carregarCentros, carregarBens])
  useEffect(() => { if (vista === 'lista') carregarBens() }, [filtroStatus, filtroTipo, vista, carregarBens])
  useEffect(() => {
    if (vista === 'detalhe' && bemAtual) carregarDetalhes(bemAtual.id)
  }, [vista, bemAtual, aba, carregarDetalhes])

  // ── Bem — salvar ──────────────────────────────────────────────────────────

  async function salvarBem(e: React.FormEvent) {
    e.preventDefault()
    if (!formBem.nome.trim()) { setMsg({ tipo: 'erro', texto: 'Nome obrigatório.' }); return }
    setSalvando(true)
    const payload = {
      tipo:            formBem.tipo,
      nome:            formBem.nome.trim(),
      descricao:       formBem.descricao || null,
      fabricante:      formBem.fabricante || null,
      modelo:          formBem.modelo || null,
      ano_fabricacao:  formBem.ano_fabricacao ? Number(formBem.ano_fabricacao) : null,
      ano_aquisicao:   formBem.ano_aquisicao  ? Number(formBem.ano_aquisicao)  : null,
      numero_serie:    formBem.numero_serie   || null,
      placa:           formBem.placa          || null,
      renavam:         formBem.renavam        || null,
      chassi:          formBem.chassi         || null,
      status:          formBem.status,
      centro_custo_id: formBem.centro_custo_id ? Number(formBem.centro_custo_id) : null,
      valor_aquisicao: formBem.valor_aquisicao ? parseFloat(formBem.valor_aquisicao.replace(',', '.')) : null,
      data_aquisicao:  formBem.data_aquisicao  || null,
      localizacao:     formBem.localizacao     || null,
      responsavel:     formBem.responsavel     || null,
      foto_url:        formBem.foto_url        || null,
      observacao:      formBem.observacao      || null,
    }
    if (bemAtual) {
      const { error } = await supabaseAdmin.from('bens_frota').update(payload).eq('id', bemAtual.id)
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
      setMsg({ tipo: 'ok', texto: 'Bem atualizado.' })
      const { data } = await supabaseAdmin.from('bens_frota').select('*, fin_centros_custo(nome)').eq('id', bemAtual.id).single()
      if (data) setBemAtual(data as Bem)
    } else {
      const { data, error } = await supabaseAdmin.from('bens_frota').insert(payload).select('*, fin_centros_custo(nome)').single()
      if (error) { setMsg({ tipo: 'erro', texto: error.message }); setSalvando(false); return }
      setMsg({ tipo: 'ok', texto: 'Bem cadastrado.' })
      setBemAtual(data as Bem)
      setVista('detalhe')
      setAba('geral')
    }
    setSalvando(false)
    carregarBens()
  }

  // ── Custo — salvar ────────────────────────────────────────────────────────

  async function salvarCusto(e: React.FormEvent) {
    e.preventDefault()
    if (!bemAtual) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('bens_frota_custos').insert({
      bem_id:     bemAtual.id,
      tipo_custo: formCusto.tipo_custo,
      descricao:  formCusto.descricao.trim(),
      valor:      parseFloat(formCusto.valor.replace(',', '.')) || 0,
      data_custo: formCusto.data_custo,
      observacao: formCusto.observacao || null,
    })
    if (error) setMsg({ tipo: 'erro', texto: error.message })
    else { setMsg({ tipo: 'ok', texto: 'Custo registrado.' }); setFormCusto(FORM_CUSTO_VAZIO); setMostrarFormCusto(false); carregarDetalhes(bemAtual.id) }
    setSalvando(false)
  }

  // ── Manutenção — salvar ────────────────────────────────────────────────────

  async function salvarManutencao(e: React.FormEvent) {
    e.preventDefault()
    if (!bemAtual) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('bens_frota_manutencoes').insert({
      bem_id:          bemAtual.id,
      tipo:            formManut.tipo,
      descricao:       formManut.descricao.trim(),
      status:          formManut.status,
      data_prevista:   formManut.data_prevista  || null,
      data_realizada:  formManut.data_realizada || null,
      km_previsto:     formManut.km_previsto    ? Number(formManut.km_previsto)    : null,
      km_realizado:    formManut.km_realizado   ? Number(formManut.km_realizado)   : null,
      custo_realizado: formManut.custo_realizado ? parseFloat(formManut.custo_realizado.replace(',', '.')) : null,
      om_referencia:   formManut.om_referencia  || null,
      observacao:      formManut.observacao     || null,
    })
    if (error) setMsg({ tipo: 'erro', texto: error.message })
    else { setMsg({ tipo: 'ok', texto: 'Manutenção registrada.' }); setFormManut(FORM_MANUT_VAZIO); setMostrarFormManut(false); carregarDetalhes(bemAtual.id) }
    setSalvando(false)
  }

  // ── Alocação — salvar ─────────────────────────────────────────────────────

  async function salvarAlocacao(e: React.FormEvent) {
    e.preventDefault()
    if (!bemAtual) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('bens_frota_alocacoes').insert({
      bem_id:        bemAtual.id,
      descricao_uso: formAloc.descricao_uso.trim(),
      data_inicio:   formAloc.data_inicio,
      data_fim:      formAloc.data_fim || null,
      responsavel:   formAloc.responsavel || null,
      observacao:    formAloc.observacao  || null,
    })
    if (error) setMsg({ tipo: 'erro', texto: error.message })
    else { setMsg({ tipo: 'ok', texto: 'Alocação registrada.' }); setFormAloc(FORM_ALOC_VAZIO); setMostrarFormAloc(false); carregarDetalhes(bemAtual.id) }
    setSalvando(false)
  }

  async function encerrarAlocacao(id: number) {
    if (!bemAtual) return
    await supabaseAdmin.from('bens_frota_alocacoes').update({ data_fim: new Date().toISOString().slice(0, 10) }).eq('id', id)
    carregarDetalhes(bemAtual.id)
  }

  async function atualizarStatusManut(id: number, status: StatusManut) {
    await supabaseAdmin.from('bens_frota_manutencoes').update({ status, ...(status === 'concluida' ? { data_realizada: new Date().toISOString().slice(0, 10) } : {}) }).eq('id', id)
    if (bemAtual) carregarDetalhes(bemAtual.id)
  }

  // ── KPIs lista ─────────────────────────────────────────────────────────────

  const anoAtual = new Date().getFullYear()
  const bemAtivos = bens.filter(b => b.status === 'ativo').length
  const bemManutencao = bens.filter(b => b.status === 'em_manutencao').length

  // ── Bens filtrados ─────────────────────────────────────────────────────────

  const bensFiltrados = bens.filter(b => {
    if (!filtroBusca) return true
    const q = filtroBusca.toLowerCase()
    return b.nome.toLowerCase().includes(q) || b.codigo.toLowerCase().includes(q) ||
           (b.placa ?? '').toLowerCase().includes(q) || (b.modelo ?? '').toLowerCase().includes(q)
  })

  // ── Vencimentos derivados ──────────────────────────────────────────────────
  // Deriva de custos (ipva/seguro/licenciamento mais recente por tipo) +
  // manutenções agendadas com data_prevista futura
  function calcVencimentos() {
    const hoje = new Date().toISOString().slice(0, 10)
    const items: { label: string; data: string; dias: number; tipo: 'custo' | 'manut' }[] = []

    // Último custo de cada tipo de vencimento anual → assume renovação em ~1 ano
    for (const tipo of TIPOS_VENCIMENTO) {
      const ultimo = [...custos].filter(c => c.tipo_custo === tipo).sort((a, b) => b.data_custo.localeCompare(a.data_custo))[0]
      if (ultimo) {
        const dataRef = new Date(ultimo.data_custo)
        dataRef.setFullYear(dataRef.getFullYear() + 1)
        const dataVenc = dataRef.toISOString().slice(0, 10)
        items.push({ label: TIPO_CUSTO_LABEL[tipo], data: dataVenc, dias: diasAte(dataVenc), tipo: 'custo' })
      }
    }

    // Manutenções agendadas com data_prevista
    for (const m of manutencoes.filter(m => m.status === 'agendada' && m.data_prevista && m.data_prevista >= hoje)) {
      items.push({ label: `${TIPO_MANUT_LABEL[m.tipo]} — ${m.descricao}`, data: m.data_prevista!, dias: diasAte(m.data_prevista!), tipo: 'manut' })
    }

    return items.sort((a, b) => a.data.localeCompare(b.data))
  }

  // ── Render — lista ─────────────────────────────────────────────────────────

  if (vista === 'lista') {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>🚗 Bens & Frota</div>
            <div className={styles.pageSubtitle}>Gestão de veículos, máquinas e equipamentos</div>
          </div>
          <button className={styles.btnPrimary} onClick={() => { setFormBem(FORM_BEM_VAZIO); setBemAtual(null); setVista('form') }}>
            + Novo bem
          </button>
        </div>

        {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

        {/* KPIs */}
        <div className={styles.kpis}>
          <div className={styles.kpiCard}><span className={styles.kpiVal}>{bens.length}</span><span className={styles.kpiLabel}>Total cadastrado</span></div>
          <div className={styles.kpiCard}><span className={styles.kpiVal}>{bemAtivos}</span><span className={styles.kpiLabel}>Ativos</span></div>
          <div className={`${styles.kpiCard} ${bemManutencao > 0 ? styles.kpiAlerta : ''}`}><span className={styles.kpiVal}>{bemManutencao}</span><span className={styles.kpiLabel}>Em manutenção</span></div>
          <div className={styles.kpiCard}><span className={styles.kpiVal}>{anoAtual}</span><span className={styles.kpiLabel}>Ano referência</span></div>
        </div>

        {/* Filtros */}
        <div className={styles.filtros}>
          <input className={styles.input} placeholder="Buscar por nome, código, placa…" value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)} style={{ flex: 1 }} />
          <select className={styles.input} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as '' | Status)}>
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_CFG) as Status[]).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          <select className={styles.input} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as '' | TipoBem)}>
            <option value="">Todos os tipos</option>
            {(Object.keys(TIPO_BEM_LABEL) as TipoBem[]).map(t => <option key={t} value={t}>{TIPO_BEM_LABEL[t]}</option>)}
          </select>
        </div>

        {loading && <div className={styles.loading}>Carregando…</div>}

        {!loading && bensFiltrados.length === 0 && (
          <div className={styles.emptyMsg}>Nenhum bem encontrado.</div>
        )}

        <div className={styles.grid}>
          {bensFiltrados.map(b => (
            <div key={b.id} className={styles.card} onClick={() => { setBemAtual(b); setAba('geral'); setVista('detalhe') }}>
              <div className={styles.cardHeader}>
                <span className={styles.cardCodigo}>{b.codigo}</span>
                <span className={`${styles.badge} ${STATUS_CFG[b.status].css}`}>{STATUS_CFG[b.status].label}</span>
              </div>
              <div className={styles.cardNome}>{b.nome}</div>
              <div className={styles.cardMeta}>
                <span>{TIPO_BEM_LABEL[b.tipo]}</span>
                {b.placa && <span>🔖 {b.placa}</span>}
                {b.modelo && <span>{b.modelo}</span>}
                {b.fin_centros_custo && <span>📂 {b.fin_centros_custo.nome}</span>}
              </div>
              {b.localizacao && <div className={styles.cardLoc}>📍 {b.localizacao}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Render — formulário ────────────────────────────────────────────────────

  if (vista === 'form') {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>🚗 Bens & Frota</div>
            <div className={styles.pageSubtitle}>{bemAtual ? `Editar — ${bemAtual.codigo}` : 'Novo bem'}</div>
          </div>
          <button className={styles.btnSecondary} onClick={() => setVista(bemAtual ? 'detalhe' : 'lista')}>← Voltar</button>
        </div>

        {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

        <form className={styles.formCard} onSubmit={salvarBem}>
          <div className={styles.formSecao}>Identificação</div>
          <div className={styles.row3}>
            <div className={styles.field}>
              <label>Tipo *</label>
              <select className={styles.input} value={formBem.tipo} onChange={e => setFormBem(f => ({ ...f, tipo: e.target.value as TipoBem }))}>
                {(Object.keys(TIPO_BEM_LABEL) as TipoBem[]).map(t => <option key={t} value={t}>{TIPO_BEM_LABEL[t]}</option>)}
              </select>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label>Nome *</label>
              <input className={styles.input} value={formBem.nome} onChange={e => setFormBem(f => ({ ...f, nome: e.target.value }))} required />
            </div>
          </div>
          <div className={styles.row3}>
            <div className={styles.field}><label>Fabricante</label><input className={styles.input} value={formBem.fabricante} onChange={e => setFormBem(f => ({ ...f, fabricante: e.target.value }))} /></div>
            <div className={styles.field}><label>Modelo</label><input className={styles.input} value={formBem.modelo} onChange={e => setFormBem(f => ({ ...f, modelo: e.target.value }))} /></div>
            <div className={styles.field}><label>Número de série</label><input className={styles.input} value={formBem.numero_serie} onChange={e => setFormBem(f => ({ ...f, numero_serie: e.target.value }))} /></div>
          </div>
          <div className={styles.row3}>
            <div className={styles.field}><label>Placa</label><input className={styles.input} value={formBem.placa} onChange={e => setFormBem(f => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="ABC-1234" /></div>
            <div className={styles.field}><label>RENAVAM</label><input className={styles.input} value={formBem.renavam} onChange={e => setFormBem(f => ({ ...f, renavam: e.target.value }))} /></div>
            <div className={styles.field}><label>Chassi</label><input className={styles.input} value={formBem.chassi} onChange={e => setFormBem(f => ({ ...f, chassi: e.target.value }))} /></div>
          </div>

          <div className={styles.formSecao}>Aquisição e classificação</div>
          <div className={styles.row3}>
            <div className={styles.field}><label>Ano fabricação</label><input className={styles.input} type="number" value={formBem.ano_fabricacao} onChange={e => setFormBem(f => ({ ...f, ano_fabricacao: e.target.value }))} placeholder={String(anoAtual)} /></div>
            <div className={styles.field}><label>Ano aquisição</label><input className={styles.input} type="number" value={formBem.ano_aquisicao} onChange={e => setFormBem(f => ({ ...f, ano_aquisicao: e.target.value }))} /></div>
            <div className={styles.field}><label>Data aquisição</label><input className={styles.input} type="date" value={formBem.data_aquisicao} onChange={e => setFormBem(f => ({ ...f, data_aquisicao: e.target.value }))} /></div>
          </div>
          <div className={styles.row3}>
            <div className={styles.field}><label>Valor aquisição (R$)</label><input className={styles.input} value={formBem.valor_aquisicao} onChange={e => setFormBem(f => ({ ...f, valor_aquisicao: e.target.value }))} placeholder="0,00" /></div>
            <div className={styles.field}><label>Status</label>
              <select className={styles.input} value={formBem.status} onChange={e => setFormBem(f => ({ ...f, status: e.target.value as Status }))}>
                {(Object.keys(STATUS_CFG) as Status[]).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>
            </div>
            <div className={styles.field}><label>Centro de custo</label>
              <select className={styles.input} value={formBem.centro_custo_id} onChange={e => setFormBem(f => ({ ...f, centro_custo_id: e.target.value }))}>
                <option value="">—</option>
                {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.formSecao}>Localização e responsável</div>
          <div className={styles.row2}>
            <div className={styles.field}><label>Localização</label><input className={styles.input} value={formBem.localizacao} onChange={e => setFormBem(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Galpão 2" /></div>
            <div className={styles.field}><label>Responsável</label><input className={styles.input} value={formBem.responsavel} onChange={e => setFormBem(f => ({ ...f, responsavel: e.target.value }))} /></div>
          </div>
          <div className={styles.field}><label>URL da foto</label><input className={styles.input} value={formBem.foto_url} onChange={e => setFormBem(f => ({ ...f, foto_url: e.target.value }))} placeholder="https://…" /></div>
          <div className={styles.field}><label>Observações</label><textarea className={styles.textarea} value={formBem.observacao} onChange={e => setFormBem(f => ({ ...f, observacao: e.target.value }))} rows={3} /></div>

          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setVista(bemAtual ? 'detalhe' : 'lista')}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={salvando}>{salvando ? 'Salvando…' : bemAtual ? 'Salvar alterações' : 'Cadastrar bem'}</button>
          </div>
        </form>
      </div>
    )
  }

  // ── Render — detalhe ───────────────────────────────────────────────────────

  if (vista === 'detalhe' && bemAtual) {
    const bem = bemAtual
    const vencimentos = calcVencimentos()
    const vencimentos30d = vencimentos.filter(v => v.dias <= 30 && v.dias >= 0).length
    const totalCustos = custos.reduce((s, c) => s + c.valor, 0)
    const alocacaoAtiva = alocacoes.find(a => !a.data_fim)

    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageTitle}>🚗 Bens & Frota</div>
            <div className={styles.pageSubtitle}>{bem.codigo} — {bem.nome}</div>
          </div>
          <div className={styles.headerAcoes}>
            <button className={styles.btnSecondary} onClick={() => { setVista('lista') }}>← Lista</button>
            <button className={styles.btnSecondary} onClick={() => {
              setFormBem({
                tipo: bem.tipo, nome: bem.nome, descricao: bem.descricao ?? '',
                fabricante: bem.fabricante ?? '', modelo: bem.modelo ?? '',
                ano_fabricacao: String(bem.ano_fabricacao ?? ''), ano_aquisicao: String(bem.ano_aquisicao ?? ''),
                numero_serie: bem.numero_serie ?? '', placa: bem.placa ?? '',
                renavam: bem.renavam ?? '', chassi: bem.chassi ?? '',
                status: bem.status, centro_custo_id: String(bem.centro_custo_id ?? ''),
                valor_aquisicao: String(bem.valor_aquisicao ?? ''), data_aquisicao: bem.data_aquisicao ?? '',
                localizacao: bem.localizacao ?? '', responsavel: bem.responsavel ?? '',
                foto_url: bem.foto_url ?? '', observacao: bem.observacao ?? '',
              })
              setVista('form')
            }}>✏️ Editar</button>
          </div>
        </div>

        {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

        {/* Header do bem */}
        <div className={styles.bemHeader}>
          {bem.foto_url && <img src={bem.foto_url} alt={bem.nome} className={styles.bemFoto} />}
          <div className={styles.bemHeaderInfo}>
            <div className={styles.bemTipoStatus}>
              <span>{TIPO_BEM_LABEL[bem.tipo]}</span>
              <span className={`${styles.badge} ${STATUS_CFG[bem.status].css}`}>{STATUS_CFG[bem.status].label}</span>
              {vencimentos30d > 0 && <span className={styles.alertaVenc}>⚠️ {vencimentos30d} vencimento{vencimentos30d > 1 ? 's' : ''} em 30 dias</span>}
            </div>
            <div className={styles.bemMeta}>
              {bem.placa && <span>🔖 {bem.placa}</span>}
              {bem.modelo && <span>{bem.fabricante ? `${bem.fabricante} ${bem.modelo}` : bem.modelo}</span>}
              {bem.ano_fabricacao && <span>{bem.ano_fabricacao}</span>}
              {bem.localizacao && <span>📍 {bem.localizacao}</span>}
              {bem.responsavel && <span>👤 {bem.responsavel}</span>}
              {bem.fin_centros_custo && <span>📂 {bem.fin_centros_custo.nome}</span>}
            </div>
            <div className={styles.bemKpis}>
              <div className={styles.bemKpi}><span>{fmtBRL(totalCustos)}</span><small>Custo total registrado</small></div>
              {bem.valor_aquisicao && <div className={styles.bemKpi}><span>{fmtBRL(bem.valor_aquisicao)}</span><small>Valor de aquisição</small></div>}
              {alocacaoAtiva && <div className={styles.bemKpi}><span>Em uso</span><small>{alocacaoAtiva.descricao_uso}</small></div>}
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className={styles.abas}>
          {([
            { key: 'geral',       label: '📋 Geral'        },
            { key: 'custos',      label: '💰 Custos'       },
            { key: 'manutencoes', label: '🔧 Manutenções'  },
            { key: 'vencimentos', label: `📅 Vencimentos${vencimentos30d > 0 ? ` (${vencimentos30d})` : ''}` },
            { key: 'alocacao',    label: '📌 Alocação'     },
            { key: 'historico',   label: '📜 Histórico'    },
          ] as { key: AbaDetalhe; label: string }[]).map(a => (
            <button key={a.key} className={`${styles.aba} ${aba === a.key ? styles.abaAtiva : ''}`} onClick={() => setAba(a.key)}>
              {a.label}
            </button>
          ))}
        </div>

        {/* ── Geral ── */}
        {aba === 'geral' && (
          <div className={styles.geralGrid}>
            {[
              ['Código', bem.codigo], ['Tipo', TIPO_BEM_LABEL[bem.tipo]],
              ['Nome', bem.nome], ['Fabricante', bem.fabricante],
              ['Modelo', bem.modelo], ['Número de série', bem.numero_serie],
              ['Placa', bem.placa], ['RENAVAM', bem.renavam], ['Chassi', bem.chassi],
              ['Ano fabricação', bem.ano_fabricacao], ['Ano aquisição', bem.ano_aquisicao],
              ['Data aquisição', fmtData(bem.data_aquisicao)],
              ['Valor aquisição', bem.valor_aquisicao ? fmtBRL(bem.valor_aquisicao) : null],
              ['Localização', bem.localizacao], ['Responsável', bem.responsavel],
              ['Centro de custo', bem.fin_centros_custo?.nome],
            ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <div key={String(k)} className={styles.geralItem}>
                <span className={styles.geralLabel}>{k}</span>
                <span className={styles.geralVal}>{String(v)}</span>
              </div>
            ))}
            {bem.observacao && (
              <div className={styles.geralItem} style={{ gridColumn: '1 / -1' }}>
                <span className={styles.geralLabel}>Observações</span>
                <span className={styles.geralVal}>{bem.observacao}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Custos ── */}
        {aba === 'custos' && (
          <div className={styles.abaContent}>
            <div className={styles.abaHeaderRow}>
              <div className={styles.totalDestaque}>Total: {fmtBRL(totalCustos)}</div>
              <button className={styles.btnPrimary} onClick={() => setMostrarFormCusto(v => !v)}>
                {mostrarFormCusto ? '✕ Fechar' : '+ Registrar custo'}
              </button>
            </div>

            {mostrarFormCusto && (
              <form className={styles.formInline} onSubmit={salvarCusto}>
                <div className={styles.row3}>
                  <div className={styles.field}><label>Tipo</label>
                    <select className={styles.input} value={formCusto.tipo_custo} onChange={e => setFormCusto(f => ({ ...f, tipo_custo: e.target.value as TipoCusto }))}>
                      {(Object.keys(TIPO_CUSTO_LABEL) as TipoCusto[]).map(t => <option key={t} value={t}>{TIPO_CUSTO_LABEL[t]}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}><label>Valor (R$)</label><input className={styles.input} value={formCusto.valor} onChange={e => setFormCusto(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" required /></div>
                  <div className={styles.field}><label>Data</label><input className={styles.input} type="date" value={formCusto.data_custo} onChange={e => setFormCusto(f => ({ ...f, data_custo: e.target.value }))} required /></div>
                </div>
                <div className={styles.field}><label>Descrição *</label><input className={styles.input} value={formCusto.descricao} onChange={e => setFormCusto(f => ({ ...f, descricao: e.target.value }))} required /></div>
                <div className={styles.field}><label>Observação</label><input className={styles.input} value={formCusto.observacao} onChange={e => setFormCusto(f => ({ ...f, observacao: e.target.value }))} /></div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
                </div>
              </form>
            )}

            {custos.length === 0 && <div className={styles.emptyMsg}>Nenhum custo registrado.</div>}
            {custos.length > 0 && (
              <table className={styles.table}>
                <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className={styles.right}>Valor</th><th>Obs</th></tr></thead>
                <tbody>
                  {custos.map(c => (
                    <tr key={c.id}>
                      <td>{fmtData(c.data_custo)}</td>
                      <td><span className={styles.tipoCusto}>{TIPO_CUSTO_LABEL[c.tipo_custo]}</span></td>
                      <td>{c.descricao}</td>
                      <td className={styles.right}>{fmtBRL(c.valor)}</td>
                      <td className={styles.obs}>{c.observacao ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Manutenções ── */}
        {aba === 'manutencoes' && (
          <div className={styles.abaContent}>
            <div className={styles.abaHeaderRow}>
              <span>{manutencoes.length} registro{manutencoes.length !== 1 ? 's' : ''}</span>
              <button className={styles.btnPrimary} onClick={() => setMostrarFormManut(v => !v)}>
                {mostrarFormManut ? '✕ Fechar' : '+ Agendar / registrar'}
              </button>
            </div>

            {mostrarFormManut && (
              <form className={styles.formInline} onSubmit={salvarManutencao}>
                <div className={styles.row3}>
                  <div className={styles.field}><label>Tipo</label>
                    <select className={styles.input} value={formManut.tipo} onChange={e => setFormManut(f => ({ ...f, tipo: e.target.value as TipoManut }))}>
                      {(Object.keys(TIPO_MANUT_LABEL) as TipoManut[]).map(t => <option key={t} value={t}>{TIPO_MANUT_LABEL[t]}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}><label>Status</label>
                    <select className={styles.input} value={formManut.status} onChange={e => setFormManut(f => ({ ...f, status: e.target.value as StatusManut }))}>
                      {(Object.keys(STATUS_MANUT_CFG) as StatusManut[]).map(s => <option key={s} value={s}>{STATUS_MANUT_CFG[s].label}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}><label>Ref. OM (opcional)</label><input className={styles.input} value={formManut.om_referencia} onChange={e => setFormManut(f => ({ ...f, om_referencia: e.target.value }))} placeholder="OM-0042" /></div>
                </div>
                <div className={styles.field}><label>Descrição *</label><input className={styles.input} value={formManut.descricao} onChange={e => setFormManut(f => ({ ...f, descricao: e.target.value }))} required /></div>
                <div className={styles.row3}>
                  <div className={styles.field}><label>Data prevista</label><input className={styles.input} type="date" value={formManut.data_prevista} onChange={e => setFormManut(f => ({ ...f, data_prevista: e.target.value }))} /></div>
                  <div className={styles.field}><label>Data realizada</label><input className={styles.input} type="date" value={formManut.data_realizada} onChange={e => setFormManut(f => ({ ...f, data_realizada: e.target.value }))} /></div>
                  <div className={styles.field}><label>Custo realizado (R$)</label><input className={styles.input} value={formManut.custo_realizado} onChange={e => setFormManut(f => ({ ...f, custo_realizado: e.target.value }))} placeholder="0,00" /></div>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
                </div>
              </form>
            )}

            {manutencoes.length === 0 && <div className={styles.emptyMsg}>Nenhuma manutenção registrada.</div>}
            {manutencoes.map(m => (
              <div key={m.id} className={styles.manutCard}>
                <div className={styles.manutHeader}>
                  <span className={styles.manutTipo}>{TIPO_MANUT_LABEL[m.tipo]}</span>
                  <span className={`${styles.badge} ${STATUS_MANUT_CFG[m.status].css}`}>{STATUS_MANUT_CFG[m.status].label}</span>
                  {m.om_referencia && <span className={styles.manutOM}>{m.om_referencia}</span>}
                </div>
                <div className={styles.manutDesc}>{m.descricao}</div>
                <div className={styles.manutMeta}>
                  {m.data_prevista  && <span>📅 Prevista: {fmtData(m.data_prevista)}</span>}
                  {m.data_realizada && <span>✅ Realizada: {fmtData(m.data_realizada)}</span>}
                  {m.custo_realizado != null && <span>💰 {fmtBRL(m.custo_realizado)}</span>}
                </div>
                {(m.status === 'agendada' || m.status === 'em_execucao') && (
                  <div className={styles.manutAcoes}>
                    {m.status === 'agendada' && <button className={styles.btnSmall} onClick={() => atualizarStatusManut(m.id, 'em_execucao')}>▶ Iniciar</button>}
                    {m.status === 'em_execucao' && <button className={styles.btnSmall} onClick={() => atualizarStatusManut(m.id, 'concluida')}>✓ Concluir</button>}
                    <button className={styles.btnSmallDanger} onClick={() => atualizarStatusManut(m.id, 'cancelada')}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Vencimentos (derivado) ── */}
        {aba === 'vencimentos' && (
          <div className={styles.abaContent}>
            <div className={styles.vencInfo}>
              💡 Vencimentos calculados a partir dos custos (IPVA, seguro, licenciamento — assume renovação anual) e manutenções agendadas.
            </div>
            {vencimentos.length === 0 && <div className={styles.emptyMsg}>Nenhum vencimento identificado. Registre custos de IPVA, seguro ou licenciamento para ativar esta visão.</div>}
            <div className={styles.vencGrid}>
              {vencimentos.map((v, i) => {
                const urgente = v.dias <= 7
                const proximo = v.dias <= 30
                return (
                  <div key={i} className={`${styles.vencCard} ${urgente ? styles.vencUrgente : proximo ? styles.vencProximo : ''}`}>
                    <div className={styles.vencLabel}>{v.label}</div>
                    <div className={styles.vencData}>{fmtData(v.data)}</div>
                    <div className={styles.vencDias}>
                      {v.dias < 0 ? <span className={styles.vencVencido}>Vencido há {Math.abs(v.dias)} dias</span>
                        : v.dias === 0 ? <span className={styles.vencVencido}>Vence hoje</span>
                        : <span>{v.dias} dias</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Alocação ── */}
        {aba === 'alocacao' && (
          <div className={styles.abaContent}>
            <div className={styles.abaHeaderRow}>
              <div>
                {alocacaoAtiva
                  ? <span className={styles.alocAtiva}>Em uso: {alocacaoAtiva.descricao_uso}</span>
                  : <span className={styles.alocLivre}>Disponível</span>}
              </div>
              <button className={styles.btnPrimary} onClick={() => setMostrarFormAloc(v => !v)}>
                {mostrarFormAloc ? '✕ Fechar' : '+ Nova alocação'}
              </button>
            </div>

            {mostrarFormAloc && (
              <form className={styles.formInline} onSubmit={salvarAlocacao}>
                <div className={styles.field}><label>Descrição do uso *</label><input className={styles.input} value={formAloc.descricao_uso} onChange={e => setFormAloc(f => ({ ...f, descricao_uso: e.target.value }))} required /></div>
                <div className={styles.row3}>
                  <div className={styles.field}><label>Data início *</label><input className={styles.input} type="date" value={formAloc.data_inicio} onChange={e => setFormAloc(f => ({ ...f, data_inicio: e.target.value }))} required /></div>
                  <div className={styles.field}><label>Data fim (vazio = em uso)</label><input className={styles.input} type="date" value={formAloc.data_fim} onChange={e => setFormAloc(f => ({ ...f, data_fim: e.target.value }))} /></div>
                  <div className={styles.field}><label>Responsável</label><input className={styles.input} value={formAloc.responsavel} onChange={e => setFormAloc(f => ({ ...f, responsavel: e.target.value }))} /></div>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
                </div>
              </form>
            )}

            {alocacoes.length === 0 && <div className={styles.emptyMsg}>Nenhuma alocação registrada.</div>}
            {alocacoes.map(a => (
              <div key={a.id} className={`${styles.alocCard} ${!a.data_fim ? styles.alocCardAtiva : ''}`}>
                <div className={styles.alocHeader}>
                  <span className={styles.alocDesc}>{a.descricao_uso}</span>
                  {!a.data_fim && <span className={styles.badgeAtivo}>Em uso</span>}
                </div>
                <div className={styles.alocMeta}>
                  <span>{fmtData(a.data_inicio)} → {a.data_fim ? fmtData(a.data_fim) : 'em andamento'}</span>
                  {a.responsavel && <span>👤 {a.responsavel}</span>}
                </div>
                {!a.data_fim && (
                  <button className={styles.btnSmall} onClick={() => encerrarAlocacao(a.id)}>Encerrar</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Histórico ── */}
        {aba === 'historico' && (() => {
          type EventoH = { data: string; label: string; sub: string; tipo: 'custo' | 'manut' | 'aloc' }
          const eventos: EventoH[] = [
            ...custos.map(c => ({ data: c.data_custo, label: `${TIPO_CUSTO_LABEL[c.tipo_custo]}: ${c.descricao}`, sub: fmtBRL(c.valor), tipo: 'custo' as const })),
            ...manutencoes.map(m => ({ data: m.data_realizada ?? m.data_prevista ?? m.created_at.slice(0,10), label: `${TIPO_MANUT_LABEL[m.tipo]}: ${m.descricao}`, sub: STATUS_MANUT_CFG[m.status].label, tipo: 'manut' as const })),
            ...alocacoes.map(a => ({ data: a.data_inicio, label: `Alocação: ${a.descricao_uso}`, sub: a.data_fim ? `até ${fmtData(a.data_fim)}` : 'em andamento', tipo: 'aloc' as const })),
          ].sort((a, b) => b.data.localeCompare(a.data))

          const ICONS = { custo: '💰', manut: '🔧', aloc: '📌' }

          return (
            <div className={styles.abaContent}>
              {eventos.length === 0 && <div className={styles.emptyMsg}>Nenhum evento registrado.</div>}
              <div className={styles.timeline}>
                {eventos.map((ev, i) => (
                  <div key={i} className={styles.timelineItem}>
                    <div className={styles.timelineIcon}>{ICONS[ev.tipo]}</div>
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineLabel}>{ev.label}</div>
                      <div className={styles.timelineMeta}>{fmtData(ev.data)} · {ev.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  return null
}
