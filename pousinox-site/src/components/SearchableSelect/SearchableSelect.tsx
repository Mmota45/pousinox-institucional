import { useState } from 'react'

interface Option { value: string; label: string }

interface SingleProps {
  value: string
  onChange: (val: string) => void
  multiple?: false
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  minWidth?: number
}

interface MultiProps {
  value: string[]
  onChange: (val: string[]) => void
  multiple: true
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  minWidth?: number
}

type Props = SingleProps | MultiProps

export function SearchableSelect(props: Props) {
  const {
    options, placeholder = 'Todos',
    searchPlaceholder = 'Buscar…', minWidth = 120,
  } = props
  const multi = props.multiple === true
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  )

  // Multi helpers
  const selectedArr = multi ? (props.value as string[]) : []
  const isSelected = (v: string) => multi ? selectedArr.includes(v) : (props.value as string) === v
  const hasValue = multi ? selectedArr.length > 0 : !!(props.value as string)

  const displayLabel = () => {
    if (multi) {
      if (selectedArr.length === 0) return placeholder
      if (selectedArr.length <= 2) return selectedArr.join(', ')
      return `${selectedArr.slice(0, 2).join(', ')} +${selectedArr.length - 2}`
    }
    const sel = options.find(o => o.value === (props.value as string))
    return sel ? sel.label : placeholder
  }

  const handleSelect = (val: string) => {
    if (multi) {
      const cb = props.onChange as (v: string[]) => void
      if (selectedArr.includes(val)) {
        cb(selectedArr.filter(v => v !== val))
      } else {
        cb([...selectedArr, val])
      }
    } else {
      ;(props.onChange as (v: string) => void)(val)
      setOpen(false)
    }
  }

  const handleClear = () => {
    if (multi) (props.onChange as (v: string[]) => void)([])
    else (props.onChange as (v: string) => void)('')
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => { setOpen(o => !o); setSearch('') }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', border: '1px solid #d0d7de', borderRadius: 6,
          background: '#fff', cursor: 'pointer', fontSize: '0.83rem',
          minWidth, userSelect: 'none',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel()}
        </span>
        {hasValue && (
          <span
            onClick={e => { e.stopPropagation(); handleClear() }}
            style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}
            title="Limpar"
          >✕</span>
        )}
        <span style={{ color: '#aaa', fontSize: '0.7rem', flexShrink: 0 }}>▼</span>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
            background: '#fff', border: '1px solid #d0d7de', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: Math.max(minWidth, 160), overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f2f5' }}>
              <input
                autoFocus
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '4px 8px', border: '1px solid #d0d7de',
                  borderRadius: 5, fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <div
                onClick={handleClear}
                style={{
                  padding: '7px 14px', cursor: 'pointer', fontSize: '0.83rem',
                  background: !hasValue ? '#e8f0f8' : 'transparent',
                  fontWeight: !hasValue ? 700 : 400, color: '#1a1a2e',
                  borderBottom: '1px solid #f5f7fa',
                }}
                onMouseEnter={e => { if (hasValue) e.currentTarget.style.background = '#f5f7fa' }}
                onMouseLeave={e => { if (hasValue) e.currentTarget.style.background = 'transparent' }}
              >
                {placeholder}
              </div>
              {filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: '7px 14px', cursor: 'pointer', fontSize: '0.83rem',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isSelected(opt.value) ? '#e8f0f8' : 'transparent',
                    fontWeight: isSelected(opt.value) ? 700 : 400, color: '#1a1a2e',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isSelected(opt.value) ? '#e8f0f8' : '#f5f7fa')}
                  onMouseLeave={e => (e.currentTarget.style.background = isSelected(opt.value) ? '#e8f0f8' : 'transparent')}
                >
                  {multi && (
                    <span style={{
                      width: 16, height: 16, borderRadius: 3, border: '1.5px solid #94a3b8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: isSelected(opt.value) ? '#1a3a5c' : '#fff',
                      color: '#fff', fontSize: '0.7rem', lineHeight: 1,
                    }}>{isSelected(opt.value) ? '✓' : ''}</span>
                  )}
                  {opt.label}
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#aaa' }}>Nenhum resultado</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
