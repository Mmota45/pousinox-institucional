import { useState, useMemo } from 'react'

type Dir = 'asc' | 'desc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSort<T = any>(
  data: T[],
  defaultKey: keyof T,
  defaultDir: Dir = 'desc'
) {
  const [key, setKey] = useState<keyof T>(defaultKey)
  const [dir, setDir] = useState<Dir>(defaultDir)

  function toggle(k: keyof T) {
    if (k === key) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setKey(k); setDir('desc') }
  }

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmp = (av as any) < (bv as any) ? -1 : (av as any) > (bv as any) ? 1 : 0
      return dir === 'asc' ? cmp : -cmp
    })
  }, [data, key, dir])

  const ind = (k: keyof T) => (key === k ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅')

  return { sorted, toggle, ind }
}
