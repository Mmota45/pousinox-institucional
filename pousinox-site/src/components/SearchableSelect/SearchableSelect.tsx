import { useState } from 'react'

interface Option { value: string; label: string }

interface Props {
  value: string
  onChange: (val: string) => void
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  minWidth?: number
}

export function SearchableSelect({
  value, onChange, options,
  placeholder = 'Todos',
  searchPlaceholder = 'Buscar…',
  minWidth = 120,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = options.find(o => o.value === value)
  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  )

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
          {selected ? selected.label : placeholder}
        </span>
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange('') }}
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
              {/* Opção "todos/nenhum" */}
              <div
                onClick={() => { onChange(''); setOpen(false) }}
                style={{
                  padding: '7px 14px', cursor: 'pointer', fontSize: '0.83rem',
                  background: !value ? '#e8f0f8' : 'transparent',
                  fontWeight: !value ? 700 : 400, color: '#1a1a2e',
                  borderBottom: '1px solid #f5f7fa',
                }}
                onMouseEnter={e => { if (value) e.currentTarget.style.background = '#f5f7fa' }}
                onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent' }}
              >
                {placeholder}
              </div>
              {filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  style={{
                    padding: '7px 14px', cursor: 'pointer', fontSize: '0.83rem',
                    background: value === opt.value ? '#e8f0f8' : 'transparent',
                    fontWeight: value === opt.value ? 700 : 400, color: '#1a1a2e',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = value === opt.value ? '#e8f0f8' : '#f5f7fa')}
                  onMouseLeave={e => (e.currentTarget.style.background = value === opt.value ? '#e8f0f8' : 'transparent')}
                >
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
