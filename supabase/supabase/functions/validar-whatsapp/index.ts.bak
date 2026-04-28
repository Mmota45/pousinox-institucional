import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE_ID") ?? ""
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? ""
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? ""

function normalizeBR(phone: string): string {
  let n = phone.replace(/\D/g, "")
  if (n.startsWith("0")) n = n.slice(1)
  if (!n.startsWith("55")) n = "55" + n
  // Add 9 for mobile if missing (2-digit DDD + 8-digit number)
  if (n.length === 12) {
    const ddd = n.slice(2, 4)
    n = "55" + ddd + "9" + n.slice(4)
  }
  return n
}

async function checkWhatsApp(phone: string): Promise<{ exists: boolean; number: string }> {
  const normalized = normalizeBR(phone)
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/phone-exists/${normalized}`
  const res = await fetch(url, {
    headers: { "Client-Token": ZAPI_CLIENT_TOKEN },
  })
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  console.log(`Z-API phone-exists ${normalized}:`, JSON.stringify(data))
  // Z-API returns { exists: true/false } or { value: true/false }
  const exists = data.exists === true || data.value === true || data.numberExists === true
  return { exists, number: normalized }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { action, phones, prospect_id, phone } = await req.json()

    if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
      return new Response(JSON.stringify({ error: "Z-API não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Validate single number
    if (action === "check") {
      const result = await checkWhatsApp(phone)
      if (prospect_id) {
        await supabase.from("prospeccao").update({
          whatsapp: result.exists ? phone : null,
          whatsapp_validado: result.exists,
        }).eq("id", prospect_id)
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Batch validate — array of {id, phone}
    if (action === "batch") {
      const results: { id: number; phone: string; exists: boolean }[] = []
      for (const item of (phones || []).slice(0, 50)) {
        try {
          const r = await checkWhatsApp(item.phone)
          results.push({ id: item.id, phone: item.phone, exists: r.exists })
          if (r.exists) {
            await supabase.from("prospeccao").update({
              whatsapp: item.phone, whatsapp_validado: true,
            }).eq("id", item.id)
          }
          // Z-API rate limit ~2req/s
          await new Promise(ok => setTimeout(ok, 600))
        } catch { results.push({ id: item.id, phone: item.phone, exists: false }) }
      }
      const validated = results.filter(r => r.exists).length
      return new Response(JSON.stringify({ total: results.length, validated, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
