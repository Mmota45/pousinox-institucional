import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'
import styles from './ViewOrcamento.module.css'

interface OrcData {
  id: number; numero: string; status: string
  empresa_nome: string | null; empresa_razao_social: string | null; empresa_cnpj: string | null
  empresa_endereco: string | null; empresa_numero: string | null; empresa_telefone: string | null
  empresa_email: string | null; empresa_site: string | null; empresa_logo_url: string | null
  vendedor_nome: string | null; vendedor_telefone: string | null
  cliente_nome: string | null; cliente_empresa: string | null; cliente_cnpj: string | null
  cliente_telefone: string | null; cliente_email: string | null
  cliente_logradouro: string | null; cliente_numero: string | null; cliente_bairro: string | null
  cliente_cidade: string | null; cliente_uf: string | null; cliente_cep: string | null
  cliente_tipo_pessoa: string | null; cliente_cargo: string | null
  cliente_whatsapp: string | null; cliente_inscricao_est: string | null
  cliente_email_nf: string | null; cliente_contatos: { tipo: string; valor: string }[] | null
  cliente_ent_logradouro: string | null; cliente_ent_numero: string | null; cliente_ent_complemento: string | null
  cliente_ent_bairro: string | null; cliente_ent_cidade: string | null; cliente_ent_uf: string | null; cliente_ent_cep: string | null
  cliente_ent_responsavel: string | null; cliente_ent_telefone: string | null; cliente_ent_whatsapp: string | null
  frete_tipo: string | null; frete_modalidade: string | null; frete_valor: number | null; frete_prazo: string | null; frete_obs: string | null
  inst_inclui: boolean | null; inst_modalidade: string | null; inst_valor: number | null; inst_texto: string | null
  exibir_config: Record<string, boolean> | null
  desconto: number; tipo_desconto: string; total: number
  condicao_pagamento: string | null; prazo_entrega: string | null; validade_dias: number; dados_pagamento: string | null
  observacoes: string | null; watermark_ativo: boolean; watermark_texto: string | null
  watermark_logo: boolean; imagem_url: string | null; criado_em: string
  itens: {
    descricao: string; qtd: number; unidade: string; valor_unit: number
    imagem_url: string | null; preco_original: number | null; obs_tecnica: string | null
  }[]
}

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

const FRETE_TIPOS: Record<string, string> = {
  'CIF': 'CIF — Por conta do fornecedor', 'FOB': 'FOB — Por conta do comprador',
  'retirada': 'Retirada na fábrica', 'cliente': 'Por conta do cliente', 'a_combinar': 'A combinar',
}

const EXIBIR_DEFAULT: Record<string, boolean> = {
  cnpj: false, inscricaoEstadual: false, telefone: true, whatsapp: false, email: false,
  emailNf: false, contatosAdicionais: false,
  cargo: false, endereco: false, enderecoEntrega: false, entResponsavel: false,
  obsTecnicaItens: false, instMontagem: false, anexos: false, detalhesLogistica: false,
}


function IcoCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IcoCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}

function IcoTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}

function IcoCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IcoWrench() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function IcoShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7aa3c8" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IcoWA({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.557 4.113 1.528 5.833L0 24l6.335-1.51A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.003-1.372l-.36-.214-3.72.887.934-3.617-.235-.372A9.818 9.818 0 0 1 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
    </svg>
  )
}

function IcoMailSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  )
}

function IcoDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export default function ViewOrcamento() {
  const { token } = useParams<{ token: string }>()
  const [orc, setOrc] = useState<OrcData | null>(null)
  const [erro, setErro] = useState('')
  const [linkId, setLinkId] = useState('')
  const [orcId, setOrcId] = useState<number | null>(null)
  const [downloads, setDownloads] = useState(0)

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); return }
    load()
  }, [token])

  async function load() {
    const { data: link } = await supabaseAdmin
      .from('orcamento_links')
      .select('id, orcamento_id, ativo, visualizacoes, downloads')
      .eq('token', token)
      .single()

    if (!link) { setErro('Este link não existe ou foi removido.'); return }
    const l = link as any
    if (!l.ativo) { setErro('Este link foi desativado.'); return }

    setLinkId(l.id)
    setOrcId(l.orcamento_id)
    setDownloads(l.downloads ?? 0)

    const now = new Date().toISOString()
    await supabaseAdmin.from('orcamento_links').update({
      visualizacoes: (l.visualizacoes ?? 0) + 1,
      ultimo_acesso: now,
      ...(l.primeiro_acesso ? {} : { primeiro_acesso: now }),
    }).eq('id', l.id)

    // Log de acesso individual — fire-and-forget
    ;(async () => {
      let ip: string | null = null
      try {
        const r = await fetch('https://api.ipify.org?format=json')
        const j = await r.json()
        ip = j.ip ?? null
      } catch { /* sem IP */ }
      await supabaseAdmin.from('orcamento_link_acessos').insert({
        link_id: l.id,
        acessado_em: now,
        ip,
        user_agent: navigator.userAgent,
      })
    })()

    const [{ data: orcRow }, { data: itensD }] = await Promise.all([
      supabaseAdmin.from('orcamentos').select('*').eq('id', l.orcamento_id).single(),
      supabaseAdmin.from('itens_orcamento').select('*').eq('orcamento_id', l.orcamento_id).order('ordem'),
    ])

    if (!orcRow) { setErro('Proposta não encontrada.'); return }
    const o = orcRow as any
    setOrc({
      ...o,
      itens: (itensD ?? []).map((i: any) => ({
        descricao: i.descricao, qtd: Number(i.qtd), unidade: i.unidade,
        valor_unit: Number(i.valor_unit), imagem_url: i.imagem_url ?? null,
        preco_original: i.preco_original ? Number(i.preco_original) : null,
        obs_tecnica: i.obs_tecnica ?? null,
      })),
    })
  }

  async function baixarPdf() {
    if (!orcId || !linkId) return
    await supabaseAdmin.from('orcamento_links').update({ downloads: downloads + 1 }).eq('id', linkId)
    setDownloads(d => d + 1)
    window.open(`/print/orcamento/${orcId}`, '_blank')
  }

  if (erro) return (
    <div className={styles.erroWrap}>
      <div className={styles.erroCard}>
        <div className={styles.erroIcone}>🔒</div>
        <div className={styles.erroTitulo}>Link indisponível</div>
        <div className={styles.erroMsg}>{erro}</div>
      </div>
    </div>
  )

  if (!orc) return (
    <div className={styles.erroWrap}>
      <div className={styles.erroCard}>
        <div className={styles.erroMsg}>Carregando proposta…</div>
      </div>
    </div>
  )

  const exibir = { ...EXIBIR_DEFAULT, ...(orc.exibir_config ?? {}) }
  const subtotal = orc.itens.reduce((s, i) => s + i.qtd * i.valor_unit, 0)
  const valorDesc = orc.tipo_desconto === '%' ? subtotal * (orc.desconto / 100) : Math.min(orc.desconto, subtotal)
  const fretoMod = orc.frete_modalidade ?? 'cobrar'
  const instMod = orc.inst_modalidade ?? 'cobrar'
  const valorFrete = fretoMod === 'cobrar' ? (orc.frete_valor ?? 0) : 0
  const valorFreteBruto = orc.frete_valor ?? 0
  const valorInst = orc.inst_inclui ? (instMod === 'cobrar' ? (orc.inst_valor ?? 0) : 0) : 0
  const valorInstBruto = orc.inst_inclui ? (orc.inst_valor ?? 0) : 0
  const total = subtotal - valorDesc + valorFrete + valorInst
  const economiaPorItens = orc.itens.reduce((s, i) => {
    if (!i.preco_original || i.preco_original <= i.valor_unit) return s
    return s + (i.preco_original - i.valor_unit) * i.qtd
  }, 0)
  const temFrete = !!(orc.frete_tipo) || valorFreteBruto > 0
  const temInst = !!(orc.inst_inclui) && (!!orc.inst_texto || valorInstBruto > 0)
  const temEndEnt = exibir.enderecoEntrega && !!(orc.cliente_ent_logradouro || orc.cliente_ent_cep || orc.cliente_ent_responsavel)

  const hasAdvantages = valorDesc > 0 || economiaPorItens > 0 ||
    (fretoMod === 'bonus' && valorFreteBruto > 0) ||
    (temInst && instMod === 'bonus' && valorInstBruto > 0)

  const totalEconomia = valorDesc + economiaPorItens +
    (fretoMod === 'bonus' ? valorFreteBruto : 0) +
    (temInst && instMod === 'bonus' ? valorInstBruto : 0)

  const dataEmissao = new Date(orc.criado_em).toLocaleDateString('pt-BR')
  const dataValidade = (() => {
    const d = new Date(orc.criado_em); d.setDate(d.getDate() + (orc.validade_dias ?? 7))
    return d.toLocaleDateString('pt-BR')
  })()

  const empresaDisplay = orc.empresa_razao_social || orc.empresa_nome || 'Pousinox'
  const isPF = orc.cliente_tipo_pessoa === 'pf'
  const clienteDisplay = isPF
    ? (orc.cliente_nome || orc.cliente_empresa || 'Cliente')
    : (orc.cliente_empresa || orc.cliente_nome || 'Cliente')

  const enderecoEmpresa = (() => {
    const end = orc.empresa_endereco; const num = orc.empresa_numero
    if (!end) return null
    if (!num || end.includes(num)) return end
    const sep = end.includes(' - ') ? ' - ' : ' — '
    const idx = end.indexOf(sep)
    if (idx < 0) return `${end}, nº ${num}`
    return `${end.slice(0, idx)}, nº ${num}${end.slice(idx)}`
  })()

  const pageUrl = window.location.href
  const whatsappMsg = encodeURIComponent(`Olá! Recebi a proposta comercial da ${empresaDisplay} (Nº ${orc.numero}). Segue o link: ${pageUrl}`)
  const emailSubject = encodeURIComponent(`Proposta Comercial ${empresaDisplay} — Nº ${orc.numero}`)
  const emailBody = encodeURIComponent(`Olá,\n\nSegue o link da proposta comercial Nº ${orc.numero} da ${empresaDisplay}:\n${pageUrl}\n\nVálida até ${dataValidade}.`)

  let condicoesArr: string[] = []
  if (orc.condicao_pagamento) {
    try { condicoesArr = JSON.parse(orc.condicao_pagamento) } catch { condicoesArr = [orc.condicao_pagamento] }
  }

  const itensVisiveis = orc.itens.filter(i => i.descricao.trim())
  const telefoneContato = orc.vendedor_telefone || orc.empresa_telefone || ''
  const telefoneWA = telefoneContato.replace(/\D/g, '')

  const showCondicoes = condicoesArr.length > 0 || orc.prazo_entrega || orc.validade_dias ||
    (temInst && orc.inst_texto) || (temFrete && fretoMod === 'cobrar' && valorFrete > 0)

  return (
    <div className={styles.page}>

      {/* ── 1. Header ── */}
      <header className={styles.header}>
        <div className={styles.logoBox}>
          {orc.empresa_logo_url
            ? <img src={orc.empresa_logo_url} alt="Logo" className={styles.logo} />
            : <span className={styles.logoPlaceholder}>{(orc.empresa_nome ?? 'PX').slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div className={styles.companyData}>
          {orc.empresa_cnpj && <p><strong>CNPJ</strong> {orc.empresa_cnpj}</p>}
          {enderecoEmpresa && <p><strong>End.</strong> {enderecoEmpresa}</p>}
          {orc.empresa_telefone && <p><strong>Tel.</strong> {orc.empresa_telefone}</p>}
          {orc.empresa_email && <p><strong>E-mail</strong> {orc.empresa_email}</p>}
          {orc.empresa_site && <p><strong>Site</strong> {orc.empresa_site}</p>}
        </div>
      </header>

      {/* ── 2. Meta bar ── */}
      <div className={styles.metaBar}>
        <span className={styles.metaItem}>Proposta Comercial</span>
        <span className={styles.metaDot} />
        <span className={styles.metaItemBold}>Nº {orc.numero}</span>
        <span className={styles.metaDot} />
        <span className={styles.metaItem}>Válida até {dataValidade}</span>
      </div>

      <div className={styles.body}>

        {/* ── 3. Destinatário ── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Destinatário</p>
          <div className={styles.card}>
            <div className={styles.recipientRow}>
              <div className={styles.recipientData}>

                {/* 1. Nome da empresa / nome PF */}
                <p className={styles.recipientCompany}>{clienteDisplay}</p>

                {/* 2. Documentos: CNPJ/CPF · IE na mesma linha */}
                {(exibir.cnpj && orc.cliente_cnpj) || (exibir.inscricaoEstadual && orc.cliente_inscricao_est) ? (
                  <p className={styles.recipientDocs}>
                    {exibir.cnpj && orc.cliente_cnpj && (
                      <span><strong>{orc.cliente_tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}:</strong> {orc.cliente_cnpj}</span>
                    )}
                    {exibir.cnpj && orc.cliente_cnpj && exibir.inscricaoEstadual && orc.cliente_inscricao_est && (
                      <span className={styles.docSep}> · </span>
                    )}
                    {exibir.inscricaoEstadual && orc.cliente_inscricao_est && (
                      <span><strong>IE:</strong> {orc.cliente_inscricao_est}</span>
                    )}
                  </p>
                ) : null}

                {/* 3. Contatos: Tel. · WhatsApp na mesma linha */}
                {(exibir.telefone && orc.cliente_telefone) || (exibir.whatsapp && orc.cliente_whatsapp) ? (
                  <p className={styles.recipientContatos}>
                    {exibir.telefone && orc.cliente_telefone && (
                      <span><strong>Tel.:</strong> {orc.cliente_telefone}</span>
                    )}
                    {exibir.telefone && orc.cliente_telefone && exibir.whatsapp && orc.cliente_whatsapp && (
                      <span className={styles.docSep}> · </span>
                    )}
                    {exibir.whatsapp && orc.cliente_whatsapp && (
                      <span><strong>WhatsApp:</strong> {orc.cliente_whatsapp}</span>
                    )}
                  </p>
                ) : null}

                {/* 4. E-mail */}
                {exibir.email && orc.cliente_email && (
                  <p><strong>E-mail:</strong> {orc.cliente_email}</p>
                )}
                {exibir.emailNf && orc.cliente_email_nf && (
                  <p><strong>E-mail NFs/Boletos:</strong> {orc.cliente_email_nf}</p>
                )}

                {/* 5. Contatos adicionais */}
                {exibir.contatosAdicionais && orc.cliente_contatos && orc.cliente_contatos.length > 0 && orc.cliente_contatos.map((ct, i) => (
                  <p key={i}><strong>{ct.tipo === 'telefone' ? 'Tel.:' : ct.tipo === 'whatsapp' ? 'WhatsApp:' : 'E-mail:'}</strong> {ct.valor}</p>
                ))}

                {/* 6. A/C. responsável — só PJ */}
                {!isPF && orc.cliente_nome && (
                  <p className={styles.recipientAc}>
                    <strong>A/C.:</strong> {orc.cliente_nome}
                    {exibir.cargo && orc.cliente_cargo && (
                      <em className={styles.recipientCargo}> — {orc.cliente_cargo}</em>
                    )}
                  </p>
                )}

                {/* 7. Endereço */}
                {exibir.endereco && orc.cliente_logradouro && (
                  <p className={styles.recipientEndereco}>
                    {[orc.cliente_logradouro, orc.cliente_numero].filter(Boolean).join(', ')}
                    {orc.cliente_bairro ? ` — ${orc.cliente_bairro}` : ''}
                  </p>
                )}
                {exibir.endereco && (orc.cliente_cidade || orc.cliente_uf || orc.cliente_cep) && (
                  <p className={styles.recipientCidade}>
                    {orc.cliente_cidade && orc.cliente_uf
                      ? `${orc.cliente_cidade} / ${orc.cliente_uf}`
                      : orc.cliente_cidade || orc.cliente_uf || ''}
                    {orc.cliente_cep ? ` · CEP ${orc.cliente_cep}` : ''}
                  </p>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* Endereço de entrega */}
        {temEndEnt && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Local de Entrega</p>
            <div className={styles.card}>
              {exibir.entResponsavel && (orc.cliente_ent_responsavel || orc.cliente_ent_telefone || orc.cliente_ent_whatsapp) && (
                <p>
                  {orc.cliente_ent_responsavel && <><strong>Resp.</strong> {orc.cliente_ent_responsavel}</>}
                  {orc.cliente_ent_telefone && <> · <strong>Tel.</strong> {orc.cliente_ent_telefone}</>}
                  {orc.cliente_ent_whatsapp && <> · <strong>WhatsApp</strong> {orc.cliente_ent_whatsapp}</>}
                </p>
              )}
              <p className={styles.entregaText}>
                {[orc.cliente_ent_logradouro, orc.cliente_ent_numero].filter(Boolean).join(', ')}
                {orc.cliente_ent_complemento ? `, ${orc.cliente_ent_complemento}` : ''}
                {orc.cliente_ent_bairro ? ` — ${orc.cliente_ent_bairro}` : ''}
                {orc.cliente_ent_cidade ? ` · ${orc.cliente_ent_cidade}` : ''}
                {orc.cliente_ent_uf ? `/${orc.cliente_ent_uf}` : ''}
                {orc.cliente_ent_cep ? ` · CEP ${orc.cliente_ent_cep}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* ── 4. Itens ── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>
            {itensVisiveis.length === 1 ? 'Item da Proposta' : `Itens da Proposta (${itensVisiveis.length})`}
          </p>
          {itensVisiveis.map((item, idx) => (
            <div key={idx} className={styles.itemCard}>
              {itensVisiveis.length > 1 && (
                <div className={styles.itemBadge}>
                  <IcoCheck />
                  Item {idx + 1} de {itensVisiveis.length}
                </div>
              )}
              {item.imagem_url && (
                <img src={item.imagem_url} alt="" className={styles.itemImage} />
              )}
              <p className={styles.itemDesc}>{item.descricao}</p>
              {exibir.obsTecnicaItens && item.obs_tecnica && (
                <p className={styles.obsTecnica}>{item.obs_tecnica}</p>
              )}
              <div className={styles.itemGrid}>
                <div className={styles.itemGridCell}>
                  <p className={styles.gLabel}>Quantidade</p>
                  <p className={styles.gValue}>{item.qtd}</p>
                </div>
                <div className={styles.itemGridCell}>
                  <p className={styles.gLabel}>Unidade</p>
                  <p className={styles.gValue}>{item.unidade}</p>
                </div>
                <div className={styles.itemGridCell}>
                  <p className={styles.gLabel}>Vlr. Unit.</p>
                  {item.preco_original && item.preco_original > item.valor_unit && (
                    <span className={styles.precoOriginal}>{fmtBRL(item.preco_original)}</span>
                  )}
                  <p className={styles.gValue}>{item.valor_unit > 0 ? fmtBRL(item.valor_unit) : '—'}</p>
                </div>
              </div>
              <div className={styles.itemTotalRow}>
                <span className={styles.itemTotalLabel}>Total do item</span>
                <span className={styles.itemTotalValue}>
                  {item.qtd > 0 && item.valor_unit > 0 ? fmtBRL(item.qtd * item.valor_unit) : '—'}
                </span>
              </div>
            </div>
          ))}
          {itensVisiveis.length > 1 && (
            <div className={styles.subtotalRow}>
              <span>Subtotal</span>
              <span className={styles.subtotalValue}>{fmtBRL(subtotal)}</span>
            </div>
          )}
        </div>

        {/* ── 5. Vantagens ── */}
        {hasAdvantages && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Vantagens desta proposta</p>
            <div className={styles.card}>
              {economiaPorItens > 0 && (
                <div className={styles.advantageRow}>
                  <div className={styles.advLeft}>
                    <div className={styles.advCheck}><IcoCheck /></div>
                    <div>
                      <p className={styles.advName}>Preço especial nos itens</p>
                      <p className={styles.advSub}>Abaixo do preço de tabela</p>
                    </div>
                  </div>
                  <div className={styles.advRight}>
                    <p className={styles.advOriginal}>{fmtBRL(economiaPorItens)}</p>
                  </div>
                </div>
              )}

              {valorDesc > 0 && (
                <div className={styles.advantageRow}>
                  <div className={styles.advLeft}>
                    <div className={styles.advCheck}><IcoCheck /></div>
                    <div>
                      <p className={styles.advName}>Desconto</p>
                      <p className={styles.advSub}>Aplicado no total</p>
                    </div>
                  </div>
                  <div className={styles.advRight}>
                    <p className={styles.advOriginal}>−{fmtBRL(valorDesc)}</p>
                  </div>
                </div>
              )}

              {fretoMod === 'bonus' && valorFreteBruto > 0 && (
                <div className={styles.advantageRow}>
                  <div className={styles.advLeft}>
                    <div className={styles.advCheck}><IcoCheck /></div>
                    <div>
                      <p className={styles.advName}>Frete Bonificado</p>
                      <p className={styles.advSub}>
                        {orc.frete_tipo ? (FRETE_TIPOS[orc.frete_tipo] ?? orc.frete_tipo) : 'Entrega inclusa'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.advRight}>
                    <p className={styles.advOriginal}>{fmtBRL(valorFreteBruto)}</p>
                  </div>
                </div>
              )}

              {temInst && instMod === 'bonus' && valorInstBruto > 0 && (
                <div className={styles.advantageRow}>
                  <div className={styles.advLeft}>
                    <div className={styles.advCheck}><IcoCheck /></div>
                    <div>
                      <p className={styles.advName}>Instalação Bonificada</p>
                      <p className={styles.advSub}>{orc.inst_texto ?? 'Serviço técnico incluso'}</p>
                    </div>
                  </div>
                  <div className={styles.advRight}>
                    <p className={styles.advOriginal}>{fmtBRL(valorInstBruto)}</p>
                  </div>
                </div>
              )}

              {totalEconomia > 0 && (
                <div className={styles.savingsBar}>
                  <span className={styles.savingsLabel}>Economia total</span>
                  <span className={styles.savingsValue}>{fmtBRL(totalEconomia)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 6. Total final ── */}
        <div className={styles.section}>
          <div className={styles.totalCard}>
            <div>
              <p className={styles.totalLabel}>Total da proposta</p>
              <p className={styles.totalValue}>{fmtBRL(total)}</p>
              {condicoesArr.length > 0 && (
                <p className={styles.totalSub}>{condicoesArr.join(' · ')}</p>
              )}
            </div>
            <div className={styles.totalShield}><IcoShield /></div>
          </div>
        </div>

        {/* ── 7. Condições comerciais ── */}
        {showCondicoes && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Condições Comerciais</p>
            <div className={styles.card}>
              <div className={styles.condList}>
                {condicoesArr.length > 0 && (
                  <div className={styles.condRow}>
                    <div className={styles.condIcon}><IcoCard /></div>
                    <div>
                      <p className={styles.condLabel}>Pagamento</p>
                      <p className={styles.condValue}>{condicoesArr.join(' · ')}</p>
                    </div>
                  </div>
                )}
                {orc.dados_pagamento && (
                  <div className={styles.condRow}>
                    <div className={styles.condIcon}><IcoCard /></div>
                    <div>
                      <p className={styles.condLabel}>Dados para pagamento</p>
                      <p className={styles.condValue} style={{ whiteSpace: 'pre-line' }}>{orc.dados_pagamento}</p>
                    </div>
                  </div>
                )}
                {orc.prazo_entrega && (
                  <div className={styles.condRow}>
                    <div className={styles.condIcon}><IcoTruck /></div>
                    <div>
                      <p className={styles.condLabel}>Prazo de Entrega</p>
                      <p className={styles.condValue}>{orc.prazo_entrega}</p>
                    </div>
                  </div>
                )}
                {temFrete && fretoMod === 'cobrar' && valorFrete > 0 && (
                  <div className={styles.condRow}>
                    <div className={styles.condIcon}><IcoTruck /></div>
                    <div>
                      <p className={styles.condLabel}>Frete</p>
                      <p className={styles.condValue}>
                        {orc.frete_tipo ? (FRETE_TIPOS[orc.frete_tipo] ?? orc.frete_tipo) : ''} · {fmtBRL(valorFrete)}
                      </p>
                    </div>
                  </div>
                )}
                {temInst && orc.inst_texto && instMod === 'cobrar' && (
                  <div className={styles.condRow}>
                    <div className={styles.condIcon}><IcoWrench /></div>
                    <div>
                      <p className={styles.condLabel}>Instalação</p>
                      <p className={styles.condValue}>{orc.inst_texto}{valorInst > 0 ? ` · ${fmtBRL(valorInst)}` : ''}</p>
                    </div>
                  </div>
                )}
                <div className={styles.condRow}>
                  <div className={styles.condIcon}><IcoCalendar /></div>
                  <div>
                    <p className={styles.condLabel}>Validade da Proposta</p>
                    <p className={styles.condValue}>{orc.validade_dias} dias — até {dataValidade}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 8. Observações ── */}
        {orc.observacoes && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Observações</p>
            <div className={styles.card}>
              <p className={styles.obsText}>{orc.observacoes}</p>
            </div>
          </div>
        )}

        {/* ── 9. Assinatura + Contato comercial ── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Confirmação &amp; Contato</p>
          <div className={styles.sigSection}>
            <div className={styles.sigCard}>
              <p className={styles.sigCardLabel}>Assinatura do cliente</p>
              <div className={styles.sigSpacer} />
              <div className={styles.sigLine} />
              <p className={styles.sigName}>{clienteDisplay}</p>
            </div>
            <div className={styles.comercialCard}>
              <p className={styles.sigCardLabel}>Consultor</p>
              {orc.vendedor_nome && <p className={styles.comercialName}>{orc.vendedor_nome}</p>}
              <p className={styles.comercialRole}>{empresaDisplay}</p>
              {telefoneContato && (
                <a href={`https://wa.me/${telefoneWA.startsWith('55') ? telefoneWA : '55' + telefoneWA}`} target="_blank" rel="noopener noreferrer" className={styles.telContact}>
                  <IcoWA size={14} />
                  <span className={styles.waContactText}>{telefoneContato}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── 10. CTAs ── */}
        <div className={styles.ctas}>
          <a
            href={`https://wa.me/?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            <IcoWA size={20} />
            Enviar pelo WhatsApp
          </a>
          <a
            href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            <IcoMailSend />
            Enviar por E-mail
          </a>
          <button onClick={baixarPdf} className={`${styles.btn} ${styles.btnGhost}`}>
            <IcoDownload />
            Baixar / Imprimir PDF
          </button>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <p>Proposta Nº {orc.numero} · Emitida em {dataEmissao}</p>
          {(orc.empresa_email || orc.empresa_site) && (
            <p>{[orc.empresa_email, orc.empresa_site].filter(Boolean).join(' · ')}</p>
          )}
          <p>Este link é pessoal e intransferível. Válido até {dataValidade}.</p>
        </div>

      </div>
    </div>
  )
}
