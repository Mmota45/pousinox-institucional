import { useState, useRef } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminClientes.module.css'

// ── Utilitários de parsing ────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseBRL(v: string): number | null {
  if (!v) return null
  const n = parseFloat(v.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseData(v: string): string | null {
  if (!v) return null
  const [d, m, y] = v.split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseCnpj(v: string): string {
  return v.replace(/\D/g, '')
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ResultadoImport {
  cabecalho: { total: number; novos: number; erros: number }
  itens: { total: number; inseridos: number; erros: number }
  clientes: { total: number; novos: number; atualizados: number }
}

interface Cliente {
  id: number
  cnpj: string
  razao_social: string | null
  primeira_compra: string | null
  ultima_compra: string | null
  total_nfs: number
  total_gasto: number
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminClientes() {
  const [aba, setAba] = useState<'importar' | 'clientes'>('importar')

  // Import
  const [arquivoCab, setArquivoCab]     = useState<File | null>(null)
  const [arquivoItens, setArquivoItens] = useState<File | null>(null)
  const [importando, setImportando]     = useState(false)
  const [progresso, setProgresso]       = useState('')
  const [resultado, setResultado]       = useState<ResultadoImport | null>(null)
  const [erroImport, setErroImport]     = useState<string | null>(null)
  const refCab   = useRef<HTMLInputElement>(null)
  const refItens = useRef<HTMLInputElement>(null)

  // Clientes
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [busca, setBusca]         = useState('')
  const [loadingCli, setLoadingCli] = useState(false)
  const [buscado, setBuscado]     = useState(false)
  const [sortCol, setSortCol]     = useState<keyof Cliente>('total_gasto')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')

  // ── Import ──────────────────────────────────────────────────────────────────

  async function importar() {
    if (!arquivoCab && !arquivoItens) { setErroImport('Selecione ao menos um arquivo.'); return }
    setImportando(true)
    setErroImport(null)
    setResultado(null)

    const res: ResultadoImport = {
      cabecalho: { total: 0, novos: 0, erros: 0 },
      itens: { total: 0, inseridos: 0, erros: 0 },
      clientes: { total: 0, novos: 0, atualizados: 0 },
    }

    // ── 1. Importar cabeçalho ─────────────────────────────────────────────
    if (arquivoCab) {
      setProgresso('Lendo NFs...')
      const texto = await arquivoCab.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const dados = linhas.slice(1) // pula header

      res.cabecalho.total = dados.length

      const lote: object[] = []
      for (const linha of dados) {
        const c = parseCsvLine(linha)
        if (c.length < 8) continue
        const chave = c[4]?.trim() || null
        lote.push({
          serie:        c[0] || null,
          numero:       c[1],
          cnpj:         parseCnpj(c[2]) || null,
          destinatario: c[3] || null,
          chave_acesso: chave,
          origem:       c[5] || null,
          status:       c[6] || null,
          emissao:      parseData(c[7]),
          total:        parseBRL(c[8]) ?? 0,
        })
      }

      // Upsert em lotes de 200
      for (let i = 0; i < lote.length; i += 200) {
        const chunk = lote.slice(i, i + 200)
        setProgresso(`Importando NFs... ${i + chunk.length}/${lote.length}`)
        const { error } = await supabaseAdmin
          .from('nf_cabecalho')
          .upsert(chunk, { onConflict: 'chave_acesso', ignoreDuplicates: false })
        if (error) res.cabecalho.erros += chunk.length
        else res.cabecalho.novos += chunk.length
      }
    }

    // ── 2. Importar itens ──────────────────────────────────────────────────
    if (arquivoItens) {
      setProgresso('Lendo itens das NFs...')
      const texto = await arquivoItens.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const dados = linhas.slice(1)

      res.itens.total = dados.length

      // Coleta números de NF para limpar antes de reinserir
      const numerosNF = [...new Set(dados.map(l => parseCsvLine(l)[0]).filter(Boolean))]
      if (numerosNF.length > 0) {
        setProgresso('Limpando itens antigos...')
        for (let i = 0; i < numerosNF.length; i += 100) {
          await supabaseAdmin
            .from('nf_itens')
            .delete()
            .in('numero', numerosNF.slice(i, i + 100))
        }
      }

      const lote: object[] = []
      for (const linha of dados) {
        const c = parseCsvLine(linha)
        if (c.length < 10) continue
        lote.push({
          numero:         c[0],
          cnpj:           parseCnpj(c[1]) || null,
          destinatario:   c[2] || null,
          emissao:        parseData(c[3]),
          codigo:         c[4] || null,
          ncm:            c[5] || null,
          ean:            c[6] || null,
          descricao:      c[7] || null,
          cfop:           c[8] || null,
          quantidade:     parseBRL(c[9]),
          valor_unitario: parseBRL(c[10]),
          origem_cst:     c[11] || null,
          valor_icms:     parseBRL(c[12]),
          valor_icms_st:  parseBRL(c[13]),
          cst_pis:        c[14] || null,
          valor_pis:      parseBRL(c[15]),
          cst_cofins:     c[16] || null,
          valor_cofins:   parseBRL(c[17]),
          valor_ipi:      parseBRL(c[18]),
          valor_total:    parseBRL(c[19]),
        })
      }

      for (let i = 0; i < lote.length; i += 200) {
        const chunk = lote.slice(i, i + 200)
        setProgresso(`Importando itens... ${i + chunk.length}/${lote.length}`)
        const { error } = await supabaseAdmin.from('nf_itens').insert(chunk)
        if (error) res.itens.erros += chunk.length
        else res.itens.inseridos += chunk.length
      }
    }

    // ── 3. Consolidar clientes ─────────────────────────────────────────────
    setProgresso('Consolidando clientes...')
    const { data: nfs } = await supabaseAdmin
      .from('nf_cabecalho')
      .select('cnpj, destinatario, emissao, total')
      .eq('status', 'Autorizadas')

    if (nfs && nfs.length > 0) {
      const mapa = new Map<string, {
        razao_social: string
        datas: string[]
        total_nfs: number
        total_gasto: number
      }>()

      for (const nf of nfs) {
        if (!nf.cnpj) continue
        const cnpj = nf.cnpj.replace(/\D/g, '')
        const ex = mapa.get(cnpj)
        if (ex) {
          if (nf.emissao) ex.datas.push(nf.emissao)
          ex.total_nfs++
          ex.total_gasto += nf.total ?? 0
        } else {
          mapa.set(cnpj, {
            razao_social: nf.destinatario ?? '',
            datas: nf.emissao ? [nf.emissao] : [],
            total_nfs: 1,
            total_gasto: nf.total ?? 0,
          })
        }
      }

      const clientesUpsert = Array.from(mapa.entries()).map(([cnpj, v]) => {
        const datas = v.datas.sort()
        return {
          cnpj,
          razao_social: v.razao_social,
          primeira_compra: datas[0] ?? null,
          ultima_compra: datas[datas.length - 1] ?? null,
          total_nfs: v.total_nfs,
          total_gasto: Math.round(v.total_gasto * 100) / 100,
          atualizado_em: new Date().toISOString(),
        }
      })

      res.clientes.total = clientesUpsert.length

      for (let i = 0; i < clientesUpsert.length; i += 200) {
        const chunk = clientesUpsert.slice(i, i + 200)
        const { error } = await supabaseAdmin
          .from('clientes')
          .upsert(chunk, { onConflict: 'cnpj' })
        if (!error) res.clientes.novos += chunk.length
      }
    }

    // ── 4. Cruzar com prospeccao ───────────────────────────────────────────
    setProgresso('Cruzando com base de prospecção...')
    const { data: clis } = await supabaseAdmin.from('clientes').select('cnpj')
    if (clis && clis.length > 0) {
      // prospeccao.cnpj é armazenado como dígitos puros (14 chars) — usa sem formatação
      const cnpjs = clis.map(c => c.cnpj.replace(/\D/g, ''))
      for (let i = 0; i < cnpjs.length; i += 500) {
        await supabaseAdmin
          .from('prospeccao')
          .update({ cliente_ativo: true })
          .in('cnpj', cnpjs.slice(i, i + 500))
      }
    }

    setResultado(res)
    setProgresso('')
    setImportando(false)
  }

  // ── Clientes ────────────────────────────────────────────────────────────────

  function toggleSort(col: keyof Cliente) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const clientesSorted = [...clientes].sort((a, b) => {
    const va = a[sortCol] ?? ''; const vb = b[sortCol] ?? ''
    const cmp = typeof va === 'string' ? (va as string).localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  async function buscarClientes() {
    setLoadingCli(true)
    setBuscado(true)
    let q = supabaseAdmin
      .from('clientes')
      .select('*')
      .order('total_gasto', { ascending: false })
      .limit(200)
    if (busca.trim()) q = q.ilike('razao_social', `%${busca.trim()}%`)
    const { data } = await q
    setClientes((data ?? []) as Cliente[])
    setLoadingCli(false)
  }

  function fmtBRL(v: number) {
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtData(v: string | null) {
    if (!v) return '—'
    const [y, m, d] = v.split('-')
    return `${d}/${m}/${y}`
  }

  function fmtCnpj(v: string) {
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>

      {/* Abas */}
      <div className={styles.abas}>
        <button className={`${styles.aba} ${aba === 'importar' ? styles.abaAtiva : ''}`} onClick={() => setAba('importar')}>
          ↑ Importar NFs
        </button>
        <button className={`${styles.aba} ${aba === 'clientes' ? styles.abaAtiva : ''}`} onClick={() => { setAba('clientes'); if (!buscado) buscarClientes() }}>
          👥 Clientes
        </button>
      </div>

      {/* ── Aba Importar ── */}
      {aba === 'importar' && (
        <div className={styles.importWrap}>

          <div className={styles.info}>
            Importe os dois relatórios exportados do NFSTOK. O sistema consolida os clientes automaticamente e cruza com a base de prospecção.
          </div>

          <div className={styles.uploadRow}>
            {/* NF Cabeçalho */}
            <div
              className={`${styles.uploadBox} ${arquivoCab ? styles.uploadBoxOk : ''}`}
              onClick={() => refCab.current?.click()}
            >
              <input ref={refCab} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => setArquivoCab(e.target.files?.[0] ?? null)} />
              <div className={styles.uploadIcon}>📋</div>
              <div className={styles.uploadTitulo}>Relatório de NFs</div>
              <div className={styles.uploadSub}>
                {arquivoCab ? arquivoCab.name : 'Clique para selecionar o CSV de notas fiscais'}
              </div>
              <div className={styles.uploadDica}>nfe-emitidas_*.csv</div>
            </div>

            {/* NF Itens */}
            <div
              className={`${styles.uploadBox} ${arquivoItens ? styles.uploadBoxOk : ''}`}
              onClick={() => refItens.current?.click()}
            >
              <input ref={refItens} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => setArquivoItens(e.target.files?.[0] ?? null)} />
              <div className={styles.uploadIcon}>📦</div>
              <div className={styles.uploadTitulo}>Relatório de Itens</div>
              <div className={styles.uploadSub}>
                {arquivoItens ? arquivoItens.name : 'Clique para selecionar o CSV de itens'}
              </div>
              <div className={styles.uploadDica}>itens-nf-es-emitidas_*.csv</div>
            </div>
          </div>

          {erroImport && (
            <div className={styles.erro}>{erroImport}</div>
          )}

          <button
            className={styles.importBtn}
            onClick={importar}
            disabled={importando || (!arquivoCab && !arquivoItens)}
          >
            {importando ? progresso || 'Importando...' : '↑ Importar arquivos'}
          </button>

          {resultado && (
            <div className={styles.resultado}>
              <div className={styles.resultTitulo}>✅ Importação concluída</div>
              <div className={styles.resultGrid}>
                {arquivoCab && (
                  <div className={styles.resultCard}>
                    <span className={styles.resultLabel}>Notas Fiscais</span>
                    <span className={styles.resultVal}>{resultado.cabecalho.novos.toLocaleString('pt-BR')}</span>
                    <span className={styles.resultSub}>de {resultado.cabecalho.total.toLocaleString('pt-BR')} linhas</span>
                    {resultado.cabecalho.erros > 0 && <span className={styles.resultErro}>{resultado.cabecalho.erros} erros</span>}
                  </div>
                )}
                {arquivoItens && (
                  <div className={styles.resultCard}>
                    <span className={styles.resultLabel}>Itens importados</span>
                    <span className={styles.resultVal}>{resultado.itens.inseridos.toLocaleString('pt-BR')}</span>
                    <span className={styles.resultSub}>de {resultado.itens.total.toLocaleString('pt-BR')} linhas</span>
                    {resultado.itens.erros > 0 && <span className={styles.resultErro}>{resultado.itens.erros} erros</span>}
                  </div>
                )}
                <div className={styles.resultCard}>
                  <span className={styles.resultLabel}>Clientes consolidados</span>
                  <span className={styles.resultVal}>{resultado.clientes.total.toLocaleString('pt-BR')}</span>
                  <span className={styles.resultSub}>base atualizada</span>
                </div>
              </div>
              <button className={styles.verClientesBtn} onClick={() => { setAba('clientes'); buscarClientes() }}>
                Ver clientes →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Clientes ── */}
      {aba === 'clientes' && (
        <div className={styles.clientesWrap}>
          <div className={styles.buscaRow}>
            <input
              className={styles.buscaInput}
              type="text"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarClientes()}
            />
            <button className={styles.buscarBtn} onClick={buscarClientes} disabled={loadingCli}>
              {loadingCli ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {loadingCli && <div className={styles.loading}>Carregando clientes...</div>}

          {!loadingCli && buscado && clientes.length === 0 && (
            <div className={styles.vazio}>Nenhum cliente encontrado. Importe os arquivos primeiro.</div>
          )}

          {!loadingCli && clientes.length > 0 && (
            <div className={styles.tableWrap}>
              <div className={styles.tableInfo}>{clientes.length} clientes</div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {(['razao_social', 'cnpj', 'primeira_compra', 'ultima_compra', 'total_nfs', 'total_gasto'] as (keyof Cliente)[]).map((col) => {
                        const labels: Record<string, string> = { razao_social: 'Cliente', cnpj: 'CNPJ', primeira_compra: 'Primeira compra', ultima_compra: 'Última compra', total_nfs: 'NFs', total_gasto: 'Total gasto' }
                        const sortable = col !== 'cnpj'
                        const ativo = sortCol === col
                        return sortable ? (
                          <th key={col} className={styles.thSort} onClick={() => toggleSort(col)}>
                            <span className={styles.thSortInner}>
                              {labels[col]}
                              <span className={styles.thArrow} style={{ opacity: ativo ? 1 : 0.25 }}>
                                {ativo ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            </span>
                          </th>
                        ) : (
                          <th key={col}>{labels[col]}</th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesSorted.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className={styles.nomeCliente}>{c.razao_social || '—'}</div>
                        </td>
                        <td className={styles.cnpj}>{fmtCnpj(c.cnpj)}</td>
                        <td className={styles.data}>{fmtData(c.primeira_compra)}</td>
                        <td className={styles.data}>{fmtData(c.ultima_compra)}</td>
                        <td className={styles.nfs}>{c.total_nfs}</td>
                        <td className={styles.valor}>{fmtBRL(c.total_gasto)}</td>
                      </tr>
                    ))}
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
