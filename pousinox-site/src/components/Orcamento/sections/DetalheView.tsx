import type {
  EmpresaEmissora, Vendedor, Item, Instalacao, DadoBancario,
  Anexo, HistoricoItem, Status,
} from '../types'
import { STATUS_CFG, EVENTO_LABEL, OBS_DEFAULT, fmtBRL, fmtDataISO } from '../types'
import type { ClienteInfo } from '../../ClienteForm/ClienteForm'
import type { FreteSummary } from '../../../types/frete'

interface Props {
  numero: string
  status: Status
  empresaSel: EmpresaEmissora | null
  vendedores: Vendedor[]
  vendedorId: number | null
  cliente: ClienteInfo
  itens: Item[]
  subtotal: number
  valorDesc: number
  desconto: string
  tipoDesc: '%' | 'R$'
  valorFrete: number
  valorInst: number
  total: number
  fmt: (v: number) => string
  freteSummary: FreteSummary
  condicoes: string[]
  dadosBancarios: DadoBancario[]
  dadosBancariosSel: number[]
  prazoEntrega: string
  validadeDias: string
  dataEmissao: string
  instalacao: Instalacao
  observacoes: string
  anexos: Anexo[]
  finLancId: number | null
  historico: HistoricoItem[]
  onEditar: () => void
  onImprimir: () => void
  styles: Record<string, string>
}

export default function DetalheView({
  numero, status, empresaSel, vendedores, vendedorId, cliente, itens,
  subtotal, valorDesc, desconto, tipoDesc, valorFrete, valorInst, total, fmt,
  freteSummary, condicoes, dadosBancarios, dadosBancariosSel,
  prazoEntrega, validadeDias, dataEmissao, instalacao, observacoes,
  anexos, finLancId, historico, onEditar, onImprimir, styles,
}: Props) {
  const cfg = STATUS_CFG[status]
  const vend = vendedores.find(v => v.id === vendedorId)

  return (
    <div className={styles.detalheWrap}>
      {/* Header */}
      <div className={styles.detalheHeader}>
        <div className={styles.detalheHeaderLeft}>
          <span className={styles.detalheNumero}>{numero}</span>
          <span className={styles.statusBadge} style={{ background: cfg?.cor + '22', color: cfg?.cor }}>{cfg?.label}</span>
        </div>
        <div className={styles.detalheActions}>
          <button className={styles.btnPrimary} onClick={onEditar}>✏️ Editar</button>
          <button className={styles.btnImprimir} onClick={onImprimir}>🖨 PDF</button>
        </div>
      </div>

      <div className={styles.detalheGrid}>
        {/* Empresa emissora */}
        <div className={styles.detalheCard}>
          <div className={styles.detalheCardTitle}>Empresa Emissora</div>
          <div className={styles.detalheCampo}><strong>Empresa:</strong> <span>{empresaSel?.nome_fantasia ?? '—'}</span></div>
          {empresaSel?.razao_social && <div className={styles.detalheCampo}><strong>Razão social:</strong> <span>{empresaSel.razao_social}</span></div>}
          {empresaSel?.cnpj && <div className={styles.detalheCampo}><strong>CNPJ:</strong> <span>{empresaSel.cnpj}</span></div>}
          {empresaSel?.telefone && <div className={styles.detalheCampo}><strong>Telefone:</strong> <span>{empresaSel.telefone}</span></div>}
          {empresaSel?.email && <div className={styles.detalheCampo}><strong>E-mail:</strong> <span>{empresaSel.email}</span></div>}
          {vend && <div className={styles.detalheCampo}><strong>Vendedor:</strong> <span>{vend.nome}</span></div>}
        </div>

        {/* Cliente */}
        <div className={styles.detalheCard}>
          <div className={styles.detalheCardTitle}>Cliente</div>
          {cliente.empresa && <div className={styles.detalheCampo}><strong>Empresa:</strong> <span>{cliente.empresa}</span></div>}
          {cliente.nome_fantasia && <div className={styles.detalheCampo}><strong>Nome fantasia:</strong> <span>{cliente.nome_fantasia}</span></div>}
          {cliente.nome && <div className={styles.detalheCampo}><strong>Contato:</strong> <span>{cliente.nome}</span></div>}
          {cliente.cargo && <div className={styles.detalheCampo}><strong>Cargo:</strong> <span>{cliente.cargo}</span></div>}
          {cliente.cnpj && <div className={styles.detalheCampo}><strong>{cliente.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}:</strong> <span>{cliente.cnpj}</span></div>}
          {cliente.telefone && <div className={styles.detalheCampo}><strong>Telefone:</strong> <span>{cliente.telefone}</span></div>}
          {cliente.email && <div className={styles.detalheCampo}><strong>E-mail:</strong> <span>{cliente.email}</span></div>}
          {cliente.cep && <div className={styles.detalheCampo}><strong>Endereço:</strong> <span>{[cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(', ')} — CEP {cliente.cep}</span></div>}
          {cliente.perfil_comprador && <div className={styles.detalheCampo}><strong>Perfil:</strong> <span>{cliente.perfil_comprador}</span></div>}
        </div>

        {/* Itens */}
        <div className={`${styles.detalheCard} ${styles.detalheCardFull}`}>
          <div className={styles.detalheCardTitle}>Itens</div>
          <table className={styles.detalheItensTable}>
            <thead><tr><th>#</th><th>Descrição</th><th>Qtd</th><th>Un</th><th>Vl. Unit.</th><th>Total</th></tr></thead>
            <tbody>
              {itens.filter(i => i.descricao.trim()).map((item, idx) => {
                const q = parseFloat(item.qtd.replace(',', '.')) || 0
                const v = parseFloat(item.valorUnit.replace(',', '.')) || 0
                return (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{item.descricao}{item.obs_tecnica ? <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{item.obs_tecnica}</div> : null}</td>
                    <td>{item.qtd}</td>
                    <td>{item.unidade}</td>
                    <td>{fmt(v)}</td>
                    <td>{fmt(q * v)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className={styles.detalheTotais}>
            <div className={styles.detalheTotaisRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {valorDesc > 0 && <div className={styles.detalheTotaisRow}><span>Desconto ({tipoDesc === '%' ? `${desconto}%` : 'R$'})</span><span>−{fmt(valorDesc)}</span></div>}
            {valorFrete > 0 && <div className={styles.detalheTotaisRow}><span>Frete</span><span>{fmt(valorFrete)}</span></div>}
            {valorInst > 0 && <div className={styles.detalheTotaisRow}><span>Instalação</span><span>{fmt(valorInst)}</span></div>}
            <div className={`${styles.detalheTotaisRow} ${styles.detalheTotaisTotal}`}><span>Total</span><span>{fmt(total)}</span></div>
          </div>
        </div>

        {/* Frete & Logística */}
        {freteSummary.tipo && (
          <div className={styles.detalheCard}>
            <div className={styles.detalheCardTitle}>Frete & Logística</div>
            <div className={styles.detalheCampo}><strong>Tipo:</strong> <span>{freteSummary.tipo}</span></div>
            <div className={styles.detalheCampo}><strong>Modalidade:</strong> <span>{freteSummary.modalidade === 'cobrar' ? 'Cobrar do cliente' : 'Bonificado'}</span></div>
            {freteSummary.provedor && <div className={styles.detalheCampo}><strong>Provedor:</strong> <span>{freteSummary.provedor} {freteSummary.servico ? `— ${freteSummary.servico}` : ''}</span></div>}
            {freteSummary.valor > 0 && <div className={styles.detalheCampo}><strong>Valor:</strong> <span>{fmtBRL(freteSummary.valor)}</span></div>}
            {freteSummary.prazo && <div className={styles.detalheCampo}><strong>Prazo:</strong> <span>{freteSummary.prazo}</span></div>}
            {freteSummary.peso_total_kg > 0 && <div className={styles.detalheCampo}><strong>Peso:</strong> <span>{freteSummary.peso_total_kg} kg</span></div>}
          </div>
        )}

        {/* Condições */}
        <div className={styles.detalheCard}>
          <div className={styles.detalheCardTitle}>Condições Comerciais</div>
          {condicoes.length > 0 && <div className={styles.detalheCampo}><strong>Pagamento:</strong> <span>{condicoes.join(', ')}</span></div>}
          {dadosBancariosSel.length > 0 && <div className={styles.detalheCampo}><strong>Dados bancários:</strong> <span>{dadosBancarios.filter(d => dadosBancariosSel.includes(d.id)).map(d => d.apelido).join(', ')}</span></div>}
          {prazoEntrega && <div className={styles.detalheCampo}><strong>Prazo entrega:</strong> <span>{prazoEntrega}</span></div>}
          <div className={styles.detalheCampo}><strong>Validade:</strong> <span>{validadeDias} dias</span></div>
          <div className={styles.detalheCampo}><strong>Emissão:</strong> <span>{dataEmissao}</span></div>
        </div>

        {/* Instalação */}
        {instalacao.inclui && (
          <div className={styles.detalheCard}>
            <div className={styles.detalheCardTitle}>Instalação / Montagem</div>
            <div className={styles.detalheCampo}><strong>Modalidade:</strong> <span>{instalacao.modalidade === 'cobrar' ? 'Cobrar do cliente' : 'Bonificada'}</span></div>
            {instalacao.valor && <div className={styles.detalheCampo}><strong>Valor:</strong> <span>{fmtBRL(parseFloat(instalacao.valor.replace(',', '.')) || 0)}</span></div>}
            {instalacao.texto && <div className={styles.detalheCampo}><strong>Descrição:</strong> <span>{instalacao.texto}</span></div>}
          </div>
        )}

        {/* Observações */}
        {observacoes && observacoes !== OBS_DEFAULT && (
          <div className={`${styles.detalheCard} ${styles.detalheCardFull}`}>
            <div className={styles.detalheCardTitle}>Observações</div>
            <div style={{ fontSize: '0.84rem', color: '#374151', whiteSpace: 'pre-line' }}>{observacoes}</div>
          </div>
        )}

        {/* Anexos */}
        {anexos.length > 0 && (
          <div className={styles.detalheCard}>
            <div className={styles.detalheCardTitle}>Anexos ({anexos.length})</div>
            {anexos.map(a => (
              <div key={a.id ?? a.nome} className={styles.detalheCampo}>
                <a href={a.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>📎 {a.nome}</a>
                {a.tamanho && <span style={{ color: '#94a3b8', fontSize: '0.76rem', marginLeft: 6 }}>{(a.tamanho / 1024).toFixed(0)} KB</span>}
              </div>
            ))}
          </div>
        )}

        {/* Recebível */}
        {finLancId && (
          <div className={styles.detalheCard}>
            <div className={styles.detalheCardTitle}>Financeiro</div>
            <div className={styles.detalheCampo} style={{ color: '#16a34a', fontWeight: 600 }}>✓ Recebível #{finLancId} vinculado</div>
          </div>
        )}

        {/* Histórico movido para painel direito (CollapsibleSection) */}
      </div>
    </div>
  )
}
