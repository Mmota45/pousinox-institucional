import { segmentos } from './segmentos'

export type SearchItem = {
  type: 'blog' | 'segmento' | 'pagina'
  title: string
  description: string
  path: string
  tags: string[]
}

const blogPosts: SearchItem[] = [
  {
    type: 'blog',
    title: 'Por que o aço inox AISI 304 é o padrão em cozinhas profissionais?',
    description: 'Entenda as propriedades do inox 304 que o tornam a escolha obrigatória em cozinhas industriais: resistência à corrosão, higiene e durabilidade.',
    path: '/blog/por-que-inox-304-em-cozinhas-profissionais',
    tags: ['restaurante', 'cozinha industrial', 'inox 304', 'food service'],
  },
  {
    type: 'blog',
    title: 'Mobiliário hospitalar em inox: higiene e segurança acima de tudo',
    description: 'Clínicas e hospitais têm exigências rigorosas para mobiliário. Saiba como os equipamentos em inox atendem às normas sanitárias.',
    path: '/blog/mobiliario-hospitalar-em-inox',
    tags: ['hospitalar', 'clínica', 'ANVISA', 'higiene'],
  },
  {
    type: 'blog',
    title: 'Inox na arquitetura: tendência ou necessidade?',
    description: 'Arquitetos e designers têm apostado cada vez mais no inox como elemento estético e funcional em projetos residenciais e comerciais.',
    path: '/blog/inox-na-arquitetura',
    tags: ['arquitetura', 'design', 'projetos residenciais', 'guarda-corpo'],
  },
  {
    type: 'blog',
    title: 'Corrimãos e guarda-corpos em inox: segurança com design',
    description: 'Além de atender às normas de segurança da ABNT, corrimãos em inox oferecem resistência à oxidação e acabamento moderno.',
    path: '/blog/corrimoes-guarda-corpos-inox',
    tags: ['construção civil', 'corrimão', 'guarda-corpo', 'ABNT'],
  },
  {
    type: 'blog',
    title: 'Como limpar e conservar equipamentos em inox corretamente',
    description: 'Dicas práticas de limpeza e conservação para prolongar a vida útil dos seus equipamentos em aço inox, evitando manchas e oxidação.',
    path: '/blog/como-limpar-conservar-inox',
    tags: ['limpeza', 'conservação', 'manutenção', 'manchas'],
  },
  {
    type: 'blog',
    title: 'Fabricação sob medida vs. linha padrão: qual escolher?',
    description: 'Cada projeto tem suas particularidades. Entenda quando vale a pena investir em fabricação sob medida e quando a linha padrão resolve.',
    path: '/blog/fabricacao-sob-medida-vs-linha-padrao',
    tags: ['sob medida', 'linha padrão', 'projeto', 'orçamento'],
  },
  {
    type: 'blog',
    title: 'Bancada em inox sob medida: como especificar corretamente',
    description: 'Altura, profundidade, espessura da chapa, tipo de acabamento e dreno integrado — especificações que definem a qualidade de uma bancada industrial.',
    path: '/blog/bancada-inox-sob-medida',
    tags: ['bancada', 'cozinha industrial', 'especificação', 'dreno'],
  },
  {
    type: 'blog',
    title: 'Inox 304 vs Inox 316: qual escolher para o seu projeto?',
    description: 'A diferença entre os dois aços inox mais usados na indústria — composição química, resistência à corrosão e quando cada um deve ser especificado.',
    path: '/blog/inox-304-vs-316',
    tags: ['inox 304', 'inox 316', 'molibdênio', 'composição'],
  },
  {
    type: 'blog',
    title: 'Equipamentos em inox em Pouso Alegre, MG: por que escolher uma fábrica local',
    description: 'Fabricar equipamentos em inox com uma empresa de Pouso Alegre significa projeto personalizado, visita técnica, prazo real e suporte pós-entrega.',
    path: '/blog/equipamentos-inox-pouso-alegre',
    tags: ['Pouso Alegre', 'Sul de Minas', 'fábrica local', 'visita técnica'],
  },
  {
    type: 'blog',
    title: 'Cozinha industrial em inox no Sul de Minas: do projeto à entrega',
    description: 'Guia completo para equipar sua cozinha profissional com equipamentos em inox no Sul de Minas Gerais.',
    path: '/blog/cozinha-industrial-inox-sul-de-minas',
    tags: ['cozinha industrial', 'Sul de Minas', 'restaurante', 'padaria'],
  },
  {
    type: 'blog',
    title: 'Corte a laser em Pouso Alegre e Sul de Minas',
    description: 'A POUSINOX® opera serviço de corte a laser de chapas metálicas em Pouso Alegre, MG. Precisão milimétrica para inox, aço carbono e alumínio.',
    path: '/blog/corte-laser-pouso-alegre-sul-minas',
    tags: ['corte a laser', 'chapas metálicas', 'DXF', 'inox'],
  },
]

const paginasEstaticas: SearchItem[] = [
  {
    type: 'pagina',
    title: 'Corte a Laser',
    description: 'Corte a laser de precisão em chapas metálicas — inox, aço carbono e alumínio. Pouso Alegre, MG.',
    path: '/servicos/corte-laser',
    tags: ['laser', 'corte', 'chapas', 'DXF', 'inox', 'alumínio'],
  },
  {
    type: 'pagina',
    title: 'Sobre a Pousinox',
    description: 'Conheça nossa fábrica, história e equipe em Pouso Alegre, MG.',
    path: '/sobre',
    tags: ['sobre', 'história', 'empresa', 'fábrica', 'equipe'],
  },
  {
    type: 'pagina',
    title: 'Orçamento e Contato',
    description: 'Solicite um orçamento ou entre em contato com nossa equipe.',
    path: '/contato',
    tags: ['orçamento', 'contato', 'whatsapp', 'formulário'],
  },
  {
    type: 'pagina',
    title: 'Pronta Entrega',
    description: 'Produtos disponíveis em estoque para retirada imediata na fábrica.',
    path: '/pronta-entrega',
    tags: ['estoque', 'outlet', 'pronta entrega', 'disponível'],
  },
  {
    type: 'pagina',
    title: 'Blog',
    description: 'Artigos técnicos sobre equipamentos em inox, fabricação e aplicações industriais.',
    path: '/blog',
    tags: ['blog', 'artigos', 'técnico', 'dicas'],
  },
]

const segmentosIndex: SearchItem[] = segmentos.map(s => ({
  type: 'segmento' as const,
  title: s.titulo,
  description: s.tagline,
  path: `/segmentos/${s.slug}`,
  tags: s.produtos.slice(0, 5),
}))

export const searchIndex: SearchItem[] = [
  ...paginasEstaticas,
  ...segmentosIndex,
  ...blogPosts,
]

export function matchSearch(item: SearchItem, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return false
  return (
    item.title.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    item.tags.some(t => t.toLowerCase().includes(q))
  )
}
