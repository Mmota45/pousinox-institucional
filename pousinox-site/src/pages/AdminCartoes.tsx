import { useState, useEffect, useRef, useCallback } from 'react'
import * as QRCodeLib from 'qrcode'
import { supabaseAdmin } from '../lib/supabase'
import S from './AdminCartoes.module.css'

// ── Types ──────────────────────────────────────────────────────────────────
type Status = 'rascunho' | 'publicado' | 'pausado' | 'arquivado'

interface Cartao {
  id: string
  slug: string
  nome: string
  cargo: string | null
  empresa: string | null
  segmento: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  foto_url: string | null
  logo_url: string | null
  cor_primaria: string
  cor_fundo: string
  linkedin: string | null
  instagram: string | null
  especialidades: string[]
  produtos: string[]
  produtos_info: { titulo: string; foto_url: string; link: string }[]
  status: Status
  visualizacoes: number
  downloads_vcard: number
  criado_por: string | null
  criado_em: string
  atualizado_em: string
}

type Vista = 'lista' | 'form' | 'detalhe'


const SEGMENTOS = [
  'Revestimentos', 'Construtoras', 'Arquitetura', 'Hotelaria', 'Hospitalar',
  'Restaurantes', 'Panificação', 'Supermercados', 'Açougues', 'Peixarias',
  'Veterinária', 'Laboratórios',
]

const STATUS_LABEL: Record<Status, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  pausado: 'Pausado',
  arquivado: 'Arquivado',
}

const STATUS_CLASS: Record<Status, string> = {
  rascunho: S.badgeRascunho,
  publicado: S.badgePublicado,
  pausado: S.badgePausado,
  arquivado: S.badgeArquivado,
}

// ── Slug helpers ───────────────────────────────────────────────────────────
function toSlugBase(nome: string, empresa: string): string {
  const text = `${nome} ${empresa}`.trim()
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function gerarSufixo(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// ── QR Code (dinâmico para evitar SSR issues) ──────────────────────────────
function QRCanvas({ url, size = 180 }: { url: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCodeLib.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 2,
        color: { dark: '#152d4a', light: '#ffffff' },
      })
    }
  }, [url, size])

  return <canvas ref={canvasRef} className={S.qrCanvas} />
}

// ── vCard generator ────────────────────────────────────────────────────────
function gerarVCard(c: Cartao): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${c.nome}`,
    c.cargo && c.empresa ? `TITLE:${c.cargo}\nORG:${c.empresa}` : '',
    c.telefone ? `TEL;TYPE=WORK,VOICE:${c.telefone}` : '',
    c.whatsapp ? `TEL;TYPE=CELL:${c.whatsapp}` : '',
    c.email ? `EMAIL:${c.email}` : '',
    c.site ? `URL:${c.site}` : '',
    c.linkedin ? `X-SOCIALPROFILE;type=linkedin:${c.linkedin}` : '',
    c.instagram ? `X-SOCIALPROFILE;type=instagram:${c.instagram}` : '',
    c.foto_url ? `PHOTO;VALUE=URI:${c.foto_url}` : '',
    'END:VCARD',
  ]
  return lines.filter(Boolean).join('\n')
}

function downloadVCard(c: Cartao) {
  const blob = new Blob([gerarVCard(c)], { type: 'text/vcard' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${c.slug}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Mini Preview Card ──────────────────────────────────────────────────────
function CartaoPreview({ c }: { c: Partial<Cartao> }) {
  const cor = c.cor_primaria || '#1e3f6e'
  const fundo = c.cor_fundo || '#ffffff'

  return (
    <div style={{
      width: 280,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      background: fundo,
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Banner */}
      <div style={{ height: 56, background: cor, position: 'relative' }}>
        {c.logo_url && (
          <img
            src={c.logo_url}
            alt="logo"
            style={{
              position: 'absolute', bottom: -20, right: 16,
              height: 40, objectFit: 'contain', borderRadius: 8,
              background: '#fff', padding: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          />
        )}
      </div>
      {/* Avatar */}
      <div style={{ padding: '0 20px', marginTop: 12, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        {c.foto_url ? (
          <img
            src={c.foto_url}
            alt={c.nome}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${cor}` }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', border: `3px solid ${cor}`,
          }}>
            👤
          </div>
        )}
        <div style={{ paddingBottom: 6 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a202c' }}>
            {c.nome || 'Nome do Profissional'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {c.cargo || 'Cargo'}{c.empresa ? ` · ${c.empresa}` : ''}
          </div>
        </div>
      </div>
      {/* Contatos */}
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {c.whatsapp && (
          <div style={{ fontSize: '0.82rem', color: '#374151', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: cor }}>📱</span> {c.whatsapp}
          </div>
        )}
        {c.email && (
          <div style={{ fontSize: '0.82rem', color: '#374151', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: cor }}>✉</span> {c.email}
          </div>
        )}
        {c.cidade && (
          <div style={{ fontSize: '0.82rem', color: '#374151', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: cor }}>📍</span> {c.cidade}{c.uf ? `/${c.uf}` : ''}
          </div>
        )}
        {/* CTA */}
        <div style={{
          marginTop: 8,
          padding: '8px 0',
          background: cor,
          borderRadius: 8,
          textAlign: 'center',
          color: '#fff',
          fontSize: '0.82rem',
          fontWeight: 600,
        }}>
          Salvar Contato
        </div>
      </div>
    </div>
  )
}

// ── Form ───────────────────────────────────────────────────────────────────
const FORM_VAZIO: Partial<Cartao> = {
  nome: '', cargo: '', empresa: '', segmento: '',
  especialidades: [],
  produtos: [],
  produtos_info: [],
  telefone: '', whatsapp: '', email: '', site: '',
  endereco: '', cidade: '', uf: '', cep: '',
  foto_url: '', logo_url: '',
  cor_primaria: '#1e3f6e', cor_fundo: '#ffffff',
  linkedin: '', instagram: '',
  status: 'rascunho',
}

interface FormProps {
  inicial?: Cartao | null
  onSalvo: (c: Cartao) => void
  onCancelar: () => void
}

function FormCartao({ inicial, onSalvo, onCancelar }: FormProps) {
  const [form, setForm] = useState<Partial<Cartao>>(inicial ? { ...inicial } : { ...FORM_VAZIO })
  const [slugManual, setSlugManual] = useState(!!inicial)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<{ id: string; titulo: string; foto_url: string; link: string }[]>([])
  const [midiaPickerCampo, setMidiaPickerCampo] = useState<'foto_url' | 'logo_url' | null>(null)
  const [midiaArquivos, setMidiaArquivos] = useState<{ name: string; url: string }[]>([])
  const [midiaCarregando, setMidiaCarregando] = useState(false)
  const [midiaUploadando, setMidiaUploadando] = useState(false)

  const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
  const BUCKET = 'outlet-fotos'

  async function listarMidia() {
    const { data } = await supabaseAdmin.storage.from(BUCKET).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    setMidiaArquivos((data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
      name: f.name,
      url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${f.name}`,
    })))
  }

  async function abrirMidiaPicker(campo: 'foto_url' | 'logo_url') {
    setMidiaPickerCampo(campo)
    setMidiaCarregando(true)
    await listarMidia()
    setMidiaCarregando(false)
  }

  async function comprimirMidia(file: File, maxWidth = 1200, qualidade = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao comprimir')), 'image/webp', qualidade)
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function uploadMidia(file: File) {
    setMidiaUploadando(true)
    try {
      const blob = await comprimirMidia(file)
      const nome = `${Date.now()}.webp`
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(nome, blob, { contentType: 'image/webp' })
      if (!error) {
        const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nome}`
        set(midiaPickerCampo!, url)
        await listarMidia()
        setMidiaPickerCampo(null)
      }
    } catch {
      const nome = `${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(nome, file, { contentType: file.type })
      if (!error) {
        const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nome}`
        set(midiaPickerCampo!, url)
        await listarMidia()
        setMidiaPickerCampo(null)
      }
    }
    setMidiaUploadando(false)
  }

  async function excluirMidia(nome: string) {
    await supabaseAdmin.storage.from(BUCKET).remove([nome])
    await listarMidia()
  }

  function selecionarMidia(url: string) {
    set(midiaPickerCampo!, url)
    setMidiaPickerCampo(null)
  }

  useEffect(() => {
    supabaseAdmin
      .from('produtos')
      .select('id, titulo, fotos')
      .order('titulo')
      .then(({ data }) => {
        if (data) {
          const vistos = new Set<string>()
          const lista = (data as { id: string; titulo: string; fotos: string[] | null }[])
            .filter(p => p.titulo && p.fotos?.length && !vistos.has(p.titulo) && vistos.add(p.titulo))
            .map(p => ({
              id: String(p.id),
              titulo: p.titulo,
              foto_url: p.fotos?.[0] ?? '',
              link: `https://pousinox.com.br/pronta-entrega`,
            }))
          setProdutosDisponiveis(lista)
        }
      })
  }, [])

  const slugSugerido = form.nome || form.empresa
    ? `${toSlugBase(form.nome || '', form.empresa || '')}-${gerarSufixo()}`
    : 'slug-gerado-automaticamente'

  function set(k: keyof Cartao, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function salvar() {
    if (!form.nome?.trim()) { setErro('Nome é obrigatório.'); return }
    setSaving(true); setErro(null)

    const slug = inicial?.slug || (slugManual && form.slug?.trim()
      ? form.slug.trim()
      : `${toSlugBase(form.nome, form.empresa || '')}-${gerarSufixo()}`)

    const payload = { ...form, slug, nome: form.nome!.trim() }

    try {
      let data: Cartao
      if (inicial) {
        const r = await supabaseAdmin
          .from('cartoes_digitais')
          .update(payload)
          .eq('id', inicial.id)
          .select()
          .single()
        if (r.error) throw r.error
        data = r.data
      } else {
        const r = await supabaseAdmin
          .from('cartoes_digitais')
          .insert(payload)
          .select()
          .single()
        if (r.error) throw r.error
        data = r.data
      }
      onSalvo(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(msg.includes('duplicate') ? 'Slug já existe. Tente outro nome.' : msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={S.formWrap}>
      <div className={S.formHeader}>
        <h2 className={S.formTitle}>{inicial ? 'Editar Cartão' : 'Novo Cartão Digital'}</h2>
        <button className={S.btnSecondary} onClick={onCancelar}>Cancelar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0, alignItems: 'start' }}>
        <div className={S.formBody}>
          {/* Identidade */}
          <div className={S.formSection}>
            <div className={S.formSectionTitle}>Identidade</div>
            <div className={S.formRow}>
              <div className={S.field}>
                <label className={S.label}>Nome *</label>
                <input className={S.input} value={form.nome || ''} onChange={e => set('nome', e.target.value)} placeholder="João Silva" />
              </div>
              <div className={S.field}>
                <label className={S.label}>Cargo <span className={S.labelOpt}>opcional</span></label>
                <input className={S.input} value={form.cargo || ''} onChange={e => set('cargo', e.target.value)} placeholder="Consultor de Vendas" />
              </div>
            </div>
            <div className={S.formRow}>
              <div className={S.field}>
                <label className={S.label}>Empresa <span className={S.labelOpt}>opcional</span></label>
                <input className={S.input} value={form.empresa || ''} onChange={e => set('empresa', e.target.value)} placeholder="Pousinox®" />
              </div>
              <div className={S.field}>
                <label className={S.label}>Segmento <span className={S.labelOpt}>opcional</span></label>
                <select className={S.select} value={form.segmento || ''} onChange={e => set('segmento', e.target.value)}>
                  <option value="">— Selecionar —</option>
                  {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Especialidades */}
            <div className={S.field}>
              <label className={S.label}>Especialidades <span className={S.labelOpt}>aparecem no cartão — múltipla escolha</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff', minHeight: 44 }}>
                {SEGMENTOS.map(s => {
                  const selecionado = (form.especialidades || []).includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const atual = form.especialidades || []
                        setForm(f => ({
                          ...f,
                          especialidades: selecionado
                            ? atual.filter(x => x !== s)
                            : [...atual, s],
                        }))
                      }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        border: `1px solid ${selecionado ? '#1e3f6e' : '#e2e8f0'}`,
                        background: selecionado ? '#1e3f6e' : '#f8fafc',
                        color: selecionado ? '#fff' : '#64748b',
                        fontSize: '0.82rem',
                        fontWeight: selecionado ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Produtos */}
            <div className={S.field}>
              <label className={S.label}>Produtos Pousinox® <span className={S.labelOpt}>aparecem no cartão — múltipla escolha</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff', minHeight: 44 }}>
                {produtosDisponiveis.length === 0 && <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Carregando produtos disponíveis…</span>}
                {/* Produtos selecionados que não estão mais na lista */}
                {(form.produtos || []).filter(t => !produtosDisponiveis.find(p => p.titulo === t)).map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      produtos: (f.produtos || []).filter(x => x !== t),
                      produtos_info: (f.produtos_info || []).filter(x => x.titulo !== t),
                    }))}
                    style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                    title="Clique para remover — produto não está mais disponível">{t} ✕</button>
                ))}
                {produtosDisponiveis.map(p => {
                  const selecionado = (form.produtos || []).includes(p.titulo)
                  return (
                    <button key={p.id} type="button"
                      onClick={() => {
                        const sel = selecionado
                        setForm(f => ({
                          ...f,
                          produtos: sel ? (f.produtos || []).filter(x => x !== p.titulo) : [...(f.produtos || []), p.titulo],
                          produtos_info: sel
                            ? (f.produtos_info || []).filter(x => x.titulo !== p.titulo)
                            : [...(f.produtos_info || []), { titulo: p.titulo, foto_url: p.foto_url, link: p.link }],
                        }))
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px 4px 4px',
                        borderRadius: 999,
                        border: `1px solid ${selecionado ? '#1e3f6e' : '#e2e8f0'}`,
                        background: selecionado ? '#eaf0f8' : '#f8fafc',
                        color: selecionado ? '#1e3f6e' : '#64748b',
                        fontSize: '0.82rem', fontWeight: selecionado ? 600 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {p.foto_url && <img src={p.foto_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                      {p.titulo}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Slug */}
            {!inicial && (
              <div className={S.field}>
                <label className={S.label}>Slug <span className={S.labelOpt}>URL pública</span></label>
                {slugManual ? (
                  <input className={S.input} value={form.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="joao-silva-pousinox-1234" />
                ) : (
                  <div>
                    <div className={S.slugPreview}>Automático: <span>{slugSugerido}</span></div>
                    <button className={S.btnSecondary} style={{ marginTop: 6, fontSize: '0.8rem', padding: '5px 10px' }} onClick={() => setSlugManual(true)}>
                      Personalizar slug
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contato */}
          <div className={S.formSection}>
            <div className={S.formSectionTitle}>Contato</div>
            <div className={S.formRow}>
              <div className={S.field}>
                <label className={S.label}>WhatsApp</label>
                <input className={S.input} value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="(35) 99999-0000" />
              </div>
              <div className={S.field}>
                <label className={S.label}>Telefone <span className={S.labelOpt}>opcional</span></label>
                <input className={S.input} value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} placeholder="(35) 3423-8994" />
              </div>
            </div>
            <div className={S.formRow}>
              <div className={S.field}>
                <label className={S.label}>E-mail <span className={S.labelOpt}>opcional</span></label>
                <input className={S.input} type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="joao@pousinox.com.br" />
              </div>
              <div className={S.field}>
                <label className={S.label}>Site <span className={S.labelOpt}>opcional</span></label>
                <input className={S.input} value={form.site || ''} onChange={e => set('site', e.target.value)} placeholder="https://pousinox.com.br" />
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className={S.formSection}>
            <div className={S.formSectionTitle}>Localização <span className={S.labelOpt} style={{ textTransform: 'none', letterSpacing: 0 }}>opcional</span></div>
            <div className={S.field}>
              <label className={S.label}>Endereço</label>
              <input className={S.input} value={form.endereco || ''} onChange={e => set('endereco', e.target.value)} placeholder="Av. Antônio Mariosa, 4545" />
            </div>
            <div className={S.formRow3}>
              <div className={S.field}>
                <label className={S.label}>Cidade</label>
                <input className={S.input} value={form.cidade || ''} onChange={e => set('cidade', e.target.value)} placeholder="Pouso Alegre" />
              </div>
              <div className={S.field}>
                <label className={S.label}>UF</label>
                <input className={S.input} value={form.uf || ''} onChange={e => set('uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="MG" maxLength={2} />
              </div>
              <div className={S.field}>
                <label className={S.label}>CEP</label>
                <input className={S.input} value={form.cep || ''} onChange={e => set('cep', e.target.value)} placeholder="37550-000" />
              </div>
            </div>
          </div>

          {/* Redes Sociais */}
          <div className={S.formSection}>
            <div className={S.formSectionTitle}>Redes Sociais <span className={S.labelOpt} style={{ textTransform: 'none', letterSpacing: 0 }}>opcional</span></div>
            <div className={S.formRow}>
              <div className={S.field}>
                <label className={S.label}>LinkedIn (URL)</label>
                <input className={S.input} value={form.linkedin || ''} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/joao-silva" />
              </div>
              <div className={S.field}>
                <label className={S.label}>Instagram (URL)</label>
                <input className={S.input} value={form.instagram || ''} onChange={e => set('instagram', e.target.value)} placeholder="https://instagram.com/pousinox" />
              </div>
            </div>
          </div>

          {/* Mídia */}
          <div className={S.formSection}>
            <div className={S.formSectionTitle}>Mídia <span className={S.labelOpt} style={{ textTransform: 'none', letterSpacing: 0 }}>opcional</span></div>
            <div className={S.formRow}>
              <div className={S.field}>
                <label className={S.label}>Foto URL</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className={S.input} value={form.foto_url || ''} onChange={e => set('foto_url', e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => abrirMidiaPicker('foto_url')} style={{ whiteSpace: 'nowrap', padding: '0 10px', background: '#1a2f4e', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>🖼 Bucket</button>
                </div>
              </div>
              <div className={S.field}>
                <label className={S.label}>Logo URL</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className={S.input} value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => abrirMidiaPicker('logo_url')} style={{ whiteSpace: 'nowrap', padding: '0 10px', background: '#1a2f4e', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>🖼 Bucket</button>
                </div>
              </div>
            </div>
          </div>

          {/* Modal picker de mídia */}
          {midiaPickerCampo && (
            <div onClick={() => setMidiaPickerCampo(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                    Imagens — {midiaPickerCampo === 'foto_url' ? 'Foto' : 'Logo'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ padding: '0.4rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff', color: '#1e3f6e', cursor: 'pointer' }}>
                      {midiaUploadando ? 'Enviando…' : '⬆ Upload'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMidia(f) }} />
                    </label>
                    <button onClick={() => setMidiaPickerCampo(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
                  </div>
                </div>
                <div style={{ padding: '0.5rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#64748b' }}>
                  ✅ Upload comprime automaticamente para WebP 82%
                </div>
                <div style={{ overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  {midiaCarregando ? (
                    <p style={{ gridColumn: '1/-1', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Carregando…</p>
                  ) : midiaArquivos.length === 0 ? (
                    <p style={{ gridColumn: '1/-1', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Nenhuma imagem no bucket. Faça upload acima.</p>
                  ) : midiaArquivos.map(img => (
                    <div key={img.name} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: (midiaPickerCampo === 'foto_url' ? form.foto_url : form.logo_url) === img.url ? '3px solid #1e3f6e' : '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                      <img src={img.url} alt={img.name} onClick={() => selecionarMidia(img.url)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }} />
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                        <a href={img.url} download={img.name} onClick={e => e.stopPropagation()}
                          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                          title="Download">⬇</a>
                        <button type="button" onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${img.name}"?`)) excluirMidia(img.name) }}
                          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Excluir">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Visual */}
          <div className={S.formSection}>
            <div className={S.formSectionTitle}>Visual</div>
            <div className={S.colorRow}>
              <div className={S.colorField}>
                <input type="color" className={S.colorInput} value={form.cor_primaria || '#1e3f6e'} onChange={e => set('cor_primaria', e.target.value)} />
                <div>
                  <div className={S.label} style={{ marginBottom: 3 }}>Cor principal</div>
                  <input className={S.colorText} value={form.cor_primaria || '#1e3f6e'} onChange={e => set('cor_primaria', e.target.value)} />
                </div>
              </div>
              <div className={S.colorField}>
                <input type="color" className={S.colorInput} value={form.cor_fundo || '#ffffff'} onChange={e => set('cor_fundo', e.target.value)} />
                <div>
                  <div className={S.label} style={{ marginBottom: 3 }}>Cor de fundo</div>
                  <input className={S.colorText} value={form.cor_fundo || '#ffffff'} onChange={e => set('cor_fundo', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview lateral */}
        <div style={{ padding: 20, borderLeft: '1px solid var(--color-border)', position: 'sticky', top: 20 }}>
          <div className={S.previewTitle}>Preview</div>
          <div style={{ marginTop: 12 }}>
            <CartaoPreview c={form} />
          </div>
        </div>
      </div>

      <div className={S.formFooter}>
        {erro && <span style={{ color: '#dc2626', fontSize: '0.85rem', marginRight: 'auto' }}>{erro}</span>}
        <button className={S.btnSecondary} onClick={onCancelar} disabled={saving}>Cancelar</button>
        <button className={S.btnPrimary} onClick={salvar} disabled={saving}>
          {saving ? 'Salvando…' : inicial ? 'Salvar alterações' : 'Criar cartão'}
        </button>
      </div>
    </div>
  )
}

// ── Detalhe ────────────────────────────────────────────────────────────────
interface DetalheProps {
  cartao: Cartao
  onVoltar: () => void
  onEditar: (c: Cartao) => void
  onAtualizado: (c: Cartao) => void
}

function DetalheCartao({ cartao, onVoltar, onEditar, onAtualizado }: DetalheProps) {
  const [copiado, setCopiado] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin
  const publicUrl = `${baseUrl}/c/${cartao.slug}`

  async function alterarStatus(novoStatus: Status) {
    setAtualizando(true)
    const r = await supabaseAdmin
      .from('cartoes_digitais')
      .update({ status: novoStatus })
      .eq('id', cartao.id)
      .select()
      .single()
    setAtualizando(false)
    if (!r.error && r.data) onAtualizado(r.data)
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(publicUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }

  async function baixarVCard() {
    downloadVCard(cartao)
    await supabaseAdmin.from('cartoes_acessos').insert({
      cartao_id: cartao.id, tipo: 'download_vcard',
    })
  }

  async function baixarQR() {
    const url = await QRCodeLib.toDataURL(publicUrl, {
      width: 512, margin: 2,
      color: { dark: '#152d4a', light: '#ffffff' },
    })
    const a = document.createElement('a')
    a.href = url; a.download = `qr-${cartao.slug}.png`; a.click()
  }

  return (
    <div className={S.detalhe}>
      {/* Main */}
      <div className={S.detalheMain}>
        <div className={S.detalheHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className={S.btnSecondary} onClick={onVoltar}>← Voltar</button>
            <span className={`${S.badge} ${STATUS_CLASS[cartao.status]}`}>{STATUS_LABEL[cartao.status]}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={S.btnSecondary} onClick={() => onEditar(cartao)}>Editar</button>
          </div>
        </div>

        <div className={S.detalheBody}>
          {/* Status actions */}
          <div className={S.statusActions}>
            {cartao.status !== 'publicado' && (
              <button className={S.btnPublish} onClick={() => alterarStatus('publicado')} disabled={atualizando}>
                Publicar
              </button>
            )}
            {cartao.status === 'publicado' && (
              <button className={S.btnPause} onClick={() => alterarStatus('pausado')} disabled={atualizando}>
                Pausar
              </button>
            )}
            {cartao.status !== 'arquivado' && cartao.status !== 'publicado' && (
              <button className={S.btnSecondary} onClick={() => alterarStatus('arquivado')} disabled={atualizando}>
                Arquivar
              </button>
            )}
          </div>

          {/* Link público */}
          <div>
            <div className={S.label} style={{ marginBottom: 6 }}>Link público</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: '0.85rem', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {publicUrl}
              </code>
              <button className={S.btnSecondary} onClick={copiarLink}>Copiar</button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={S.btnSecondary} style={{ textDecoration: 'none' }}>Abrir</a>
            </div>
            {copiado && <div className={S.copyFeedback}>Link copiado!</div>}
          </div>

          {/* Informações */}
          <div>
            <div className={S.formSectionTitle} style={{ marginBottom: 10 }}>Informações</div>
            <div className={S.infoGrid}>
              {cartao.cargo && <><span className={S.infoLabel}>Cargo</span><span className={S.infoValue}>{cartao.cargo}</span></>}
              {cartao.empresa && <><span className={S.infoLabel}>Empresa</span><span className={S.infoValue}>{cartao.empresa}</span></>}
              {cartao.segmento && <><span className={S.infoLabel}>Segmento</span><span className={S.infoValue}>{cartao.segmento}</span></>}
              {cartao.whatsapp && <><span className={S.infoLabel}>WhatsApp</span><span className={S.infoValue}>{cartao.whatsapp}</span></>}
              {cartao.telefone && <><span className={S.infoLabel}>Telefone</span><span className={S.infoValue}>{cartao.telefone}</span></>}
              {cartao.email && <><span className={S.infoLabel}>E-mail</span><a className={S.infoLink} href={`mailto:${cartao.email}`}>{cartao.email}</a></>}
              {cartao.site && <><span className={S.infoLabel}>Site</span><a className={S.infoLink} href={cartao.site} target="_blank" rel="noopener noreferrer">{cartao.site}</a></>}
              {cartao.cidade && <><span className={S.infoLabel}>Cidade</span><span className={S.infoValue}>{cartao.cidade}{cartao.uf ? `/${cartao.uf}` : ''}</span></>}
              {cartao.linkedin && <><span className={S.infoLabel}>LinkedIn</span><a className={S.infoLink} href={cartao.linkedin} target="_blank" rel="noopener noreferrer">Ver perfil</a></>}
              {cartao.instagram && <><span className={S.infoLabel}>Instagram</span><a className={S.infoLink} href={cartao.instagram} target="_blank" rel="noopener noreferrer">Ver perfil</a></>}
              <span className={S.infoLabel}>Slug</span><code style={{ fontSize: '0.82rem' }}>{cartao.slug}</code>
              <span className={S.infoLabel}>Criado em</span><span className={S.infoValue}>{new Date(cartao.criado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={S.detalheSide}>
        {/* Preview */}
        <div className={S.previewWrap}>
          <div className={S.previewTitle}>Preview</div>
          <CartaoPreview c={cartao} />
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button className={S.btnSecondary} style={{ flex: 1, justifyContent: 'center' }} onClick={baixarVCard}>
              Baixar vCard
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className={S.metricas}>
          <div className={S.metricasHeader}>Métricas</div>
          <div className={S.metricasGrid}>
            <div className={S.metricaItem}>
              <span className={S.metricaLabel}>Visualizações</span>
              <span className={S.metricaValue}>{cartao.visualizacoes.toLocaleString('pt-BR')}</span>
            </div>
            <div className={S.metricaItem}>
              <span className={S.metricaLabel}>vCards baixados</span>
              <span className={S.metricaValue}>{cartao.downloads_vcard.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        {cartao.status === 'publicado' && (
          <div className={S.qrWrap}>
            <div className={S.previewTitle} style={{ alignSelf: 'flex-start' }}>QR Code</div>
            <QRCanvas url={publicUrl} size={180} />
            <div className={S.qrActions}>
              <button className={S.btnSecondary} onClick={baixarQR}>Baixar PNG</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lista ──────────────────────────────────────────────────────────────────
function ListaCartoes({
  cartoes, onNovo, onAbrir,
}: {
  cartoes: Cartao[]
  onNovo: () => void
  onAbrir: (c: Cartao) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const filtrados = cartoes.filter(c => {
    const texto = `${c.nome} ${c.empresa || ''} ${c.slug}`.toLowerCase()
    const buscaOk = !busca || texto.includes(busca.toLowerCase())
    const statusOk = !filtroStatus || c.status === filtroStatus
    return buscaOk && statusOk
  })

  return (
    <>
      <div className={S.toolbar}>
        <input
          className={S.searchInput}
          placeholder="Buscar por nome, empresa ou slug…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className={S.filterSelect} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="publicado">Publicado</option>
          <option value="rascunho">Rascunho</option>
          <option value="pausado">Pausado</option>
          <option value="arquivado">Arquivado</option>
        </select>
        <button className={S.btnPrimary} onClick={onNovo}>+ Novo cartão</button>
      </div>

      {filtrados.length === 0 ? (
        <div className={S.empty}>
          <h3>{cartoes.length === 0 ? 'Nenhum cartão criado' : 'Nenhum resultado'}</h3>
          <p>{cartoes.length === 0 ? 'Crie o primeiro cartão digital da equipe.' : 'Tente ajustar os filtros.'}</p>
          {cartoes.length === 0 && (
            <button className={S.btnPrimary} onClick={onNovo}>Criar primeiro cartão</button>
          )}
        </div>
      ) : (
        <div className={S.grid}>
          {filtrados.map(c => (
            <div key={c.id} className={S.card} onClick={() => onAbrir(c)} style={{ cursor: 'pointer' }}>
              <div className={S.cardBanner} style={{ background: c.cor_primaria }} />
              <div className={S.cardBody}>
                {c.foto_url
                  ? <img src={c.foto_url} alt={c.nome} className={S.cardAvatar} />
                  : <div className={S.cardAvatarPlaceholder}>👤</div>
                }
                <div className={S.cardInfo}>
                  <p className={S.cardName}>{c.nome}</p>
                  <p className={S.cardCargo}>{c.cargo || '—'}{c.empresa ? ` · ${c.empresa}` : ''}</p>
                  <code className={S.cardSlug}>{c.slug}</code>
                </div>
              </div>
              <div className={S.cardFooter}>
                <div className={S.cardStats}>
                  <span>{c.visualizacoes} views</span>
                  <span>{c.downloads_vcard} vCards</span>
                </div>
                <span className={`${S.badge} ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminCartoes() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('lista')
  const [selecionado, setSelecionado] = useState<Cartao | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const r = await supabaseAdmin
      .from('cartoes_digitais')
      .select('*')
      .order('criado_em', { ascending: false })
    setLoading(false)
    if (!r.error && r.data) setCartoes(r.data as Cartao[])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function aoSalvo(c: Cartao) {
    setCartoes(prev => {
      const idx = prev.findIndex(x => x.id === c.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = c; return n }
      return [c, ...prev]
    })
    setSelecionado(c)
    setVista('detalhe')
  }

  function aoAtualizado(c: Cartao) {
    setCartoes(prev => prev.map(x => x.id === c.id ? c : x))
    setSelecionado(c)
  }

  return (
    <div className={S.wrap}>
      <div className={S.pageHeader}>
        <div>
          <h1 className={S.pageTitle}>Cartões Digitais</h1>
          <p className={S.pageSubtitle}>Cartões de visita digitais Pousinox® com QR Code e vCard</p>
        </div>
        {vista !== 'lista' && (
          <button className={S.btnSecondary} onClick={() => { setVista('lista'); setSelecionado(null) }}>
            ← Lista
          </button>
        )}
      </div>

      {loading && vista === 'lista' ? (
        <div className={S.loading}>Carregando…</div>
      ) : vista === 'lista' ? (
        <ListaCartoes
          cartoes={cartoes}
          onNovo={() => { setSelecionado(null); setVista('form') }}
          onAbrir={c => { setSelecionado(c); setVista('detalhe') }}
        />
      ) : vista === 'form' ? (
        <FormCartao
          inicial={selecionado}
          onSalvo={aoSalvo}
          onCancelar={() => {
            if (selecionado) setVista('detalhe')
            else setVista('lista')
          }}
        />
      ) : selecionado ? (
        <DetalheCartao
          cartao={selecionado}
          onVoltar={() => { setVista('lista'); setSelecionado(null) }}
          onEditar={c => { setSelecionado(c); setVista('form') }}
          onAtualizado={aoAtualizado}
        />
      ) : null}
    </div>
  )
}
