import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import { useSiteConfig } from '../hooks/useSiteData'
import styles from './Produtos.module.css'

const WA_LINK = 'https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento.'

const categories = [
  {
    id: 'restaurantes',
    title: 'Restaurantes e Food Service',
    description: 'Equipamentos e mobiliário em inox projetados para cozinhas profissionais de alto desempenho, com higiene, resistência e praticidade.',
    items: [
      'Bancadas sob medida',
      'Pias industriais (simples e duplas)',
      'Mesas de preparo',
      'Armários e gaveteiros',
      'Prateleiras e suportes',
      'Cubas com dreno',
      'Coifas e exaustores',
      'Estantes para câmaras frias',
    ],
  },
  {
    id: 'panificacao',
    title: 'Panificação e Confeitaria',
    description: 'Estruturas em inox sob medida para padarias e confeitarias, com foco em higiene, praticidade e resistência ao uso intenso.',
    items: [
      'Mesas de trabalho e manipulação',
      'Bancadas de produção',
      'Armários para utensílios',
      'Estantes para bandejas e formas',
      'Prateleiras de resfriamento',
      'Cubas de higienização',
      'Carrinhos para transporte',
      'Suportes e acessórios',
    ],
  },
  {
    id: 'hospitalar',
    title: 'Hospitalar e Clínicas',
    description: 'Mobiliário e estruturas para clínicas e hospitais com foco em higiene, durabilidade e facilidade de esterilização.',
    items: [
      'Carrinhos de curativo',
      'Mesas de apoio clínico',
      'Bancadas de procedimento',
      'Suportes de soro',
      'Armários hospitalares',
      'Mesas de instrumentação',
      'Cubas e lavabos',
      'Estantes para materiais',
    ],
  },
  {
    id: 'laboratorio',
    title: 'Laboratório Farmacêutico',
    description: 'Bancadas e estruturas em inox resistentes a produtos químicos, de fácil higienização e adequadas às normas sanitárias.',
    items: [
      'Bancadas de laboratório',
      'Armários para reagentes',
      'Mesas de pesagem',
      'Cubas de higienização',
      'Estantes para equipamentos',
      'Carrinhos de transporte',
      'Suportes e acessórios',
      'Estruturas anticontaminação',
    ],
  },
  {
    id: 'hotelaria',
    title: 'Hotelaria e Catering',
    description: 'Equipamentos e mobiliário em inox para hotéis, pousadas e serviços de catering com acabamento e funcionalidade de alto padrão.',
    items: [
      'Balcões de buffet',
      'Carrinhos de serviço',
      'Mesas de apoio',
      'Bancadas de cozinha',
      'Armários de estoque',
      'Estantes para utensílios',
      'Cubas e pias',
      'Estruturas para eventos',
    ],
  },
  {
    id: 'varejo',
    title: 'Comércio e Varejo',
    description: 'Estruturas em inox para açougues, peixarias, padarias e supermercados, com higiene e durabilidade para o uso diário.',
    items: [
      'Balcões de atendimento',
      'Bancadas para açougue',
      'Pias e cubas para peixaria',
      'Expositores e gôndolas',
      'Mesas de corte',
      'Prateleiras comerciais',
      'Armários e arquivos',
      'Muretas e divisórias',
    ],
  },
  {
    id: 'arquitetura',
    title: 'Arquitetura e Projetos Residenciais',
    description: 'Peças únicas e personalizadas para projetos de arquitetura e design de interiores de alto padrão, aliando estética e funcionalidade.',
    items: [
      'Revestimentos em inox',
      'Painéis decorativos',
      'Portas e portais',
      'Divisórias e biombos',
      'Molduras e acabamentos',
      'Mesas e bancadas de design',
      'Estruturas e suportes',
      'Elementos escultóricos',
    ],
  },
  {
    id: 'construcao',
    title: 'Construção Civil',
    description: 'Elementos estruturais e de acabamento em inox para obras residenciais, comerciais e industriais com alta durabilidade.',
    items: [
      'Corrimãos e guarda-corpos',
      'Grades e cercas',
      'Portões e portas',
      'Calhas e rufos',
      'Estruturas metálicas',
      'Suportes e fixações',
      'Escadas e mezaninos',
      'Coberturas e pergolados',
    ],
  },
]

async function compartilharCategoria(title: string) {
  const url = 'https://pousinox.com.br/#/produtos'
  const text = `Veja os equipamentos em inox para ${title} — fabricados sob medida pela POUSINOX® em Pouso Alegre, MG.`
  if (navigator.share) {
    await navigator.share({ title: `POUSINOX® — ${title}`, text, url }).catch(() => {})
  } else {
    await navigator.clipboard.writeText(`${text} ${url}`)
  }
}

export default function Produtos() {
  const { config } = useSiteConfig()
  const [activeCategory, setActiveCategory] = useState('restaurantes')
  const current = categories.find(c => c.id === activeCategory)!
  const pageTitle = config.produtos_titulo || 'Nossos Produtos'
  const pageSub = config.produtos_subtitulo || 'Fabricamos equipamentos e mobiliário em aço inox sob medida para oito segmentos. Selecione uma categoria para conhecer os itens disponíveis.'
  const ctaNota = config.produtos_cta_nota || 'Todos os itens podem ser fabricados sob medida. Não encontrou o que precisa? Entre em contato — desenvolvemos projetos personalizados.'
  const waLink = config.whatsapp_numero ? `https://wa.me/${config.whatsapp_numero}?text=${encodeURIComponent(config.whatsapp_mensagem || 'Olá, gostaria de solicitar um orçamento.')}` : WA_LINK

  return (
    <div className={styles.page}>
      <SEO
        title="Produtos em Inox Sob Medida | Pousinox Pouso Alegre, MG"
        description="Bancadas, mesas, pias, coifas, corrimãos e muito mais — equipamentos em aço inox sob medida fabricados em Pouso Alegre, MG. Atendemos restaurantes, hospitais, laboratórios e construção civil em todo o Sul de Minas Gerais."
        path="/produtos"
      />
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <p className={styles.pageSubtitle}>{pageSub}</p>
        </div>
      </div>

      <div className={`container ${styles.layout}`}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>Categorias</h2>
          <nav className={styles.sidebarNav}>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`${styles.catBtn} ${activeCategory === cat.id ? styles.catBtnActive : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.catHeader}>
            <h2 className={styles.catTitle}>{current.title}</h2>
            <p className={styles.catDesc}>{current.description}</p>
          </div>

          <div className={styles.itemsGrid}>
            {current.items.map(item => (
              <div key={item} className={styles.itemCard}>
                <span className={styles.itemCheck}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className={styles.catCta}>
            <p className={styles.ctaNote}>{ctaNota}</p>
            <div className={styles.ctaButtons}>
              <button className={styles.shareBtn} onClick={() => compartilharCategoria(current.title)} type="button">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Compartilhar
              </button>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Solicitar via WhatsApp
              </a>
              <Link to="/contato" className="btn-primary">
                Formulário de Orçamento
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
