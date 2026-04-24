import { useState, useCallback, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../../../lib/supabase'
import type { OrcLink } from '../types'

interface UseLinksParams {
  editandoId: number | null
  nomeUsuario: string
}

function gerarShortCode(len = 7) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function useLinks(params: UseLinksParams) {
  const p = useRef(params)
  useEffect(() => { p.current = params })

  const [links, setLinks] = useState<OrcLink[]>([])
  const [gerandoLink, setGerandoLink] = useState(false)
  const [novoLinkDest, setNovoLinkDest] = useState('')
  const [acessosLink, setAcessosLink] = useState<Record<string, any[]>>({})
  const [expandedLink, setExpandedLink] = useState<string | null>(null)

  const carregarLinks = useCallback(async (orcId: number) => {
    const { data } = await supabaseAdmin.from('orcamento_links').select('id, token, short_code, destinatario, criado_em, primeiro_acesso, ultimo_acesso, visualizacoes, downloads, ativo').eq('orcamento_id', orcId).order('criado_em', { ascending: false })
    setLinks((data ?? []) as OrcLink[])
  }, [])

  const toggleAcessos = useCallback(async (linkId: string) => {
    setExpandedLink(prev => {
      if (prev === linkId) return null
      return linkId
    })
    setAcessosLink(prev => {
      if (prev[linkId]) return prev
      // fetch async — fire and forget, update state when done
      supabaseAdmin
        .from('orcamento_link_acessos')
        .select('acessado_em, ip, user_agent')
        .eq('link_id', linkId)
        .order('acessado_em', { ascending: false })
        .then(({ data }) => {
          setAcessosLink(p2 => ({ ...p2, [linkId]: data ?? [] }))
        })
      return prev
    })
  }, [])

  const gerarLink = useCallback(async () => {
    const { editandoId, nomeUsuario } = p.current
    if (!editandoId) return
    setGerandoLink(true)
    const short_code = gerarShortCode()
    const dest = novoLinkDest.trim()
    const { data } = await supabaseAdmin.from('orcamento_links').insert({
      orcamento_id: editandoId,
      destinatario: dest || null,
      short_code,
    }).select('*').single()
    if (data) {
      setLinks(prev => [data as OrcLink, ...prev])
      setNovoLinkDest('')
      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'link_gerado', descricao: dest || 'Link gerado', usuario: nomeUsuario || null })
    }
    setGerandoLink(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoLinkDest])

  const desativarLink = useCallback(async (linkId: string) => {
    await supabaseAdmin.from('orcamento_links').update({ ativo: false }).eq('id', linkId)
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, ativo: false } : l))
  }, [])

  const linkUrl = useCallback((l: OrcLink) => {
    return l.short_code
      ? `${window.location.origin}/p/${l.short_code}`
      : `${window.location.origin}/view/orcamento/${l.token}`
  }, [])

  return {
    links, setLinks,
    gerandoLink, novoLinkDest, setNovoLinkDest,
    acessosLink, expandedLink,
    carregarLinks, toggleAcessos, gerarLink, desativarLink, linkUrl,
  }
}
