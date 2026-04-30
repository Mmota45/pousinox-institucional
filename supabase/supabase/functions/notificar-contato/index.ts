const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContatoRequest {
  nome: string
  email: string
  telefone?: string
  empresa?: string
  mensagem: string
  origem: string // contato | newsletter | calculadora | orcamento
  segmento?: string
  cidade?: string
  uf?: string
}

const ADMIN_EMAIL = 'marcos.mota@pousinox.com.br'
const ADMIN_WHATSAPP = '5535999619463'
const BANNER_URL = 'https://pousinox.com.br/og-image.jpg'

function gerarHtmlAdmin(dados: ContatoRequest): string {
  const campos = [
    ['Nome', dados.nome],
    ['Email', dados.email],
    dados.telefone ? ['Telefone', dados.telefone] : null,
    dados.empresa ? ['Empresa', dados.empresa] : null,
    dados.segmento ? ['Segmento', dados.segmento] : null,
    dados.cidade && dados.uf ? ['Cidade/UF', `${dados.cidade}/${dados.uf}`] : null,
    ['Origem', dados.origem],
  ].filter(Boolean) as [string, string][]

  const tel = dados.telefone?.replace(/\D/g, '') ?? ''
  const telFull = tel.startsWith('55') ? tel : `55${tel}`

  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1a3a5c; margin: 0;">Novo contato recebido</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin: 4px 0 0;">Pousinox — Fixadores em Aco Inox</p>
      </div>
      ${campos.map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('')}
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #334155;">${dados.mensagem.replace(/\n/g, '<br/>')}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
      <p>
        ${tel ? `<a href="https://wa.me/${telFull}" style="color: #16a34a; font-weight: 700;">WhatsApp</a> · ` : ''}
        <a href="mailto:${dados.email}" style="color: #1a5fa8; font-weight: 700;">Responder email</a> ·
        <a href="https://pousinox.com.br/admin/leads" style="color: #1a5fa8; font-weight: 700;">Ver leads</a>
      </p>
    </div>
  `
}

function gerarHtmlCliente(dados: ContatoRequest): string {
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1a3a5c; margin: 0;">Pousinox</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin: 4px 0 0;">Fixadores em Aco Inox</p>
      </div>
      <p>Ola <strong>${dados.nome}</strong>,</p>
      <p>Recebemos sua mensagem e retornaremos em breve!</p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #64748b; font-size: 0.85rem;"><em>"${dados.mensagem.length > 200 ? dados.mensagem.slice(0, 200) + '...' : dados.mensagem}"</em></p>
      </div>
      <p>Enquanto isso, conhca nossos produtos:</p>
      <p><a href="https://pousinox.com.br/produtos" style="color: #1a5fa8; font-weight: 600;">Ver catalogo completo</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 0.78rem; color: #94a3b8; text-align: center;">
        Pousinox — Pouso Alegre/MG<br/>
        <a href="https://pousinox.com.br" style="color: #1a5fa8;">pousinox.com.br</a>
      </p>
    </div>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const dados: ContatoRequest = await req.json()
    if (!dados.nome || !dados.email || !dados.mensagem) {
      return new Response(JSON.stringify({ error: 'nome, email e mensagem obrigatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID') ?? ''
    const zapiToken = Deno.env.get('ZAPI_TOKEN') ?? ''
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') ?? ''

    // 1. Salvar lead no Supabase
    let leadSalvo = false
    try {
      const leadResp = await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          nome: dados.nome,
          email: dados.email,
          telefone: dados.telefone || null,
          empresa: dados.empresa || null,
          mensagem: dados.mensagem,
          origem: dados.origem || 'contato',
          segmento: dados.segmento || null,
          cidade: dados.cidade || null,
          uf: dados.uf || null,
        }),
      })
      leadSalvo = leadResp.ok
      if (!leadResp.ok) console.error('Lead save erro:', await leadResp.text())
    } catch (e) {
      console.error('Lead save erro:', (e as Error).message)
    }

    // 2. Email para o admin
    let adminEmailEnviado = false
    if (resendKey) {
      try {
        const origemLabel: Record<string, string> = {
          contato: 'Formulario de Contato',
          newsletter: 'Newsletter',
          calculadora: 'Calculadora de Fixadores',
          orcamento: 'Solicitacao de Orcamento',
        }
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Pousinox <noreply@pousinox.com.br>',
            to: ADMIN_EMAIL,
            subject: `[${origemLabel[dados.origem] ?? dados.origem}] ${dados.nome}${dados.empresa ? ` — ${dados.empresa}` : ''}`,
            html: gerarHtmlAdmin(dados),
          }),
        })
        adminEmailEnviado = resp.ok
        if (!resp.ok) console.error('Admin email erro:', await resp.text())
      } catch (e) {
        console.error('Admin email erro:', (e as Error).message)
      }
    }

    // 3. Email de confirmacao para o cliente
    let clienteEmailEnviado = false
    if (resendKey && dados.origem !== 'newsletter') {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Pousinox <noreply@pousinox.com.br>',
            to: dados.email,
            subject: 'Recebemos sua mensagem — Pousinox',
            html: gerarHtmlCliente(dados),
          }),
        })
        clienteEmailEnviado = resp.ok
        if (!resp.ok) console.error('Cliente email erro:', await resp.text())
      } catch (e) {
        console.error('Cliente email erro:', (e as Error).message)
      }
    }

    // 4. WhatsApp rich notification para admin via Z-API (send-link = imagem + texto + botao)
    let whatsappEnviado = false
    if (zapiInstanceId && zapiToken) {
      try {
        const origemEmoji: Record<string, string> = {
          contato: '📩',
          newsletter: '📰',
          calculadora: '🧮',
          orcamento: '💰',
        }
        const emoji = origemEmoji[dados.origem] ?? '📩'
        const msgTexto = [
          `${emoji} *Novo contato — ${dados.origem.toUpperCase()}*`,
          '',
          `*Nome:* ${dados.nome}`,
          dados.empresa ? `*Empresa:* ${dados.empresa}` : null,
          dados.telefone ? `*Tel:* ${dados.telefone}` : null,
          `*Email:* ${dados.email}`,
          dados.cidade && dados.uf ? `*Local:* ${dados.cidade}/${dados.uf}` : null,
          '',
          `💬 _"${dados.mensagem.length > 150 ? dados.mensagem.slice(0, 150) + '...' : dados.mensagem}"_`,
        ].filter(Boolean).join('\n')

        const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-link`
        const resp = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiClientToken,
          },
          body: JSON.stringify({
            phone: ADMIN_WHATSAPP,
            message: msgTexto,
            image: BANNER_URL,
            linkUrl: `https://pousinox.com.br/admin/leads`,
            title: 'Ver no Admin',
            linkDescription: `Novo lead de ${dados.nome}`,
          }),
        })
        whatsappEnviado = resp.ok
        if (!resp.ok) console.error('Z-API erro:', await resp.text())
      } catch (e) {
        console.error('Z-API erro:', (e as Error).message)
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      lead_salvo: leadSalvo,
      admin_email: adminEmailEnviado,
      cliente_email: clienteEmailEnviado,
      whatsapp: whatsappEnviado,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
