import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE_ID") ?? ""
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? ""
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? ""

// ── Mensagem por segmento ────────────────────────────────────────────────────

const PRODUTOS: Record<string, string> = {
  generico: "bancadas, mesas, coifas, fogões industriais, lava-botas, corrimãos e projetos sob medida",
  "açougue/frigorífico": "bancadas, mesas de corte, ganchos, lava-botas e estruturas para câmaras frias",
  "restaurante/bar": "bancadas, fogões industriais, coifas, mesas de preparo e mobiliário para cozinhas profissionais",
  "padaria/confeitaria": "bancadas, estantes, mesas de trabalho e estruturas para fornos",
  "hospital/clínica": "bancadas, pias cirúrgicas, mobiliário técnico e equipamentos para ambientes controlados",
  "hotel/pousada": "bancadas, buffets, mesas e mobiliário para cozinhas industriais",
  "construção/engenharia": "fixador de segurança para porcelanato, corrimãos, guarda-corpos e peças sob medida",
  "supermercado/varejo": "bancadas, balcões, mesas de manipulação e estruturas para áreas de preparo",
}

function detectarSegmentoKey(seg: string): string {
  const s = seg.toLowerCase()
  if (/açougue|frigoríf|carne/i.test(s)) return "açougue/frigorífico"
  if (/restaurante|gastrono|gourmet|alimenta|bar\b|lanchonete/i.test(s)) return "restaurante/bar"
  if (/padaria|panifica|confeitaria/i.test(s)) return "padaria/confeitaria"
  if (/hospital|clínica|saúde|laborat|farmác/i.test(s)) return "hospital/clínica"
  if (/hotel|hotelaria|pousada/i.test(s)) return "hotel/pousada"
  if (/constru|engenh|arquit|revest|imobil/i.test(s)) return "construção/engenharia"
  if (/supermercado|mercado|varejo/i.test(s)) return "supermercado/varejo"
  return "generico"
}

function limparNome(nome: string): string {
  return nome
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\.?A\.?|CNPJ|FILIAL|MATRIZ)\b/gi, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function formatarNome(nome: string): string {
  return limparNome(nome)
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

function gerarMensagem(nome: string, segmento: string | null, cidade: string | null): string {
  const nomeFmt = formatarNome(nome)
  const seg = segmento || ""
  const cidadeLocal = (cidade || "").toLowerCase().includes("pouso alegre")
  const origem = cidadeLocal ? "" : ", em Pouso Alegre/MG"
  const segKey = detectarSegmentoKey(seg)
  const produtos = PRODUTOS[segKey] || PRODUTOS.generico

  return `Boa tarde, ${nomeFmt}.

Meu nome é Marcos, da Pousinox\u00AE. Fabricamos equipamentos em aço inox padrão e sob medida${origem}.

Trabalhamos com: ${produtos}.

Caso estejam precisando de algum projeto específico sob medida ou equipamento, ficamos à disposição. Seria um prazer conversar com o responsável pela área de compras.

✅ Responda *SIM* se tiver interesse
❌ Responda *NÃO* se não precisar no momento

Marcos Mota
Pousinox\u00AE \u2014 A Arte em Inox
www.pousinox.com.br`
}

// ── Normalizar telefone BR ───────────────────────────────────────────────────

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

// ── Enviar mensagem via Z-API ────────────────────────────────────────────────

async function enviarMensagem(phone: string, message: string): Promise<boolean> {
  const normalized = normalizeBR(phone)
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone: normalized, message }),
  })
  if (!res.ok) {
    console.error(`Z-API send-text ${normalized}: ${res.status} ${await res.text()}`)
    return false
  }
  console.log(`Z-API send-text ${normalized}: OK`)
  return true
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))

    // Teste direto para um número (ignora feriado)
    if (body.test_phone) {
      const msg = gerarMensagem(body.test_nome || "Teste", body.test_segmento || null, null)
      const ok = await enviarMensagem(body.test_phone, msg)
      return new Response(JSON.stringify({ ok, phone: body.test_phone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Verificar feriado nacional via BrasilAPI
    const hoje = new Date().toISOString().slice(0, 10)
    const ano = hoje.slice(0, 4)
    try {
      const fRes = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`)
      if (fRes.ok) {
        const feriados = await fRes.json()
        if (feriados.some((f: any) => f.date === hoje)) {
          console.log(`[prospectar-whatsapp] Feriado nacional: ${hoje} — pulando`)
          return new Response(JSON.stringify({ total: 0, enviados: 0, message: "Feriado nacional — prospecção pausada" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
      }
    } catch { /* API fora — prossegue normalmente */ }

    const limit = body.limit ?? 20
    const dryRun = body.dry_run ?? false
    const filtroUf = body.uf ?? null
    const filtroMeso = body.mesorregiao ?? null
    const filtroCidade = body.cidade ?? null
    const filtroSegmento = body.segmento ?? null

    if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
      return new Response(JSON.stringify({ error: "Z-API não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Buscar config de filtros salvos (tabela feature_flags como config store)
    if (!filtroUf && !filtroMeso && !filtroSegmento) {
      const { data: cfg } = await supabase
        .from("feature_flags")
        .select("config")
        .eq("flag", "prospectar_whatsapp_config")
        .single()
      if (cfg?.config) {
        const c = typeof cfg.config === "string" ? JSON.parse(cfg.config) : cfg.config
        if (c.uf) Object.assign(body, { uf: c.uf })
        if (c.mesorregiao) Object.assign(body, { mesorregiao: c.mesorregiao })
        if (c.cidade) Object.assign(body, { cidade: c.cidade })
        if (c.segmento) Object.assign(body, { segmento: c.segmento })
      }
    }
    const uf = body.uf ?? filtroUf
    const meso = body.mesorregiao ?? filtroMeso
    const cidade = body.cidade ?? filtroCidade
    const seg = body.segmento ?? filtroSegmento

    // Buscar prospects: WA validado, sem status_contato (nunca contactados)
    let query = supabase
      .from("prospeccao")
      .select("id, nome_fantasia, razao_social, segmento, cidade, whatsapp, telefone1, uf, mesorregiao")
      .eq("whatsapp_validado", true)
      .is("status_contato", null)
      .not("whatsapp", "is", null)
    if (uf) {
      const ufs = Array.isArray(uf) ? uf : [uf]
      query = query.in("uf", ufs)
    }
    if (meso) {
      const mesos = Array.isArray(meso) ? meso : [meso]
      query = query.in("mesorregiao", mesos)
    }
    if (cidade) {
      const cidades = Array.isArray(cidade) ? cidade : [cidade]
      query = query.in("cidade", cidades)
    }
    if (seg) {
      const segs = Array.isArray(seg) ? seg : [seg]
      if (segs.length === 1) {
        query = query.ilike("segmento", `%${segs[0]}%`)
      } else {
        query = query.or(segs.map(s => `segmento.ilike.%${s}%`).join(","))
      }
    }
    const { data: prospects } = await query.limit(limit)

    if (!prospects || prospects.length === 0) {
      return new Response(JSON.stringify({ total: 0, enviados: 0, message: "Nenhum prospect pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let enviados = 0
    const resultados: { id: number; nome: string; ok: boolean }[] = []

    for (const p of prospects) {
      const nome = p.nome_fantasia || p.razao_social || ""
      const tel = p.whatsapp || p.telefone1
      if (!tel || !nome) continue

      const msg = gerarMensagem(nome, p.segmento, p.cidade)

      let ok = false
      if (!dryRun) {
        ok = await enviarMensagem(tel, msg)
        if (ok) {
          // Marcar como contactado
          await supabase.from("prospeccao").update({
            status_contato: "Aguardando",
          }).eq("id", p.id)
          // Registrar atividade
          await supabase.from("activity_log").insert({
            prospect_id: p.id,
            tipo: "whatsapp_auto",
            canal: "whatsapp",
            detalhes: { segmento: p.segmento, cidade: p.cidade },
            created_by: "cron",
          })
          enviados++
        }
        // Rate limit Z-API
        await new Promise(ok => setTimeout(ok, 1500))
      } else {
        ok = true
        enviados++
      }

      resultados.push({ id: p.id, nome: limparNome(nome), ok })
    }

    console.log(`[prospectar-whatsapp] ${dryRun ? "DRY RUN — " : ""}Enviados: ${enviados}/${prospects.length}`)

    return new Response(JSON.stringify({ total: prospects.length, enviados, dry_run: dryRun, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
