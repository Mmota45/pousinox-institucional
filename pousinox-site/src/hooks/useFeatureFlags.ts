import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'

interface FeatureFlag {
  flag: string
  habilitado: boolean
  descricao: string | null
  config: Record<string, unknown> | null
}

let cache: FeatureFlag[] | null = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 min

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache && Date.now() - cacheTime < CACHE_TTL) {
      setFlags(cache)
      setLoading(false)
      return
    }
    supabaseAdmin
      .from('feature_flags')
      .select('flag, habilitado, descricao, config')
      .then(({ data }) => {
        cache = data ?? []
        cacheTime = Date.now()
        setFlags(cache)
        setLoading(false)
      })
  }, [])

  const isEnabled = (name: string) => flags.find(f => f.flag === name)?.habilitado ?? false

  const refresh = async () => {
    const { data } = await supabaseAdmin
      .from('feature_flags')
      .select('flag, habilitado, descricao, config')
    cache = data ?? []
    cacheTime = Date.now()
    setFlags(cache)
  }

  return { flags, loading, isEnabled, refresh }
}

/** Hook leve para páginas públicas — usa anon key */
import { supabase } from '../lib/supabase'

let publicCache: Record<string, boolean> = {}
let publicCacheTime = 0

export function usePublicFlag(name: string): boolean {
  const [enabled, setEnabled] = useState(publicCache[name] ?? true) // default true para não esconder durante load

  useEffect(() => {
    if (publicCacheTime && Date.now() - publicCacheTime < CACHE_TTL) {
      setEnabled(publicCache[name] ?? true)
      return
    }
    supabase
      .from('feature_flags')
      .select('flag, habilitado')
      .then(({ data }) => {
        publicCache = {}
        ;(data ?? []).forEach(f => { publicCache[f.flag] = f.habilitado })
        publicCacheTime = Date.now()
        setEnabled(publicCache[name] ?? true)
      })
  }, [name])

  return enabled
}
