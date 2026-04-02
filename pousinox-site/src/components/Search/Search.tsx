import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchIndex, matchSearch } from '../../data/searchIndex'
import { supabase } from '../../lib/supabase'
import type { ProdutoPublico } from '../../lib/supabase'
import styles from './Search.module.css'

const TYPE_LABEL: Record<string, string> = {
  blog: 'Blog',
  segmento: 'Segmento',
  pagina: 'Página',
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconBlog() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
}
function IconSegmento() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
}
function IconPagina() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
}
function IconProduto() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
}

type ProdutoResult = Pick<ProdutoPublico, 'id' | 'titulo' | 'categoria'>

export default function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [produtos, setProdutos] = useState<ProdutoResult[]>([])
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const staticResults = query.trim().length >= 2
    ? searchIndex.filter(item => matchSearch(item, query)).slice(0, 8)
    : []

  const hasResults = staticResults.length > 0 || produtos.length > 0
  const showResults = query.trim().length >= 2

  // Ao abrir no mobile, foca o input do overlay
  useEffect(() => {
    if (open) setTimeout(() => mobileInputRef.current?.focus(), 60)
    if (!open) { setQuery(''); setProdutos([]) }
  }, [open])

  // ESC fecha
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // Busca Supabase com debounce
  useEffect(() => {
    if (query.trim().length < 2) { setProdutos([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('produtos_publicos')
        .select('id, titulo, categoria')
        .ilike('titulo', `%${query}%`)
        .limit(3)
      setProdutos((data ?? []) as ProdutoResult[])
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  function go(path: string) {
    navigate(path)
    setOpen(false)
  }

  function handleDesktopFocus() {
    setOpen(true)
  }

  function clearQuery() {
    setQuery('')
    setProdutos([])
  }

  const results = (
    <>
      {showResults && (
        <div className={styles.results}>
          {!hasResults && (
            <p className={styles.empty}>Nenhum resultado para "<strong>{query}</strong>"</p>
          )}

          {produtos.length > 0 && (
            <div className={styles.group}>
              <span className={styles.groupLabel}>Produtos em Estoque</span>
              {produtos.map(p => (
                <button key={p.id} className={styles.resultItem} onClick={() => go('/pronta-entrega')} type="button">
                  <span className={styles.resultIcon}><IconProduto /></span>
                  <div className={styles.resultText}>
                    <span className={styles.resultTitle}>{p.titulo}</span>
                    {p.categoria && <span className={styles.resultSub}>{p.categoria}</span>}
                  </div>
                  <span className={styles.resultBadge} data-type="produto">Pronta Entrega</span>
                </button>
              ))}
            </div>
          )}

          {staticResults.length > 0 && (
            <div className={styles.group}>
              <span className={styles.groupLabel}>Páginas e Artigos</span>
              {staticResults.map((item, i) => (
                <button key={i} className={styles.resultItem} onClick={() => go(item.path)} type="button">
                  <span className={styles.resultIcon}>
                    {item.type === 'blog' && <IconBlog />}
                    {item.type === 'segmento' && <IconSegmento />}
                    {item.type === 'pagina' && <IconPagina />}
                  </span>
                  <div className={styles.resultText}>
                    <span className={styles.resultTitle}>{item.title}</span>
                    <span className={styles.resultSub}>{item.description}</span>
                  </div>
                  <span className={styles.resultBadge} data-type={item.type}>{TYPE_LABEL[item.type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!showResults && (
        <p className={styles.hint}>Digite pelo menos 2 caracteres para buscar em produtos, artigos, segmentos e serviços.</p>
      )}
    </>
  )

  return (
    <>
      {/* ── Desktop: input inline na faixa 1 ── */}
      <div className={styles.desktopBar}>
        <span className={styles.desktopIcon}><IconSearch size={16} /></span>
        <input
          className={styles.desktopInput}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={handleDesktopFocus}
          placeholder="Buscar produtos, artigos, serviços..."
          autoComplete="off"
        />
        {query && (
          <button className={styles.desktopClear} onClick={clearQuery} type="button" aria-label="Limpar">
            <IconClose />
          </button>
        )}
      </div>

      {/* ── Mobile: ícone que abre overlay ── */}
      <button
        className={styles.mobileBtn}
        onClick={() => setOpen(o => !o)}
        aria-label="Buscar no site"
        type="button"
      >
        <IconSearch size={18} />
      </button>

      {/* ── Overlay de resultados (desktop + mobile) ── */}
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.overlay}>
            <div className="container">
              {/* Input visível apenas no overlay mobile */}
              <div className={styles.mobileInputRow}>
                <span className={styles.mobileInputIcon}><IconSearch size={17} /></span>
                <input
                  ref={mobileInputRef}
                  className={styles.mobileInput}
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar produtos, artigos, serviços..."
                  autoComplete="off"
                />
                <button className={styles.closeBtn} onClick={() => setOpen(false)} type="button" aria-label="Fechar">
                  <IconClose />
                  <span className={styles.escLabel}>ESC</span>
                </button>
              </div>
              {results}
            </div>
          </div>
        </>
      )}
    </>
  )
}
