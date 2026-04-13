import { useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { supabaseAdmin } from '../../lib/supabase'
import styles from './UploadMemorial.module.css'

// Worker do pdfjs (Vite serve do node_modules)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const EDGE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/extrair-memorial'
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? ''

interface AtributoCatalogo {
  chave: string
  label_pt: string
  tipo_valor: string
  unidade_padrao: string | null
  valores_enum: string[] | null
}

interface AtributoExtraido {
  chave: string
  valor: string
  confianca: number
  selecionado: boolean
  valorEditado: string
}

interface Props {
  projetoId: number
  catalogo: AtributoCatalogo[]
  onSalvo: () => void
}

// Extrai texto de todas as páginas do PDF
async function extrairTextoPDF(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const paginas: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const conteudo = await pagina.getTextContent()
    const texto = conteudo.items
      .map((item: unknown) => ('str' in (item as object) ? (item as { str: string }).str : ''))
      .join(' ')
    paginas.push(texto)
  }

  return paginas.join('\n\n')
}

export default function UploadMemorial({ projetoId, catalogo, onSalvo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<'idle' | 'extraindo' | 'analisando' | 'revisao' | 'salvando'>('idle')
  const [erro, setErro] = useState<string | null>(null)
  const [atributos, setAtributos] = useState<AtributoExtraido[]>([])

  async function processar(file: File) {
    setErro(null)
    setFase('extraindo')

    try {
      const texto = await extrairTextoPDF(file)

      setFase('analisando')

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ texto, catalogo }),
      })

      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)

      const { atributos: extraidos, error } = await res.json()
      if (error) throw new Error(error)

      const lista: AtributoExtraido[] = (extraidos ?? []).map((a: { chave: string; valor: string; confianca: number }) => ({
        ...a,
        selecionado: a.confianca >= 0.6,
        valorEditado: String(a.valor),
      }))

      setAtributos(lista)
      setFase('revisao')

    } catch (e) {
      setErro(String(e))
      setFase('idle')
    }
  }

  async function salvar() {
    setFase('salvando')
    const selecionados = atributos.filter(a => a.selecionado && String(a.valorEditado).trim())

    const chaves = selecionados.map(a => a.chave)

    // Remove atributos existentes para as chaves extraídas + variantes com sufixo _mm/_kg/_un
    const chavesEVariantes = [...new Set([
      ...chaves,
      ...chaves.map(c => `${c}_mm`),
      ...chaves.map(c => `${c}_kg`),
      ...chaves.map(c => `${c}_un`),
      // Remove também a base sem sufixo quando a chave extraída já tem sufixo
      ...chaves.map(c => c.replace(/_mm$|_kg$|_un$/, '')),
    ])]

    await supabaseAdmin
      .from('projeto_atributos')
      .delete()
      .eq('projeto_id', projetoId)
      .in('chave', chavesEVariantes)

    const rows = selecionados.map(a => {
      const cat = catalogo.find(c => c.chave === a.chave)
      return {
        projeto_id: projetoId,
        chave:      a.chave,
        valor:      a.valorEditado,
        valor_num:  cat?.tipo_valor === 'numero' ? parseFloat(a.valorEditado) || null : null,
        unidade:    cat?.unidade_padrao ?? null,
        origem:     'manual',
      }
    })

    const { error: insertError } = await supabaseAdmin.from('projeto_atributos').insert(rows)
    if (insertError) {
      setErro(`Erro ao salvar: ${insertError.message} — detalhes: ${insertError.details ?? ''}`)
      setFase('idle')
      return
    }

    setFase('idle')
    setAtributos([])
    onSalvo()
  }

  function toggleSelecionado(chave: string) {
    setAtributos(prev => prev.map(a => a.chave === chave ? { ...a, selecionado: !a.selecionado } : a))
  }

  function editarValor(chave: string, valor: string) {
    setAtributos(prev => prev.map(a => a.chave === chave ? { ...a, valorEditado: valor } : a))
  }

  function corConfianca(c: number) {
    if (c >= 0.8) return '#16a34a'
    if (c >= 0.6) return '#ca8a04'
    return '#dc2626'
  }

  if (fase === 'revisao') {
    const selecionados = atributos.filter(a => a.selecionado).length
    return (
      <div className={styles.revisao}>
        <div className={styles.revisaoHeader}>
          <span>{atributos.length} atributos extraídos — {selecionados} selecionados para salvar</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecundario} onClick={() => { setFase('idle'); setAtributos([]) }}>
              Cancelar
            </button>
            <button className={styles.btnPrimario} onClick={salvar} disabled={selecionados === 0}>
              Salvar {selecionados} atributos
            </button>
          </div>
        </div>

        <div className={styles.lista}>
          {atributos.map(a => {
            const cat = catalogo.find(c => c.chave === a.chave)
            return (
              <label key={a.chave} className={`${styles.item} ${!a.selecionado ? styles.itemDesmarcado : ''}`}>
                <input
                  type="checkbox"
                  checked={a.selecionado}
                  onChange={() => toggleSelecionado(a.chave)}
                />
                <div className={styles.itemInfo}>
                  <span className={styles.itemLabel}>{cat?.label_pt ?? a.chave}</span>
                  <span className={styles.itemChave}>{a.chave}</span>
                </div>
                {cat?.valores_enum?.length ? (
                  <select
                    className={styles.itemValor}
                    value={a.valorEditado}
                    onChange={e => editarValor(a.chave, e.target.value)}
                    disabled={!a.selecionado}
                  >
                    {cat.valores_enum.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    className={styles.itemValor}
                    value={a.valorEditado}
                    onChange={e => editarValor(a.chave, e.target.value)}
                    disabled={!a.selecionado}
                  />
                )}
                <span
                  className={styles.confianca}
                  style={{ color: corConfianca(a.confianca) }}
                  title={`Confiança: ${Math.round(a.confianca * 100)}%`}
                >
                  {Math.round(a.confianca * 100)}%
                </span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) processar(f) }}
      />

      {fase === 'idle' && (
        <button className={styles.btnUpload} onClick={() => inputRef.current?.click()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Analisar PDF com IA
        </button>
      )}

      {(fase === 'extraindo' || fase === 'analisando' || fase === 'salvando') && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>
            {fase === 'extraindo'  && 'Extraindo texto do PDF...'}
            {fase === 'analisando' && 'Analisando com IA...'}
            {fase === 'salvando'   && 'Salvando atributos...'}
          </span>
        </div>
      )}

      {erro && <div className={styles.erro}>{erro}</div>}
    </div>
  )
}
