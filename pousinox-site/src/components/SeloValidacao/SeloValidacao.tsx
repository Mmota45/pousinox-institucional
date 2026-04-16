import styles from './SeloValidacao.module.css'

interface SeloValidacaoProps {
  /** Texto secundário exibido abaixo do título. Padrão: ensaios LAMAT/SENAI */
  descricao?: string
  className?: string
}

export default function SeloValidacao({
  descricao = 'Ensaios técnicos LAMAT · SENAI',
  className,
}: SeloValidacaoProps) {
  return (
    <div className={`${styles.selo} ${className ?? ''}`}>
      <div className={styles.icone}>
        {/* Escudo com check */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6l-9-4z"
            fill="currentColor"
            opacity="0.15"
          />
          <path
            d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6l-9-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M8.5 12l2.5 2.5 4.5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={styles.texto}>
        <span className={styles.titulo}>Validado em ensaio técnico</span>
        <span className={styles.subtitulo}>{descricao}</span>
      </div>
    </div>
  )
}
