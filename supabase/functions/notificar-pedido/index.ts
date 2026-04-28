const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificacaoRequest {
  pedido_id: number
  evento: string // criado, pago, preparando, enviado, entregue, cancelado
}

const ASSUNTOS: Record<string, string> = {
  criado: 'Pedido recebido — Pousinox',
  pago: 'Pagamento confirmado — Pousinox',
  preparando: 'Pedido em preparação — Pousinox',
  enviado: 'Pedido enviado — Pousinox',
  entregue: 'Pedido entregue — Pousinox',
  cancelado: 'Pedido cancelado — Pousinox',
}

function gerarHtml(pedido: Record<string, unknown>, itens: Record<string, unknown>[], evento: string, dadosBancarios: Record<string, unknown> | null): string {
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const nome = pedido.cliente_nome as string
  const codigo = pedido.codigo as string
  const total = pedido.total as number
  const subtotal = pedido.subtotal as number
  const frete = pedido.frete_preco as number
  const freteServico = pedido.frete_servico as string
  const rastreio = pedido.codigo_rastreio as string | null

  let corpo = ''

  switch (evento) {
    case 'criado':
      corpo = `
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Recebemos seu pedido <strong>${codigo}</strong>!</p>
        <h3>Resumo</h3>
        ${itens.map(it => `<p>${it.titulo} (${it.quantidade}×) — R$ ${fmtBRL(it.subtotal as number)}</p>`).join('')}
        <p>Frete (${freteServico}): ${frete === 0 ? 'Grátis' : `R$ ${fmtBRL(frete)}`}</p>
        <p><strong>Total: R$ ${fmtBRL(total)}</strong></p>
        ${dadosBancarios ? `
          <h3>Dados para pagamento via Pix</h3>
          <p><strong>Chave Pix:</strong> ${dadosBancarios.pix_chave}</p>
          <p><strong>Titular:</strong> ${dadosBancarios.titular}</p>
          ${dadosBancarios.banco ? `<p><strong>Banco:</strong> ${dadosBancarios.banco}</p>` : ''}
          <p><strong>Valor:</strong> R$ ${fmtBRL(total)}</p>
        ` : ''}
        <p>Após o pagamento, confirmaremos em até 1 dia útil.</p>
      `
      break
    case 'pago':
      corpo = `
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Seu pagamento do pedido <strong>${codigo}</strong> foi confirmado!</p>
        <p>Estamos preparando seu envio.</p>
        <p><strong>Total pago: R$ ${fmtBRL(total)}</strong></p>
      `
      break
    case 'enviado':
      corpo = `
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Seu pedido <strong>${codigo}</strong> foi enviado!</p>
        ${rastreio ? `
          <p><strong>Código de rastreio:</strong> ${rastreio}</p>
          <p><a href="https://www.linkcorreios.com.br/?id=${rastreio}">Clique aqui para rastrear</a></p>
        ` : ''}
        <p>Frete: ${freteServico}</p>
      `
      break
    case 'entregue':
      corpo = `
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Seu pedido <strong>${codigo}</strong> foi entregue!</p>
        <p>Obrigado por comprar na Pousinox!</p>
      `
      break
    case 'cancelado':
      corpo = `
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Seu pedido <strong>${codigo}</strong> foi cancelado.</p>
        <p>Se tiver dúvidas, entre em contato conosco.</p>
      `
      break
    default:
      corpo = `<p>Atualização do pedido ${codigo}.</p>`
  }

  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1a3a5c; margin: 0;">Pousinox</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin: 4px 0 0;">Fixadores em Aço Inox</p>
      </div>
      ${corpo}
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
    const { pedido_id, evento }: NotificacaoRequest = await req.json()
    if (!pedido_id || !evento) {
      return new Response(JSON.stringify({ error: 'pedido_id e evento obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

    // Buscar pedido + itens + dados bancários
    const [pedidoResp, itensResp, bancoResp] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/pedidos_outlet?id=eq.${pedido_id}&limit=1`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/pedidos_outlet_itens?pedido_id=eq.${pedido_id}`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/dados_bancarios?ativo=eq.true&order=ordem.asc&limit=1`, { headers }),
    ])

    const pedidos = await pedidoResp.json()
    const itens = await itensResp.json()
    const bancos = await bancoResp.json()

    if (!pedidos.length) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pedido = pedidos[0]
    const dadosBancarios = bancos.length ? bancos[0] : null

    // Gerar link WhatsApp
    const tel = (pedido.cliente_telefone as string).replace(/\D/g, '')
    const telFull = tel.startsWith('55') ? tel : `55${tel}`
    const whatsappUrl = `https://wa.me/${telFull}`

    // Enviar email via Resend
    let emailEnviado = false
    const ADMIN_EMAIL = 'adm@pousinox.com.br'
    const ADMIN_WHATSAPP = '5535999619463'

    if (resendKey && pedido.cliente_email) {
      try {
        const html = gerarHtml(pedido, itens, evento, dadosBancarios)
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Pousinox <noreply@pousinox.com.br>',
            to: pedido.cliente_email,
            subject: ASSUNTOS[evento] ?? `Pedido ${pedido.codigo} — Pousinox`,
            html,
          }),
        })
        emailEnviado = emailResp.ok
        if (!emailResp.ok) console.error('Resend erro:', await emailResp.text())
      } catch (e) {
        console.error('Email erro:', (e as Error).message)
      }
    }

    // Notificar admin por email quando pedido criado
    let adminEmailEnviado = false
    if (resendKey && evento === 'criado') {
      try {
        const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        const adminHtml = `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a3a5c; margin: 0 0 16px;">Novo pedido recebido!</h2>
            <p><strong>Pedido:</strong> ${pedido.codigo}</p>
            <p><strong>Cliente:</strong> ${pedido.cliente_nome}</p>
            <p><strong>Email:</strong> ${pedido.cliente_email}</p>
            <p><strong>Telefone:</strong> ${pedido.cliente_telefone}</p>
            <p><strong>Destino:</strong> ${pedido.cliente_cidade}/${pedido.cliente_uf}</p>
            <p><strong>Total:</strong> R$ ${fmtBRL(pedido.total as number)}</p>
            <p><strong>Frete:</strong> ${pedido.frete_servico} — R$ ${fmtBRL(pedido.frete_preco as number)}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p>
              <a href="https://wa.me/${telFull}" style="color: #16a34a; font-weight: 700;">WhatsApp do cliente</a> ·
              <a href="https://pousinox.com.br/admin/pedidos-outlet" style="color: #1a5fa8; font-weight: 700;">Ver no admin</a>
            </p>
          </div>
        `
        const adminResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Pousinox <noreply@pousinox.com.br>',
            to: ADMIN_EMAIL,
            subject: `Novo pedido ${pedido.codigo} — ${pedido.cliente_nome}`,
            html: adminHtml,
          }),
        })
        adminEmailEnviado = adminResp.ok
      } catch (e) {
        console.error('Admin email erro:', (e as Error).message)
      }
    }

    // Link WhatsApp do admin (para o admin receber notificação)
    const adminWhatsappMsg = evento === 'criado'
      ? encodeURIComponent(`Novo pedido ${pedido.codigo}! Cliente: ${pedido.cliente_nome}, Total: R$ ${(pedido.total as number).toFixed(2)}`)
      : ''
    const adminWhatsappUrl = evento === 'criado' ? `https://wa.me/${ADMIN_WHATSAPP}?text=${adminWhatsappMsg}` : ''

    return new Response(JSON.stringify({
      ok: true,
      email_enviado: emailEnviado,
      admin_email_enviado: adminEmailEnviado,
      admin_whatsapp_url: adminWhatsappUrl,
      whatsapp_url: whatsappUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
