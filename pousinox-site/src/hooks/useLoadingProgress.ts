import { useState, useCallback, useRef } from 'react'

/**
 * Hook para tracking de progresso de carregamento.
 *
 * Uso sequencial:
 *   const lp = useLoadingProgress(4)
 *   const r1 = await query1(); lp.step()
 *
 * Uso paralelo (Promise.all):
 *   const [a, b, c] = await Promise.all([
 *     query1().then(r => { lp.step(); return r }),
 *     query2().then(r => { lp.step(); return r }),
 *   ])
 *
 * Uso com wrap helper:
 *   const [a, b] = await Promise.all([lp.wrap(query1()), lp.wrap(query2())])
 */
export function useLoadingProgress(totalSteps: number) {
  const [current, setCurrent] = useState(0)
  const stepRef = useRef(0)

  const step = useCallback(() => {
    stepRef.current = Math.min(stepRef.current + 1, totalSteps)
    setCurrent(stepRef.current)
  }, [totalSteps])

  const reset = useCallback(() => {
    stepRef.current = 0
    setCurrent(0)
  }, [])

  const wrap = useCallback(<T,>(promise: PromiseLike<T>): Promise<T> =>
    Promise.resolve(promise).then(r => { step(); return r }), [step])

  return { current, total: totalSteps, loading: current < totalSteps, step, reset, wrap }
}
