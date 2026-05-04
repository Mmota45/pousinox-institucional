import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { HistoricoItem } from '../types'
import { EVENTO_LABEL } from '../types'

function fmtEvento(iso: string) { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }

interface Props {
  historico: HistoricoItem[]
  styles: Record<string, string>
}

export default function HistoricoSection({ historico, styles }: Props) {
  const [verTodo, setVerTodo] = useState(false)

  if (historico.length === 0) return null

  const grupos: { evento: string; descricao: string | null; criado_em: string; usuario: string | null; count: number }[] = []
  for (const h of historico) {
    const dia = h.criado_em.slice(0, 10)
    const last = grupos[grupos.length - 1]
    if (last && last.evento === h.evento && last.criado_em.slice(0, 10) === dia) {
      last.count++
    } else {
      grupos.push({ evento: h.evento, descricao: h.descricao, criado_em: h.criado_em, usuario: h.usuario, count: 1 })
    }
  }
  const visiveis = verTodo ? grupos : grupos.slice(0, 5)

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Rastreabilidade</div>
      <div className={styles.historicoList}>
        {visiveis.map((g, i) => (
          <div key={i} className={styles.historicoItem}>
            <span className={styles.historicoEvento}>
              {EVENTO_LABEL[g.evento] ?? g.evento}
              {g.count > 1 && <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#e2e8f0', color: '#64748b', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>×{g.count}</span>}
            </span>
            {g.descricao && <span className={styles.historicoDesc}>{g.descricao}</span>}
            <span className={styles.historicoData}>{fmtEvento(g.criado_em)}{g.usuario ? ` · ${g.usuario}` : ''}</span>
          </div>
        ))}
      </div>
      {grupos.length > 5 && (
        <button type="button" onClick={() => setVerTodo(v => !v)}
          style={{ marginTop: 8, fontSize: '0.78rem', color: '#1a5fa8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {verTodo ? <><ChevronUp size={13} /> Ver menos</> : <><ChevronDown size={13} /> Ver histórico completo ({grupos.length} entradas)</>}
        </button>
      )}
    </div>
  )
}
