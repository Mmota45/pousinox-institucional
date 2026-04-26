import { useState } from 'react'
import { type ToolCall, ACTION_LABELS, formatActionParams, executeAction, type ActionResult } from './actions/executeAction'
import s from './ActionConfirm.module.css'

interface Props {
  tools: ToolCall[]
  onComplete: (results: { tool_id: string; result: ActionResult }[]) => void
  onCancel: () => void
}

const ACTION_ICONS: Record<string, string> = {
  criar_orcamento: '📋',
  mover_deal: '🔄',
  criar_ordem_producao: '🏭',
  registrar_lancamento: '💰',
  consultar_dados: '🔍',
}

export default function ActionConfirm({ tools, onComplete, onCancel }: Props) {
  const [executing, setExecuting] = useState(false)

  async function handleConfirm() {
    setExecuting(true)
    const results: { tool_id: string; result: ActionResult }[] = []
    for (const tool of tools) {
      const result = await executeAction(tool)
      results.push({ tool_id: tool.id, result })
    }
    onComplete(results)
  }

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className={s.modal}>
        {tools.map(tool => (
          <div key={tool.id}>
            <div className={s.header}>
              <div className={s.headerIcon}>{ACTION_ICONS[tool.name] || '⚡'}</div>
              <div className={s.headerText}>
                <h3>{ACTION_LABELS[tool.name] || tool.name}</h3>
                <p>O assistente quer executar esta ação. Confirme para prosseguir.</p>
              </div>
            </div>
            <div className={s.body}>
              <div className={s.paramList}>
                {formatActionParams(tool).map((line, i) => {
                  const [key, ...rest] = line.split(': ')
                  return (
                    <div key={i} className={s.param}>
                      <span className={s.paramKey}>{key}</span>
                      <span className={s.paramVal}>{rest.join(': ')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
        <div className={s.footer}>
          <button className={s.btnCancel} onClick={onCancel} disabled={executing}>Cancelar</button>
          <button className={s.btnConfirm} onClick={handleConfirm} disabled={executing}>
            {executing ? 'Executando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
