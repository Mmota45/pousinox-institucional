import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminVendas.module.css'
import finStyles from './AdminFinanceiro.module.css'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Venda {
  id: string
  produto_titulo: string
  valor_recebido: number
  forma_pagamento: string
  data_venda: string
  observacao: string | null
}

interface Categoria { id: number; nome: string; tipo: 'receita'|'despesa'; grupo: string; cor: string; ativo: boolean }

interface BudgetItem {
  id: number; ano: number; mes: number | null; categoria_id: number
  centro_custo_id: number | null; valor_orcado: number; observacao: string | null
  fin_categorias?: { nome: string; cor: string; grupo: string } | null
  fin_centros_custo?: { nome: string } | null
}
interface BudgetRow extends BudgetItem {
  realizado: number; variacao: number; pct: number; status: 'ok'|'alerta'|'excedido'
}

interface DreGrupo {
  grupo: string; tipo: 'receita'|'despesa'; realizado: number; previsto: number; atrasado: number
}

type Aba = 'vendas' | 'budget' | 'dre'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number, ocultar = false) =>
  ocultar ? '••••' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtBRLint = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function AdminRelatorios() {
  const { ocultarValores } = useAdmin()
  const [aba, setAba] = useState<Aba>('vendas')

  // ── Vendas ────────────────────────────────────────────────────────────────
  const hoje    = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const hojeStr   = hoje.toISOString().slice(0, 10)

  const [dataInicio, setDataInicio] = useState(inicioMes)
  const [dataFim,    setDataFim]    = useState(hojeStr)
  const [vendas,     setVendas]     = useState<Venda[]>([])
  const [buscado,    setBuscado]    = useState(false)
  const [loadingVendas, setLoadingVendas] = useState(false)

  const fmt     = (v: number) => ocultarValores ? '••••' : 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  async function buscar() {
    setLoadingVendas(true)
    const { data } = await supabaseAdmin
      .from('vendas').select('*')
      .gte('data_venda', new Date(dataInicio).toISOString())
      .lte('data_venda', new Date(dataFim + 'T23:59:59').toISOString())
      .order('data_venda', { ascending: false })
    setVendas(data ?? [])
    setBuscado(true)
    setLoadingVendas(false)
  }

  const total  = vendas.reduce((s, v) => s + Number(v.valor_recebido), 0)
  const ticket = vendas.length > 0 ? total / vendas.length : 0

  const porForma: Record<string, { qtd: number; valor: number }> = {}
  vendas.forEach(v => {
    if (!porForma[v.forma_pagamento]) porForma[v.forma_pagamento] = { qtd: 0, valor: 0 }
    porForma[v.forma_pagamento].qtd++
    porForma[v.forma_pagamento].valor += Number(v.valor_recebido)
  })
  const porProduto: Record<string, { qtd: number; valor: number }> = {}
  vendas.forEach(v => {
    if (!porProduto[v.produto_titulo]) porProduto[v.produto_titulo] = { qtd: 0, valor: 0 }
    porProduto[v.produto_titulo].qtd++
    porProduto[v.produto_titulo].valor += Number(v.valor_recebido)
  })
  const formaArray = Object.entries(porForma).map(([forma, d]) => ({ forma, ...d }))
  const prodArray  = Object.entries(porProduto).map(([titulo, d]) => ({ titulo, ...d }))

  const [vendKey,  setVendKey]  = useState<keyof Venda>('data_venda')
  const [vendDir,  setVendDir]  = useState<'asc'|'desc'>('desc')
  const [formaKey, setFormaKey] = useState<'forma'|'qtd'|'valor'>('valor')
  const [formaDir, setFormaDir] = useState<'asc'|'desc'>('desc')
  const [prodKey2, setProdKey2] = useState<'titulo'|'qtd'|'valor'>('valor')
  const [prodDir2, setProdDir2] = useState<'asc'|'desc'>('desc')

  function toggleVend(k: keyof Venda)            { if (k===vendKey)  setVendDir(d=>d==='asc'?'desc':'asc');  else { setVendKey(k);  setVendDir('desc') } }
  function toggleForma(k: 'forma'|'qtd'|'valor') { if (k===formaKey) setFormaDir(d=>d==='asc'?'desc':'asc'); else { setFormaKey(k); setFormaDir('desc') } }
  function toggleProd2(k: 'titulo'|'qtd'|'valor'){ if (k===prodKey2) setProdDir2(d=>d==='asc'?'desc':'asc'); else { setProdKey2(k); setProdDir2('desc') } }
  function indVend(k: keyof Venda)   { return vendKey===k  ? (vendDir==='asc' ?'▲':'▼') : '⇅' }
  function indForma(k: string)       { return formaKey===k ? (formaDir==='asc'?'▲':'▼') : '⇅' }
  function indProd2(k: string)       { return prodKey2===k ? (prodDir2==='asc'?'▲':'▼') : '⇅' }
  function sortArr<T>(arr: T[], key: keyof T, dir: 'asc'|'desc') {
    return [...arr].sort((a, b) => { const av=a[key]??''; const bv=b[key]??''; const c=av<bv?-1:av>bv?1:0; return dir==='asc'?c:-c })
  }
  function exportarCSV() {
    const header = 'Produto,Valor,Pagamento,Data,Observação'
    const rows   = vendas.map(v=>`"${v.produto_titulo}","${fmt(v.valor_recebido)}","${v.forma_pagamento}","${fmtData(v.data_venda)}","${v.observacao??''}"`)
    const csv = [header,...rows].join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`vendas-${dataInicio}-${dataFim}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  const [categorias,      setCategorias]      = useState<Categoria[]>([])
  const [budgetItens,     setBudgetItens]     = useState<BudgetRow[]>([])
  const [anoB,            setAnoB]            = useState(new Date().getFullYear())
  const [mesB,            setMesB]            = useState<number|''>(new Date().getMonth()+1)
  const [editandoBudgetId,setEditandoBudgetId]= useState<number|null>(null)
  const [editValor,       setEditValor]       = useState('')
  const [salvandoBudget,  setSalvandoBudget]  = useState(false)
  const [novaCatB,        setNovaCatB]        = useState('')
  const [novoValorB,      setNovoValorB]      = useState('')
  const [adicionando,     setAdicionando]     = useState(false)
  const [msg,             setMsg]             = useState<{tipo:'ok'|'erro';texto:string}|null>(null)

  useEffect(()=>{ if(!msg) return; const t=setTimeout(()=>setMsg(null),3500); return ()=>clearTimeout(t) },[msg])

  const carregarBudget = useCallback(async () => {
    const [{ data: cats }] = await Promise.all([
      supabaseAdmin.from('fin_categorias').select('*').eq('ativo',true).order('grupo').order('nome'),
    ])
    setCategorias(cats ?? [])

    let bq = supabaseAdmin.from('fin_budget')
      .select('*, fin_categorias(nome,cor,grupo), fin_centros_custo(nome)').eq('ano',anoB)
    if (mesB!=='') bq=bq.eq('mes',mesB); else bq=bq.is('mes',null)
    const { data: budgets } = await bq

    const mesStr  = mesB!=='' ? String(mesB).padStart(2,'0') : null
    const dimMes  = mesB!=='' ? new Date(anoB, mesB as number, 0).getDate() : 31
    const dataIni = mesStr ? `${anoB}-${mesStr}-01` : `${anoB}-01-01`
    const dataFimB= mesStr ? `${anoB}-${mesStr}-${dimMes}` : `${anoB}-12-31`
    const { data: lancs } = await supabaseAdmin.from('fin_lancamentos')
      .select('categoria_id, valor').eq('tipo','despesa')
      .in('status',['pendente','pago','parcial'])
      .gte('data_competencia',dataIni).lte('data_competencia',dataFimB)

    const realMap: Record<number,number> = {}
    for (const l of (lancs??[])) {
      if (l.categoria_id!=null) realMap[l.categoria_id]=(realMap[l.categoria_id]??0)+(l.valor as number)
    }
    const rows: BudgetRow[] = (budgets??[]).map(b => {
      const realizado=realMap[b.categoria_id]??0
      const variacao=realizado-b.valor_orcado
      const pct=b.valor_orcado>0?(realizado/b.valor_orcado)*100:(realizado>0?999:0)
      const status: BudgetRow['status']=pct>=100?'excedido':pct>=80?'alerta':'ok'
      return {...(b as BudgetItem),realizado,variacao,pct,status}
    })
    rows.sort((a,b)=>{
      const ga=a.fin_categorias?.grupo??''; const gb=b.fin_categorias?.grupo??''
      return ga!==gb?ga.localeCompare(gb):(a.fin_categorias?.nome??'').localeCompare(b.fin_categorias?.nome??'')
    })
    setBudgetItens(rows)
  }, [anoB, mesB])

  useEffect(()=>{ if(aba==='budget') carregarBudget() },[aba,carregarBudget])

  async function salvarBudgetInline(id: number) {
    setSalvandoBudget(true)
    const v=parseFloat(editValor.replace(',','.'))
    if(isNaN(v)||v<0){ setMsg({tipo:'erro',texto:'Valor inválido.'}); setSalvandoBudget(false); return }
    const {error}=await supabaseAdmin.from('fin_budget').update({valor_orcado:v}).eq('id',id)
    if(error) setMsg({tipo:'erro',texto:'Erro ao salvar.'})
    else { setMsg({tipo:'ok',texto:'Budget atualizado.'}); setEditandoBudgetId(null); carregarBudget() }
    setSalvandoBudget(false)
  }

  async function adicionarBudget(e: React.FormEvent) {
    e.preventDefault(); if(!novaCatB) return
    setAdicionando(true)
    const v=parseFloat(novoValorB.replace(',','.'))||0
    const {error}=await supabaseAdmin.from('fin_budget').insert({
      ano:anoB, mes:mesB!==''?mesB:null, categoria_id:Number(novaCatB), valor_orcado:v,
    })
    if(error) setMsg({tipo:'erro',texto:error.code==='23505'?'Categoria já existe neste período.':error.message})
    else { setMsg({tipo:'ok',texto:'Linha adicionada.'}); setNovaCatB(''); setNovoValorB(''); carregarBudget() }
    setAdicionando(false)
  }

  async function removerBudget(id: number) {
    if(!window.confirm('Remover esta linha?')) return
    await supabaseAdmin.from('fin_budget').delete().eq('id',id)
    carregarBudget()
  }

  // ── DRE ───────────────────────────────────────────────────────────────────
  const [dreGrupos, setDreGrupos] = useState<DreGrupo[]>([])
  const [dreAno,    setDreAno]    = useState(new Date().getFullYear())
  const [dreMes,    setDreMes]    = useState<number>(0)

  const carregarDre = useCallback(async () => {
    const hojeStr2 = new Date().toISOString().slice(0,10)
    const dataIni  = dreMes ? `${dreAno}-${String(dreMes).padStart(2,'0')}-01` : `${dreAno}-01-01`
    const dimMes   = dreMes ? new Date(dreAno,dreMes,0).getDate() : 31
    const dataFim  = dreMes ? `${dreAno}-${String(dreMes).padStart(2,'0')}-${dimMes}` : `${dreAno}-12-31`

    const [{data:movs},{data:previstos},{data:atrasados}] = await Promise.all([
      supabaseAdmin.from('fin_movimentacoes').select('tipo,valor').gte('data',dataIni).lte('data',dataFim),
      supabaseAdmin.from('fin_lancamentos').select('tipo,valor,fin_categorias(grupo,tipo)')
        .eq('status','pendente').gte('data_vencimento',hojeStr2).gte('data_vencimento',dataIni).lte('data_vencimento',dataFim),
      supabaseAdmin.from('fin_lancamentos').select('tipo,valor,fin_categorias(grupo,tipo)')
        .eq('status','pendente').lt('data_vencimento',hojeStr2).gte('data_vencimento',dataIni).lte('data_vencimento',dataFim),
    ])

    const map: Record<string,DreGrupo> = {}
    const ensure=(grupo:string,tipo:'receita'|'despesa')=>{
      const k=`${tipo}::${grupo||'Sem categoria'}`
      if(!map[k]) map[k]={grupo:grupo||'Sem categoria',tipo,realizado:0,previsto:0,atrasado:0}
      return map[k]
    }
    let totE=0,totS=0
    for(const m of (movs??[]) as any[]){ if(m.tipo==='entrada') totE+=Number(m.valor)||0; else totS+=Number(m.valor)||0 }
    if(totE>0) ensure('Caixa','receita').realizado+=totE
    if(totS>0) ensure('Caixa','despesa').realizado+=totS
    for(const l of (previstos??[]) as any[]){ const cat=(l as any).fin_categorias; ensure(cat?.grupo??'',cat?.tipo??l.tipo).previsto+=Number(l.valor)||0 }
    for(const l of (atrasados??[]) as any[]){ const cat=(l as any).fin_categorias; ensure(cat?.grupo??'',cat?.tipo??l.tipo).atrasado+=Number(l.valor)||0 }
    setDreGrupos(Object.values(map).sort((a,b)=>a.tipo!==b.tipo?a.tipo.localeCompare(b.tipo):a.grupo.localeCompare(b.grupo)))
  },[dreAno,dreMes])

  useEffect(()=>{ if(aba==='dre') carregarDre() },[aba,carregarDre])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {msg && <div className={msg.tipo==='ok'?finStyles.msgOk:finStyles.msgErro}>{msg.texto}</div>}

      {/* Abas */}
      <div className={finStyles.abas}>
        {([['vendas','📊 Vendas'],['budget','🎯 Budget'],['dre','📈 DRE']] as const).map(([k,l])=>(
          <button key={k} className={`${finStyles.aba} ${aba===k?finStyles.abaAtiva:''}`} onClick={()=>setAba(k)}>{l}</button>
        ))}
      </div>

      {/* ══ VENDAS ══ */}
      {aba==='vendas' && (
        <>
          <div className={styles.form}>
            <h2 className={styles.formTitle}>Relatório de vendas</h2>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label>Data início</label>
                <input className={styles.input} type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>Data fim</label>
                <input className={styles.input} type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}/>
              </div>
              <div className={styles.field} style={{justifyContent:'flex-end'}}>
                <label>&nbsp;</label>
                <button className={styles.btnPrimary} onClick={buscar} disabled={loadingVendas}>
                  {loadingVendas?'Buscando...':'Gerar relatório'}
                </button>
              </div>
            </div>
          </div>

          {buscado && (
            <>
              <div className={styles.indicadores}>
                <div className={styles.indicador}><span>Total de vendas</span><strong>{vendas.length}</strong></div>
                <div className={styles.indicador}><span>Faturamento</span><strong>{fmt(total)}</strong></div>
                <div className={styles.indicador}><span>Ticket médio</span><strong>{fmt(ticket)}</strong></div>
              </div>

              {vendas.length>0 && (
                <div className={styles.grid2col}>
                  <div>
                    <h3 className={styles.formTitle}>Por forma de pagamento</h3>
                    <table className={styles.tabela}>
                      <thead><tr>
                        <th className={styles.sortable} onClick={()=>toggleForma('forma')}>Forma {indForma('forma')}</th>
                        <th className={styles.sortable} onClick={()=>toggleForma('qtd')}>Qtd {indForma('qtd')}</th>
                        <th className={styles.sortable} onClick={()=>toggleForma('valor')}>Total {indForma('valor')}</th>
                      </tr></thead>
                      <tbody>{sortArr(formaArray,formaKey,formaDir).map(d=>(
                        <tr key={d.forma}>
                          <td>{d.forma.charAt(0).toUpperCase()+d.forma.slice(1)}</td>
                          <td style={{textAlign:'center'}}>{d.qtd}</td>
                          <td className={styles.valor}>{fmt(d.valor)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div>
                    <h3 className={styles.formTitle}>Por produto</h3>
                    <table className={styles.tabela}>
                      <thead><tr>
                        <th className={styles.sortable} onClick={()=>toggleProd2('titulo')}>Produto {indProd2('titulo')}</th>
                        <th className={styles.sortable} onClick={()=>toggleProd2('qtd')}>Qtd {indProd2('qtd')}</th>
                        <th className={styles.sortable} onClick={()=>toggleProd2('valor')}>Total {indProd2('valor')}</th>
                      </tr></thead>
                      <tbody>{sortArr(prodArray,prodKey2,prodDir2).map(d=>(
                        <tr key={d.titulo}><td>{d.titulo}</td><td style={{textAlign:'center'}}>{d.qtd}</td><td className={styles.valor}>{fmt(d.valor)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className={styles.lista}>
                <div className={styles.listaHeader}>
                  <h3 className={styles.formTitle}>Detalhamento ({vendas.length} venda{vendas.length!==1?'s':''})</h3>
                  {vendas.length>0 && <button className={styles.btnSecondary} onClick={exportarCSV}>Exportar CSV</button>}
                </div>
                {vendas.length===0 ? <p className={styles.vazio}>Nenhuma venda no período.</p> : (
                  <table className={styles.tabela}>
                    <thead><tr>
                      <th className={styles.sortable} onClick={()=>toggleVend('produto_titulo')}>Produto {indVend('produto_titulo')}</th>
                      <th className={styles.sortable} onClick={()=>toggleVend('valor_recebido')}>Valor {indVend('valor_recebido')}</th>
                      <th className={styles.sortable} onClick={()=>toggleVend('forma_pagamento')}>Pagamento {indVend('forma_pagamento')}</th>
                      <th className={styles.sortable} onClick={()=>toggleVend('data_venda')}>Data {indVend('data_venda')}</th>
                      <th>Obs</th>
                    </tr></thead>
                    <tbody>{sortArr(vendas,vendKey,vendDir).map(v=>(
                      <tr key={v.id}>
                        <td>{v.produto_titulo}</td>
                        <td className={styles.valor}>{fmt(v.valor_recebido)}</td>
                        <td>{v.forma_pagamento}</td>
                        <td>{fmtData(v.data_venda)}</td>
                        <td className={styles.obs}>{v.observacao??'—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ══ BUDGET ══ */}
      {aba==='budget' && (()=>{
        const catsSemBudget=categorias.filter(c=>c.tipo==='despesa'&&!budgetItens.find(b=>b.categoria_id===c.id))
        const totalOrcado   =budgetItens.reduce((s,r)=>s+r.valor_orcado,0)
        const totalRealizado=budgetItens.reduce((s,r)=>s+r.realizado,0)
        const totalVariacao =totalRealizado-totalOrcado
        const totalPct      =totalOrcado>0?(totalRealizado/totalOrcado)*100:0
        const grupos=[...new Set(budgetItens.map(r=>r.fin_categorias?.grupo??''))].sort()
        return (
          <div className={finStyles.budgetWrap}>
            <div className={finStyles.budgetFiltros}>
              <div className={finStyles.field}>
                <label>Ano</label>
                <select className={finStyles.input} value={anoB} onChange={e=>setAnoB(Number(e.target.value))}>
                  {[anoB-1,anoB,anoB+1].map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className={finStyles.field}>
                <label>Mês</label>
                <select className={finStyles.input} value={mesB} onChange={e=>setMesB(e.target.value===''?'':Number(e.target.value))}>
                  <option value="">Anual</option>
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
            </div>

            {budgetItens.length>0 && (
              <div className={finStyles.budgetResumo}>
                <div className={finStyles.budgetCard}><span className={finStyles.budgetCardLabel}>Total Orçado</span><span className={finStyles.budgetCardVal}>{fmtBRL(totalOrcado,ocultarValores)}</span></div>
                <div className={finStyles.budgetCard}><span className={finStyles.budgetCardLabel}>Total Realizado</span><span className={finStyles.budgetCardVal}>{fmtBRL(totalRealizado,ocultarValores)}</span></div>
                <div className={`${finStyles.budgetCard} ${totalVariacao>0?finStyles.budgetCardExcedido:finStyles.budgetCardOk}`}>
                  <span className={finStyles.budgetCardLabel}>Variação</span>
                  <span className={finStyles.budgetCardVal}>{totalVariacao>0?'+':''}{fmtBRL(totalVariacao,ocultarValores)}</span>
                </div>
                <div className={finStyles.budgetCard}><span className={finStyles.budgetCardLabel}>Utilização</span><span className={finStyles.budgetCardVal}>{totalPct.toFixed(1)}%</span></div>
              </div>
            )}

            {budgetItens.length===0 && <div className={finStyles.emptyMsg}>Nenhum orçamento cadastrado para este período.</div>}
            {grupos.map(grupo=>(
              <div key={grupo} className={finStyles.budgetGrupo}>
                <div className={finStyles.budgetGrupoTitulo}>{grupo||'Sem grupo'}</div>
                <table className={finStyles.budgetTable}>
                  <thead><tr>
                    <th>Categoria</th>
                    <th className={finStyles.right}>Orçado</th>
                    <th className={finStyles.right}>Realizado</th>
                    <th className={finStyles.right}>Variação</th>
                    <th className={finStyles.right}>%</th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody>{budgetItens.filter(r=>(r.fin_categorias?.grupo??'')===grupo).map(row=>(
                    <tr key={row.id}>
                      <td><span className={finStyles.catDot} style={{background:row.fin_categorias?.cor??'#888'}}/>{row.fin_categorias?.nome??`#${row.categoria_id}`}</td>
                      <td className={finStyles.right}>
                        {editandoBudgetId===row.id ? (
                          <span className={finStyles.inlineEdit}>
                            <input className={finStyles.inputSmall} value={editValor}
                              onChange={e=>setEditValor(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter')salvarBudgetInline(row.id);if(e.key==='Escape')setEditandoBudgetId(null)}}
                              autoFocus/>
                            <button className={finStyles.btnBaixa} onClick={()=>salvarBudgetInline(row.id)} disabled={salvandoBudget}>✓</button>
                            <button className={finStyles.btnCancelarBaixa} onClick={()=>setEditandoBudgetId(null)}>✕</button>
                          </span>
                        ) : (
                          <span className={finStyles.editableVal} onClick={()=>{setEditandoBudgetId(row.id);setEditValor(String(row.valor_orcado))}}>
                            {fmtBRL(row.valor_orcado,ocultarValores)} ✏️
                          </span>
                        )}
                      </td>
                      <td className={finStyles.right}>{fmtBRL(row.realizado,ocultarValores)}</td>
                      <td className={`${finStyles.right} ${row.variacao>0?finStyles.txtRed:finStyles.txtGreen}`}>{row.variacao>0?'+':''}{fmtBRL(row.variacao,ocultarValores)}</td>
                      <td className={finStyles.right}>
                        <span className={finStyles.budgetBar}><span className={finStyles.budgetBarFill} style={{width:`${Math.min(row.pct,100)}%`,background:row.status==='excedido'?'var(--color-danger,#dc2626)':row.status==='alerta'?'#f59e0b':'var(--color-success,#16a34a)'}}/></span>
                        {row.pct.toFixed(0)}%
                      </td>
                      <td><span className={`${finStyles.budgetStatus} ${finStyles[`budget_${row.status}`]}`}>{row.status==='ok'?'OK':row.status==='alerta'?'Alerta':'Excedido'}</span></td>
                      <td><button className={finStyles.btnRemover} onClick={()=>removerBudget(row.id)} title="Remover">🗑</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}

            {catsSemBudget.length>0 && (
              <form className={finStyles.budgetAddForm} onSubmit={adicionarBudget}>
                <div className={finStyles.budgetAddTitulo}>Adicionar categoria ao budget</div>
                <div className={finStyles.row3}>
                  <div className={finStyles.field}>
                    <label>Categoria (despesa)</label>
                    <select className={finStyles.input} value={novaCatB} onChange={e=>setNovaCatB(e.target.value)} required>
                      <option value="">Selecione…</option>
                      {catsSemBudget.map(c=><option key={c.id} value={c.id}>{c.grupo?`${c.grupo} — `:''}{c.nome}</option>)}
                    </select>
                  </div>
                  <div className={finStyles.field}>
                    <label>Valor orçado (R$)</label>
                    <input className={finStyles.input} value={novoValorB} onChange={e=>setNovoValorB(e.target.value)} placeholder="0,00"/>
                  </div>
                  <div className={finStyles.field} style={{justifyContent:'flex-end'}}>
                    <button type="submit" className={finStyles.btnPrimary} disabled={adicionando||!novaCatB}>{adicionando?'Adicionando…':'+ Adicionar'}</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )
      })()}

      {/* ══ DRE ══ */}
      {aba==='dre' && (()=>{
        const receitas=dreGrupos.filter(g=>g.tipo==='receita')
        const despesas=dreGrupos.filter(g=>g.tipo==='despesa')
        const totR=(arr:DreGrupo[],col:keyof DreGrupo)=>arr.reduce((s,g)=>s+(g[col] as number),0)
        const totRecReal=totR(receitas,'realizado'),totRecPrev=totR(receitas,'previsto'),totRecAtr=totR(receitas,'atrasado')
        const totDesReal=totR(despesas,'realizado'),totDesPrev=totR(despesas,'previsto'),totDesAtr=totR(despesas,'atrasado')
        const resReal=totRecReal-totDesReal,resPrev=totRecPrev-totDesPrev,resAtr=totRecAtr-totDesAtr
        const thS:React.CSSProperties={padding:'8px 14px',textAlign:'right',fontSize:'0.75rem',fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:'0.04em',background:'#f5f7fa',borderBottom:'2px solid #e0e4ea',whiteSpace:'nowrap'}
        const tdS:React.CSSProperties={padding:'8px 14px',textAlign:'right',fontSize:'0.84rem',borderBottom:'1px solid #f0f2f5'}
        const secS:React.CSSProperties={padding:'7px 14px',fontWeight:700,fontSize:'0.78rem',textTransform:'uppercase',letterSpacing:'0.05em',background:'#f0f4f8',borderBottom:'1px solid #e0e4ea',color:'#1a3a5c'}
        const totS:React.CSSProperties={padding:'9px 14px',textAlign:'right',fontSize:'0.84rem',fontWeight:700,borderTop:'2px solid #e0e4ea',background:'#f5f7fa'}
        const rc=(v:number)=>v>=0?'#27ae60':'#c0392b'
        return (
          <>
            <div style={{display:'flex',gap:10,alignItems:'flex-end',marginBottom:20,flexWrap:'wrap'}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <label style={{fontSize:'0.68rem',fontWeight:700,color:'#666',textTransform:'uppercase'}}>Ano</label>
                <select value={dreAno} onChange={e=>setDreAno(Number(e.target.value))} style={{padding:'6px 10px',border:'1px solid #d0d7de',borderRadius:6,fontSize:'0.83rem'}}>
                  {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <label style={{fontSize:'0.68rem',fontWeight:700,color:'#666',textTransform:'uppercase'}}>Período</label>
                <select value={dreMes} onChange={e=>setDreMes(Number(e.target.value))} style={{padding:'6px 10px',border:'1px solid #d0d7de',borderRadius:6,fontSize:'0.83rem'}}>
                  <option value={0}>Ano todo</option>
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <button className={finStyles.btnFiltrar} onClick={carregarDre}>Atualizar</button>
              <span style={{marginLeft:'auto',fontSize:'0.78rem',color:'#888',alignSelf:'flex-end'}}>
                Regime de caixa · {dreAno}{dreMes?` / ${String(dreMes).padStart(2,'0')}`:''}
              </span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.83rem'}}>
                <thead><tr>
                  <th style={{...thS,textAlign:'left',minWidth:200}}>Grupo / Categoria</th>
                  <th style={thS}>Realizado</th><th style={thS}>Previsto</th><th style={thS}>Atrasado</th>
                  <th style={{...thS,color:'#1a3a5c'}}>Resultado</th>
                </tr></thead>
                <tbody>
                  <tr><td colSpan={5} style={{...secS,color:'#27ae60'}}>🟢 Receitas</td></tr>
                  {receitas.map(g=>(
                    <tr key={g.grupo}>
                      <td style={{padding:'8px 14px 8px 28px',borderBottom:'1px solid #f0f2f5',fontSize:'0.83rem'}}>{g.grupo}</td>
                      <td style={{...tdS,color:'#27ae60'}}>{fmtBRLint(g.realizado)}</td>
                      <td style={{...tdS,color:'#888'}}>{fmtBRLint(g.previsto)}</td>
                      <td style={{...tdS,color:g.atrasado>0?'#e67e22':'#888'}}>{fmtBRLint(g.atrasado)}</td>
                      <td style={tdS}></td>
                    </tr>
                  ))}
                  {receitas.length===0 && <tr><td colSpan={5} style={{padding:'12px 28px',color:'#aaa',fontSize:'0.8rem'}}>Sem receitas no período</td></tr>}
                  <tr>
                    <td style={{...totS,textAlign:'left',paddingLeft:14}}>Total Receitas</td>
                    <td style={{...totS,color:'#27ae60'}}>{fmtBRLint(totRecReal)}</td>
                    <td style={totS}>{fmtBRLint(totRecPrev)}</td>
                    <td style={{...totS,color:totRecAtr>0?'#e67e22':'#333'}}>{fmtBRLint(totRecAtr)}</td>
                    <td style={totS}></td>
                  </tr>
                  <tr><td colSpan={5} style={{...secS,color:'#c0392b',paddingTop:16}}>🔴 Despesas</td></tr>
                  {despesas.map(g=>(
                    <tr key={g.grupo}>
                      <td style={{padding:'8px 14px 8px 28px',borderBottom:'1px solid #f0f2f5',fontSize:'0.83rem'}}>{g.grupo}</td>
                      <td style={{...tdS,color:'#c0392b'}}>{fmtBRLint(g.realizado)}</td>
                      <td style={{...tdS,color:'#888'}}>{fmtBRLint(g.previsto)}</td>
                      <td style={{...tdS,color:g.atrasado>0?'#e67e22':'#888'}}>{fmtBRLint(g.atrasado)}</td>
                      <td style={tdS}></td>
                    </tr>
                  ))}
                  {despesas.length===0 && <tr><td colSpan={5} style={{padding:'12px 28px',color:'#aaa',fontSize:'0.8rem'}}>Sem despesas no período</td></tr>}
                  <tr>
                    <td style={{...totS,textAlign:'left',paddingLeft:14}}>Total Despesas</td>
                    <td style={{...totS,color:'#c0392b'}}>{fmtBRLint(totDesReal)}</td>
                    <td style={totS}>{fmtBRLint(totDesPrev)}</td>
                    <td style={{...totS,color:totDesAtr>0?'#e67e22':'#333'}}>{fmtBRLint(totDesAtr)}</td>
                    <td style={totS}></td>
                  </tr>
                  <tr style={{background:'#1a3a5c'}}>
                    <td style={{padding:'12px 14px',fontWeight:800,fontSize:'0.88rem',color:'#fff'}}>Resultado Líquido</td>
                    <td style={{padding:'12px 14px',textAlign:'right',fontWeight:800,fontSize:'0.88rem',color:rc(resReal)}}>{fmtBRLint(resReal)}</td>
                    <td style={{padding:'12px 14px',textAlign:'right',fontWeight:700,fontSize:'0.84rem',color:rc(resPrev)}}>{fmtBRLint(resPrev)}</td>
                    <td style={{padding:'12px 14px',textAlign:'right',fontWeight:700,fontSize:'0.84rem',color:rc(resAtr)}}>{fmtBRLint(resAtr)}</td>
                    <td style={{padding:'12px 14px'}}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )
      })()}
    </div>
  )
}
