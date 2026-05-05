import { useState, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useCockpit, type EmpresaSelecionada } from '../../contexts/CockpitContext'
import { Search, X, Building2, Users } from 'lucide-react'
import styles from './BuscaGlobal.module.css'

interface Resultado {
  cnpj: string
  nome: string
  tipo: 'prospect' | 'cliente'
  id?: number
  cidade?: string
  uf?: string
  segmento?: string
}

export default function BuscaGlobal() {
  const { empresa, setEmpresa, limpar } = useCockpit()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [aberto, setAberto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setAberto(true)
        setTimeout(() => {
          const input = wrapRef.current?.querySelector('input')
          input?.focus()
        }, 50)
      }
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  function buscar(termo: string) {
    setQuery(termo)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (termo.length < 2) { setResultados([]); return }

    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      const cnpjLimpo = termo.replace(/\D/g, '')
      const buscaCnpj = cnpjLimpo.length >= 4

      const [prospects, clientes] = await Promise.allSettled([
        supabaseAdmin.from('prospeccao')
          .select('id, cnpj, razao_social, nome_fantasia, cidade, uf, segmento')
          .or(buscaCnpj ? `cnpj.ilike.%${cnpjLimpo}%,razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%` : `razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
          .limit(8),
        supabaseAdmin.from('clientes')
          .select('id, cnpj, razao_social, cidade, uf')
          .or(buscaCnpj ? `cnpj.ilike.%${cnpjLimpo}%,razao_social.ilike.%${termo}%` : `razao_social.ilike.%${termo}%`)
          .limit(5),
      ])

      const res: Resultado[] = []
      if (prospects.status === 'fulfilled') {
        (prospects.value.data ?? []).forEach(p => res.push({
          cnpj: p.cnpj, nome: p.nome_fantasia || p.razao_social, tipo: 'prospect',
          id: p.id, cidade: p.cidade, uf: p.uf, segmento: p.segmento,
        }))
      }
      if (clientes.status === 'fulfilled') {
        (clientes.value.data ?? []).forEach(c => {
          if (!res.some(r => r.cnpj === c.cnpj)) {
            res.push({ cnpj: c.cnpj, nome: c.razao_social, tipo: 'cliente', id: c.id, cidade: c.cidade, uf: c.uf })
          }
        })
      }
      setResultados(res)
      setBuscando(false)
    }, 300)
  }

  function selecionar(r: Resultado) {
    setEmpresa({ cnpj: r.cnpj, nome: r.nome, tipo: r.tipo, id: r.id })
    setAberto(false)
    setQuery('')
    setResultados([])
  }

  function formatCnpj(c: string) {
    const d = c.replace(/\D/g, '')
    if (d.length !== 14) return c
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  // Badge da empresa selecionada
  if (empresa && !aberto) {
    return (
      <div className={styles.badge} ref={wrapRef}>
        <Building2 size={14} color="#2563eb" />
        <span className={styles.badgeNome}>{empresa.nome}</span>
        <span className={styles.badgeCnpj}>{formatCnpj(empresa.cnpj)}</span>
        <span className={styles.badgeTipo} data-tipo={empresa.tipo}>
          {empresa.tipo === 'prospect' ? 'Prospect' : 'Cliente'}
        </span>
        <button className={styles.badgeLimpar} onClick={limpar} title="Voltar ao modo global">
          <X size={14} />
        </button>
        <button className={styles.badgeBuscar} onClick={() => setAberto(true)} title="Buscar outra empresa (Ctrl+K)">
          <Search size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputWrap}>
        <Search size={16} color="#64748b" className={styles.inputIcon} />
        <input
          className={styles.input}
          placeholder="Buscar empresa por CNPJ ou nome... (Ctrl+K)"
          value={query}
          onChange={e => buscar(e.target.value)}
          onFocus={() => setAberto(true)}
          autoFocus={aberto}
        />
        {query && (
          <button className={styles.inputClear} onClick={() => { setQuery(''); setResultados([]) }}>
            <X size={14} />
          </button>
        )}
      </div>

      {aberto && resultados.length > 0 && (
        <div className={styles.dropdown}>
          {resultados.map(r => (
            <button key={`${r.tipo}-${r.cnpj}`} className={styles.item} onClick={() => selecionar(r)}>
              <div className={styles.itemIcon}>
                {r.tipo === 'prospect' ? <Users size={16} color="#f59e0b" /> : <Building2 size={16} color="#16a34a" />}
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemNome}>{r.nome}</span>
                <span className={styles.itemMeta}>
                  {formatCnpj(r.cnpj)}
                  {r.cidade && r.uf && ` · ${r.cidade}/${r.uf}`}
                  {r.segmento && ` · ${r.segmento}`}
                </span>
              </div>
              <span className={styles.itemTipo} data-tipo={r.tipo}>
                {r.tipo === 'prospect' ? 'Prospect' : 'Cliente'}
              </span>
            </button>
          ))}
        </div>
      )}

      {aberto && query.length >= 2 && resultados.length === 0 && !buscando && (
        <div className={styles.dropdown}>
          <div className={styles.vazio}>Nenhuma empresa encontrada</div>
        </div>
      )}

      {aberto && buscando && (
        <div className={styles.dropdown}>
          <div className={styles.vazio}>Buscando...</div>
        </div>
      )}
    </div>
  )
}
