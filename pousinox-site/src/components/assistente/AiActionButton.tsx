// Botão IA reutilizável — abre modal com resultado
import { useState, useRef, useCallback } from 'react'
import s from './AiActionButton.module.css'

interface Props {
  label: string
  icon?: string
  /** Função que executa a ação IA e retorna o texto resultado */
  action: () => Promise<string>
  /** Callback opcional com o resultado (para preencher campos) */
  onResult?: (result: string) => void
  /** Se true, aceita upload de imagem antes de executar */
  acceptImage?: boolean
  /** Quando acceptImage=true, recebe o file e retorna resultado */
  actionWithFile?: (file: File) => Promise<string>
  small?: boolean
  disabled?: boolean
}

export default function AiActionButton({
  label, icon = '🤖', action, onResult, acceptImage, actionWithFile, small, disabled,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const execute = useCallback(async (file?: File) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const text = file && actionWithFile ? await actionWithFile(file) : await action()
      setResult(text)
      onResult?.(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na IA')
    } finally {
      setLoading(false)
    }
  }, [action, actionWithFile, onResult])

  const handleClick = useCallback(() => {
    if (acceptImage && fileRef.current) {
      fileRef.current.click()
    } else {
      execute()
    }
  }, [acceptImage, execute])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) execute(file)
    e.target.value = ''
  }, [execute])

  return (
    <>
      <button
        className={`${s.btn} ${small ? s.small : ''}`}
        onClick={handleClick}
        disabled={loading || disabled}
        title={label}
      >
        {loading ? '⏳' : icon} {!small && label}
      </button>

      {acceptImage && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      )}

      {(result || error) && (
        <div className={s.overlay} onClick={() => { setResult(null); setError(null) }}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span>{icon} {label}</span>
              <button className={s.close} onClick={() => { setResult(null); setError(null) }}>×</button>
            </div>
            <div className={s.modalBody}>
              {error ? (
                <div className={s.error}>{error}</div>
              ) : (
                <div className={s.resultText}>{result}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
