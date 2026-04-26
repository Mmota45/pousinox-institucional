import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import s from './KnowledgeBase.module.css'

interface DocGroup {
  source_file: string
  chunks: number
}

interface Props {
  ragEnabled: boolean
  onRagToggle: (v: boolean) => void
}

export default function KnowledgeBase({ ragEnabled, onRagToggle }: Props) {
  const [docs, setDocs] = useState<DocGroup[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    const { data } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('source_file')
      .order('created_at', { ascending: false })
    if (!data) return
    const groups: Record<string, number> = {}
    data.forEach((r: { source_file: string }) => { groups[r.source_file] = (groups[r.source_file] || 0) + 1 })
    setDocs(Object.entries(groups).map(([source_file, chunks]) => ({ source_file, chunks })))
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    setProgress('Lendo arquivo...')
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      setProgress('Indexando...')
      const { data, error } = await supabaseAdmin.functions.invoke('indexar-documento', {
        body: { file_base64: base64, mime_type: file.type, filename: file.name },
      })

      if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
      const parsed = typeof data === 'string' ? JSON.parse(data) : data

      if (parsed.success) {
        setProgress(`✅ ${parsed.chunks} chunks indexados`)
        fetchDocs()
        setTimeout(() => setProgress(''), 3000)
      } else {
        setProgress(`❌ ${parsed.error}`)
      }
    } catch (err) {
      setProgress(`❌ ${err instanceof Error ? err.message : 'Erro'}`)
    } finally {
      setUploading(false)
    }
  }, [fetchDocs])

  const handleDelete = useCallback(async (sourceFile: string) => {
    if (!confirm(`Excluir "${sourceFile}" da base de conhecimento?`)) return
    await supabaseAdmin.from('knowledge_chunks').delete().eq('source_file', sourceFile)
    fetchDocs()
  }, [fetchDocs])

  return (
    <div className={s.panel}>
      <div className={s.ragToggle}>
        <input type="checkbox" checked={ragEnabled} onChange={e => onRagToggle(e.target.checked)} />
        <span>RAG ativo (busca em documentos)</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.csv,.txt,.md,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
      <button
        className={s.uploadBtn}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? '⏳ Indexando...' : '📚 Adicionar documento'}
      </button>

      {progress && <div className={s.progress}>{progress}</div>}

      {docs.length > 0 ? (
        <div className={s.docList}>
          {docs.map(d => (
            <div key={d.source_file} className={s.docItem}>
              <span className={s.docIcon}>📄</span>
              <span className={s.docInfo} title={d.source_file}>{d.source_file}</span>
              <span className={s.docChunks}>{d.chunks}ch</span>
              <button className={s.docDel} onClick={() => handleDelete(d.source_file)} title="Excluir">×</button>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.emptyDocs}>Nenhum documento indexado</div>
      )}
    </div>
  )
}
