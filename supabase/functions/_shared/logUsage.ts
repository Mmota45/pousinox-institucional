// Helper compartilhado — registra uso de IA em ai_usage_log
// Import: import { logUsage } from '../_shared/logUsage.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Custo por token (USD)
const COST_MAP: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001':  { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  'claude-sonnet-4-6-20250514': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'gemini-2.5-flash':           { input: 0, output: 0 },  // free tier
  'gemini-embedding-001':       { input: 0, output: 0 },
  'llama-3.3-70b-versatile':   { input: 0, output: 0 },  // Groq free
  'llama-3.3-70b':             { input: 0, output: 0 },  // Cerebras free
  'mistral-small-latest':      { input: 0, output: 0 },  // Mistral free tier
}

export async function logUsage(
  function_name: string,
  model: string,
  input_tokens: number,
  output_tokens: number,
  metadata?: Record<string, unknown>,
) {
  if (!SUPABASE_URL || !SERVICE_KEY) return

  const costs = COST_MAP[model] ?? { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 }
  const custo_usd = input_tokens * costs.input + output_tokens * costs.output

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        function_name,
        model,
        input_tokens,
        output_tokens,
        custo_usd,
        metadata: metadata ?? {},
      }),
    })
  } catch (err) {
    console.warn('[logUsage] erro:', err)
  }
}
