import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Xq8ZiFGMQfE8wWfwtDOUNw_aozTc_PP'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-admin-service',
  },
})

export interface ProdutoPublico {
  id: string
  titulo: string
  categoria: string | null
  tipo: 'outlet' | 'pronta-entrega'
  marca: string | null
  fabricante: string | null
  descricao: string | null
  specs: { k: string; v: string }[] | Record<string, string> | null
  fotos: string[] | null
  disponivel: boolean
  quantidade: number
  vendido_em: string | null
  destaque: boolean
  seminovo: boolean
  preco: number
  preco_original: number | null
  desconto_max: number | null
  total_interesses: number
  exibir_preco: boolean
  peso_kg: number | null
  comprimento_cm: number | null
  largura_cm: number | null
  altura_cm: number | null
}
