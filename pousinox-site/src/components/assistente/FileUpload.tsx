import { useRef, useState, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import s from './FileUpload.module.css'

const ACCEPT = '.pdf,.csv,.xlsx,.png,.jpg,.jpeg,.webp'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'text/csv': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  disabled?: boolean
  onResult: (content: string, filename: string) => void
}

export default function FileUpload({ disabled, onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleSelect = useCallback((f: File) => {
    if (f.size > MAX_SIZE) { alert('Arquivo muito grande (máx 10MB)'); return }
    setFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleSelect(f)
    e.target.value = ''
  }, [handleSelect])

  const handleSend = useCallback(async () => {
    if (!file) return
    setUploading(true)
    try {
      // Converter para base64
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      const { data, error } = await supabaseAdmin.functions.invoke('assistente-arquivo', {
        body: { file_base64: base64, mime_type: file.type, filename: file.name },
      })

      if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      onResult(parsed?.content || 'Análise concluída sem conteúdo.', file.name)
      setFile(null)
      setPreview(null)
    } catch (err) {
      onResult(`Erro ao analisar arquivo: ${err instanceof Error ? err.message : 'desconhecido'}`, file.name)
    } finally {
      setUploading(false)
    }
  }, [file, onResult])

  const clear = useCallback(() => {
    setFile(null)
    setPreview(null)
  }, [])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className={s.hiddenInput}
        onChange={handleChange}
      />
      <button
        className={s.attachBtn}
        onClick={() => file ? handleSend() : inputRef.current?.click()}
        disabled={disabled || uploading}
        title={file ? 'Enviar arquivo para análise' : 'Anexar arquivo'}
      >
        {uploading
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          : file
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        }
      </button>

      {file && !uploading && (
        <div className={s.preview}>
          {preview ? (
            <img src={preview} alt="" className={s.previewThumb} />
          ) : (
            <div className={s.previewIcon}>{FILE_ICONS[file.type] || '📄'}</div>
          )}
          <div className={s.previewInfo}>
            <div className={s.previewName}>{file.name}</div>
            <div className={s.previewSize}>{formatSize(file.size)}</div>
          </div>
          <button className={s.previewDel} onClick={clear} title="Remover">×</button>
        </div>
      )}
    </>
  )
}
