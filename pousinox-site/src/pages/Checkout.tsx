import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { ProdutoPublico } from '../lib/supabase'
import { gerarPixQRCodeDataUrl } from '../lib/pix'
import { useCart, type CartItem } from '../contexts/CartContext'
import styles from './Checkout.module.css'
import logoIcon from '../assets/logo-icon.png'

interface OpcaoFrete {
  servico: string
  codigo: string
  preco: number
  prazo: number
  prazo_texto?: string
  erro: string | null
}

interface DadoBancario {
  id: number
  apelido: string
  banco: string
  agencia: string
  conta: string
  tipo_conta: string
  pix_chave: string
  pix_tipo: string
  titular: string
  cnpj_titular: string
}

const STEP_LABELS = ['Dados', 'Endereço', 'Frete', 'Pagamento']

function Checkout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cart = useCart()
  const produtoId = params.get('produto_id')
  const qtdParam = parseInt(params.get('qtd') ?? '1') || 1

  const [step, setStep] = useState(0)
  const [produto, setProduto] = useState<ProdutoPublico | null>(null)
  const [_qtd] = useState(qtdParam) // eslint-disable-line
  // Itens do checkout: do carrinho ou produto único
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Step 1 — Dados pessoais
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')

  // Step 2 — Endereço
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)

  // Step 3 — Frete
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>([])
  const [freteSel, setFreteSel] = useState(0)
  const [freteLoading, setFreteLoading] = useState(false)

  // Step 4 — Pagamento
  const [dadosBancarios, setDadosBancarios] = useState<DadoBancario[]>([])
  const [obsCliente, setObsCliente] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [pixPayloadStr, setPixPayloadStr] = useState('')

  // Carregar produto(s) — via query param ou carrinho
  useEffect(() => {
    if (produtoId) {
      supabase.from('produtos_publicos').select('*').eq('id', produtoId).single()
        .then(({ data }) => {
          if (data) {
            setProduto(data)
            setCheckoutItems([{
              produtoId: Number(data.id),
              titulo: data.titulo,
              preco: data.preco ?? 0,
              quantidade: qtdParam,
              imagem: data.imagem ?? '',
              peso_kg: data.peso_kg ?? 0,
              altura_cm: data.altura_cm ?? 0,
              comprimento_cm: data.comprimento_cm ?? 0,
              largura_cm: data.largura_cm ?? 0,
            }])
          }
        })
    } else if (cart.items.length > 0) {
      setCheckoutItems(cart.items)
      // Usar o primeiro item como "produto" de referência para compatibilidade
      setProduto({
        id: cart.items[0].produtoId,
        titulo: cart.items[0].titulo,
        preco: cart.items[0].preco,
        imagem: cart.items[0].imagem,
        peso_kg: cart.items[0].peso_kg,
        altura_cm: cart.items[0].altura_cm,
        comprimento_cm: cart.items[0].comprimento_cm,
        largura_cm: cart.items[0].largura_cm,
      } as unknown as ProdutoPublico)
    }
  }, [produtoId])

  // Carregar dados bancários
  useEffect(() => {
    supabase.from('dados_bancarios').select('*').eq('ativo', true).order('ordem')
      .then(({ data }) => { if (data) setDadosBancarios(data) })
  }, [])

  // Buscar CEP
  const buscarCep = useCallback(async (cepLimpo: string) => {
    if (cepLimpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setEndereco(data.logradouro || '')
        setBairro(data.bairro || '')
        setCidade(data.localidade || '')
        setUf(data.uf || '')
      }
    } catch { /* ignora */ }
    setBuscandoCep(false)
  }, [])

  // Calcular frete — com dados combinados do carrinho
  const calcularFrete = useCallback(async () => {
    if (checkoutItems.length === 0 || !cep) return
    setFreteLoading(true)
    setOpcoesFrete([])
    try {
      const cepLimpo = cep.replace(/\D/g, '')
      const pesoTotal = checkoutItems.reduce((s, i) => s + (i.peso_kg || 0) * i.quantidade, 0)
      const altTotal = Math.min(checkoutItems.reduce((s, i) => s + (i.altura_cm || 10) * i.quantidade, 0), 100)
      const maxComp = Math.max(...checkoutItems.map(i => i.comprimento_cm || 20))
      const maxLarg = Math.max(...checkoutItems.map(i => i.largura_cm || 15))
      const valorTotal = checkoutItems.reduce((s, i) => s + i.preco * i.quantidade, 0)
      const { data } = await supabase.functions.invoke('calcular-frete', {
        body: {
          cep_destino: cepLimpo,
          peso_kg: pesoTotal || 1,
          comprimento_cm: maxComp,
          largura_cm: maxLarg,
          altura_cm: altTotal || 10,
          valor_mercadoria: valorTotal,
        },
      })
      if (data?.opcoes) setOpcoesFrete(data.opcoes)
    } catch { /* ignora */ }
    setFreteLoading(false)
  }, [checkoutItems, cep])

  // Ao entrar no step 3, calcular frete
  useEffect(() => {
    if (step === 2 && cep.replace(/\D/g, '').length === 8) calcularFrete()
    // Gerar QR Code Pix ao entrar no step de pagamento
    if (step === 3 && dadosBancarios.length > 0 && checkoutItems.length > 0) {
      const db = dadosBancarios[0]
      const subtotalItens = checkoutItems.reduce((s, i) => s + i.preco * i.quantidade, 0)
      const val = subtotalItens + (opcoesFrete[freteSel]?.preco ?? 0)
      gerarPixQRCodeDataUrl({
        chave: db.pix_chave,
        nome: db.titular,
        cidade: 'Pouso Alegre',
        valor: val,
      }).then(url => setQrDataUrl(url))
      // Gerar payload para copia-e-cola
      import('../lib/pix').then(({ gerarPixPayload }) => {
        setPixPayloadStr(gerarPixPayload({
          chave: db.pix_chave,
          nome: db.titular,
          cidade: 'Pouso Alegre',
          valor: val,
        }))
      })
    }
  }, [step, calcularFrete, cep])

  // Gerar código PO-XXXX
  const gerarCodigo = async (): Promise<string> => {
    const { data } = await supabaseAdmin.rpc('nextval', { seq_name: 'pedidos_outlet_numero_seq' })
    const num = data ?? Date.now()
    return `PO-${String(num).padStart(4, '0')}`
  }

  // Confirmar pedido
  const confirmarPedido = async () => {
    if (checkoutItems.length === 0) return
    setSalvando(true)
    setErro('')
    try {
      const codigo = await gerarCodigo()
      const freteEscolhido = opcoesFrete[freteSel] ?? opcoesFrete[0]
      const subtotal = checkoutItems.reduce((s, i) => s + i.preco * i.quantidade, 0)
      const total = subtotal + (freteEscolhido?.preco ?? 0)

      const { data: pedido, error: errPedido } = await supabase.from('pedidos_outlet').insert({
        codigo,
        cliente_nome: nome.trim(),
        cliente_email: email.trim(),
        cliente_telefone: telefone.trim(),
        cliente_cpf_cnpj: cpfCnpj.trim() || null,
        cliente_cep: cep.replace(/\D/g, ''),
        cliente_endereco: endereco.trim(),
        cliente_numero: numero.trim() || null,
        cliente_complemento: complemento.trim() || null,
        cliente_bairro: bairro.trim(),
        cliente_cidade: cidade.trim(),
        cliente_uf: uf.trim(),
        frete_servico: freteEscolhido?.servico ?? '',
        frete_codigo: freteEscolhido?.codigo ?? null,
        frete_preco: freteEscolhido?.preco ?? 0,
        frete_prazo_dias: freteEscolhido?.prazo ?? null,
        frete_prazo_texto: freteEscolhido?.prazo_texto ?? null,
        subtotal,
        total,
        obs_cliente: obsCliente.trim() || null,
      }).select('id, codigo').single()

      if (errPedido) throw errPedido

      // Inserir itens
      await supabase.from('pedidos_outlet_itens').insert(
        checkoutItems.map(item => ({
          pedido_id: pedido!.id,
          produto_id: item.produtoId,
          titulo: item.titulo,
          preco_unitario: item.preco,
          quantidade: item.quantidade,
          subtotal: item.preco * item.quantidade,
        }))
      )

      // Notificar (edge function)
      try {
        await supabase.functions.invoke('notificar-pedido', {
          body: { pedido_id: pedido!.id, evento: 'criado' },
        })
      } catch { /* notificação não bloqueia */ }

      cart.clearCart()
      navigate(`/pedido/${codigo}`)
    } catch (e) {
      setErro((e as Error).message || 'Erro ao criar pedido')
    }
    setSalvando(false)
  }

  if (checkoutItems.length === 0 && !produtoId) return <div className={styles.wrap}><p className={styles.erro}>Carrinho vazio.</p><Link to="/pronta-entrega" className={styles.voltar}>← Voltar ao Outlet</Link></div>
  if (!produto) return <div className={styles.wrap}><p>Carregando...</p></div>

  const subtotal = checkoutItems.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const freteEscolhido = opcoesFrete[freteSel] ?? null
  const total = subtotal + (freteEscolhido?.preco ?? 0)

  const podeAvancar = (): boolean => {
    if (step === 0) return !!(nome.trim() && email.trim() && telefone.trim())
    if (step === 1) return !!(cep.replace(/\D/g, '').length === 8 && endereco.trim() && cidade.trim() && uf.trim())
    if (step === 2) return opcoesFrete.length > 0
    return true
  }

  const copiarPix = (chave: string) => {
    navigator.clipboard.writeText(chave)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  return (
    <div className={styles.wrap}>
      <div className={styles.watermark} style={{ backgroundImage: `url(${logoIcon})` }} />
      <Link to="/pronta-entrega" className={styles.voltar}>← Voltar ao Outlet</Link>

      <div>
        <h1 className={styles.titulo}>Finalizar Pedido</h1>
        <p className={styles.subtitulo}>{STEP_LABELS[step]}</p>
      </div>

      {/* Progress */}
      <div className={styles.steps}>
        {STEP_LABELS.map((_, i) => (
          <div key={i} className={`${styles.step} ${i === step ? styles.stepAtivo : ''} ${i < step ? styles.stepCompleto : ''}`} />
        ))}
      </div>
      <div className={styles.stepLabels}>
        {STEP_LABELS.map((l, i) => (
          <span key={i} className={`${styles.stepLabel} ${i === step ? styles.stepLabelAtivo : ''}`}>{l}</span>
        ))}
      </div>

      {/* Produtos mini */}
      {checkoutItems.map(item => (
        <div key={item.produtoId} className={styles.produtoMini}>
          {item.imagem && <img src={item.imagem} alt="" className={styles.produtoMiniImg} />}
          <div className={styles.produtoMiniInfo}>
            <div className={styles.produtoMiniTitulo}>{item.titulo}</div>
            <div className={styles.produtoMiniPreco}>{item.quantidade}× R$ {fmtBRL(item.preco)} = R$ {fmtBRL(item.preco * item.quantidade)}</div>
          </div>
        </div>
      ))}

      {erro && <p className={styles.erro}>{erro}</p>}

      {/* STEP 0 — Dados pessoais */}
      {step === 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Seus dados</h2>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formFull}`}>
              <label className={styles.formLabel}>Nome completo *</label>
              <input className={styles.formInput} value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email *</label>
              <input type="email" className={styles.formInput} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone / WhatsApp *</label>
              <input className={styles.formInput} value={telefone} placeholder="(00) 00000-0000"
                onChange={e => setTelefone(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CPF ou CNPJ (opcional)</label>
              <input className={styles.formInput} value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 1 — Endereço */}
      {step === 1 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Endereço de entrega</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CEP *</label>
              <input className={styles.formInput} value={cep} maxLength={9} placeholder="00000-000"
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                  const mask = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v
                  setCep(mask)
                  if (v.length === 8) buscarCep(v)
                }} />
              {buscandoCep && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Buscando...</span>}
            </div>
            <div className={`${styles.formGroup} ${styles.formFull}`}>
              <label className={styles.formLabel}>Rua / Avenida *</label>
              <input className={styles.formInput} value={endereco} onChange={e => setEndereco(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Número *</label>
              <input className={styles.formInput} value={numero} onChange={e => setNumero(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Complemento</label>
              <input className={styles.formInput} value={complemento} onChange={e => setComplemento(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Bairro *</label>
              <input className={styles.formInput} value={bairro} onChange={e => setBairro(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cidade *</label>
              <input className={styles.formInput} value={cidade} onChange={e => setCidade(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>UF *</label>
              <input className={styles.formInput} value={uf} maxLength={2} onChange={e => setUf(e.target.value.toUpperCase())} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — Frete */}
      {step === 2 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Escolha o frete</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Entrega para {cidade}/{uf} — CEP {cep}</p>
          {freteLoading && <p className={styles.freteLoading}>Calculando opções de frete...</p>}
          {!freteLoading && opcoesFrete.length === 0 && <p className={styles.erro}>Nenhuma opção de frete disponível.</p>}
          <div className={styles.freteOpcoes}>
            {opcoesFrete.map((op, i) => (
              <div key={op.codigo} className={`${styles.freteOpcao} ${i === freteSel ? styles.freteOpcaoSel : ''}`}
                onClick={() => setFreteSel(i)}>
                <div>
                  <div className={styles.freteServico}>{op.servico}</div>
                  <div className={styles.fretePrazo}>{op.prazo_texto ?? `${op.prazo} ${op.prazo !== 1 ? 'dias úteis' : 'dia útil'}`}</div>
                </div>
                <span className={styles.fretePreco}>
                  {op.preco === 0 ? 'Grátis' : `R$ ${fmtBRL(op.preco)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3 — Resumo + Pagamento */}
      {step === 3 && (
        <>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Resumo do pedido</h2>
            <div className={styles.resumo}>
              {checkoutItems.map(item => (
                <div key={item.produtoId} className={styles.resumoLinha}>
                  <span>{item.titulo} ({item.quantidade}×)</span>
                  <span>R$ {fmtBRL(item.preco * item.quantidade)}</span>
                </div>
              ))}
              {freteEscolhido && (
                <div className={styles.resumoLinha}>
                  <span>Frete ({freteEscolhido.servico})</span>
                  <span>{freteEscolhido.preco === 0 ? 'Grátis' : `R$ ${fmtBRL(freteEscolhido.preco)}`}</span>
                </div>
              )}
              <div className={`${styles.resumoLinha} ${styles.resumoTotal}`}>
                <span>Total</span>
                <span>R$ {fmtBRL(total)}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Entrega: {cidade}/{uf} — {freteEscolhido?.prazo_texto ?? ''}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Observações (opcional)</label>
              <textarea className={styles.formTextarea} value={obsCliente}
                onChange={e => setObsCliente(e.target.value)} placeholder="Alguma observação sobre o pedido?" />
            </div>
          </div>

          {/* Dados Pix */}
          {dadosBancarios.length > 0 && (
            <div className={styles.pixBox}>
              <h3 className={styles.pixTitulo}>Pagamento via Pix</h3>
              <p style={{ fontSize: '0.85rem', color: '#166534', margin: 0 }}>
                Valor: <strong>R$ {fmtBRL(total)}</strong>
              </p>

              {/* QR Code */}
              {qrDataUrl && (
                <div className={styles.pixQr}>
                  <img src={qrDataUrl} alt="QR Code Pix" width={220} height={220} />
                  <p style={{ fontSize: '0.78rem', color: '#166534', margin: '4px 0 0' }}>
                    Escaneie com o app do seu banco
                  </p>
                </div>
              )}

              {/* Pix Copia e Cola */}
              {pixPayloadStr && (
                <div className={styles.pixChave}>
                  <span style={{ fontSize: '0.72rem', wordBreak: 'break-all', maxHeight: 40, overflow: 'hidden' }}>
                    {pixPayloadStr.slice(0, 60)}...
                  </span>
                  <button className={styles.pixCopiar} onClick={() => copiarPix(pixPayloadStr)}>
                    {copiado ? 'Copiado!' : 'Pix Copia e Cola'}
                  </button>
                </div>
              )}

              {/* Dados escritos */}
              {dadosBancarios.map(db => (
                <div key={db.id} className={styles.pixInfo}>
                  <strong>{db.titular}</strong>
                  {db.cnpj_titular && <span>CNPJ: {db.cnpj_titular}</span>}
                  {db.banco && <span> | {db.banco}</span>}
                  {db.agencia && <span> | Ag: {db.agencia}</span>}
                  {db.conta && <span> | Cc: {db.conta}</span>}
                  <div style={{ marginTop: 4, fontSize: '0.78rem' }}>
                    Chave Pix: {db.pix_chave}
                  </div>
                </div>
              ))}
              <p style={{ fontSize: '0.78rem', color: '#15803d', margin: 0 }}>
                Após o pagamento, confirmaremos em até 1 dia útil.
              </p>
            </div>
          )}

          <button className={styles.btnConfirmar} onClick={confirmarPedido} disabled={salvando}>
            {salvando ? 'Criando pedido...' : 'Confirmar Pedido'}
          </button>
        </>
      )}

      {/* Navigation */}
      {step < 3 && (
        <div className={styles.actions}>
          {step > 0 ? (
            <button className={styles.btnSecondary} onClick={() => setStep(s => s - 1)}>← Voltar</button>
          ) : <div />}
          <button className={styles.btnPrimary} disabled={!podeAvancar()} onClick={() => setStep(s => s + 1)}>
            Continuar →
          </button>
        </div>
      )}
    </div>
  )
}

export default Checkout
