/**
 * ModelMonitor — Painel de monitoramento e descoberta de modelos IA
 * Usado no AdminIA para verificar saúde, descobrir novos modelos e ativar/desativar
 */

import { useState } from 'react'

const EDGE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/ai-hub'

interface HealthResult {
  provider: string
  model: string
  ok: boolean
  latency_ms: number
  error?: string
}

interface DiscoveredModel {
  id: string
  name: string
  free: boolean
  context?: number
  new?: boolean
  price?: string
}

export default function ModelMonitor({ onClose }: { onClose: () => void }) {
  const [health, setHealth] = useState<HealthResult[] | null>(null)
  const [discovered, setDiscovered] = useState<Record<string, DiscoveredModel[]> | null>(null)
  const [configured, setConfigured] = useState<Record<string, string[]> | null>(null)
  const [loading, setLoading] = useState('')
  const [msg, setMsg] = useState('')

  async function edgeCall(body: Record<string, unknown>) {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}` },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async function runHealthCheck() {
    setLoading('health')
    setHealth(null)
    try {
      const data = await edgeCall({ action: 'health_check' })
      if (data.ok) setHealth(data.results)
      else setMsg(`Erro: ${data.error}`)
    } catch (e) { setMsg(`Erro: ${(e as Error).message}`) }
    setLoading('')
  }

  async function runDiscover() {
    setLoading('discover')
    setDiscovered(null)
    try {
      const data = await edgeCall({ action: 'discover' })
      if (data.ok) {
        setDiscovered(data.discovered)
        setConfigured(data.configured)
      } else setMsg(`Erro: ${data.error}`)
    } catch (e) { setMsg(`Erro: ${(e as Error).message}`) }
    setLoading('')
  }

  async function toggleModel(provider: string, modelId: string, activate: boolean, displayName?: string) {
    try {
      await edgeCall({
        action: activate ? 'activate' : 'deactivate',
        provider, model_id: modelId, display_name: displayName, free: true,
      })
      setMsg(`${activate ? '✅ Ativado' : '❌ Desativado'}: ${modelId}`)
      // Refresh discover
      if (discovered) runDiscover()
    } catch (e) { setMsg(`Erro: ${(e as Error).message}`) }
  }

  const providerLabels: Record<string, string> = {
    groq: '⚡ Groq', gemini: '💎 Gemini', cohere: '🧠 Cohere',
    huggingface: '🤗 HuggingFace', together: '🤝 Together',
    cloudflare: '☁️ Cloudflare', openrouter: '🔀 OpenRouter',
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>🔬 Monitor de Modelos IA</h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>Verificar saúde, descobrir novos e ativar/desativar</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={runHealthCheck} disabled={!!loading}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#0a1628', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading === 'health' ? '⏳ Testando…' : '🏥 Health Check'}
          </button>
          <button onClick={runDiscover} disabled={!!loading}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading === 'discover' ? '⏳ Buscando…' : '🔍 Descobrir Novos'}
          </button>
        </div>

        {msg && <div style={{ padding: '8px 12px', borderRadius: 8, background: msg.startsWith('Erro') ? '#fef2f2' : '#f0fdf4', color: msg.startsWith('Erro') ? '#dc2626' : '#166534', fontSize: '0.82rem', fontWeight: 600 }}>{msg}</div>}

        {/* Health Results */}
        {health && (
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Resultados do Health Check</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {health.map((h, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${h.ok ? '#86efac' : '#fca5a5'}`,
                  background: h.ok ? '#f0fdf4' : '#fef2f2',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: h.ok ? '#166534' : '#991b1b' }}>
                      {h.ok ? '✅' : '❌'} {providerLabels[h.provider] || h.provider}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: h.latency_ms < 3000 ? '#16a34a' : h.latency_ms < 8000 ? '#d97706' : '#dc2626' }}>
                      {(h.latency_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{h.model}</div>
                  {h.error && <div style={{ fontSize: '0.68rem', color: '#dc2626', marginTop: 4, wordBreak: 'break-all' }}>{h.error.slice(0, 120)}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#94a3b8' }}>
              {health.filter(h => h.ok).length}/{health.length} operacionais · Média: {(health.reduce((s, h) => s + h.latency_ms, 0) / health.length / 1000).toFixed(1)}s
            </div>
          </div>
        )}

        {/* Discovered Models */}
        {discovered && (
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Modelos Disponíveis por Provider</h4>
            {Object.entries(discovered).map(([prov, models]) => {
              const activeSet = new Set(configured?.[prov] || [])
              const newModels = models.filter(m => m.new)
              return (
                <details key={prov} style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', padding: '8px 0' }}>
                    {providerLabels[prov] || prov} — {models.length} modelos
                    {newModels.length > 0 && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 700 }}>+{newModels.length} novos</span>}
                  </summary>
                  <div style={{ maxHeight: 300, overflowY: 'auto', paddingLeft: 8 }}>
                    {models.filter(m => m.free || m.new).slice(0, 20).map(m => (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem',
                      }}>
                        <span style={{ flex: 1, fontWeight: m.new ? 700 : 400, color: m.new ? '#1d4ed8' : '#334155' }}>
                          {m.name || m.id}
                          {m.free && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontSize: '0.6rem', fontWeight: 700 }}>FREE</span>}
                          {m.new && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontSize: '0.6rem', fontWeight: 700 }}>NOVO</span>}
                        </span>
                        {m.context && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{(m.context / 1000).toFixed(0)}K</span>}
                        {activeSet.has(m.id) ? (
                          <button onClick={() => toggleModel(prov, m.id, false)}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                            Desativar
                          </button>
                        ) : (
                          <button onClick={() => toggleModel(prov, m.id, true, m.name)}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                            Ativar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
