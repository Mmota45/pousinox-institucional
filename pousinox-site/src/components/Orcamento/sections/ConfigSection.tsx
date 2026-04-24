import type { ExibirProposta } from '../types'

interface Props {
  showControles: boolean
  setShowControles: (fn: (v: boolean) => boolean) => void
  exibir: ExibirProposta
  setExibir: (fn: (v: ExibirProposta) => ExibirProposta) => void
  watermarkAtivo: boolean
  setWatermarkAtivo: (v: boolean) => void
  watermarkLogo: boolean
  setWatermarkLogo: (v: boolean) => void
  watermarkTexto: string
  setWatermarkTexto: (v: string) => void
  imagemUrl: string
  setImagemUrl: (v: string) => void
  imagemRef: React.RefObject<HTMLInputElement | null>
  uploadandoImagem: boolean
  uploadImagem: (file: File) => void
  origemLead: string
  setOrigemLead: (v: string) => void
  obsInternas: string
  setObsInternas: (v: string) => void
  styles: Record<string, string>
}

export default function ConfigSection({
  showControles, setShowControles, exibir, setExibir,
  watermarkAtivo, setWatermarkAtivo, watermarkLogo, setWatermarkLogo,
  watermarkTexto, setWatermarkTexto, imagemUrl, setImagemUrl,
  imagemRef, uploadandoImagem, uploadImagem,
  origemLead, setOrigemLead, obsInternas, setObsInternas, styles,
}: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle} style={{cursor:'pointer',userSelect:'none'}} onClick={() => setShowControles(v=>!v)}>
        Configuração da Proposta {showControles ? '▲' : '▼'}
        <span style={{color:'#94a3b8',fontWeight:400,fontSize:'0.73rem',marginLeft:8}}>opções de exibição, marca d'água, dados internos</span>
      </div>
      {showControles && (<>
        {/* Controles de visibilidade no PDF */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Campos visíveis no PDF</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px'}}>
            {([
              ['telefone','Telefone'],['whatsapp','WhatsApp'],['email','E-mail'],
              ['emailNf','E-mail NFs/Boletos'],['contatosAdicionais','Contatos adicionais'],
              ['cnpj','CNPJ/CPF'],['inscricaoEstadual','Insc. Estadual'],
              ['cargo','Cargo do contato'],['endereco','Endereço principal'],
              ['enderecoEntrega','Endereço de entrega'],['entResponsavel','Responsável na entrega'],
              ['obsTecnicaItens','Obs. técnica dos itens'],
              ['instMontagem','Instalação/montagem'],
              ['anexos','Anexos'],['detalhesLogistica','Detalhes logísticos'],
            ] as [keyof ExibirProposta, string][]).map(([key, label]) => (
              <label key={key} className={styles.toggleLabel}>
                <input type="checkbox" checked={exibir[key]} onChange={e => setExibir(x=>({...x,[key]:e.target.checked}))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Marca d'água + Imagem */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Aparência</div>
          <div className={styles.watermarkRow}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={watermarkAtivo} onChange={e => setWatermarkAtivo(e.target.checked)} />
              <span>Marca d'água</span>
            </label>
            {watermarkAtivo && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className={styles.toggleLabel}>
                  <input type="checkbox" checked={watermarkLogo} onChange={e => setWatermarkLogo(e.target.checked)} />
                  <span style={{ fontSize: '0.82rem' }}>Usar logomarca</span>
                </label>
                {!watermarkLogo && (
                  <input className={styles.input} style={{ maxWidth: 220 }} placeholder="Ex: CONFIDENCIAL" value={watermarkTexto} onChange={e => setWatermarkTexto(e.target.value)} />
                )}
              </div>
            )}
          </div>
          <div className={styles.imagemOrcRow}>
            <span className={styles.imagemOrcLabel}>Imagem do produto / projeto <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></span>
            {imagemUrl ? (
              <div className={styles.imagemOrcPreview}>
                <img src={imagemUrl} alt="Imagem orçamento" className={styles.imagemOrcThumb} />
                <div className={styles.imagemOrcActions}>
                  <input className={styles.input} placeholder="URL da imagem" value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} style={{ fontSize: '0.75rem' }} />
                  <button className={styles.btnRemoveItem} onClick={() => setImagemUrl('')} title="Remover imagem">✕</button>
                </div>
              </div>
            ) : (
              <div className={styles.imagemOrcActions}>
                <input className={styles.input} placeholder="Cole a URL de uma imagem..." value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>ou</span>
                <input type="file" ref={imagemRef} accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadImagem(e.target.files[0])} />
                <button className={styles.btnAddItem} onClick={() => imagemRef.current?.click()} disabled={uploadandoImagem}>
                  {uploadandoImagem ? 'Enviando...' : '📷 Upload'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dados internos */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Dados internos <span style={{fontWeight:400,fontSize:'0.72rem'}}>(não aparecem no PDF)</span></div>
          <div className={styles.row2}>
            <div className={styles.fg}><label>Origem do lead</label><input className={styles.input} placeholder="Ex: Indicação, LinkedIn, Feira..." value={origemLead} onChange={e => setOrigemLead(e.target.value)} /></div>
          </div>
          <div className={styles.fg} style={{ marginTop: 8 }}><label>Observações internas</label><textarea className={`${styles.input} ${styles.textarea}`} rows={3} placeholder="Notas internas, instruções para a equipe..." value={obsInternas} onChange={e => setObsInternas(e.target.value)} /></div>
        </div>
      </>)}
    </div>
  )
}
