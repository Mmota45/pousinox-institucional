import { useState } from 'react'
import { useCanva } from '../../hooks/useCanva'
import s from './CanvaIntegration.module.css'

interface Props {
  /** Ação ao clicar: recebe as funções do hook useCanva */
  onAction: (canva: ReturnType<typeof useCanva>) => Promise<void>
  label?: string
  icon?: string
  disabled?: boolean
  className?: string
}

/**
 * Botão reutilizável para ações Canva.
 * Se o Canva não estiver conectado, mostra botão de conexão.
 */
export default function CanvaButton({ onAction, label = 'Criar no Canva', icon = '🎨', disabled, className }: Props) {
  const canva = useCanva()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (canva.loading) return null

  if (!canva.connected) {
    return (
      <button
        className={`${s.btn} ${s.btnConnect} ${className ?? ''}`}
        onClick={() => canva.connect()}
        title="Conectar conta Canva Pro"
      >
        🔗 Conectar Canva
      </button>
    )
  }

  const handleClick = async () => {
    setLoading(true)
    setError('')
    try {
      await onAction(canva)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.wrap}>
      <button
        className={`${s.btn} ${s.btnCanva} ${className ?? ''}`}
        onClick={handleClick}
        disabled={disabled || loading}
        title={label}
      >
        {loading ? '⏳' : icon} {loading ? 'Gerando...' : label}
      </button>
      {error && <span className={s.error}>{error}</span>}
    </div>
  )
}
