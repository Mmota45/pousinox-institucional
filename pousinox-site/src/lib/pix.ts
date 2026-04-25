import QRCode from 'qrcode'

/**
 * Gera payload Pix no padrão EMV (BR Code) — compatível com todos os bancos.
 */
function emvField(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function crc16(payload: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
      else crc <<= 1
      crc &= 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function gerarPixPayload(opts: {
  chave: string
  nome: string       // max 25 chars
  cidade: string     // max 15 chars
  valor?: number
  txid?: string
}): string {
  const { valor, txid } = opts
  // Limpar chave: CNPJ/CPF/telefone sem formatação (só dígitos/email/@)
  const chave = opts.chave.replace(/[.\-\/\(\)\s]/g, '')
  const nome = opts.nome.slice(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const cidade = opts.cidade.slice(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Merchant Account Information (ID 26)
  const gui = emvField('00', 'br.gov.bcb.pix')
  const key = emvField('01', chave)
  const mai = emvField('26', gui + key)

  let payload = ''
  payload += emvField('00', '01')              // Payload Format Indicator
  payload += mai                                // Merchant Account Info
  payload += emvField('52', '0000')            // Merchant Category Code
  payload += emvField('53', '986')             // Transaction Currency (BRL)
  if (valor && valor > 0) {
    payload += emvField('54', valor.toFixed(2)) // Transaction Amount
  }
  payload += emvField('58', 'BR')              // Country Code
  payload += emvField('59', nome)              // Merchant Name
  payload += emvField('60', cidade)            // Merchant City

  // Additional Data (ID 62) — txid
  const tid = txid ?? '***'
  payload += emvField('62', emvField('05', tid))

  // CRC placeholder + cálculo
  payload += '6304'
  const checksum = crc16(payload)
  payload += checksum

  return payload
}

export async function gerarPixQRCodeDataUrl(opts: {
  chave: string
  nome: string
  cidade: string
  valor?: number
  txid?: string
}): Promise<string> {
  const payload = gerarPixPayload(opts)
  return QRCode.toDataURL(payload, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
}
