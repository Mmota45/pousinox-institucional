import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface SiteConfig {
  [key: string]: string
}

export interface SiteContador {
  id: number
  valor: number
  sufixo: string
  label: string
  ordem: number
}

export interface SiteDepoimento {
  id: number
  nome: string
  avatar_cor: string
  texto: string
  nota: number
  ordem: number
}

export interface SiteEtapa {
  id: number
  numero: string
  titulo: string
  descricao: string
  ordem: number
}

export interface SiteFaq {
  id: number
  pergunta: string
  resposta: string
  categoria: string
  ordem: number
}

export interface SiteVideo {
  id: number
  titulo: string
  youtube_url: string
  secao: string
  ordem: number
}

export interface SiteSeo {
  rota: string
  titulo: string | null
  descricao: string | null
  og_image: string | null
}

// Cache em memória para evitar refetch a cada navegação
const cache: Record<string, { data: unknown; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 min

async function fetchCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache[key]
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T
  const data = await fetcher()
  cache[key] = { data, ts: Date.now() }
  return data
}

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCached('site_config', async () => {
      const { data } = await supabase.from('site_config').select('chave, valor')
      const map: SiteConfig = {}
      data?.forEach(r => { map[r.chave] = r.valor })
      return map
    }).then(d => { setConfig(d); setLoading(false) })
  }, [])

  return { config, loading }
}

export function useSiteContadores() {
  const [contadores, setContadores] = useState<SiteContador[]>([])
  useEffect(() => {
    fetchCached('site_contadores', async () => {
      const { data } = await supabase
        .from('site_contadores')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      return (data || []) as SiteContador[]
    }).then(setContadores)
  }, [])
  return contadores
}

export function useSiteDepoimentos() {
  const [depoimentos, setDepoimentos] = useState<SiteDepoimento[]>([])
  useEffect(() => {
    fetchCached('site_depoimentos', async () => {
      const { data } = await supabase
        .from('site_depoimentos')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      return (data || []) as SiteDepoimento[]
    }).then(setDepoimentos)
  }, [])
  return depoimentos
}

export function useSiteEtapas() {
  const [etapas, setEtapas] = useState<SiteEtapa[]>([])
  useEffect(() => {
    fetchCached('site_etapas', async () => {
      const { data } = await supabase
        .from('site_etapas')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      return (data || []) as SiteEtapa[]
    }).then(setEtapas)
  }, [])
  return etapas
}

export function useSiteFaq() {
  const [faq, setFaq] = useState<SiteFaq[]>([])
  useEffect(() => {
    fetchCached('site_faq', async () => {
      const { data } = await supabase
        .from('site_faq')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      return (data || []) as SiteFaq[]
    }).then(setFaq)
  }, [])
  return faq
}

export function useSiteVideos(secao?: string) {
  const [videos, setVideos] = useState<SiteVideo[]>([])
  useEffect(() => {
    fetchCached(`site_videos_${secao || 'all'}`, async () => {
      let q = supabase.from('site_videos').select('*').eq('ativo', true).order('ordem')
      if (secao) q = q.eq('secao', secao)
      const { data } = await q
      return (data || []) as SiteVideo[]
    }).then(setVideos)
  }, [secao])
  return videos
}

export function useSiteSeo(rota: string) {
  const [seo, setSeo] = useState<SiteSeo | null>(null)
  useEffect(() => {
    fetchCached(`site_seo_${rota}`, async () => {
      const { data } = await supabase
        .from('site_seo')
        .select('rota, titulo, descricao, og_image')
        .eq('rota', rota)
        .single()
      return data as SiteSeo | null
    }).then(setSeo)
  }, [rota])
  return seo
}

/** Invalida cache para forçar refetch */
export function invalidateSiteCache(key?: string) {
  if (key) { delete cache[key] } else { Object.keys(cache).forEach(k => delete cache[k]) }
}
