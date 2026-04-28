const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_BASE = 'https://api.correios.com.br'

interface Remetente {
  nome: string
  cpfCnpj: string
  ddd: string
  celular: string
  endereco: {
    cep: string
    logradouro: string
    numero: string
    bairro: string
    cidade: string
    uf: string
    complemento?: string
  }
}

interface Destinatario {
  nome: string
  cpfCnpj?: string
  ddd: string
  celular: string
  email?: string
  endereco: {
    cep: string
    logradouro: string
    numero: string
    bairro: string
    cidade: string
    uf: string
    complemento?: string
  }
}

interface EtiquetaRequest {
  acao: 'criar-prepostagem' | 'gerar-rotulo' | 'consultar-rotulo' | 'gerar-dce' | 'cancelar'
  // Para criar-prepostagem
  destinatario?: Destinatario
  codigoServico?: string // 03220 SEDEX, 03298 PAC
  pesoGramas?: number
  comprimentoCm?: number
  larguraCm?: number
  alturaCm?: number
  valorDeclarado?: number
  descricaoConteudo?: string
  quantidade?: number
  // Para gerar-rotulo / consultar-rotulo
  idPrePostagem?: string
  // Para cancelar
  codigoObjeto?: string
}

const REMETENTE: Remetente = {
  nome: 'POUSINOX LTDA',
  cpfCnpj: '12115379000164',
  ddd: '35',
  celular: '988888888',
  endereco: {
    cep: '37550360',
    logradouro: 'Av Antonio Mariosa',
    numero: '4545',
    bairro: 'Sao Geraldo',
    cidade: 'Pouso Alegre',
    uf: 'MG',
  },
}

async function autenticar(): Promise<string> {
  const cnpj = '12115379000164'
  const token = Deno.env.get('CORREIOS_API_TOKEN') ?? ''
  const cartao = Deno.env.get('CORREIOS_CARTAO') ?? '0080006566'

  if (!token) throw new Error('CORREIOS_API_TOKEN não configurado')

  const resp = await fetch(`${API_BASE}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(`${cnpj}:${token}`)}`,
    },
    body: JSON.stringify({ numero: cartao }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Auth falhou (${resp.status}): ${err}`)
  }

  const data = await resp.json()
  return data.token
}

async function criarPrePostagem(jwt: string, req: EtiquetaRequest) {
  if (!req.destinatario) throw new Error('destinatario obrigatório')

  const body = {
    remetente: REMETENTE,
    destinatario: req.destinatario,
    codigoServico: req.codigoServico || '03220',
    pesoInformado: String(req.pesoGramas || 1000),
    codigoFormatoObjetoInformado: '1', // caixa
    cienteObjetoNaoProibido: '1',
    modalidadePagamento: '1', // à vista
    logisticaReversa: 'N',
    itensDeclaracaoConteudo: [{
      conteudo: req.descricaoConteudo || 'Equipamento em aco inox',
      quantidade: String(req.quantidade || 1),
      valor: String((req.valorDeclarado || 100).toFixed(2)),
    }],
  }

  const resp = await fetch(`${API_BASE}/prepostagem/v1/prepostagens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })

  const text = await resp.text()
  if (!resp.ok) throw new Error(`Pre-postagem falhou (${resp.status}): ${text}`)

  try {
    return JSON.parse(text)
  } catch {
    // API returns plain ID string sometimes
    return { id: text.replace(/"/g, '') }
  }
}

async function gerarRotulo(jwt: string, idPrePostagem: string) {
  const body = {
    idsPrePostagem: [idPrePostagem],
    tipoRotulo: 'P',
    formatoRotulo: 'ET',
    layoutImpressao: 'PADRAO',
    imprimeRemetente: 'S',
    numeroCartaoPostagem: Deno.env.get('CORREIOS_CARTAO') ?? '0080006566',
  }

  const resp = await fetch(`${API_BASE}/prepostagem/v1/prepostagens/rotulo/assincrono/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })

  const text = await resp.text()
  if (!resp.ok) throw new Error(`Rotulo falhou (${resp.status}): ${text}`)

  try {
    return JSON.parse(text)
  } catch {
    return { idRecibo: text.replace(/"/g, '') }
  }
}

async function consultarRotulo(jwt: string, idRecibo: string) {
  // Endpoint: /rotulo/download/assincrono/{idRecibo} — returns JSON with "dados" (base64 PDF)
  const resp = await fetch(`${API_BASE}/prepostagem/v1/prepostagens/rotulo/download/assincrono/${idRecibo}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwt}`,
    },
  })

  if (!resp.ok) {
    const text = await resp.text()
    // 404 usually means still processing
    if (resp.status === 404) {
      return { status: 'processando', idRecibo }
    }
    throw new Error(`Consulta rotulo falhou (${resp.status}): ${text}`)
  }

  const data = await resp.json()
  if (data.dados) {
    return { status: 'pronto', pdf_base64: data.dados }
  }

  return { status: 'processando', idRecibo, ...data }
}

async function gerarDce(jwt: string, idPrePostagem: string) {
  const url = `${API_BASE}/prepostagem/v1/prepostagens/declaracaoconteudo/${idPrePostagem}`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/pdf',
    },
  })

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    throw new Error(`DCe falhou (${resp.status}): ${errBody.slice(0, 300)}`)
  }

  const buffer = await resp.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { status: 'pronto', pdf_base64: btoa(binary) }

  throw new Error(`DCe: nenhum endpoint funcionou. Tentativas: ${errors.join(' | ')}`)
}

async function cancelarPrePostagem(jwt: string, idPrePostagem: string) {
  const resp = await fetch(`${API_BASE}/prepostagem/v1/prepostagens/${idPrePostagem}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${jwt}`,
    },
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Cancelamento falhou (${resp.status}): ${text}`)
  }

  return { cancelado: true, id: idPrePostagem }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: EtiquetaRequest = await req.json()
    const { acao } = body

    if (!acao) {
      return new Response(
        JSON.stringify({ error: 'Campo "acao" obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const jwt = await autenticar()

    let resultado: unknown

    switch (acao) {
      case 'criar-prepostagem':
        resultado = await criarPrePostagem(jwt, body)
        break
      case 'gerar-rotulo':
        if (!body.idPrePostagem) throw new Error('idPrePostagem obrigatório')
        resultado = await gerarRotulo(jwt, body.idPrePostagem)
        break
      case 'consultar-rotulo':
        if (!body.idPrePostagem) throw new Error('idPrePostagem (idRecibo) obrigatório')
        resultado = await consultarRotulo(jwt, body.idPrePostagem)
        break
      case 'gerar-dce':
        if (!body.idPrePostagem) throw new Error('idPrePostagem obrigatório')
        resultado = await gerarDce(jwt, body.idPrePostagem)
        break
      case 'cancelar':
        if (!body.idPrePostagem) throw new Error('idPrePostagem obrigatório')
        resultado = await cancelarPrePostagem(jwt, body.idPrePostagem)
        break
      default:
        throw new Error(`Ação desconhecida: ${acao}`)
    }

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
