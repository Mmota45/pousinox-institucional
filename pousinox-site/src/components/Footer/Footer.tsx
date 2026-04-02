import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.bottomBar}>
        <p className={styles.copyright}>© {new Date().getFullYear()} POUSINOX®. Todos os direitos reservados. &nbsp;·&nbsp; CNPJ: 12.115.379/0001-64 | Pouso Alegre, MG</p>
        <p className={styles.dev}>Desenvolvido por <a href="https://www.linkedin.com/in/marcos-mota-7444b368" target="_blank" rel="noopener noreferrer" className={styles.devLink}>Marcos Mota</a></p>
      </div>
    </footer>
  )
}
