import { useState, useCallback, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../../../lib/supabase'
import type { ClienteInfo, Item, HistoricoItem } from '../types'

const FUNC_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/gerar-etiqueta'
const SVC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'
const F_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SVC_KEY}`, 'apikey': SVC_KEY }

async function callEtiqueta(body: Record<string, unknown>) {
  const resp = await fetch(FUNC_URL, { method: 'POST', headers: F_HEADERS, body: JSON.stringify(body) })
  const json = await resp.json()
  if (!resp.ok || json.error) throw new Error(json.error || `HTTP ${resp.status}`)
  return json
}

interface UseEtiquetaParams {
  editandoId: number | null
  cliente: ClienteInfo
  itens: Item[]
  totalFn: () => number
  nomeUsuario: string
  showMsg: (tipo: 'ok' | 'erro', msg: string) => void
  setHistorico: React.Dispatch<React.SetStateAction<HistoricoItem[]>>
}

export function useEtiqueta(params: UseEtiquetaParams) {
  const p = useRef(params)
  useEffect(() => { p.current = params })

  const [etiquetaPreId, setEtiquetaPreId] = useState<string | null>(null)
  const [gerandoEtiq, setGerandoEtiq] = useState(false)
  const [baixandoRotulo, setBaixandoRotulo] = useState(false)
  const [baixandoDace, setBaixandoDace] = useState(false)
  const [cancelandoEtiq, setCancelandoEtiq] = useState(false)

  const gerarEtiqueta = useCallback(async () => {
    const { editandoId, cliente, itens, totalFn, nomeUsuario, showMsg, setHistorico } = p.current
    if (!editandoId) return
    const end = cliente.ent_diferente
      ? { cep: cliente.ent_cep, logradouro: cliente.ent_logradouro, numero: cliente.ent_numero, complemento: cliente.ent_complemento, bairro: cliente.ent_bairro, cidade: cliente.ent_cidade, uf: cliente.ent_uf }
      : { cep: cliente.cep, logradouro: cliente.logradouro, numero: cliente.numero, complemento: cliente.complemento, bairro: cliente.bairro, cidade: cliente.cidade, uf: cliente.uf }
    const cepLimpo = end.cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) { showMsg('erro', 'CEP do destinatário inválido. Preencha o endereço.'); return }
    if (!end.logradouro) { showMsg('erro', 'Logradouro do destinatário obrigatório.'); return }

    setGerandoEtiq(true)
    try {
      let telRaw = (cliente.ent_diferente ? (cliente.ent_telefone || cliente.ent_whatsapp) : (cliente.whatsapp || cliente.telefone)).replace(/\D/g, '')
      if (telRaw.startsWith('55') && telRaw.length >= 12) telRaw = telRaw.slice(2)
      const ddd = telRaw.length >= 10 ? telRaw.slice(0, 2) : '35'
      const celular = telRaw.length >= 10 ? telRaw.slice(2, 11) : '999999999'

      const pesoTotal = itens.reduce((s, it) => s + (parseFloat(it.qtd) || 1) * 0.5, 0)
      const pesoGramas = Math.min(Math.max(Math.round(pesoTotal * 1000), 300), 30000)

      const data = await callEtiqueta({
        acao: 'criar-prepostagem',
        destinatario: {
          nome: cliente.ent_diferente ? (cliente.ent_responsavel || cliente.empresa || cliente.nome) : (cliente.empresa || cliente.nome),
          cpfCnpj: (() => { const c = cliente.cnpj.replace(/\D/g, ''); return (c.length === 11 || c.length === 14) ? c : undefined })(),
          ddd,
          celular,
          email: cliente.email || undefined,
          endereco: {
            cep: cepLimpo,
            logradouro: end.logradouro,
            numero: end.numero || 'S/N',
            complemento: end.complemento || undefined,
            bairro: end.bairro,
            cidade: end.cidade,
            uf: end.uf,
          },
        },
        codigoServico: '03220',
        pesoGramas,
        descricaoConteudo: itens.map(it => it.descricao).filter(Boolean).join(', ').slice(0, 50) || 'Equipamento em aco inox',
        quantidade: itens.reduce((s, it) => s + (parseInt(it.qtd) || 1), 0),
        valorDeclarado: totalFn(),
      })

      const idPre = data.id || data.idPrePostagem
      if (!idPre) throw new Error('ID da pré-postagem não retornado')

      setEtiquetaPreId(idPre)
      await supabaseAdmin.from('orcamentos').update({ etiqueta_pre_id: idPre }).eq('id', editandoId)
      showMsg('ok', `Pré-postagem criada! Clique em "🏷 Baixar Rótulo" para imprimir a etiqueta.`)

      await supabaseAdmin.from('orcamentos_historico').insert({ orcamento_id: editandoId, evento: 'etiqueta_gerada', descricao: `ID Correios: ${idPre}`, usuario: nomeUsuario || null })
      const { data: hd } = await supabaseAdmin.from('orcamentos_historico').select('*').eq('orcamento_id', editandoId).order('criado_em', { ascending: false })
      setHistorico((hd ?? []) as HistoricoItem[])
    } catch (e) {
      showMsg('erro', `Erro na etiqueta: ${(e as Error).message}`)
    }
    setGerandoEtiq(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const baixarRotulo = useCallback(async () => {
    const { showMsg } = p.current
    if (!etiquetaPreId) return
    setBaixandoRotulo(true)
    try {
      const rotulo = await callEtiqueta({ acao: 'gerar-rotulo', idPrePostagem: etiquetaPreId })
      const idRecibo = rotulo?.idRecibo
      if (!idRecibo) throw new Error('ID do recibo não retornado')

      let pdf: string | null = null
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 3000))
        try {
          const dl = await callEtiqueta({ acao: 'consultar-rotulo', idPrePostagem: idRecibo })
          if (dl?.status === 'pronto' && dl.pdf_base64) { pdf = dl.pdf_base64; break }
        } catch { /* still processing */ }
      }

      if (pdf) {
        const blob = new Blob([Uint8Array.from(atob(pdf), c => c.charCodeAt(0))], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `etiqueta-${etiquetaPreId}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        showMsg('ok', 'Rótulo baixado!')
      } else {
        showMsg('erro', 'O rótulo ainda está sendo processado. Tente novamente em alguns segundos.')
      }
    } catch (e) {
      showMsg('erro', `Erro ao baixar rótulo: ${(e as Error).message}`)
    }
    setBaixandoRotulo(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etiquetaPreId])

  const baixarDace = useCallback(async () => {
    const { showMsg } = p.current
    if (!etiquetaPreId) return
    setBaixandoDace(true)
    try {
      const resp = await fetch(FUNC_URL, { method: 'POST', headers: F_HEADERS, body: JSON.stringify({ acao: 'gerar-dce', idPrePostagem: etiquetaPreId }) })
      const json = await resp.json()
      if (!resp.ok || json.error) throw new Error(json.error || `HTTP ${resp.status}`)
      if (json.pdf_base64) {
        const blob = new Blob([Uint8Array.from(atob(json.pdf_base64), c => c.charCodeAt(0))], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 30000)
        showMsg('ok', 'DACE aberto!')
      } else {
        showMsg('erro', 'Não foi possível gerar o DACE. Verifique se a pré-postagem foi criada corretamente.')
      }
    } catch (e) {
      showMsg('erro', `Erro ao gerar DACE: ${(e as Error).message}`)
    }
    setBaixandoDace(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etiquetaPreId])

  const cancelarEtiqueta = useCallback(async () => {
    const { editandoId, showMsg } = p.current
    if (!etiquetaPreId || !confirm('Cancelar a pré-postagem? O rótulo e DACE ficarão inválidos.')) return
    setCancelandoEtiq(true)
    try {
      const resp = await fetch(FUNC_URL, { method: 'POST', headers: F_HEADERS, body: JSON.stringify({ acao: 'cancelar', idPrePostagem: etiquetaPreId }) })
      const json = await resp.json()
      if (!resp.ok || json.error) throw new Error(json.error || `HTTP ${resp.status}`)
      setEtiquetaPreId(null)
      if (editandoId) await supabaseAdmin.from('orcamentos').update({ etiqueta_pre_id: null }).eq('id', editandoId)
      showMsg('ok', 'Pré-postagem cancelada.')
    } catch (e) {
      showMsg('erro', `Erro ao cancelar: ${(e as Error).message}`)
    }
    setCancelandoEtiq(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etiquetaPreId])

  return {
    etiquetaPreId, setEtiquetaPreId,
    gerandoEtiq, baixandoRotulo, baixandoDace, cancelandoEtiq,
    gerarEtiqueta, baixarRotulo, baixarDace, cancelarEtiqueta,
  }
}
