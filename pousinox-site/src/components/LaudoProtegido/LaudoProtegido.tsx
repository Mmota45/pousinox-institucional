/**
 * LaudoProtegido — Gera PDF de laudo com marca d'água rastreável + acesso protegido por senha
 *
 * Fluxo:
 * 1. Selecionar PDF base do bucket 'laudos'
 * 2. Preencher destinatário (empresa, CNPJ, contato, email)
 * 3. Definir senha (auto ou manual) + validade + max downloads
 * 4. Edge function aplica watermark + salva no bucket privado
 * 5. Retorna link + senha para compartilhar separadamente
 */

import { useState, useEffect, useRef } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import styles from './LaudoProtegido.module.css'

interface Props {
  /** Pré-preencher empresa */
  empresa?: string
  /** Pré-preencher CNPJ */
  cnpj?: string
  /** Pré-preencher contato */
  contato?: string
  /** Pré-preencher email */
  email?: string
  /** Usuário admin logado */
  usuario?: string
  /** Callback ao gerar com sucesso */
  onGerado?: (result: GeradoResult) => void
}

interface GeradoResult {
  watermark_id: string
  senha: string
  link: string
  expira_em: string
  max_downloads: number
}

interface LaudoBase {
  name: string
  size?: number
}

export default function LaudoProtegido({ empresa, cnpj, contato, email, usuario, onGerado }: Props) {
  const [aberto, setAberto] = useState(false)
  const [laudos, setLaudos] = useState<LaudoBase[]>([])
  const [laudoSel, setLaudoSel] = useState('')
  const [form, setForm] = useState({
    empresa: empresa || '',
    cnpj: cnpj || '',
    contato: contato || '',
    email: email || '',
    senha: '',
    senhaAuto: true,
    expiraHoras: 72,
    maxDownloads: 5,
    canal: 'link' as string,
    observacao: '',
  })
  const [buscaEmpresa, setBuscaEmpresa] = useState('')
  const [sugestoes, setSugestoes] = useState<{ nome: string; cnpj: string; contato: string; email: string; fonte: string }[]>([])
  const [showSugestoes, setShowSugestoes] = useState(false)
  const buscaTimer = useRef<ReturnType<typeof setTimeout>>()
  const [gerando, setGerando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<GeradoResult | null>(null)
  const [copiado, setCopiado] = useState<'link' | 'senha' | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Carregar laudos base ao abrir
  useEffect(() => {
    if (!aberto) return
    carregarLaudos()
  }, [aberto])

  // Sync props → form
  useEffect(() => {
    setForm(f => ({
      ...f,
      empresa: empresa || f.empresa,
      cnpj: cnpj || f.cnpj,
      contato: contato || f.contato,
      email: email || f.email,
    }))
  }, [empresa, cnpj, contato, email])

  async function carregarLaudos() {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from('laudos')
        .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
      if (!error && data) {
        setLaudos(data.filter(f => !f.name.startsWith('.')).map(f => ({ name: f.name, size: (f.metadata as any)?.size })))
      }
    } catch { /* bucket pode não existir ainda */ }
  }

  async function uploadArquivos(files: FileList | File[]) {
    const lista = Array.from(files)
    if (lista.length === 0) return
    const MAX = 50 * 1024 * 1024 // 50MB
    const grandes = lista.filter(f => f.size > MAX)
    if (grandes.length) { setErro(`Arquivo(s) acima de 50MB: ${grandes.map(f => f.name).join(', ')}`); return }

    setUploading(true)
    setErro(null)
    try {
      for (const file of lista) {
        const { error } = await supabaseAdmin.storage
          .from('laudos')
          .upload(file.name, file, { contentType: file.type || 'application/octet-stream', upsert: true })
        if (error) { setErro(`Erro em "${file.name}": ${error.message}`); return }
      }
      await carregarLaudos()
      // Seleciona o primeiro PDF enviado, ou o primeiro arquivo
      const primeiroPdf = lista.find(f => f.name.endsWith('.pdf'))
      setLaudoSel((primeiroPdf || lista[0]).name)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) uploadArquivos(e.dataTransfer.files)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadArquivos(e.target.files)
    e.target.value = ''
  }

  function buscarEmpresa(termo: string) {
    setBuscaEmpresa(termo)
    setForm(f => ({ ...f, empresa: termo }))
    if (buscaTimer.current) clearTimeout(buscaTimer.current)
    if (termo.trim().length < 2) { setSugestoes([]); setShowSugestoes(false); return }

    buscaTimer.current = setTimeout(async () => {
      const results: typeof sugestoes = []
      // Buscar em clientes
      const { data: cli } = await supabaseAdmin.from('clientes')
        .select('razao_social, nome_fantasia, cnpj, email')
        .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,cnpj.ilike.%${termo}%`)
        .limit(5)
      if (cli) {
        for (const c of cli as any[]) {
          results.push({
            nome: c.nome_fantasia || c.razao_social || '',
            cnpj: c.cnpj || '',
            contato: '',
            email: c.email || '',
            fonte: 'Cliente',
          })
        }
      }
      // Buscar em prospeccao
      const { data: prosp } = await supabaseAdmin.from('prospeccao')
        .select('razao_social, nome_fantasia, cnpj, email')
        .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,cnpj.ilike.%${termo}%`)
        .limit(5)
      if (prosp) {
        for (const p of prosp as any[]) {
          const nome = p.nome_fantasia || p.razao_social || ''
          if (!results.some(r => r.cnpj === p.cnpj)) {
            results.push({ nome, cnpj: p.cnpj || '', contato: '', email: p.email || '', fonte: 'Prospect' })
          }
        }
      }
      setSugestoes(results)
      setShowSugestoes(results.length > 0)
    }, 300)
  }

  function selecionarEmpresa(s: typeof sugestoes[0]) {
    setForm(f => ({
      ...f,
      empresa: s.nome,
      cnpj: s.cnpj || f.cnpj,
      contato: s.contato || f.contato,
      email: s.email || f.email,
    }))
    setBuscaEmpresa(s.nome)
    setShowSugestoes(false)
  }

  function campo(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function gerar() {
    if (!laudoSel) { setErro('Selecione o laudo base.'); return }
    if (!form.empresa.trim()) { setErro('Informe a empresa destinatária.'); return }

    setGerando(true)
    setErro(null)

    try {
      const res = await supabaseAdmin.functions.invoke('proteger-pdf', {
        body: {
          action: 'gerar',
          laudo_path: laudoSel,
          destinatario: form.empresa.trim(),
          cnpj: form.cnpj.trim() || undefined,
          contato: form.contato.trim() || undefined,
          email: form.email.trim() || undefined,
          senha: form.senhaAuto ? undefined : form.senha.trim() || undefined,
          enviado_por: usuario || undefined,
          canal_envio: form.canal,
          expira_horas: form.expiraHoras,
          max_downloads: form.maxDownloads,
          observacao: form.observacao.trim() || undefined,
        },
      })

      if (res.error || !res.data?.ok) {
        setErro(res.data?.error || res.error?.message || 'Erro ao gerar laudo protegido')
        return
      }

      const result: GeradoResult = {
        watermark_id: res.data.watermark_id,
        senha: res.data.senha,
        link: `${window.location.origin}${res.data.link}`,
        expira_em: res.data.expira_em,
        max_downloads: res.data.max_downloads,
      }

      setResultado(result)
      onGerado?.(result)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setGerando(false)
    }
  }

  function copiar(tipo: 'link' | 'senha') {
    if (!resultado) return
    const texto = tipo === 'link' ? resultado.link : resultado.senha
    navigator.clipboard.writeText(texto)
    setCopiado(tipo)
    setTimeout(() => setCopiado(null), 2000)
  }

  function fechar() {
    setAberto(false)
    setResultado(null)
    setErro(null)
    setLaudoSel('')
  }

  function formatarData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <>
      <button className={styles.btnGerar} onClick={() => setAberto(true)} type="button">
        📎 Anexar Laudo Protegido
      </button>

      {aberto && (
        <div className={styles.overlay} onClick={fechar}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{resultado ? '✅ Laudo Gerado' : '🔒 Gerar Laudo Protegido'}</h3>
              <button onClick={fechar}>✕</button>
            </div>

            {resultado ? (
              /* ── Resultado ── */
              <div className={styles.resultado}>
                <p className={styles.sucessoMsg}>
                  Laudo protegido gerado com sucesso. Compartilhe o link e a senha <strong>separadamente</strong>.
                </p>

                <div className={styles.resultadoItem}>
                  <span className={styles.resultadoLabel}>Link de acesso:</span>
                  <div className={styles.resultadoRow}>
                    <code className={styles.resultadoCode}>{resultado.link}</code>
                    <button className={styles.btnCopiar} onClick={() => copiar('link')}>
                      {copiado === 'link' ? '✓' : '📋'}
                    </button>
                  </div>
                </div>

                <div className={styles.resultadoItem}>
                  <span className={styles.resultadoLabel}>Senha:</span>
                  <div className={styles.resultadoRow}>
                    <code className={styles.resultadoCode}>{resultado.senha}</code>
                    <button className={styles.btnCopiar} onClick={() => copiar('senha')}>
                      {copiado === 'senha' ? '✓' : '📋'}
                    </button>
                  </div>
                </div>

                <div className={styles.resultadoMeta}>
                  <span>Expira em: {formatarData(resultado.expira_em)}</span>
                  <span>Max downloads: {resultado.max_downloads}</span>
                </div>

                <div className={styles.avisoSenha}>
                  ⚠️ A senha não será exibida novamente. Anote ou compartilhe agora.
                </div>
              </div>
            ) : (
              /* ── Formulário ── */
              <>
                <p className={styles.aviso}>
                  O PDF será gerado com marca d'água rastreável (nome + CNPJ do destinatário).
                  O acesso será protegido por senha com link expirável.
                </p>

                {/* Arquivo base — select + drop zone + upload */}
                <div className={styles.label}>
                  Arquivo base *
                  <select className={styles.input} value={laudoSel} onChange={e => setLaudoSel(e.target.value)}>
                    <option value="">Selecione o arquivo...</option>
                    {laudos.map(l => (
                      <option key={l.name} value={l.name}>{l.name}</option>
                    ))}
                  </select>

                  {/* Drop zone + upload */}
                  <label
                    className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input type="file" multiple onChange={handleFileInput} style={{ display: 'none' }} />
                    <span className={styles.dropIcon}>{uploading ? '⏳' : '📤'}</span>
                    <span>
                      {uploading
                        ? 'Enviando...'
                        : laudoSel
                          ? `✅ ${laudoSel}`
                          : 'Arraste arquivos ou clique para selecionar'}
                    </span>
                    <span className={styles.dropHint}>PDF, imagens, vídeos e outros formatos · Máx 50MB</span>
                  </label>
                </div>

                {/* Destinatário com busca */}
                <div className={styles.row2}>
                  <div className={styles.label} style={{ position: 'relative' }}>
                    Empresa *
                    <input
                      className={styles.input}
                      value={form.empresa}
                      onChange={e => buscarEmpresa(e.target.value)}
                      onFocus={() => sugestoes.length > 0 && setShowSugestoes(true)}
                      onBlur={() => setTimeout(() => setShowSugestoes(false), 200)}
                      placeholder="Digite para buscar..."
                      autoComplete="off"
                    />
                    {showSugestoes && (
                      <div className={styles.sugestoes}>
                        {sugestoes.map((s, i) => (
                          <button key={i} className={styles.sugestaoItem} onMouseDown={() => selecionarEmpresa(s)} type="button">
                            <span className={styles.sugestaoNome}>{s.nome}</span>
                            <span className={styles.sugestaoMeta}>
                              {s.cnpj && <span>{s.cnpj}</span>}
                              <span className={styles.sugestaoFonte}>{s.fonte}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <label className={styles.label}>
                    CNPJ
                    <input className={styles.input} value={form.cnpj} onChange={campo('cnpj')} placeholder="00.000.000/0001-00" />
                  </label>
                </div>

                <div className={styles.row2}>
                  <label className={styles.label}>
                    Contato
                    <input className={styles.input} value={form.contato} onChange={campo('contato')} placeholder="Nome do responsável" />
                  </label>
                  <label className={styles.label}>
                    E-mail
                    <input className={styles.input} type="email" value={form.email} onChange={campo('email')} placeholder="email@empresa.com" />
                  </label>
                </div>

                {/* Senha */}
                <div className={styles.senhaBlock}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={form.senhaAuto}
                      onChange={e => setForm(f => ({ ...f, senhaAuto: e.target.checked }))}
                    />
                    <span>Gerar senha automaticamente (6 dígitos)</span>
                  </label>
                  {!form.senhaAuto && (
                    <input
                      className={styles.input}
                      value={form.senha}
                      onChange={campo('senha')}
                      placeholder="Digite a senha de acesso"
                      style={{ marginTop: 6 }}
                    />
                  )}
                </div>

                {/* Config */}
                <div className={styles.row3}>
                  <label className={styles.label}>
                    Validade
                    <select className={styles.input} value={form.expiraHoras} onChange={e => setForm(f => ({ ...f, expiraHoras: Number(e.target.value) }))}>
                      <option value={24}>24 horas</option>
                      <option value={48}>48 horas</option>
                      <option value={72}>72 horas</option>
                      <option value={168}>7 dias</option>
                      <option value={720}>30 dias</option>
                    </select>
                  </label>
                  <label className={styles.label}>
                    Max acessos
                    <select className={styles.input} value={form.maxDownloads} onChange={e => setForm(f => ({ ...f, maxDownloads: Number(e.target.value) }))}>
                      <option value={1}>1</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </label>
                  <label className={styles.label}>
                    Canal de envio
                    <select className={styles.input} value={form.canal} onChange={campo('canal')}>
                      <option value="link">Link</option>
                      <option value="email">E-mail</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="presencial">Presencial</option>
                    </select>
                  </label>
                </div>

                <label className={styles.label}>
                  Observação
                  <textarea className={styles.input} value={form.observacao} onChange={campo('observacao')} placeholder="Finalidade, reunião, etc." rows={2} />
                </label>

                {erro && <p className={styles.erro}>{erro}</p>}

                <div className={styles.actions}>
                  <button className={styles.btnCancelar} onClick={fechar}>Cancelar</button>
                  <button className={styles.btnConfirmar} onClick={gerar} disabled={gerando}>
                    {gerando ? 'Gerando…' : '🔒 Gerar Laudo Protegido'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
