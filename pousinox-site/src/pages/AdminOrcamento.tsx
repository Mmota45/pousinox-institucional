import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import logomarca from '../assets/logomarca.png'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminOrcamento.module.css'

/* ── Tipos ── */
interface Item {
  descricao: string
  qtd: string
  unidade: string
  valorUnit: string
}

interface ClienteInfo {
  nome: string
  empresa: string
  cnpj: string
  telefone: string
  email: string
  endereco: string
}

interface EmpresaInfo {
  cnpj: string
  endereco: string
  telefone: string
  email: string
  site: string
}

const EMPRESA_KEY = 'psnx_empresa_info'
const ORC_NUM_KEY = 'psnx_orc_num'

const EMPRESA_DEFAULT: EmpresaInfo = {
  cnpj: '',
  endereco: 'Pouso Alegre - MG',
  telefone: '(35) 3423-8994',
  email: 'adm@pousinox.com.br',
  site: 'pousinox.com.br',
}

const ITEM_VAZIO: Item = { descricao: '', qtd: '1', unidade: 'UN', valorUnit: '' }

const UNIDADES = ['UN', 'CX', 'KG', 'M', 'M²', 'M³', 'L', 'PC', 'JG', 'PAR', 'RL', 'SC', 'H', 'DZ', 'GL']

const COND_PAGAMENTO = [
  'À vista',
  'À vista com desconto',
  '30 dias',
  '30/60 dias',
  '30/60/90 dias',
  'Cartão de crédito (até 12x)',
  'Boleto bancário',
  'PIX',
  'Depósito/Transferência',
]

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function hoje() {
  return new Date().toLocaleDateString('pt-BR')
}

function addDias(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('pt-BR')
}

function proximoNum() {
  const ano = new Date().getFullYear()
  const ultimo = parseInt(localStorage.getItem(ORC_NUM_KEY) || '0')
  const proximo = ultimo + 1
  return `${ano}/${String(proximo).padStart(3, '0')}`
}

export default function AdminOrcamento() {
  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const location = useLocation()
  const fromProjeto = location.state as {
    projeto?: { titulo: string; codigo: string; cliente_nome: string | null; cliente_cnpj: string | null; observacoes: string | null }
    atributos?: { chave: string; valor: string; unidade: string | null }[]
    componentes?: { nome: string; quantidade: number | null }[]
  } | null

  const especAtributos = fromProjeto?.atributos ?? []
  const especComponentes = fromProjeto?.componentes ?? []

  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => {
    try { return { ...EMPRESA_DEFAULT, ...JSON.parse(localStorage.getItem(EMPRESA_KEY) || '{}') } }
    catch { return EMPRESA_DEFAULT }
  })
  const [editandoEmpresa, setEditandoEmpresa] = useState(false)

  const [numero, setNumero] = useState(proximoNum)
  const [dataEmissao] = useState(hoje)
  const [validadeDias, setValidadeDias] = useState('7')
  const [dataValidade, setDataValidade] = useState(() => addDias(7))

  const [cliente, setCliente] = useState<ClienteInfo>(() => ({
    nome:     fromProjeto?.projeto?.cliente_nome ?? '',
    empresa:  fromProjeto?.projeto?.cliente_nome ?? '',
    cnpj:     fromProjeto?.projeto?.cliente_cnpj ?? '',
    telefone: '', email: '', endereco: '',
  }))

  const [itens, setItens] = useState<Item[]>(() =>
    fromProjeto?.projeto
      ? [{ descricao: fromProjeto.projeto.titulo, qtd: '1', unidade: 'UN', valorUnit: '' }]
      : [{ ...ITEM_VAZIO }]
  )
  const [desconto, setDesconto] = useState('')
  const [tipoDesconto, setTipoDesconto] = useState<'%' | 'R$'>('%')
  const [condicao, setCondicao] = useState('')
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [observacoes, setObservacoes] = useState(() =>
    fromProjeto?.projeto ? `Ref.: ${fromProjeto.projeto.codigo} — ${fromProjeto.projeto.titulo}${fromProjeto.projeto.observacoes ? '\n' + fromProjeto.projeto.observacoes : ''}` : ''
  )
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const d = parseInt(validadeDias) || 7
    setDataValidade(addDias(d))
  }, [validadeDias])

  function salvarEmpresa() {
    localStorage.setItem(EMPRESA_KEY, JSON.stringify(empresa))
    setEditandoEmpresa(false)
  }

  function addItem() { setItens(prev => [...prev, { ...ITEM_VAZIO }]) }

  function removeItem(i: number) {
    setItens(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof Item, val: string) {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  function subtotal() {
    return itens.reduce((sum, item) => {
      const q = parseFloat(item.qtd) || 0
      const v = parseFloat(item.valorUnit.replace(',', '.')) || 0
      return sum + q * v
    }, 0)
  }

  function valorDesconto() {
    const sub = subtotal()
    const d = parseFloat(desconto.replace(',', '.')) || 0
    if (tipoDesconto === '%') return sub * d / 100
    return Math.min(d, sub)
  }

  function total() { return subtotal() - valorDesconto() }

  function imprimir() {
    // Salva o número usado
    const num = parseInt(numero.split('/')[1]) || 0
    localStorage.setItem(ORC_NUM_KEY, String(num))
    window.print()
  }

  function novoOrcamento() {
    if (!confirm('Iniciar novo orçamento? O atual será perdido.')) return
    const num = parseInt(numero.split('/')[1]) || 0
    localStorage.setItem(ORC_NUM_KEY, String(num))
    setNumero(proximoNum())
    setCliente({ nome: '', empresa: '', cnpj: '', telefone: '', email: '', endereco: '' })
    setItens([{ ...ITEM_VAZIO }])
    setDesconto('')
    setCondicao('')
    setPrazoEntrega('')
    setObservacoes('')
    setValidadeDias('7')
  }

  const sub = subtotal()
  const desc = valorDesconto()
  const tot = total()

  return (
    <div className={styles.wrap}>

      {/* ── Configurações da empresa (colapsável) ── */}
      <div className={styles.empresaBar}>
        <button className={styles.empresaToggle} onClick={() => setEditandoEmpresa(e => !e)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
          </svg>
          Dados da empresa
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', width: 14, height: 14, transform: editandoEmpresa ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {editandoEmpresa && (
          <div className={styles.empresaForm}>
            <div className={styles.empresaGrid}>
              <div className={styles.fg}>
                <label>CNPJ</label>
                <input className={styles.input} value={empresa.cnpj} placeholder="00.000.000/0001-00"
                  onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>Endereço</label>
                <input className={styles.input} value={empresa.endereco}
                  onChange={e => setEmpresa(p => ({ ...p, endereco: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>Telefone</label>
                <input className={styles.input} value={empresa.telefone}
                  onChange={e => setEmpresa(p => ({ ...p, telefone: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>E-mail</label>
                <input className={styles.input} value={empresa.email}
                  onChange={e => setEmpresa(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>Site</label>
                <input className={styles.input} value={empresa.site}
                  onChange={e => setEmpresa(p => ({ ...p, site: e.target.value }))} />
              </div>
            </div>
            <button className={styles.btnPrimary} onClick={salvarEmpresa}>Salvar dados da empresa</button>
          </div>
        )}
      </div>

      <div className={styles.layout}>
        {/* ── FORMULÁRIO ── */}
        <div className={styles.formCol}>

          {/* Cabeçalho do orçamento */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Orçamento</h2>
            <div className={styles.row3}>
              <div className={styles.fg}>
                <label>Número</label>
                <input className={styles.input} value={numero} onChange={e => setNumero(e.target.value)} />
              </div>
              <div className={styles.fg}>
                <label>Data de emissão</label>
                <input className={styles.input} value={dataEmissao} readOnly />
              </div>
              <div className={styles.fg}>
                <label>Validade (dias)</label>
                <input className={styles.input} type="number" min="1" value={validadeDias}
                  onChange={e => setValidadeDias(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Cliente */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Destinatário</h2>
            <div className={styles.row2}>
              <div className={styles.fg}>
                <label>Empresa / Razão social</label>
                <input className={styles.input} value={cliente.empresa}
                  onChange={e => setCliente(p => ({ ...p, empresa: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>Responsável</label>
                <input className={styles.input} value={cliente.nome}
                  onChange={e => setCliente(p => ({ ...p, nome: e.target.value }))} />
              </div>
            </div>
            <div className={styles.row3}>
              <div className={styles.fg}>
                <label>CNPJ / CPF</label>
                <input className={styles.input} value={cliente.cnpj}
                  onChange={e => setCliente(p => ({ ...p, cnpj: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>Telefone</label>
                <input className={styles.input} value={cliente.telefone}
                  onChange={e => setCliente(p => ({ ...p, telefone: e.target.value }))} />
              </div>
              <div className={styles.fg}>
                <label>E-mail</label>
                <input className={styles.input} value={cliente.email}
                  onChange={e => setCliente(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fg}>
              <label>Endereço</label>
              <input className={styles.input} value={cliente.endereco}
                onChange={e => setCliente(p => ({ ...p, endereco: e.target.value }))} />
            </div>
          </section>

          {/* Itens */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Itens</h2>
            <div className={styles.itensHeader}>
              <span style={{ flex: '3' }}>Descrição</span>
              <span style={{ flex: '1', textAlign: 'center' }}>Qtd</span>
              <span style={{ flex: '0.8', textAlign: 'center' }}>Un</span>
              <span style={{ flex: '1.2', textAlign: 'right' }}>Vlr Unit.</span>
              <span style={{ flex: '1.2', textAlign: 'right' }}>Total</span>
              <span style={{ width: 28 }}></span>
            </div>
            {itens.map((item, i) => {
              const qtd = parseFloat(item.qtd) || 0
              const vu = parseFloat(item.valorUnit.replace(',', '.')) || 0
              const tot = qtd * vu
              return (
                <div key={i} className={styles.itemRow}>
                  <input className={`${styles.input} ${styles.itemDesc}`} placeholder="Descrição do produto/serviço"
                    value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} />
                  <input className={`${styles.input} ${styles.itemQtd}`} type="number" min="0" step="0.01"
                    value={item.qtd} onChange={e => updateItem(i, 'qtd', e.target.value)} />
                  <select className={`${styles.input} ${styles.itemUn}`} value={item.unidade}
                    onChange={e => updateItem(i, 'unidade', e.target.value)}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input className={`${styles.input} ${styles.itemVu}`} placeholder="0,00"
                    value={item.valorUnit} onChange={e => updateItem(i, 'valorUnit', e.target.value)} />
                  <span className={styles.itemTotal}>{tot > 0 ? fmt(tot) : '—'}</span>
                  <button className={styles.btnRemoveItem} onClick={() => removeItem(i)} title="Remover">✕</button>
                </div>
              )
            })}
            <button className={styles.btnAddItem} onClick={addItem}>+ Adicionar item</button>

            {/* Totais */}
            <div className={styles.totaisWrap}>
              <div className={styles.totaisRow}>
                <span>Subtotal</span>
                <span>{fmt(sub)}</span>
              </div>
              <div className={styles.totaisRow}>
                <span>Desconto</span>
                <div className={styles.descontoGroup}>
                  <input className={`${styles.input} ${styles.descontoInput}`} placeholder="0"
                    value={desconto} onChange={e => setDesconto(e.target.value)} />
                  <select className={`${styles.input} ${styles.descontoTipo}`} value={tipoDesconto}
                    onChange={e => setTipoDesconto(e.target.value as '%' | 'R$')}>
                    <option>%</option>
                    <option>R$</option>
                  </select>
                  <span className={styles.descontoValor}>{desc > 0 ? `− ${fmt(desc)}` : '—'}</span>
                </div>
              </div>
              <div className={`${styles.totaisRow} ${styles.totaisTotal}`}>
                <span>TOTAL</span>
                <span>{fmt(tot)}</span>
              </div>
            </div>
          </section>

          {/* Condições */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Condições</h2>
            <div className={styles.row2}>
              <div className={styles.fg}>
                <label>Condição de pagamento</label>
                <select className={styles.input} value={condicao} onChange={e => setCondicao(e.target.value)}>
                  <option value="">Selecione...</option>
                  {COND_PAGAMENTO.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.fg}>
                <label>Prazo de entrega</label>
                <input className={styles.input} placeholder="Ex: 5 dias úteis" value={prazoEntrega}
                  onChange={e => setPrazoEntrega(e.target.value)} />
              </div>
            </div>
            <div className={styles.fg}>
              <label>Observações</label>
              <textarea className={`${styles.input} ${styles.textarea}`} rows={3}
                placeholder="Informações adicionais, condições especiais..."
                value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </div>
          </section>

          {/* Ações */}
          <div className={styles.acoes}>
            <button className={styles.btnSecondary} onClick={novoOrcamento}>Novo orçamento</button>
            <button className={styles.btnPrimary} onClick={imprimir}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {/* ── PREVIEW ── */}
        <div className={styles.previewCol}>
          <div className={styles.previewLabel}>Pré-visualização</div>
          <div className={styles.previewSheet} ref={printRef} id="orcamento-print">

            {/* Cabeçalho */}
            <div className={styles.pHeader}>
              <div className={styles.pHeaderLeft}>
                <img src={logomarca} alt="Pousinox" className={styles.pLogo} />
                <div className={styles.pEmpresaInfo}>
                  {empresa.cnpj && <span>CNPJ: {empresa.cnpj}</span>}
                  {empresa.endereco && <span>{empresa.endereco}</span>}
                  {empresa.telefone && <span>{empresa.telefone}</span>}
                  {empresa.email && <span>{empresa.email}</span>}
                  {empresa.site && <span>{empresa.site}</span>}
                </div>
              </div>
              <div className={styles.pHeaderRight}>
                <div className={styles.pOrcTitulo}>ORÇAMENTO</div>
                <div className={styles.pOrcNum}>Nº {numero}</div>
                <div className={styles.pOrcData}>Emissão: {dataEmissao}</div>
                <div className={styles.pOrcData}>Validade: {dataValidade}</div>
              </div>
            </div>

            <div className={styles.pDivider} />

            {/* Destinatário */}
            {(cliente.empresa || cliente.nome) && (
              <div className={styles.pCliente}>
                <div className={styles.pClienteTitle}>DESTINATÁRIO</div>
                <div className={styles.pClienteGrid}>
                  {cliente.empresa && <div><strong>Empresa:</strong> {cliente.empresa}</div>}
                  {cliente.nome && <div><strong>Responsável:</strong> {cliente.nome}</div>}
                  {cliente.cnpj && <div><strong>CNPJ/CPF:</strong> {cliente.cnpj}</div>}
                  {cliente.telefone && <div><strong>Tel:</strong> {cliente.telefone}</div>}
                  {cliente.email && <div><strong>E-mail:</strong> {cliente.email}</div>}
                  {cliente.endereco && <div className={styles.pClienteEnd}><strong>Endereço:</strong> {cliente.endereco}</div>}
                </div>
              </div>
            )}

            {/* Itens */}
            <table className={styles.pTable}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>Nº</th>
                  <th>Descrição</th>
                  <th style={{ width: 50 }}>Qtd</th>
                  <th style={{ width: 40 }}>Un</th>
                  <th style={{ width: 80 }}>Vlr Unit.</th>
                  <th style={{ width: 90 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.filter(item => item.descricao || item.valorUnit).map((item, i) => {
                  const qtd = parseFloat(item.qtd) || 0
                  const vu = parseFloat(item.valorUnit.replace(',', '.')) || 0
                  return (
                    <tr key={i}>
                      <td className={styles.pTdCenter}>{i + 1}</td>
                      <td>{item.descricao || '—'}</td>
                      <td className={styles.pTdCenter}>{item.qtd}</td>
                      <td className={styles.pTdCenter}>{item.unidade}</td>
                      <td className={styles.pTdRight}>{vu > 0 ? fmt(vu) : '—'}</td>
                      <td className={styles.pTdRight}>{vu > 0 && qtd > 0 ? fmt(qtd * vu) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totais */}
            <div className={styles.pTotais}>
              <div className={styles.pTotaisRow}>
                <span>Subtotal</span><span>{fmt(sub)}</span>
              </div>
              {desc > 0 && (
                <div className={styles.pTotaisRow}>
                  <span>Desconto ({desconto}{tipoDesconto})</span>
                  <span>− {fmt(desc)}</span>
                </div>
              )}
              <div className={`${styles.pTotaisRow} ${styles.pTotaisTotal}`}>
                <span>TOTAL</span><span>{fmt(tot)}</span>
              </div>
            </div>

            {/* Especificações Técnicas */}
            {(especAtributos.length > 0 || especComponentes.length > 0) && (
              <div className={styles.pCondicoes} style={{ marginTop: 16 }}>
                <div className={styles.pClienteTitle} style={{ marginBottom: 8 }}>ESPECIFICAÇÕES TÉCNICAS</div>
                {especAtributos.length > 0 && (
                  <table className={styles.pTable} style={{ marginBottom: especComponentes.length > 0 ? 10 : 0 }}>
                    <thead>
                      <tr>
                        <th>Atributo</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {especAtributos.map((a, i) => {
                        // Remove sufixos de unidade da chave (_mm, _kg, _un)
                        const chaveLabel = a.chave
                          .replace(/_mm$|_kg$|_un$|_m$/, '')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, c => c.toUpperCase())
                        // Evita duplicar unidade se já está no valor
                        const valorStr = String(a.valor)
                        const unidade = a.unidade ?? ''
                        const valorFinal = unidade && !valorStr.toLowerCase().includes(unidade.toLowerCase())
                          ? `${valorStr} ${unidade}`
                          : valorStr
                        return (
                          <tr key={i}>
                            <td>{chaveLabel}</td>
                            <td>{valorFinal}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {especComponentes.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Componentes</div>
                    <table className={styles.pTable}>
                      <thead>
                        <tr>
                          <th>Componente</th>
                          <th style={{ width: 60, textAlign: 'center' }}>Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {especComponentes.map((c, i) => (
                          <tr key={i}>
                            <td>{c.nome}</td>
                            <td style={{ textAlign: 'center' }}>{c.quantidade ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* Condições */}
            {(condicao || prazoEntrega || observacoes) && (
              <div className={styles.pCondicoes}>
                {condicao && (
                  <div className={styles.pCondicaoItem}>
                    <strong>Condição de pagamento:</strong> {condicao}
                  </div>
                )}
                {prazoEntrega && (
                  <div className={styles.pCondicaoItem}>
                    <strong>Prazo de entrega:</strong> {prazoEntrega}
                  </div>
                )}
                {observacoes && (
                  <div className={styles.pCondicaoItem}>
                    <strong>Observações:</strong> {observacoes}
                  </div>
                )}
              </div>
            )}

            {/* Assinatura */}
            <div className={styles.pAssinatura}>
              <div className={styles.pAssinaturaBox}>
                <div className={styles.pAssinaturaLinha} />
                <span>Responsável Pousinox</span>
              </div>
              <div className={styles.pAssinaturaBox}>
                <div className={styles.pAssinaturaLinha} />
                <span>Cliente / Aprovação</span>
              </div>
            </div>

            {/* Rodapé */}
            <div className={styles.pFooter}>
              Pousinox Indústria e Comércio de Aço Inox
              {empresa.site && <> · {empresa.site}</>}
              {empresa.telefone && <> · {empresa.telefone}</>}
              {empresa.email && <> · {empresa.email}</>}
              <br />
              Orçamento Nº {numero} · Emitido em {dataEmissao} · Válido até {dataValidade}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
