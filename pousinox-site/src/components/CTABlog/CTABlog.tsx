import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import styles from './CTABlog.module.css'

const WA_NUMBER = '5535999619463'

interface Props {
  ctaTipo: 'pronta_entrega' | 'orcamento' | 'parceiro' | 'nenhum'
  origemOferta?: string | null
  produtoRelacionadoId?: string | null
  fabricanteParceiro?: string | null
  tituloPost?: string
}

interface Produto {
  id: string
  titulo: string
  disponivel: boolean
  preco?: number | null
  exibir_preco?: boolean
  fotos?: string[]
}

export default function CTABlog({ ctaTipo, origemOferta, produtoRelacionadoId, fabricanteParceiro, tituloPost }: Props) {
  const [produto, setProduto] = useState<Produto | null>(null)

  useEffect(() => {
    if (ctaTipo === 'pronta_entrega' && produtoRelacionadoId) {
      supabase
        .from('produtos')
        .select('id, titulo, disponivel, preco, exibir_preco, fotos')
        .eq('id', produtoRelacionadoId)
        .single()
        .then(({ data }) => { if (data) setProduto(data as Produto) })
    }
  }, [ctaTipo, produtoRelacionadoId])

  if (ctaTipo === 'nenhum') return null

  // ── Pronta Entrega ────────────────────────────────────────────────────────
  if (ctaTipo === 'pronta_entrega') {
    const foto = produto?.fotos?.[0]
    const disponivel = produto?.disponivel ?? true

    return (
      <div className={styles.wrap}>
        <div className={styles.label}>
          {origemOferta === 'produto_proprio'
            ? 'Produto POUSINOX®'
            : origemOferta === 'parceiro' && fabricanteParceiro
              ? `Produto ${fabricanteParceiro} · comercializado pela POUSINOX®`
              : 'Disponível em pronta entrega'}
        </div>
        <div className={styles.cardPE}>
          {foto && <img src={foto} alt={produto?.titulo} className={styles.cardFoto} />}
          <div className={styles.cardInfo}>
            <p className={styles.cardTitulo}>{produto?.titulo ?? 'Produto relacionado'}</p>
            {disponivel ? (
              <span className={styles.badgeDisp}>Em estoque</span>
            ) : (
              <span className={styles.badgeIndisп}>Indisponível no momento</span>
            )}
            {disponivel ? (
              <a href="/pronta-entrega" className={styles.btnPE}>
                Ver na Pronta Entrega →
              </a>
            ) : (
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Olá! Vi o artigo sobre ${tituloPost ?? 'este produto'} e gostaria de saber sobre disponibilidade.`)}`}
                target="_blank" rel="noopener noreferrer"
                className={styles.btnWA}
              >
                Consultar disponibilidade
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Parceiro ──────────────────────────────────────────────────────────────
  if (ctaTipo === 'parceiro') {
    return (
      <div className={`${styles.wrap} ${styles.wrapParceiro}`}>
        <div className={styles.label}>Nota sobre este produto</div>
        <p className={styles.parceiroTexto}>
          {fabricanteParceiro
            ? <>Este produto é fabricado pela <strong>{fabricanteParceiro}</strong> e comercializado pela <strong>POUSINOX®</strong>. Para disponibilidade e condições, entre em contato.</>
            : <>Este produto é comercializado pela <strong>POUSINOX®</strong>. Para disponibilidade e condições, entre em contato.</>
          }
        </p>
        <a
          href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Olá! Vi o artigo sobre ${tituloPost ?? 'este produto'} e gostaria de mais informações.`)}`}
          target="_blank" rel="noopener noreferrer"
          className={styles.btnWA}
        >
          Falar com a POUSINOX®
        </a>
      </div>
    )
  }

  // ── Orçamento / WhatsApp (default) ────────────────────────────────────────
  return (
    <div className={`${styles.wrap} ${styles.wrapOrcamento}`}>
      <div className={styles.label}>Gostou? Fale com a POUSINOX®</div>
      <p className={styles.orcTexto}>
        Desenvolvemos soluções em inox sob medida para restaurantes, hospitais, hotéis e indústria.
        Solicite um orçamento sem compromisso.
      </p>
      <div className={styles.btnRow}>
        <a
          href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Olá! Vi o artigo sobre ${tituloPost ?? 'seus produtos'} e gostaria de um orçamento.`)}`}
          target="_blank" rel="noopener noreferrer"
          className={styles.btnWA}
        >
          Solicitar orçamento pelo WhatsApp
        </a>
        <a href="/contato" className={styles.btnContato}>
          Formulário de contato
        </a>
      </div>
    </div>
  )
}
