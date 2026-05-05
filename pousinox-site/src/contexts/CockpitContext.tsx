import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface EmpresaSelecionada {
  cnpj: string
  nome: string
  tipo: 'prospect' | 'cliente'
  id?: number
}

interface CockpitCtx {
  empresa: EmpresaSelecionada | null
  setEmpresa: (e: EmpresaSelecionada | null) => void
  limpar: () => void
  etapa: Etapa
  setEtapa: (e: Etapa) => void
}

export type Etapa = 'radar' | 'lead' | 'contato' | 'deal' | 'proposta' | 'venda' | 'entrega' | 'posvenda'

const ETAPAS: Etapa[] = ['radar', 'lead', 'contato', 'deal', 'proposta', 'venda', 'entrega', 'posvenda']

const Ctx = createContext<CockpitCtx | null>(null)

export function CockpitProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<EmpresaSelecionada | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('radar')
  const limpar = useCallback(() => setEmpresa(null), [])
  return (
    <Ctx.Provider value={{ empresa, setEmpresa, limpar, etapa, setEtapa }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCockpit() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCockpit deve estar dentro de CockpitProvider')
  return ctx
}

export { ETAPAS }
