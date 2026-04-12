import { useState, useEffect, Fragment } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminProdutos.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DescricaoNF {
  descricao: string
  codigo: string | null
  ncm: string | null
  qtd_nfs: number
  qtd_total: number
  valor_total_sum: number
}

interface DadosMensal {
  mes: string   // "YYYY-MM"
  total: number
  qtd_nfs: number
}

interface Produto {
  id: number
  nome_padronizado: string
  familia: string | null
  material: string | null
  dimensoes: string | null
  unidade: string | null
  ncm: string | null
  ativo: boolean
}

type FormProduto = Omit<Produto, 'id' | 'ativo'>
type Periodo     = '30d' | '90d' | 'ano' | 'anterior' | 'tudo' | 'custom'
type Aba         = 'descricoes' | 'analise' | 'catalogo'

// ── Constantes ────────────────────────────────────────────────────────────────

const FAMILIAS = ['Equipamentos Inox', 'Fixador de Porcelanato', 'Acessórios', 'Serviços', 'Outros']
const MATERIAIS = ['Inox 304', 'Inox 316', 'Polipropileno', 'Alumínio', 'Misto']
const UNIDADES  = ['UN', 'PC', 'CX', 'KG', 'M', 'M²', 'M³']
const MESES     = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const FORM_VAZIO: FormProduto = {
  nome_padronizado: '', familia: '', material: '', dimensoes: '', unidade: 'UN', ncm: '',
}

const PERIODOS_DESC: { label: string; value: Periodo }[] = [
  { label: 'Tudo', value: 'tudo' }, { label: 'Este ano', value: 'ano' },
  { label: 'Ano passado', value: 'anterior' }, { label: '90 dias', value: '90d' },
  { label: '30 dias', value: '30d' }, { label: 'Personalizado', value: 'custom' },
]

const ANO_ATUAL  = new Date().getFullYear()
const ANOS_OPTS  = Array.from({ length: ANO_ATUAL - 2018 }, (_, i) => ANO_ATUAL - i)
const MESES_OPTS = MESES.map((label, i) => ({ value: i + 1, label }))
const CORES      = ['#1a5fa8', '#f97316', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number | null) {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getDatasDesc(periodo: Periodo, dataIni: string, dataFim: string) {
  const hoje = new Date()
  const fmt  = (d: Date) => d.toISOString().slice(0, 10)
  if (periodo === 'tudo')     return { ini: null, fim: null }
  if (periodo === '30d')      { const d = new Date(hoje); d.setDate(d.getDate() - 30); return { ini: fmt(d), fim: fmt(hoje) } }
  if (periodo === '90d')      { const d = new Date(hoje); d.setDate(d.getDate() - 90); return { ini: fmt(d), fim: fmt(hoje) } }
  if (periodo === 'ano')      return { ini: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` }
  if (periodo === 'anterior') return { ini: `${hoje.getFullYear()-1}-01-01`, fim: `${hoje.getFullYear()-1}-12-31` }
  return { ini: dataIni || null, fim: dataFim || null }
}

// ── MultiSelectDropdown ───────────────────────────────────────────────────────

function MultiSelectDropdown({ label, opts, selected, onToggle, onToggleAll, hideSelected }: {
  label: string
  opts: { value: number; label: string }[]
  selected: number[]
  onToggle: (v: number) => void
  onToggleAll: () => void
  hideSelected?: boolean
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.length === opts.length
  const nenhum      = selected.length === 0
  const triggerText = hideSelected ? undefined
    : nenhum ? 'Nenhum'
    : allSelected ? 'Todos'
    : selected.length <= 3
      ? opts.filter(o => selected.includes(o.value)).map(o => o.label).join(', ')
      : `${selected.length} selecionados`

  return (
    <div style={{ position: 'relative' }}>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
      )}
      <button
        className={`${styles.dropdownTrigger} ${!allSelected && !nenhum ? styles.dropdownTriggerAtivo : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.dropdownLabel}>{label}</span>
        {triggerText && <span className={styles.dropdownVal}>{triggerText}</span>}
        <span className={styles.dropdownArrow}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.dropdownPanel}>
          {/* Todos */}
          <label className={styles.dropdownItemTodos}>
            <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
            Todos
          </label>
          <div className={styles.dropdownDivider} />
          {/* Opções */}
          <div className={styles.dropdownList}>
            {opts.map(opt => (
              <label key={opt.value} className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => onToggle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PeriodoSelector (aba Descrições) ─────────────────────────────────────────

function PeriodoSelector({ periodo, onChange, dataIni, dataFim, onDataIni, onDataFim }: {
  periodo: Periodo; onChange: (p: Periodo) => void
  dataIni: string; dataFim: string; onDataIni: (v: string) => void; onDataFim: (v: string) => void
}) {
  return (
    <div className={styles.periodoRow}>
      <span className={styles.periodoLabel}>Período:</span>
      <div className={styles.periodoBtns}>
        {PERIODOS_DESC.map(p => (
          <button key={p.value}
            className={`${styles.periodoBtn} ${periodo === p.value ? styles.periodoBtnAtivo : ''}`}
            onClick={() => onChange(p.value)}>{p.label}</button>
        ))}
      </div>
      {periodo === 'custom' && (
        <div className={styles.customDatas}>
          <input type="date" value={dataIni} onChange={e => onDataIni(e.target.value)} className={styles.dataInput} />
          <span className={styles.dataSep}>até</span>
          <input type="date" value={dataFim} onChange={e => onDataFim(e.target.value)} className={styles.dataInput} />
        </div>
      )}
    </div>
  )
}

// ── FormInline ────────────────────────────────────────────────────────────────

function FormInline({ value, onChange, onSalvar, onCancelar, salvando, labelBtn = 'Salvar' }: {
  value: FormProduto; onChange: (f: FormProduto) => void
  onSalvar: () => void; onCancelar: () => void; salvando: boolean; labelBtn?: string
}) {
  return (
    <div className={styles.formInline}>
      <div className={styles.formGrupo} style={{ flex: 2 }}>
        <label className={styles.formLabel}>Nome padronizado *</label>
        <input type="text" value={value.nome_padronizado}
          onChange={e => onChange({ ...value, nome_padronizado: e.target.value })}
          className={styles.formInput} autoFocus placeholder="Nome único do produto"
          onKeyDown={e => e.key === 'Enter' && onSalvar()} />
      </div>
      <div className={styles.formGrupo}>
        <label className={styles.formLabel}>Família</label>
        <select value={value.familia ?? ''} onChange={e => onChange({ ...value, familia: e.target.value })} className={styles.formInput}>
          <option value="">—</option>{FAMILIAS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className={styles.formGrupo}>
        <label className={styles.formLabel}>Material</label>
        <select value={value.material ?? ''} onChange={e => onChange({ ...value, material: e.target.value })} className={styles.formInput}>
          <option value="">—</option>{MATERIAIS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className={styles.formGrupo}>
        <label className={styles.formLabel}>Dimensões</label>
        <input type="text" value={value.dimensoes ?? ''} onChange={e => onChange({ ...value, dimensoes: e.target.value })}
          className={styles.formInput} placeholder="ex: 200×100×50 cm" />
      </div>
      <div className={styles.formGrupo} style={{ maxWidth: 80 }}>
        <label className={styles.formLabel}>Un.</label>
        <select value={value.unidade ?? 'UN'} onChange={e => onChange({ ...value, unidade: e.target.value })} className={styles.formInput}>
          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className={styles.formAcoes}>
        <button className={styles.salvarBtn} onClick={onSalvar} disabled={salvando || !value.nome_padronizado.trim()}>
          {salvando ? '...' : labelBtn}
        </button>
        <button className={styles.cancelarBtn} onClick={onCancelar}>✕</button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminProdutos() {
  const [aba, setAba] = useState<Aba>('descricoes')

  // Aba Descrições
  const [periodo, setPeriodo]   = useState<Periodo>('tudo')
  const [dataIni, setDataIni]   = useState('')
  const [dataFim, setDataFim]   = useState('')
  const [busca, setBusca]       = useState('')
  const [descricoes, setDescricoes]   = useState<DescricaoNF[]>([])
  const [loading, setLoading]         = useState(false)
  const [catalogando, setCatalogando] = useState<string | null>(null)
  const [formCat, setFormCat]         = useState<FormProduto>(FORM_VAZIO)
  const [salvandoCat, setSalvandoCat] = useState(false)
  const [sortCol, setSortCol]         = useState<keyof DescricaoNF>('qtd_nfs')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc')

  // Aba Análise
  const [anosAtivos, setAnosAtivos]   = useState<number[]>([ANO_ATUAL])
  const [mesesAtivos, setMesesAtivos] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12])
  const [dadosPorAno, setDadosPorAno] = useState<Record<number, DadosMensal[]>>({})
  const [descricoesPorAno, setDescricoesPorAno] = useState<Record<number, DescricaoNF[]>>({})
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [top15Dir, setTop15Dir]       = useState<'asc' | 'desc'>('desc')

  // Aba Catálogo
  const [catalogo, setCatalogo]     = useState<Produto[]>([])
  const [loadingCat, setLoadingCat] = useState(false)
  const [criando, setCriando]       = useState(false)
  const [formNovo, setFormNovo]     = useState<FormProduto>(FORM_VAZIO)
  const [editando, setEditando]     = useState<Produto | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [sortColCat, setSortColCat] = useState<keyof Produto>('familia')
  const [sortDirCat, setSortDirCat] = useState<'asc' | 'desc'>('asc')

  useEffect(() => { buscarDescricoes() }, []) // eslint-disable-line

  useEffect(() => {
    if (aba === 'analise' && anosAtivos.length > 0 && mesesAtivos.length > 0) buscarAnalise()
  }, [anosAtivos, mesesAtivos, aba]) // eslint-disable-line

  // ── Descrições ───────────────────────────────────────────────────────────────

  async function buscarDescricoes() {
    setLoading(true)
    const { ini, fim } = getDatasDesc(periodo, dataIni, dataFim)
    const { data } = await supabaseAdmin.rpc('get_descricoes_nf', {
      p_busca: busca.trim() || null, p_data_ini: ini, p_data_fim: fim,
    })
    setDescricoes((data ?? []) as DescricaoNF[])
    setLoading(false)
  }

  function iniciarCatalogacao(d: DescricaoNF) {
    setCatalogando(d.descricao)
    setFormCat({ ...FORM_VAZIO, nome_padronizado: d.descricao, ncm: d.ncm ?? '' })
  }

  async function salvarCatalogacao() {
    if (!formCat.nome_padronizado.trim()) return
    setSalvandoCat(true)
    await supabaseAdmin.from('produtos_catalogo').insert({
      nome_padronizado: formCat.nome_padronizado.trim(),
      familia: formCat.familia || null, material: formCat.material || null,
      dimensoes: formCat.dimensoes || null, unidade: formCat.unidade || null, ncm: formCat.ncm || null,
    })
    setCatalogando(null); setFormCat(FORM_VAZIO); setSalvandoCat(false)
  }

  // ── Análise ───────────────────────────────────────────────────────────────────

  function toggleAno(v: number) {
    setAnosAtivos(prev =>
      prev.includes(v)
        ? prev.length > 1 ? prev.filter(x => x !== v) : prev
        : [...prev, v].sort((a, b) => a - b)
    )
  }

  function toggleTodosAnos() {
    setAnosAtivos(prev => prev.length === ANOS_OPTS.length ? [ANO_ATUAL] : [...ANOS_OPTS])
  }

  function toggleMes(v: number) {
    setMesesAtivos(prev =>
      prev.includes(v)
        ? prev.length > 1 ? prev.filter(x => x !== v) : prev
        : [...prev, v].sort((a, b) => a - b)
    )
  }

  function toggleTodosMeses() {
    setMesesAtivos(prev => prev.length === 12 ? [new Date().getMonth() + 1] : [1,2,3,4,5,6,7,8,9,10,11,12])
  }

  async function buscarAnalise() {
    if (!anosAtivos.length || !mesesAtivos.length) return
    setLoadingAnalise(true)
    const minMes = Math.min(...mesesAtivos)
    const maxMes = Math.max(...mesesAtivos)

    const results = await Promise.all(
      anosAtivos.map(async a => {
        const mStr = (m: number) => String(m).padStart(2, '0')
        const lastDay = new Date(a, maxMes, 0).getDate()
        const [{ data: mensal }, { data: desc }] = await Promise.all([
          // mensal: ano completo para filtrar client-side por meses
          supabaseAdmin.rpc('get_faturamento_mensal', { p_data_ini: `${a}-01-01`, p_data_fim: `${a}-12-31` }),
          // desc: range dos meses selecionados
          supabaseAdmin.rpc('get_descricoes_nf', {
            p_busca: null,
            p_data_ini: `${a}-${mStr(minMes)}-01`,
            p_data_fim: `${a}-${mStr(maxMes)}-${lastDay}`,
          }),
        ])
        return { ano: a, mensal: (mensal ?? []) as DadosMensal[], desc: (desc ?? []) as DescricaoNF[] }
      })
    )

    const newDados: Record<number, DadosMensal[]> = {}
    const newDesc:  Record<number, DescricaoNF[]> = {}
    for (const r of results) { newDados[r.ano] = r.mensal; newDesc[r.ano] = r.desc }
    setDadosPorAno(newDados)
    setDescricoesPorAno(newDesc)
    setLoadingAnalise(false)
  }

  // ── Catálogo ─────────────────────────────────────────────────────────────────

  async function buscarCatalogo() {
    setLoadingCat(true)
    const { data } = await supabaseAdmin.from('produtos_catalogo').select('*').eq('ativo', true)
      .order('familia', { ascending: true, nullsFirst: false }).order('nome_padronizado', { ascending: true })
    setCatalogo((data ?? []) as Produto[])
    setLoadingCat(false)
  }

  async function criarProduto() {
    if (!formNovo.nome_padronizado.trim()) return
    setSalvando(true)
    await supabaseAdmin.from('produtos_catalogo').insert({
      nome_padronizado: formNovo.nome_padronizado.trim(),
      familia: formNovo.familia || null, material: formNovo.material || null,
      dimensoes: formNovo.dimensoes || null, unidade: formNovo.unidade || null, ncm: formNovo.ncm || null,
    })
    setFormNovo(FORM_VAZIO); setCriando(false); setSalvando(false); buscarCatalogo()
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    await supabaseAdmin.from('produtos_catalogo').update({
      nome_padronizado: editando.nome_padronizado, familia: editando.familia || null,
      material: editando.material || null, dimensoes: editando.dimensoes || null,
      unidade: editando.unidade || null, ncm: editando.ncm || null,
    }).eq('id', editando.id)
    setSalvando(false); setEditando(null); buscarCatalogo()
  }

  async function excluir(id: number) {
    if (!confirm('Remover este produto do catálogo?')) return
    await supabaseAdmin.from('produtos_catalogo').update({ ativo: false }).eq('id', id)
    setCatalogo(prev => prev.filter(p => p.id !== id))
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────

  function toggleSort(col: keyof DescricaoNF) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function toggleSortCat(col: keyof Produto) {
    if (sortColCat === col) setSortDirCat(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColCat(col); setSortDirCat('asc') }
  }

  const descricoesSorted = [...descricoes].sort((a, b) => {
    const va = a[sortCol] ?? ''; const vb = b[sortCol] ?? ''
    const cmp = typeof va === 'string' ? (va as string).localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const catalogoSorted = [...catalogo].sort((a, b) => {
    const va = a[sortColCat] ?? ''; const vb = b[sortColCat] ?? ''
    const cmp = typeof va === 'string' ? (va as string).localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number)
    return sortDirCat === 'asc' ? cmp : -cmp
  })

  // ── Dados para gráficos ───────────────────────────────────────────────────────

  const mesesSorted = [...mesesAtivos].sort((a, b) => a - b)

  // Área: meses selecionados × anos ativos
  const dadosArea = mesesSorted.map(m => {
    const entry: Record<string, unknown> = { label: MESES[m - 1] }
    for (const a of anosAtivos) {
      const d = (dadosPorAno[a] ?? []).find(x => parseInt(x.mes.split('-')[1]) === m)
      entry[String(a)] = d?.total ?? null
    }
    return entry
  })

  // Top 15: base = ano mais recente selecionado
  const anoBase    = Math.max(...anosAtivos)
  const baseDesc   = descricoesPorAno[anoBase] ?? []
  const totalGeral = baseDesc.reduce((s, d) => s + (d.valor_total_sum ?? 0), 0)

  const top15 = [...baseDesc]
    .filter(d => d.valor_total_sum > 0)
    .sort((a, b) => b.valor_total_sum - a.valor_total_sum)
    .slice(0, 15)
    .map(d => {
      const pct = totalGeral > 0 ? (d.valor_total_sum / totalGeral) * 100 : 0
      const entry: Record<string, unknown> = {
        nome: d.descricao.length > 35 ? d.descricao.slice(0, 35) + '…' : d.descricao,
        pct,
        [String(anoBase)]: d.valor_total_sum,
      }
      for (const a of anosAtivos) {
        if (a === anoBase) continue
        const match = (descricoesPorAno[a] ?? []).find(x => x.descricao === d.descricao)
        entry[String(a)] = match?.valor_total_sum ?? 0
      }
      return entry
    })
    .sort((a, b) => top15Dir === 'desc'
      ? (a[String(anoBase)] as number) - (b[String(anoBase)] as number)
      : (b[String(anoBase)] as number) - (a[String(anoBase)] as number)
    )

  // ── Formatters / tooltip ──────────────────────────────────────────────────────

  function barLabelSingle(v: unknown) {
    const val = v as number
    if (!val) return ''
    const pctStr = totalGeral > 0 ? ` (${((val / totalGeral) * 100).toFixed(1)}%)` : ''
    return `${fmtBRL(val)}${pctStr}`
  }

  function TooltipArea({ active, payload, label }: {
    active?: boolean
    payload?: { dataKey: string; value: number; color: string }[]
    label?: string
  }) {
    if (!active || !payload?.length) return null
    const valBase = payload.find(p => String(p.dataKey) === String(anoBase))?.value
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>{label}</div>
        {[...payload].reverse().map(p => {
          const isBase = String(p.dataKey) === String(anoBase)
          const pct = !isBase && valBase && p.value ? ((p.value - valBase) / valBase) * 100 : null
          const idx = anosAtivos.indexOf(Number(p.dataKey))
          return (
            <div key={p.dataKey} style={{ color: CORES[idx] ?? p.color }}>
              {p.dataKey}: {fmtBRL(p.value)}
              {pct != null && (
                <span style={{ marginLeft: 6, fontWeight: 700, color: pct >= 0 ? '#15803d' : '#dc2626' }}>
                  {pct >= 0 ? '▲ +' : '▼ '}{pct.toFixed(1)}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── ThSort helpers ────────────────────────────────────────────────────────────

  function ThSort({ col, children, align }: { col: keyof DescricaoNF; children: React.ReactNode; align?: string }) {
    const ativo = sortCol === col
    return (
      <th className={styles.thSort}
        style={{ textAlign: (align as React.CSSProperties['textAlign']) ?? 'left', cursor: 'pointer' }}
        onClick={() => toggleSort(col)}>
        <span className={styles.thSortInner} style={{ justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
          {children}<span className={styles.thArrow} style={{ opacity: ativo ? 1 : 0.25 }}>{ativo ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
        </span>
      </th>
    )
  }

  function ThSortCat({ col, children }: { col: keyof Produto; children: React.ReactNode }) {
    const ativo = sortColCat === col
    return (
      <th className={styles.thSort} style={{ cursor: 'pointer' }} onClick={() => toggleSortCat(col)}>
        <span className={styles.thSortInner}>
          {children}<span className={styles.thArrow} style={{ opacity: ativo ? 1 : 0.25 }}>{ativo ? (sortDirCat === 'asc' ? '↑' : '↓') : '↕'}</span>
        </span>
      </th>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {/* Abas */}
      <div className={styles.abas}>
        <button className={`${styles.aba} ${aba === 'descricoes' ? styles.abaAtiva : ''}`} onClick={() => setAba('descricoes')}>Descrições das NFs</button>
        <button className={`${styles.aba} ${aba === 'analise' ? styles.abaAtiva : ''}`} onClick={() => setAba('analise')}>Análise</button>
        <button className={`${styles.aba} ${aba === 'catalogo' ? styles.abaAtiva : ''}`} onClick={() => { setAba('catalogo'); if (catalogo.length === 0) buscarCatalogo() }}>Catálogo de Produtos</button>
      </div>

      {/* ── Aba: Descrições ─────────────────────────────────────────────────── */}
      {aba === 'descricoes' && (
        <div className={styles.descWrap}>
          <div className={styles.info}>
            Agrupa todas as descrições únicas das notas fiscais emitidas. Use o botão <strong>Catalogar</strong> para
            vincular uma descrição a um produto padronizado.
          </div>
          <PeriodoSelector periodo={periodo} onChange={setPeriodo}
            dataIni={dataIni} dataFim={dataFim} onDataIni={setDataIni} onDataFim={setDataFim} />
          <div className={styles.buscaRow}>
            <input className={styles.buscaInput} type="text" placeholder="Buscar nas descrições..."
              value={busca} onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarDescricoes()} />
            <button className={styles.buscarBtn} onClick={buscarDescricoes} disabled={loading}>
              {loading ? '...' : 'Buscar'}
            </button>
          </div>
          {loading ? <div className={styles.loading}>Carregando descrições...</div> : (
            <div className={styles.tableWrap}>
              <div className={styles.tableInfo}>{descricoes.length} descrições únicas encontradas</div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr>
                    <ThSort col="descricao">Descrição NF</ThSort>
                    <ThSort col="codigo">Código</ThSort>
                    <ThSort col="ncm">NCM</ThSort>
                    <ThSort col="qtd_nfs" align="center">NFs</ThSort>
                    <ThSort col="qtd_total" align="right">Qtd total</ThSort>
                    <ThSort col="valor_total_sum" align="right">Faturado</ThSort>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {descricoesSorted.map(d => (
                      <Fragment key={d.descricao}>
                        <tr className={catalogando === d.descricao ? styles.rowAberta : undefined}>
                          <td><div className={styles.descText}>{d.descricao}</div></td>
                          <td><span className={styles.mono}>{d.codigo || '—'}</span></td>
                          <td><span className={styles.mono}>{d.ncm || '—'}</span></td>
                          <td style={{ textAlign: 'center' }}><span className={styles.badge}>{d.qtd_nfs}</span></td>
                          <td className={styles.numCell}>{d.qtd_total?.toLocaleString('pt-BR')}</td>
                          <td className={styles.valorCell}>{fmtBRL(d.valor_total_sum)}</td>
                          <td>
                            <button className={styles.catalogarBtn}
                              onClick={() => catalogando === d.descricao ? setCatalogando(null) : iniciarCatalogacao(d)}>
                              {catalogando === d.descricao ? 'Fechar' : 'Catalogar'}
                            </button>
                          </td>
                        </tr>
                        {catalogando === d.descricao && (
                          <tr><td colSpan={7} className={styles.formRow}>
                            <FormInline value={formCat} onChange={setFormCat} onSalvar={salvarCatalogacao}
                              onCancelar={() => setCatalogando(null)} salvando={salvandoCat} labelBtn="Catalogar" />
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                    {descricoes.length === 0 && !loading && (
                      <tr><td colSpan={7} className={styles.vazio}>
                        Nenhuma descrição encontrada para este período/busca.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Análise ────────────────────────────────────────────────────── */}
      {aba === 'analise' && (
        <div className={styles.analiseWrap}>

          {/* Filtros */}
          <div className={styles.analiseControles}>
            <div className={styles.filtrosRow}>
              <MultiSelectDropdown
                label="Ano"
                opts={ANOS_OPTS.map(a => ({ value: a, label: String(a) }))}
                selected={anosAtivos}
                onToggle={toggleAno}
                onToggleAll={toggleTodosAnos}
                hideSelected
              />
              <MultiSelectDropdown
                label="Mês"
                opts={MESES_OPTS}
                selected={mesesAtivos}
                onToggle={toggleMes}
                onToggleAll={toggleTodosMeses}
                hideSelected
              />
              {loadingAnalise && <span className={styles.carregandoTag}>Atualizando...</span>}
            </div>

          </div>

          {/* Gráfico de faturamento */}
          <div className={styles.graficoCard}>
            <div className={styles.graficoTitulo}>
              <div>
                <div>Faturamento mensal</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {[...anosAtivos].sort((a, b) => a - b).map((a, i) => (
                    <span key={a} style={{ fontSize: '0.78rem', fontWeight: 500, color: '#475569' }}>
                      <span style={{ color: CORES[i], marginRight: 3 }}>●</span>{a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {dadosArea.every(d => anosAtivos.every(a => d[String(a)] == null)) ? (
              <div className={styles.vazio}>Sem dados para a seleção atual.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dadosArea} margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                  <defs>
                    {anosAtivos.map((a, i) => (
                      <linearGradient key={a} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CORES[i]} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CORES[i]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={60} />
                  <Tooltip content={TooltipArea as never} />
                  {anosAtivos.map((a, i) => (
                    <Area key={a} type="monotone" dataKey={String(a)}
                      stroke={CORES[i]} strokeWidth={2}
                      strokeDasharray={i === 0 ? undefined : i === 1 ? '5 3' : i === 2 ? '3 2' : '7 3'}
                      fill={`url(#grad${i})`} dot={{ r: 3, fill: CORES[i] }} connectNulls />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 15 */}
          <div className={styles.graficoCard}>
            <div className={styles.graficoTitulo}>
              Top 15 — {anoBase}
              <span className={styles.graficoLegenda} style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>
                ranking pelo ano mais recente
              </span>
              <button
                className={styles.periodoBtn}
                style={{ marginLeft: 'auto', fontSize: '0.78rem' }}
                onClick={() => setTop15Dir(d => d === 'desc' ? 'asc' : 'desc')}
              >
                {top15Dir === 'desc' ? '↓ Maior primeiro' : '↑ Menor primeiro'}
              </button>
            </div>
            {top15.length === 0 ? (
              <div className={styles.vazio}>Sem dados para {anoBase}.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(320, top15.length * (anosAtivos.length > 1 ? 48 : 32))}>
                <BarChart data={top15} layout="vertical" margin={{ top: 0, right: 120, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="nome" width={240} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip formatter={(v, name) => name === 'pct' ? null : [fmtBRL(v as number), String(name)]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem' }} />
                  {anosAtivos.map((a, i) => (
                    <Bar key={a} dataKey={String(a)} fill={CORES[i]}
                      radius={i === anosAtivos.length - 1 ? [0, 4, 4, 0] : 0}
                      label={anosAtivos.length === 1
                        ? { position: 'right', formatter: barLabelSingle as never, fontSize: 10, fill: '#64748b' }
                        : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>
      )}

      {/* ── Aba: Catálogo ────────────────────────────────────────────────────── */}
      {aba === 'catalogo' && (
        <div className={styles.catWrap}>
          <div className={styles.catHeader}>
            <span className={styles.catInfo}>{catalogo.length > 0 ? `${catalogo.length} produtos cadastrados` : 'Catálogo vazio'}</span>
            <button className={styles.novoBtn} onClick={() => { setCriando(c => !c); setFormNovo(FORM_VAZIO) }}>
              {criando ? '✕ Cancelar' : '+ Novo produto'}
            </button>
          </div>
          {criando && (
            <div className={styles.novoFormWrap}>
              <FormInline value={formNovo} onChange={setFormNovo} onSalvar={criarProduto}
                onCancelar={() => setCriando(false)} salvando={salvando} labelBtn="Criar produto" />
            </div>
          )}
          {loadingCat ? <div className={styles.loading}>Carregando catálogo...</div> : (
            <div className={styles.tableWrap}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr>
                    <ThSortCat col="nome_padronizado">Nome padronizado</ThSortCat>
                    <ThSortCat col="familia">Família</ThSortCat>
                    <ThSortCat col="material">Material</ThSortCat>
                    <ThSortCat col="dimensoes">Dimensões</ThSortCat>
                    <ThSortCat col="unidade">Un.</ThSortCat>
                    <ThSortCat col="ncm">NCM</ThSortCat>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {catalogoSorted.map(p => (
                      <Fragment key={p.id}>
                        <tr className={editando?.id === p.id ? styles.rowAberta : undefined}>
                          <td className={styles.nomeProduto}>{p.nome_padronizado}</td>
                          <td>{p.familia ? <span className={styles.pillFam}>{p.familia}</span> : <span className={styles.sem}>—</span>}</td>
                          <td><span className={styles.mono}>{p.material || '—'}</span></td>
                          <td><span className={styles.mono}>{p.dimensoes || '—'}</span></td>
                          <td>{p.unidade || '—'}</td>
                          <td><span className={styles.mono}>{p.ncm || '—'}</span></td>
                          <td>
                            <div className={styles.catAcoes}>
                              <button className={styles.editBtn} onClick={() => setEditando(editando?.id === p.id ? null : { ...p })}>Editar</button>
                              <button className={styles.delBtn} onClick={() => excluir(p.id)} title="Remover">×</button>
                            </div>
                          </td>
                        </tr>
                        {editando?.id === p.id && (
                          <tr><td colSpan={7} className={styles.formRow}>
                            <FormInline
                              value={{ nome_padronizado: editando.nome_padronizado, familia: editando.familia, material: editando.material, dimensoes: editando.dimensoes, unidade: editando.unidade, ncm: editando.ncm }}
                              onChange={f => setEditando(ed => ed ? { ...ed, ...f } : null)}
                              onSalvar={salvarEdicao} onCancelar={() => setEditando(null)} salvando={salvando} />
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                    {catalogo.length === 0 && !loadingCat && (
                      <tr><td colSpan={7} className={styles.vazio}>
                        Catálogo vazio. Acesse <strong>Descrições das NFs</strong> para catalogar, ou use <strong>+ Novo produto</strong>.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
