import { useState, useRef } from 'react'
import { useAdmin } from '../contexts/AdminContext'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminAnaliseNF.module.css'

interface ItemNF {
  nf: string
  cnpj: string
  cliente: string
  emissao: string
  codigo: string
  descricao: string
  qtd: number
  vlrUnit: number
  vlrTotal: number
}

interface Analise {
  itens: ItemNF[]
  faturamentoTotal: number
  totalNFs: number
  porMes: { mes: string; total: number }[]
  topProdutos: { codigo: string; desc: string; qtd: number; total: number; nfs: number }[]
  topClientes: { cnpj: string; nome: string; total: number; nfs: number }[]
  ticketMedio: number
}

function parseCSV(content: string): string[][] {
  const rows: string[][] = []
  let i = 0
  while (i < content.length) {
    const row: string[] = []
    while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
      if (content[i] === '"') {
        i++
        let val = ''
        while (i < content.length) {
          if (content[i] === '"' && content[i + 1] === '"') { val += '"'; i += 2 }
          else if (content[i] === '"') { i++; break }
          else { val += content[i++] }
        }
        row.push(val)
        if (content[i] === ',') i++
      } else {
        let val = ''
        while (i < content.length && content[i] !== ',' && content[i] !== '\n' && content[i] !== '\r') {
          val += content[i++]
        }
        row.push(val.trim())
        if (content[i] === ',') i++
      }
    }
    if (content[i] === '\r') i++
    if (content[i] === '\n') i++
    if (row.length > 1) rows.push(row)
  }
  return rows
}

function parseVal(s: string): number {
  if (!s) return 0
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function analisar(csvText: string): Analise {
  const rows = parseCSV(csvText)
  const dataRows = rows.slice(1)

  const byProduto: Record<string, { desc: string; qtd: number; total: number; nfs: Set<string> }> = {}
  const byCliente: Record<string, { nome: string; total: number; nfs: Set<string> }> = {}
  const byMes: Record<string, number> = {}
  const nfSet = new Set<string>()
  const itens: ItemNF[] = []
  let faturamentoTotal = 0

  for (const r of dataRows) {
    if (r.length < 20) continue
    const nf = r[0]
    const cnpj = r[1]
    const cliente = r[2]
    const emissao = r[3]
    const codigo = r[4]
    const desc = r[7]
    const qtd = parseVal(r[9])
    const vlrUnit = parseVal(r[10])
    const vlrTotal = parseVal(r[19])

    faturamentoTotal += vlrTotal
    nfSet.add(nf)

    itens.push({ nf, cnpj, cliente, emissao, codigo, descricao: desc, qtd, vlrUnit, vlrTotal })

    if (!byProduto[codigo]) byProduto[codigo] = { desc, qtd: 0, total: 0, nfs: new Set() }
    byProduto[codigo].qtd += qtd
    byProduto[codigo].total += vlrTotal
    byProduto[codigo].nfs.add(nf)

    if (!byCliente[cnpj]) byCliente[cnpj] = { nome: cliente, total: 0, nfs: new Set() }
    byCliente[cnpj].total += vlrTotal
    byCliente[cnpj].nfs.add(nf)

    const mes = emissao ? emissao.substring(3) : '??'
    byMes[mes] = (byMes[mes] || 0) + vlrTotal
  }

  const porMes = Object.entries(byMes)
    .sort((a, b) => {
      const [mA, yA] = a[0].split('/')
      const [mB, yB] = b[0].split('/')
      return (Number(yA) - Number(yB)) || (Number(mA) - Number(mB))
    })
    .map(([mes, total]) => ({ mes, total }))

  const topProdutos = Object.entries(byProduto)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([codigo, p]) => ({ codigo, desc: p.desc, qtd: p.qtd, total: p.total, nfs: p.nfs.size }))

  const topClientes = Object.entries(byCliente)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15)
    .map(([cnpj, c]) => ({ cnpj, nome: c.nome, total: c.total, nfs: c.nfs.size }))

  return {
    itens,
    faturamentoTotal,
    totalNFs: nfSet.size,
    porMes,
    topProdutos,
    topClientes,
    ticketMedio: nfSet.size > 0 ? faturamentoTotal / nfSet.size : 0,
  }
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function exportCSV(analise: Analise, nomeArquivo: string) {
  const linhas = [
    ['=== RESUMO ==='],
    ['Notas Fiscais', analise.totalNFs],
    ['Itens', analise.itens.length],
    ['Faturamento Total', analise.faturamentoTotal],
    ['Ticket Médio por NF', analise.ticketMedio],
    [],
    ['=== FATURAMENTO POR MÊS ==='],
    ['Mês', 'Total'],
    ...analise.porMes.map(m => [m.mes, m.total]),
    [],
    ['=== TOP PRODUTOS ==='],
    ['Código', 'Descrição', 'Qtd', 'Total', 'Nº NFs'],
    ...analise.topProdutos.map(p => [p.codigo, p.desc, p.qtd, p.total, p.nfs]),
    [],
    ['=== TOP CLIENTES ==='],
    ['CNPJ/CPF', 'Nome', 'Total', 'Nº NFs'],
    ...analise.topClientes.map(c => [c.cnpj, c.nome, c.total, c.nfs]),
  ]
  const csv = linhas.map(l => l.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.replace('.csv', '') + '_analise.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseDateBRtoISO(s: string): string | null {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export default function AdminAnaliseNF() {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const [analise, setAnalise] = useState<Analise | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [abaSec, setAbaSec] = useState<'resumo' | 'produtos' | 'clientes' | 'itens'>('resumo')
  const [salvandoDocs, setSalvandoDocs] = useState<'emitido' | 'recebido' | null>(null)
  const [salvarProgresso, setSalvarProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [msgSalvar, setMsgSalvar] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const salvandoRef = useRef(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNomeArquivo(file.name)
    setCarregando(true)
    setErro(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const resultado = analisar(text)
        if (resultado.itens.length === 0) {
          setErro('Nenhum item encontrado. Verifique se o arquivo é uma exportação de itens NF-e do NFSTOK/similar.')
          setAnalise(null)
        } else {
          setAnalise(resultado)
          setAbaSec('resumo')
        }
      } catch {
        setErro('Erro ao processar o arquivo. Verifique o formato.')
        setAnalise(null)
      }
      setCarregando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
    reader.onerror = () => {
      setErro('Erro ao ler o arquivo.')
      setCarregando(false)
    }
    reader.readAsText(file, 'latin1')
  }

  async function salvarEmDocs(tipo: 'emitido' | 'recebido') {
    if (!analise || salvandoRef.current) return
    salvandoRef.current = true
    setSalvandoDocs(tipo); setMsgSalvar(null); setSalvarProgresso(null)

    // Agrupar itens por NF
    const byNF: Record<string, { cnpj: string; nome: string; emissao: string; itens: ItemNF[] }> = {}
    for (const it of analise.itens) {
      if (!byNF[it.nf]) byNF[it.nf] = { cnpj: it.cnpj, nome: it.cliente, emissao: it.emissao, itens: [] }
      byNF[it.nf].itens.push(it)
    }

    const nfEntries = Object.entries(byNF)
    const totalNFs = nfEntries.length
    let processados = 0
    let inseridos = 0; let pulados = 0
    for (const [nfNum, grupo] of nfEntries) {
      processados++
      setSalvarProgresso({ atual: processados, total: totalNFs })
      const { data: existe } = await supabaseAdmin
        .from('docs_fiscais').select('id').eq('tipo', tipo).eq('nf_numero', nfNum).limit(1)
      if (existe && existe.length > 0) { pulados++; continue }

      const valorTotal  = grupo.itens.reduce((s, i) => s + i.vlrTotal, 0)
      const dataEmissao = parseDateBRtoISO(grupo.emissao)
      const { data: doc, error } = await supabaseAdmin
        .from('docs_fiscais')
        .insert({
          tipo,
          nf_numero:        nfNum,
          contraparte_cnpj: grupo.cnpj || null,
          contraparte_nome: grupo.nome || '',
          data_emissao:     dataEmissao,
          data_entrada:     tipo === 'recebido' ? (dataEmissao ?? new Date().toISOString().slice(0, 10)) : null,
          valor_total:      valorTotal,
          status:           tipo === 'recebido' ? 'pendente' : 'rascunho',
        })
        .select('id').single()
      if (error || !doc) continue

      const itensNF = grupo.itens
        .filter(i => i.descricao?.trim())
        .map((i, idx) => ({
          doc_id:          doc.id,
          codigo_produto:  i.codigo || null,
          descricao:       i.descricao,
          quantidade:      i.qtd,
          unidade:         'un',
          valor_unitario:  i.vlrUnit,
          valor_total:     i.vlrTotal,
          estoque_item_id: null,
          ordem:           idx,
        }))
      if (itensNF.length > 0) await supabaseAdmin.from('itens_doc').insert(itensNF)
      inseridos++
    }

    salvandoRef.current = false
    setSalvandoDocs(null)
    setSalvarProgresso(null)
    setMsgSalvar({
      tipo: 'ok',
      texto: `${inseridos} NF(s) salva(s) como ${tipo === 'emitido' ? 'Docs Emitidos' : 'Docs Recebidos'}. ${pulados > 0 ? `${pulados} já existia(m).` : ''}`,
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.uploadArea}>
        <div className={styles.uploadInfo}>
          <span className={styles.uploadTitle}>Importar CSV de NF-e</span>
          <span className={styles.uploadDesc}>Exportação de itens (NFSTOK ou similar) — colunas: NF, CNPJ, Destinatário, Emissão, Código, NCM, EAN, Descrição, CFOP, Qtd, Vlr Unit, …, Vlr Total</span>
        </div>
        <label className={styles.uploadBtn}>
          {carregando ? 'Processando...' : 'Selecionar CSV'}
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFile} disabled={carregando} hidden />
        </label>
      </div>

      {erro && <div className={styles.erro}>{erro}</div>}

      {!analise && !erro && (
        <div className={styles.vazio}>
          Nenhum arquivo carregado. Selecione um CSV de itens NF-e para visualizar a análise.
        </div>
      )}

      {analise && (
        <>
          <div className={styles.arquivoInfo}>
            Arquivo: <strong>{nomeArquivo}</strong> — {analise.itens.length} itens, {analise.totalNFs} NFs
            <button className={styles.btnRemover} onClick={() => { setAnalise(null); setNomeArquivo(''); setErro(null); setMsgSalvar(null) }}>
              ✕ Remover arquivo
            </button>
            <button className={styles.btnExport} onClick={() => exportCSV(analise, nomeArquivo)}>
              Exportar análise CSV
            </button>
            <button className={styles.btnExport} onClick={() => salvarEmDocs('emitido')} disabled={salvandoDocs !== null}>
              {salvandoDocs === 'emitido'
                ? `Salvando… ${salvarProgresso ? Math.round(salvarProgresso.atual / salvarProgresso.total * 100) + '%' : ''}`
                : '💾 Salvar em Docs Emitidos'}
            </button>
            <button className={styles.btnExport} onClick={() => salvarEmDocs('recebido')} disabled={salvandoDocs !== null}>
              {salvandoDocs === 'recebido'
                ? `Salvando… ${salvarProgresso ? Math.round(salvarProgresso.atual / salvarProgresso.total * 100) + '%' : ''}`
                : '💾 Salvar em Docs Recebidos'}
            </button>
          </div>
          {msgSalvar && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, margin: '8px 0', fontSize: '0.85rem',
              background: msgSalvar.tipo === 'ok' ? 'var(--color-success-bg, #ecfdf5)' : 'var(--color-error-bg, #fef2f2)',
              color: msgSalvar.tipo === 'ok' ? 'var(--color-success, #059669)' : 'var(--color-error, #dc2626)',
            }}>
              {msgSalvar.texto}
            </div>
          )}

          {/* Cards de resumo */}
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Faturamento Total</span>
              <strong className={styles.cardValue}>{fmt(analise.faturamentoTotal)}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Notas Fiscais</span>
              <strong className={styles.cardValue}>{analise.totalNFs}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Itens Faturados</span>
              <strong className={styles.cardValue}>{analise.itens.length}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Ticket Médio / NF</span>
              <strong className={styles.cardValue}>{fmt(analise.ticketMedio)}</strong>
            </div>
          </div>

          {/* Sub-abas */}
          <div className={styles.subAbas}>
            {(['resumo', 'produtos', 'clientes', 'itens'] as const).map(a => (
              <button
                key={a}
                className={`${styles.subAba} ${abaSec === a ? styles.subAbaAtiva : ''}`}
                onClick={() => setAbaSec(a)}
              >
                {a === 'resumo' ? 'Por Mês' : a === 'produtos' ? 'Top Produtos' : a === 'clientes' ? 'Top Clientes' : 'Todos os Itens'}
              </button>
            ))}
          </div>

          {abaSec === 'resumo' && (
            <div className={styles.box}>
              <h3 className={styles.boxTitle}>Faturamento por Mês</h3>
              {analise.porMes.map(m => {
                const pct = (m.total / analise.faturamentoTotal) * 100
                return (
                  <div key={m.mes} className={styles.mesRow}>
                    <span className={styles.mesLabel}>{m.mes}</span>
                    <div className={styles.mesBar}>
                      <div className={styles.mesBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.mesValor}>{fmt(m.total)}</span>
                  </div>
                )
              })}
            </div>
          )}

          <TabelaProdutos topProdutos={analise.topProdutos} faturamentoTotal={analise.faturamentoTotal} abaSec={abaSec} />
          <TabelaClientes topClientes={analise.topClientes} faturamentoTotal={analise.faturamentoTotal} abaSec={abaSec} />
          <TabelaItens itens={analise.itens} abaSec={abaSec} />
        </>
      )}
    </div>
  )
}

type ProdKey = 'desc' | 'qtd' | 'nfs' | 'total'
type ClienteKey = 'nome' | 'nfs' | 'total'
type ItemKey = keyof ItemNF

function sortArr<T>(arr: T[], key: keyof T, dir: 'asc' | 'desc'): T[] {
  return [...arr].sort((a, b) => {
    const av = a[key] ?? ''; const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}

function TabelaProdutos({ topProdutos, faturamentoTotal, abaSec }: { topProdutos: Analise['topProdutos']; faturamentoTotal: number; abaSec: string }) {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const [sk, setSk] = useState<ProdKey>('total')
  const [sd, setSd] = useState<'asc' | 'desc'>('desc')
  if (abaSec !== 'produtos') return null
  function toggle(k: ProdKey) { if (k === sk) setSd(d => d === 'asc' ? 'desc' : 'asc'); else { setSk(k); setSd('desc') } }
  function ind(k: ProdKey) { return sk === k ? (sd === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }
  const sorted = sortArr(topProdutos, sk, sd)
  return (
    <div className={styles.box}>
      <h3 className={styles.boxTitle}>Top 20 Produtos por Faturamento</h3>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th>#</th>
            <th className={styles.sortable} onClick={() => toggle('desc')}>Produto{ind('desc')}</th>
            <th className={styles.sortable} onClick={() => toggle('qtd')}>Qtd{ind('qtd')}</th>
            <th className={styles.sortable} onClick={() => toggle('nfs')}>NFs{ind('nfs')}</th>
            <th className={styles.sortable} onClick={() => toggle('total')}>Total{ind('total')}</th>
            <th className={styles.sortable} onClick={() => toggle('total')}>%{ind('total')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={p.codigo}>
              <td className={styles.pos}>{i + 1}</td>
              <td className={styles.descCell}>{p.desc}</td>
              <td>{p.qtd}</td>
              <td>{p.nfs}</td>
              <td className={styles.valor}>{fmt(p.total)}</td>
              <td className={styles.pct}>{((p.total / faturamentoTotal) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaClientes({ topClientes, faturamentoTotal, abaSec }: { topClientes: Analise['topClientes']; faturamentoTotal: number; abaSec: string }) {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const [sk, setSk] = useState<ClienteKey>('total')
  const [sd, setSd] = useState<'asc' | 'desc'>('desc')
  if (abaSec !== 'clientes') return null
  function toggle(k: ClienteKey) { if (k === sk) setSd(d => d === 'asc' ? 'desc' : 'asc'); else { setSk(k); setSd('desc') } }
  function ind(k: ClienteKey) { return sk === k ? (sd === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }
  const sorted = sortArr(topClientes, sk, sd)
  return (
    <div className={styles.box}>
      <h3 className={styles.boxTitle}>Top 15 Clientes por Faturamento</h3>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th>#</th>
            <th className={styles.sortable} onClick={() => toggle('nome')}>Cliente{ind('nome')}</th>
            <th>CNPJ/CPF</th>
            <th className={styles.sortable} onClick={() => toggle('nfs')}>NFs{ind('nfs')}</th>
            <th className={styles.sortable} onClick={() => toggle('total')}>Total{ind('total')}</th>
            <th className={styles.sortable} onClick={() => toggle('total')}>%{ind('total')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={c.cnpj}>
              <td className={styles.pos}>{i + 1}</td>
              <td className={styles.descCell}>{c.nome}</td>
              <td className={styles.cnpj}>{c.cnpj}</td>
              <td>{c.nfs}</td>
              <td className={styles.valor}>{fmt(c.total)}</td>
              <td className={styles.pct}>{((c.total / faturamentoTotal) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaItens({ itens, abaSec }: { itens: ItemNF[]; abaSec: string }) {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const [sk, setSk] = useState<ItemKey>('vlrTotal')
  const [sd, setSd] = useState<'asc' | 'desc'>('desc')
  if (abaSec !== 'itens') return null
  function toggle(k: ItemKey) { if (k === sk) setSd(d => d === 'asc' ? 'desc' : 'asc'); else { setSk(k); setSd('desc') } }
  function ind(k: ItemKey) { return sk === k ? (sd === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }
  const sorted = sortArr(itens, sk, sd)
  return (
    <div className={styles.box}>
      <h3 className={styles.boxTitle}>Todos os Itens ({itens.length})</h3>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th className={styles.sortable} onClick={() => toggle('nf')}>NF{ind('nf')}</th>
            <th className={styles.sortable} onClick={() => toggle('emissao')}>Data{ind('emissao')}</th>
            <th className={styles.sortable} onClick={() => toggle('descricao')}>Produto{ind('descricao')}</th>
            <th className={styles.sortable} onClick={() => toggle('cliente')}>Cliente{ind('cliente')}</th>
            <th className={styles.sortable} onClick={() => toggle('qtd')}>Qtd{ind('qtd')}</th>
            <th className={styles.sortable} onClick={() => toggle('vlrUnit')}>Vlr Unit{ind('vlrUnit')}</th>
            <th className={styles.sortable} onClick={() => toggle('vlrTotal')}>Total{ind('vlrTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr key={i}>
              <td>{item.nf}</td>
              <td className={styles.data}>{item.emissao}</td>
              <td className={styles.descCell}>{item.descricao}</td>
              <td className={styles.clienteCell}>{item.cliente}</td>
              <td>{item.qtd}</td>
              <td>{fmt(item.vlrUnit)}</td>
              <td className={styles.valor}>{fmt(item.vlrTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
