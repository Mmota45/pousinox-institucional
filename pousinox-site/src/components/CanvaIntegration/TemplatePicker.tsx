import { useEffect, useState } from 'react'
import { useCanva } from '../../hooks/useCanva'
import s from './CanvaIntegration.module.css'

interface Template {
  id: string
  title?: string
  thumbnail?: { url: string }
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (template: Template) => void
  query?: string
}

export default function TemplatePicker({ open, onClose, onSelect, query }: Props) {
  const { listTemplates, connected } = useCanva()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !connected) return
    setLoading(true)
    listTemplates(query)
      .then(res => setTemplates(res.items ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [open, connected, query]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  return (
    <div className={s.modal}>
      <div className={s.modalBackdrop} onClick={onClose} />
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>Escolher Template</h3>
          <button className={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={s.modalBody}>
          {loading ? (
            <div className={s.emptyTemplates}>Carregando templates...</div>
          ) : templates.length === 0 ? (
            <div className={s.emptyTemplates}>
              Nenhum brand template encontrado no Canva.<br />
              Crie templates com campos de preenchimento automático no Canva Pro.
            </div>
          ) : (
            <div className={s.templateGrid}>
              {templates.map(t => (
                <div key={t.id} className={s.templateCard} onClick={() => onSelect(t)}>
                  {t.thumbnail?.url && <img src={t.thumbnail.url} alt={t.title} className={s.templateThumb} />}
                  <div className={s.templateName}>{t.title || 'Sem título'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
