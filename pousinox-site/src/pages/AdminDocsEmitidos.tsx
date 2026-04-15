import AdminFiscalDocBase from './AdminFiscalDocBase'

export default function AdminDocsEmitidos() {
  return (
    <AdminFiscalDocBase
      tipo="emitido"
      titulo="Documentos Emitidos"
      subtitulo="NF-e de venda emitidas — vinculadas a vendas e com movimentação de saída em estoque"
    />
  )
}
