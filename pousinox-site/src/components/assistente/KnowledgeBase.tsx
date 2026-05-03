import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import s from './KnowledgeBase.module.css'

interface DocGroup {
  source_file: string
  chunks: number
  resumo?: string
}

interface Props {
  ragEnabled: boolean
  onRagToggle: (v: boolean) => void
  onAskQuestion?: (q: string) => void
  onDocCountChange?: (count: number) => void
}

function docIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['pdf'].includes(ext)) return '📄'
  if (['csv', 'xlsx', 'xls'].includes(ext)) return '📊'
  if (['mp3', 'ogg', 'wav', 'm4a', 'webm', 'opus'].includes(ext)) return '🎙️'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼️'
  if (['md', 'txt'].includes(ext)) return '📝'
  return '📎'
}

export default function KnowledgeBase({ ragEnabled, onRagToggle, onAskQuestion, onDocCountChange }: Props) {
  const [docs, setDocs] = useState<DocGroup[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [docsOpen, setDocsOpen] = useState(false)
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [perguntas, setPerguntas] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [urlInput, setUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    const { data } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('source_file, chunk_index, content, metadata')
      .order('created_at', { ascending: false })
    if (!data) return
    const groups: Record<string, { chunks: number; resumo?: string }> = {}
    data.forEach((r: { source_file: string; chunk_index: number; content: string; metadata: Record<string, unknown> }) => {
      if (!groups[r.source_file]) groups[r.source_file] = { chunks: 0 }
      if (r.chunk_index === -1 && r.metadata?.tipo === 'contexto_ia') {
        // Extrair resumo do chunk de contexto (remover prefixo [CONTEXTO...])
        groups[r.source_file].resumo = r.content.replace(/^\[CONTEXTO DO DOCUMENTO:.*?\]\n?/, '')
      } else {
        groups[r.source_file].chunks++
      }
    })
    const docList = Object.entries(groups).map(([source_file, g]) => ({ source_file, ...g }))
    setDocs(docList)
    onDocCountChange?.(docList.length)
  }, [onDocCountChange])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const toggleSelect = (file: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(file) ? next.delete(file) : next.add(file)
    return next
  })
  const toggleAll = () => setSelected(prev => prev.size === docs.length ? new Set() : new Set(docs.map(d => d.source_file)))

  const handleDeleteSelected = useCallback(async () => {
    if (!selected.size) return
    if (!confirm(`Excluir ${selected.size} documento(s) da base de conhecimento?`)) return
    for (const file of selected) {
      await supabaseAdmin.from('knowledge_chunks').delete().eq('source_file', file)
    }
    setSelected(new Set())
    fetchDocs()
  }, [selected, fetchDocs])

  const AI_HUB_URL = `${import.meta.env.VITE_SUPABASE_URL || 'https://vcektwtpofypsgdgdjlx.supabase.co'}/functions/v1/ai-hub`
  const SRV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

  async function transcreverParaTexto(base64: string, nome: string): Promise<string> {
    const res = await fetch(AI_HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SRV_KEY, Authorization: `Bearer ${SRV_KEY}` },
      body: JSON.stringify({ action: 'transcribe', audio_base64: base64, audio_name: nome }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || 'Falha na transcrição')
    const duracao = data.duration ? ` (${Math.round(data.duration)}s)` : ''
    return `Transcrição de áudio "${nome}"${duracao}:\n\n${data.text}`
  }

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList?.length) return
    const files = Array.from(fileList)
    e.target.value = ''

    setUploading(true)
    const total = files.length
    let ok = 0, erros = 0
    const todasPerguntas: string[] = []
    const audioExts = ['mp3', 'ogg', 'wav', 'm4a', 'webm', 'opus', 'mp4']

    for (let f = 0; f < total; f++) {
      const file = files[f]
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const isAudio = file.type.startsWith('audio/') || audioExts.includes(ext)

      setProgress(isAudio
        ? `🎙️ Transcrevendo ${f + 1}/${total}: ${file.name}...`
        : `Analisando ${f + 1}/${total}: ${file.name}...`)

      try {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)

        if (isAudio) {
          // Transcrever áudio via Groq Whisper
          setProgress(`🎙️ Transcrevendo ${f + 1}/${total}: ${file.name}...`)
          let transcricao: string
          try {
            transcricao = await transcreverParaTexto(base64, file.name)
          } catch (err) {
            console.error(`[KB] erro transcrição ${file.name}:`, err)
            throw new Error(`Falha na transcrição: ${(err as Error).message}`)
          }

          console.log(`[KB] transcrição ok ${file.name}: ${transcricao.length} chars`)
          setProgress(`📚 Indexando transcrição de ${file.name}...`)

          // Converter transcrição para base64 (compatível UTF-8)
          const encoder = new TextEncoder()
          const txtBytes = encoder.encode(transcricao)
          let txtBinary = ''
          for (let i = 0; i < txtBytes.length; i++) txtBinary += String.fromCharCode(txtBytes[i])
          const txtBase64 = btoa(txtBinary)

          const { data, error } = await supabaseAdmin.functions.invoke('indexar-documento', {
            body: { file_base64: txtBase64, mime_type: 'text/plain', filename: `${file.name}.txt` },
          })
          console.log(`[KB] indexar transcrição ${file.name}:`, { data, error })
          if (error) {
            const errMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error))
            throw new Error(`Indexação falhou: ${errMsg}`)
          }
          const parsed = typeof data === 'string' ? JSON.parse(data) : data
          if (parsed.success) {
            ok++
            if (parsed.perguntas_sugeridas?.length) todasPerguntas.push(...parsed.perguntas_sugeridas)
          } else { erros++ }
        } else {
          const { data, error } = await supabaseAdmin.functions.invoke('indexar-documento', {
            body: { file_base64: base64, mime_type: file.type, filename: file.name },
          })

          console.log(`[KB] ${file.name} →`, { data, error })
          if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
          const parsed = typeof data === 'string' ? JSON.parse(data) : data
          console.log(`[KB] parsed:`, parsed)

          if (parsed.success) {
            ok++
            if (parsed.perguntas_sugeridas?.length) todasPerguntas.push(...parsed.perguntas_sugeridas)
          } else {
            erros++
          }
        }
      } catch (err) {
        console.error(`[KB] erro upload ${file.name}:`, err)
        erros++
      }
    }

    if (todasPerguntas.length) setPerguntas(todasPerguntas.slice(0, 5))
    fetchDocs()
    setProgress(`✅ ${ok} documento${ok !== 1 ? 's' : ''} indexado${ok !== 1 ? 's' : ''}${erros ? ` · ❌ ${erros} erro${erros !== 1 ? 's' : ''}` : ''}`)
    setTimeout(() => setProgress(''), 5000)
    setUploading(false)
  }, [fetchDocs])

  const handleUrlAdd = useCallback(async () => {
    const url = urlInput.trim()
    if (!url) return
    setUploading(true)
    setProgress('Extraindo conteúdo da URL...')
    try {
      const { data, error } = await supabaseAdmin.functions.invoke('indexar-documento', {
        body: { url, filename: url },
      })
      if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      if (parsed.success) {
        setProgress('URL indexada com sucesso')
        if (parsed.perguntas_sugeridas?.length) setPerguntas(parsed.perguntas_sugeridas.slice(0, 5))
        fetchDocs()
      } else {
        setProgress('Erro ao indexar URL')
      }
    } catch (err) {
      console.error('[KB] erro URL:', err)
      setProgress(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setUrlInput('')
      setShowUrlInput(false)
      setUploading(false)
      setTimeout(() => setProgress(''), 5000)
    }
  }, [urlInput, fetchDocs])

  const handleDelete = useCallback(async (sourceFile: string) => {
    if (!confirm(`Excluir "${sourceFile}" da base de conhecimento?`)) return
    await supabaseAdmin.from('knowledge_chunks').delete().eq('source_file', sourceFile)
    fetchDocs()
  }, [fetchDocs])

  return (
    <div className={s.panel}>
      <label className={s.ragToggle}>
        <input type="checkbox" checked={ragEnabled} onChange={e => onRagToggle(e.target.checked)} />
        <span className={`${s.switch} ${ragEnabled ? s.switchOn : ''}`} />
        <span>Consultar base de conhecimento</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.csv,.txt,.md,.doc,.docx,audio/*,.mp3,.ogg,.wav,.m4a,.webm,.opus"
        multiple
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
      <button
        className={s.uploadBtn}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Processando...' : '+ Adicionar fontes'}
      </button>

      <div className={s.urlBar}>
        {showUrlInput ? (
          <div className={s.urlInputWrap}>
            <input
              className={s.urlInput}
              type="url"
              placeholder="https://exemplo.com/artigo"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) handleUrlAdd() }}
              disabled={uploading}
              autoFocus
            />
            <button className={s.urlSend} disabled={uploading || !urlInput.trim()} onClick={handleUrlAdd}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button className={s.urlCancel} onClick={() => { setShowUrlInput(false); setUrlInput('') }}>✕</button>
          </div>
        ) : (
          <button className={s.urlToggle} onClick={() => setShowUrlInput(true)} disabled={uploading}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            Adicionar URL
          </button>
        )}
      </div>

      {progress && (
        <div className={`${s.progress} ${progress.startsWith('✅') ? s.progressOk : progress.startsWith('❌') ? s.progressErr : s.progressLoading}`}>
          {progress}
        </div>
      )}

      {/* Perguntas sugeridas após upload */}
      {perguntas.length > 0 && (
        <div className={s.sugestoes}>
          <div className={s.sugestoesTitle}>💡 Perguntas sugeridas</div>
          {perguntas.map((p, i) => (
            <button key={i} className={s.sugestaoBtn} onClick={() => { onAskQuestion?.(p); setPerguntas([]) }}>
              {p}
            </button>
          ))}
          <button className={s.sugestaoFechar} onClick={() => setPerguntas([])}>✕ Fechar</button>
        </div>
      )}

      {docs.length > 0 ? (
        <div>
          <button className={s.docsToggle} onClick={() => setDocsOpen(v => !v)}>
            <span>{docsOpen ? '▾' : '▸'}</span>
            <span>Documentos</span>
            <span className={s.docsBadge}>{docs.length}</span>
          </button>
          {docsOpen && (
            <div className={s.docList}>
              <label className={s.docSelectAll}>
                <input type="checkbox" checked={selected.size === docs.length && docs.length > 0} onChange={toggleAll} />
                Selecionar todos
                {selected.size > 0 && (
                  <button className={s.docDelSelected} onClick={handleDeleteSelected}>
                    🗑 Excluir {selected.size}
                  </button>
                )}
              </label>
              {docs.map(d => (
                <div key={d.source_file}>
                  <div className={s.docItem}>
                    <input type="checkbox" checked={selected.has(d.source_file)} onChange={() => toggleSelect(d.source_file)} style={{ flexShrink: 0 }} />
                    <span className={s.docTypeIcon}>{docIcon(d.source_file)}</span>
                    <span
                      className={s.docInfo}
                      title={d.source_file}
                      onClick={() => d.resumo && setExpandedDoc(expandedDoc === d.source_file ? null : d.source_file)}
                      style={d.resumo ? { cursor: 'pointer' } : undefined}
                    >
                      {d.source_file}
                    </span>
                    <span className={s.docChunks}>{d.chunks}ch</span>
                    {d.resumo && <span className={s.docAiBadge} title="Contexto IA gerado">🧠</span>}
                    <button className={s.docDel} onClick={() => handleDelete(d.source_file)} title="Excluir">×</button>
                  </div>
                  {expandedDoc === d.source_file && d.resumo && (
                    <div className={s.docResumo}>{d.resumo}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={s.emptyDocs}>
          <div className={s.emptyIcon}>📄</div>
          <p className={s.emptyTitle}>As fontes salvas vão aparecer aqui</p>
          <p className={s.emptySub}>Clique em "Adicionar fontes" para incluir arquivos PDF, texto, CSV ou áudio.</p>
        </div>
      )}
    </div>
  )
}
