import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'
import styles from './ViewOrcamento.module.css'

interface OrcData {
  id: number; numero: string; status: string
  empresa_nome: string | null; empresa_razao_social: string | null; empresa_cnpj: string | null
  empresa_endereco: string | null; empresa_numero: string | null; empresa_telefone: string | null
  empresa_email: string | null; empresa_site: string | null; empresa_logo_url: string | null
  vendedor_nome: string | null
  cliente_nome: string | null; cliente_empresa: string | null; cliente_cnpj: string | null
  cliente_telefone: string | null; cliente_email: string | null
  cliente_logradouro: string | null; cliente_numero: string | null; cliente_bairro: string | null
  cliente_cidade: string | null; cliente_uf: string | null; cliente_cep: string | null
  cliente_tipo_pessoa: string | null; cliente_cargo: string | null
  cliente_ent_logradouro: string | null; cliente_ent_numero: string | null
  cliente_ent_bairro: string | null; cliente_ent_cidade: string | null; cliente_ent_uf: string | null; cliente_ent_cep: string | null
  frete_tipo: string | null; frete_modalidade: string | null; frete_valor: number | null; frete_prazo: string | null; frete_obs: string | null
  inst_inclui: boolean | null; inst_modalidade: string | null; inst_valor: number | null; inst_texto: string | null
  exibir_config: Record<string, boolean> | null
  desconto: number; tipo_desconto: string; total: number
  condicao_pagamento: string | null; prazo_entrega: string | null; validade_dias: number
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
  cargo: false, endereco: false, enderecoEntrega: false, obsTecnicaItens: false,
  instMontagem: false, anexos: false, detalhesLogistica: false,
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
  const hasImages = orc.itens.some(i => i.imagem_url)
  const temEndEnt = exibir.enderecoEntrega && !!(orc.cliente_ent_logradouro || orc.cliente_ent_cep)

  const dataEmissao = new Date(orc.criado_em).toLocaleDateString('pt-BR')
  const dataValidade = (() => {
    const d = new Date(orc.criado_em); d.setDate(d.getDate() + (orc.validade_dias ?? 7))
    return d.toLocaleDateString('pt-BR')
  })()

  const empresaDisplay = orc.empresa_razao_social || orc.empresa_nome || 'Pousinox'
  const clienteDisplay = orc.cliente_empresa || orc.cliente_nome || 'Cliente'

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

  return (
    <div className={styles.page}>
      {/* Barra superior */}
      <div className={styles.topBar}>
        <span className={styles.topBarInfo}>
          Proposta Nº {orc.numero} · {clienteDisplay}
        </span>
        <button onClick={baixarPdf} className={styles.topBarBtn}>
          ⬇ PDF
        </button>
      </div>

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            {orc.empresa_logo_url
              ? <img src={orc.empresa_logo_url} alt="Logo" className={styles.logo} />
              : <div className={styles.logoPlaceholder}>{(orc.empresa_nome ?? 'PX').slice(0, 2).toUpperCase()}</div>
            }
            <div className={styles.empresaInfo}>
              <span className={styles.empresaNome}>{empresaDisplay}</span>
              <span className={styles.empresaMeta}>
                {[orc.empresa_cnpj && `CNPJ ${orc.empresa_cnpj}`, enderecoEmpresa, orc.empresa_telefone].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.metaLabel}>Proposta Comercial</span>
            <span className={styles.metaNumero}>Nº {orc.numero}</span>
            <span className={styles.metaData}>Emissão: {dataEmissao} · Validade: {dataValidade}</span>
            {orc.vendedor_nome && <span className={styles.metaData}>Consultor: {orc.vendedor_nome}</span>}
          </div>
        </div>

        <div className={styles.accentLine} />

        {/* Destinatário */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Destinatário</div>
          <div className={styles.clienteBox}>
            {orc.cliente_empresa && <div className={styles.clienteNome}>{orc.cliente_empresa}</div>}
            <div className={styles.clienteMeta}>
              {orc.cliente_nome && <div>A/C.: {orc.cliente_cargo ? `${orc.cliente_nome} — ${orc.cliente_cargo}` : orc.cliente_nome}</div>}
              {exibir.cnpj && orc.cliente_cnpj && <div>{orc.cliente_tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}: {orc.cliente_cnpj}</div>}
              {exibir.telefone && orc.cliente_telefone && <div>Tel.: {orc.cliente_telefone}</div>}
              {exibir.email && orc.cliente_email && <div>E-mail: {orc.cliente_email}</div>}
              {exibir.endereco && orc.cliente_logradouro && (
                <div>
                  {[orc.cliente_logradouro, orc.cliente_numero].filter(Boolean).join(', ')}
                  {orc.cliente_bairro ? ` — ${orc.cliente_bairro}` : ''}
                  {orc.cliente_cidade ? ` · ${orc.cliente_cidade}` : ''}
                  {orc.cliente_uf ? `/${orc.cliente_uf}` : ''}
                  {orc.cliente_cep ? ` · CEP ${orc.cliente_cep}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Endereço entrega */}
        {temEndEnt && (
          <div className={styles.section} style={{ paddingTop: 0 }}>
            <div className={styles.sectionTitle}>Local de Entrega</div>
            <div className={styles.entregaBox}>
              <span style={{ fontSize: '0.78rem', color: '#334155' }}>
                {[orc.cliente_ent_logradouro, orc.cliente_ent_numero].filter(Boolean).join(', ')}
                {orc.cliente_ent_bairro ? ` — ${orc.cliente_ent_bairro}` : ''}
                {orc.cliente_ent_cidade ? ` · ${orc.cliente_ent_cidade}` : ''}
                {orc.cliente_ent_uf ? `/${orc.cliente_ent_uf}` : ''}
                {orc.cliente_ent_cep ? ` · CEP ${orc.cliente_ent_cep}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Itens */}
        <div className={styles.section} style={{ paddingBottom: 0 }}>
          <div className={styles.sectionTitle}>Itens da Proposta</div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                {hasImages && <th />}
                <th>Descrição</th>
                <th style={{ textAlign: 'center' }}>Qtd</th>
                <th style={{ textAlign: 'center' }}>Un</th>
                <th style={{ textAlign: 'right' }}>Vl. Unit.</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orc.itens.filter(i => i.descricao.trim()).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#94a3b8', textAlign: 'center', width: 28 }}>{idx + 1}</td>
                  {hasImages && (
                    <td style={{ padding: '4px 6px', width: 52 }}>
                      {item.imagem_url
                        ? <img src={item.imagem_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'block' }} />
                        : <div style={{ width: 44, height: 44 }} />}
                    </td>
                  )}
                  <td>
                    <div>{item.descricao}</div>
                    {exibir.obsTecnicaItens && item.obs_tecnica && (
                      <div className={styles.obsTecnica}>{item.obs_tecnica}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.qtd}</td>
                  <td style={{ textAlign: 'center' }}>{item.unidade}</td>
                  <td style={{ textAlign: 'right' }}>
                    {item.preco_original && item.preco_original > item.valor_unit && (
                      <span className={styles.precoOriginal}>{fmtBRL(item.preco_original)}</span>
                    )}
                    {item.valor_unit > 0 ? fmtBRL(item.valor_unit) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {item.qtd > 0 && item.valor_unit > 0 ? fmtBRL(item.qtd * item.valor_unit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className={styles.section}>
          <div className={styles.totaisBox}>
            <div className={styles.totaisRow}><span>Subtotal</span><span>{fmtBRL(subtotal)}</span></div>
            {valorDesc > 0 && (
              <div className={styles.totaisRow} style={{ color: '#dc2626' }}>
                <span>Desconto ({orc.tipo_desconto === '%' ? `${orc.desconto}%` : `R$ ${orc.desconto}`})</span>
                <span>−{fmtBRL(valorDesc)}</span>
              </div>
            )}
            {temFrete && fretoMod === 'cobrar' && valorFrete > 0 && (
              <div className={styles.totaisRow}>
                <span>Frete {orc.frete_tipo ? `(${FRETE_TIPOS[orc.frete_tipo] ?? orc.frete_tipo})` : ''}</span>
                <span>{fmtBRL(valorFrete)}</span>
              </div>
            )}
            {temFrete && fretoMod === 'bonus' && valorFreteBruto > 0 && (
              <div className={styles.totaisRow} style={{ color: '#16a34a' }}>
                <span>🎁 Frete grátis</span>
                <span><s style={{ color: '#dc2626', fontWeight: 600 }}>{fmtBRL(valorFreteBruto)}</s></span>
              </div>
            )}
            {temInst && instMod === 'cobrar' && valorInst > 0 && (
              <div className={styles.totaisRow}><span>Instalação/Montagem</span><span>{fmtBRL(valorInst)}</span></div>
            )}
            {temInst && instMod === 'bonus' && valorInstBruto > 0 && (
              <div className={styles.totaisRow} style={{ color: '#16a34a' }}>
                <span>🎁 Instalação bonificada</span><span>Incluso</span>
              </div>
            )}
            <div className={`${styles.totaisRow} ${styles.totaisTotal}`}><span>TOTAL</span><span>{fmtBRL(total)}</span></div>
            {(economiaPorItens + valorDesc) > 0 && (
              <div className={styles.economia}>
                🏷️ Você economiza <strong>{fmtBRL(economiaPorItens + valorDesc)}</strong> nesta proposta
              </div>
            )}
          </div>
        </div>

        {/* Condições */}
        {(condicoesArr.length > 0 || orc.prazo_entrega || orc.validade_dias || temInst) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Condições Comerciais</div>
            <div className={styles.condicoesBox}>
              {condicoesArr.length > 0 && (
                <div className={styles.condicaoItem}>
                  💳 <strong>Pagamento:</strong> {condicoesArr.join(' · ')}
                  <span style={{ color: '#64748b', fontSize: '0.90em', marginLeft: 6 }}>— Envio após confirmação do pagamento.</span>
                </div>
              )}
              {orc.prazo_entrega && <div className={styles.condicaoItem}>🚚 <strong>Entrega:</strong> {orc.prazo_entrega}</div>}
              {temInst && orc.inst_texto && <div className={styles.condicaoItem}>🔧 <strong>Instalação:</strong> {orc.inst_texto}</div>}
              <div className={styles.condicaoItem}>📅 <strong>Validade:</strong> {orc.validade_dias} dias (até {dataValidade})</div>
              {orc.empresa_email && <div className={styles.condicaoItem}>✉️ <strong>Contato:</strong> {orc.empresa_email}</div>}
            </div>
          </div>
        )}

        {/* Observações */}
        {orc.observacoes && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Observações</div>
            <div className={styles.obsBox}>
              <div className={styles.obsText}>{orc.observacoes}</div>
            </div>
          </div>
        )}

        {/* Assinaturas */}
        <div className={styles.assinaturas}>
          <div className={styles.assinatura}>
            <div className={styles.assinaturaLinha} />
            <span className={styles.assinaturaNome}>{empresaDisplay}{orc.vendedor_nome ? ` · ${orc.vendedor_nome}` : ''}</span>
          </div>
          <div className={styles.assinatura}>
            <div className={styles.assinaturaLinha} />
            <span className={styles.assinaturaNome}>{clienteDisplay}</span>
          </div>
        </div>

        {/* Selo de verificação */}
        <div className={styles.seloWrap}>
          <div className={styles.seloIcone}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="white" opacity="0.9"/>
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.seloTexto}>
            <div className={styles.seloTitulo}>Documento oficial {empresaDisplay}</div>
            <div className={styles.seloCodigo}>Proposta Nº {orc.numero} · Válida até {dataValidade} · {pageUrl.replace(/^https?:\/\//, '')}</div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {[orc.empresa_email, orc.empresa_site, orc.empresa_telefone].filter(Boolean).join(' · ')}
        </div>

        {/* CTAs */}
        <div className={styles.ctaWrap}>
          <a
            href={`https://wa.me/?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnWhatsapp}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.126 1.526 5.864L0 24l6.293-1.506A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.802 9.802 0 01-5.003-1.368l-.359-.213-3.737.895.935-3.618-.235-.373A9.785 9.785 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
            Compartilhar via WhatsApp
          </a>
          <a
            href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
            className={styles.btnEmail}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Enviar por E-mail
          </a>
          <button onClick={baixarPdf} className={styles.btnPdf}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar PDF
          </button>
        </div>
        <div className={styles.ctaValidade}>
          Este link é pessoal e intransferível. Válido até {dataValidade}.
        </div>
      </div>
    </div>
  )
}
