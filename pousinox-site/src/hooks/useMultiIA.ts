import { useState, useCallback } from 'react'
import { aiParallel, aiPipeline, aiReviewer, type MultiTarget, type MultiResult } from '../lib/aiHelper'

export type MultiMode = 'parallel' | 'pipeline' | 'reviewer'

interface PipelineStep { target: MultiTarget; system: string }

interface UseMultiIAOpts {
  mode: MultiMode
  /** Parallel: lista de targets. Reviewer: [main, reviewer]. Pipeline: ignorado. */
  targets?: MultiTarget[]
  /** Pipeline: etapas com system prompt por step */
  steps?: PipelineStep[]
  /** System prompt geral (parallel/reviewer) */
  system?: string
}

interface UseMultiIAReturn {
  results: MultiResult[]
  reviewResult: { main: MultiResult; review: MultiResult } | null
  isRunning: boolean
  run: (prompt: string) => Promise<void>
  clear: () => void
}

export function useMultiIA(opts: UseMultiIAOpts): UseMultiIAReturn {
  const [results, setResults] = useState<MultiResult[]>([])
  const [reviewResult, setReviewResult] = useState<{ main: MultiResult; review: MultiResult } | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(async (prompt: string) => {
    setIsRunning(true)
    setResults([])
    setReviewResult(null)

    try {
      switch (opts.mode) {
        case 'parallel': {
          if (!opts.targets?.length) break
          // Setar loading para cada target
          setResults(opts.targets.map(t => ({ ...t, response: '', tempo: undefined })))
          const res = await aiParallel(prompt, opts.targets, opts.system)
          setResults(res)
          break
        }
        case 'pipeline': {
          if (!opts.steps?.length) break
          const res = await aiPipeline(prompt, opts.steps)
          setResults(res)
          break
        }
        case 'reviewer': {
          if (!opts.targets || opts.targets.length < 2) break
          const res = await aiReviewer(prompt, opts.targets[0], opts.targets[1], opts.system)
          setReviewResult(res)
          setResults([res.main, res.review])
          break
        }
      }
    } catch (e) {
      setResults([{ provider: '', model: '', response: '', error: String(e) }])
    }

    setIsRunning(false)
  }, [opts.mode, opts.targets, opts.steps, opts.system])

  const clear = useCallback(() => {
    setResults([])
    setReviewResult(null)
  }, [])

  return { results, reviewResult, isRunning, run, clear }
}
