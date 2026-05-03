import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE_ID") ?? ""
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? ""
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

function normalizeBR(phone: string): string {
  let n = phone.replace(/\D/g, "")
  if (n.startsWith("0")) n = n.slice(1)
  if (!n.startsWith("55")) n = "55" + n
  if (n.length === 12) {
    const ddd = n.slice(2, 4)
    n = "55" + ddd + "9" + n.slice(4)
  }
  return n
}

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function enviarWhatsApp(phone: string, message: string): Promise<boolean> {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone, message }),
  })
  if (!res.ok) {
    console.error(`Z-API send error: ${res.status} ${await res.text()}`)
    return false
  }
  return true
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  try {
    const { action, nome, whatsapp, email, empresa, cep, endereco, codigo } = await req.json()
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
      return json({ error: "Z-API não configurado" }, 500)
    }

    // ── ENVIAR CÓDIGO ──────────────────────────────────────────────────────
    if (action === "enviar") {
      if (!nome?.trim() || !whatsapp?.trim()) {
        return json({ error: "Nome e WhatsApp são obrigatórios." }, 400)
      }

      const numero = normalizeBR(whatsapp)
      const code = gerarCodigo()
      const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

      // Upsert lead
      const { data: existing } = await sb
        .from("calculadora_leads")
        .select("id, otp_tentativas, verificado")
        .eq("whatsapp", numero)
        .maybeSingle()

      if (existing) {
        // Rate limit: max 5 tentativas por hora
        if (existing.otp_tentativas >= 5) {
          return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429)
        }
        await sb.from("calculadora_leads").update({
          nome: nome.trim(),
          email: email?.trim() || null,
          empresa: empresa?.trim() || null,
          cep: cep?.trim() || null,
          endereco: endereco?.trim() || null,
          otp_codigo: code,
          otp_expira: expira,
          otp_tentativas: existing.otp_tentativas + 1,
        }).eq("id", existing.id)
      } else {
        await sb.from("calculadora_leads").insert({
          nome: nome.trim(),
          whatsapp: numero,
          email: email?.trim() || null,
          empresa: empresa?.trim() || null,
          cep: cep?.trim() || null,
          endereco: endereco?.trim() || null,
          otp_codigo: code,
          otp_expira: expira,
          otp_tentativas: 1,
        })
      }

      // Enviar via Z-API
      const msg = `🔩 POUSINOX — Calculadora de Materiais\n\nSeu código de acesso: *${code}*\n\nVálido por 10 minutos.\nNão compartilhe este código.`
      const sent = await enviarWhatsApp(numero, msg)

      if (!sent) {
        return json({ error: "Não foi possível enviar o código. Verifique o número." }, 500)
      }

      return json({
        ok: true,
        message: "Código enviado via WhatsApp.",
        whatsapp_masked: numero.slice(0, 4) + "****" + numero.slice(-4),
      })
    }

    // ── VERIFICAR CÓDIGO ───────────────────────────────────────────────────
    if (action === "verificar") {
      if (!whatsapp?.trim() || !codigo?.trim()) {
        return json({ error: "WhatsApp e código são obrigatórios." }, 400)
      }

      const numero = normalizeBR(whatsapp)

      const { data: lead } = await sb
        .from("calculadora_leads")
        .select("id, otp_codigo, otp_expira, verificado, nome, empresa, email, cep, endereco")
        .eq("whatsapp", numero)
        .maybeSingle()

      if (!lead) {
        return json({ error: "Número não encontrado. Solicite um novo código." }, 404)
      }

      // Já verificado
      if (lead.verificado) {
        return json({ ok: true, verificado: true, lead_id: lead.id })
      }

      // Expirado
      if (lead.otp_expira && new Date(lead.otp_expira) < new Date()) {
        return json({ error: "Código expirado. Solicite um novo." }, 410)
      }

      // Código errado
      if (lead.otp_codigo !== codigo.trim()) {
        return json({ error: "Código incorreto." }, 401)
      }

      // Sucesso — marcar como verificado
      await sb.from("calculadora_leads").update({
        verificado: true,
        otp_codigo: null,
        otp_expira: null,
        otp_tentativas: 0,
      }).eq("id", lead.id)

      // ── Criar/atualizar na prospecção ──
      try {
        const prospectData: Record<string, unknown> = {
          nome_fantasia: lead.nome || lead.empresa || "Lead Calculadora",
          razao_social: lead.empresa || lead.nome || "Lead Calculadora",
          whatsapp: numero,
          whatsapp_validado: true,
          telefone1: numero,
          email: lead.email || null,
          cep: lead.cep || null,
          endereco: lead.endereco || null,
          segmento: "Construção Civil",
          produto: "Fixador de Porcelanato",
          observacao: `Lead via calculadora de materiais (${new Date().toLocaleDateString("pt-BR")})`,
          contatado: false,
          uf: null,
          cidade: null,
        }

        // Tenta extrair UF/cidade do CEP via BrasilAPI
        if (lead.cep) {
          try {
            const cepResp = await fetch(`https://brasilapi.com.br/api/cep/v1/${lead.cep.replace(/\D/g, "")}`)
            if (cepResp.ok) {
              const cepData = await cepResp.json()
              prospectData.uf = cepData.state || null
              prospectData.cidade = cepData.city || null
              if (cepData.neighborhood) prospectData.bairro = cepData.neighborhood
            }
          } catch { /* ignora erro CEP */ }
        }

        // Upsert por whatsapp — se já existe, atualiza
        const { data: existing } = await sb.from("prospeccao")
          .select("id")
          .eq("whatsapp", numero)
          .maybeSingle()

        if (existing) {
          await sb.from("prospeccao").update({
            nome_fantasia: prospectData.nome_fantasia,
            email: prospectData.email || undefined,
            observacao: prospectData.observacao,
          }).eq("id", existing.id)
        } else {
          await sb.from("prospeccao").insert(prospectData)
        }
      } catch (e) {
        console.error("Erro ao criar prospect:", e)
        // Não bloqueia o fluxo — lead já foi verificado
      }

      return json({ ok: true, verificado: true, lead_id: lead.id })
    }

    // ── REGISTRAR CÁLCULO ──────────────────────────────────────────────────
    if (action === "registrar_calculo") {
      if (!whatsapp?.trim()) {
        return json({ error: "WhatsApp obrigatório." }, 400)
      }

      const numero = normalizeBR(whatsapp)
      await sb.from("calculadora_leads").update({
        calculos: sb.rpc ? undefined : 1, // fallback
        ultimo_calculo: new Date().toISOString(),
      }).eq("whatsapp", numero)

      // Increment calculos
      await sb.rpc("increment_calc_leads", { p_whatsapp: numero }).catch(() => {
        // fallback se RPC não existir
        sb.from("calculadora_leads")
          .update({ ultimo_calculo: new Date().toISOString() })
          .eq("whatsapp", numero)
      })

      return json({ ok: true })
    }

    return json({ error: "Ação inválida" }, 400)
  } catch (err) {
    console.error("calculadora-otp error:", err)
    return json({ error: (err as Error).message }, 500)
  }
})
