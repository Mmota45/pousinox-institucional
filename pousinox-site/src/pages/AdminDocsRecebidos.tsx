import AdminFiscalDocBase from './AdminFiscalDocBase'

export default function AdminDocsRecebidos() {
  return (
    <AdminFiscalDocBase
      tipo="recebido"
      titulo="Documentos Recebidos"
      subtitulo="NF-e de compra recebidas — vinculadas a recebimentos e com movimentação de entrada em estoque"
    />
  )
}
