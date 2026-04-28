import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'

interface CanvaState {
  connected: boolean
  loading: boolean
  error: string | null
}

interface ExportResult {
  url: string
  status: string
}

/** Hook para integração com Canva Connect API */
export function useCanva() {
  const [state, setState] = useState<CanvaState>({ connected: false, loading: true, error: null })

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.functions.invoke('canva-api', { body })
    if (error) throw new Error(error.message ?? 'Erro na API Canva')
    if (data?.error) throw new Error(data.error)
    return data
  }, [])

  // Check connection status on mount
  useEffect(() => {
    invoke({ acao: 'status' })
      .then(d => setState({ connected: d.connected, loading: false, error: null }))
      .catch(() => setState({ connected: false, loading: false, error: null }))
  }, [invoke])

  /** Start OAuth flow — opens Canva consent in new window */
  const connect = useCallback(async () => {
    const redirect_uri = window.location.hostname === 'localhost'
      ? `http://127.0.0.1:${window.location.port}/admin/canva-callback`
      : `${window.location.origin}/admin/canva-callback`
    const data = await invoke({ acao: 'auth_url', redirect_uri })
    // Store PKCE verifier for callback
    localStorage.setItem('canva_code_verifier', data.code_verifier)
    localStorage.setItem('canva_state', data.state)
    window.location.href = data.url
  }, [invoke])

  /** Exchange auth code for tokens (called from callback page) */
  const handleCallback = useCallback(async (code: string, state: string) => {
    const stored_state = localStorage.getItem('canva_state')
    if (state !== stored_state) throw new Error('State mismatch — possível CSRF')
    const code_verifier = localStorage.getItem('canva_code_verifier') ?? ''
    const redirect_uri = window.location.hostname === 'localhost'
      ? `http://127.0.0.1:${window.location.port}/admin/canva-callback`
      : `${window.location.origin}/admin/canva-callback`
    await invoke({ acao: 'callback', code, redirect_uri, code_verifier })
    localStorage.removeItem('canva_code_verifier')
    localStorage.removeItem('canva_state')
    setState(s => ({ ...s, connected: true }))
  }, [invoke])

  /** List brand templates */
  const listTemplates = useCallback(async (query?: string) => {
    return invoke({ acao: 'brand_templates', query })
  }, [invoke])

  /** Autofill a brand template with data */
  const autofill = useCallback(async (
    brand_template_id: string,
    data: Record<string, { type: 'text'; text: string } | { type: 'image'; asset_id: string }>,
    title?: string,
  ) => {
    return invoke({ acao: 'autofill', brand_template_id, data, title })
  }, [invoke])

  /** Create a blank design */
  const createDesign = useCallback(async (title: string, opts?: { width?: number; height?: number; design_type?: string }) => {
    return invoke({ acao: 'create_design', title, ...opts })
  }, [invoke])

  /** Export design to PDF or PNG */
  const exportDesign = useCallback(async (design_id: string, format: 'pdf' | 'png' | 'jpg' = 'pdf'): Promise<ExportResult> => {
    const job = await invoke({ acao: 'export', design_id, format })
    // Poll for completion
    let result = job
    while (result.status === 'in_progress' || result.status === 'pending') {
      await new Promise(r => setTimeout(r, 1500))
      result = await invoke({ acao: 'export_status', export_id: result.id ?? job.id })
    }
    return result
  }, [invoke])

  /** Upload image URL as Canva asset */
  const uploadAsset = useCallback(async (url: string, name: string) => {
    return invoke({ acao: 'upload_asset', url, name })
  }, [invoke])

  /** Search existing designs */
  const searchDesigns = useCallback(async (query?: string) => {
    return invoke({ acao: 'list_designs', query })
  }, [invoke])

  return {
    ...state,
    connect,
    handleCallback,
    listTemplates,
    autofill,
    createDesign,
    exportDesign,
    uploadAsset,
    searchDesigns,
  }
}
