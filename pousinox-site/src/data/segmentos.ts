import heroRestaurantes from '../assets/hero-restaurantes.webp'
import heroPanificacao from '../assets/hero-panificacao.webp'
import heroHospitalar from '../assets/hero-hospitalar.webp'
import heroLaboratorio from '../assets/hero-laboratorio.webp'
import heroHotelaria from '../assets/hero-hotelaria.webp'
import heroComercio from '../assets/hero-comercio.webp'
import heroArquitetura from '../assets/hero-arquitetura.webp'
import heroConstrucao from '../assets/hero-construcao.webp'

export interface Segmento {
  slug: string
  titulo: string
  seoTitle: string
  seoDescription: string
  tagline: string
  intro: string
  image: string
  produtos: string[]
  beneficios: { titulo: string; texto: string }[]
}

export const segmentos: Segmento[] = [
  {
    slug: 'restaurantes',
    titulo: 'Restaurantes e Food Service',
    seoTitle: 'Equipamentos em Inox para Restaurantes e Cozinhas Industriais | Pousinox',
    seoDescription: 'Bancadas, pias, mesas de preparo, coifas e armários em aço inox sob medida para restaurantes e cozinhas industriais. Fabricação própria em Pouso Alegre, MG.',
    tagline: 'Equipamentos em inox sob medida para cozinhas profissionais de alto desempenho.',
    intro: 'Cozinhas industriais exigem equipamentos que suportem uso intenso, altas temperaturas e limpeza frequente com produtos químicos. O aço inox é o material ideal: não retém bactérias, resiste à corrosão e mantém o acabamento profissional por décadas. A Pousinox® fabrica bancadas, pias, mesas de preparo, armários e toda a linha de mobiliário para restaurantes, bares, lanchonetes e cozinhas industriais, com projeto sob medida para o seu espaço e atendimento às normas da Vigilância Sanitária.',
    image: heroRestaurantes,
    produtos: [
      'Bancadas sob medida',
      'Pias industriais simples e duplas',
      'Mesas de preparo',
      'Armários e gaveteiros',
      'Prateleiras e suportes',
      'Cubas com dreno',
      'Coifas e exaustores',
      'Estantes para câmaras frias',
    ],
    beneficios: [
      {
        titulo: 'Higiene garantida',
        texto: 'O inox não é poroso, não retém gordura nem bactérias, e resiste a desinfetantes e produtos de limpeza de uso profissional. Essencial para cumprir as normas da Vigilância Sanitária.',
      },
      {
        titulo: 'Durabilidade industrial',
        texto: 'Suporta o uso intenso de cozinhas que funcionam 12 a 16 horas por dia, sete dias por semana, sem deformar, enferrujar ou perder o acabamento.',
      },
      {
        titulo: 'Projeto sob medida',
        texto: 'Cada cozinha tem um layout diferente. Fabricamos cada peça nas dimensões exatas do seu espaço, maximizando a produtividade da equipe e o aproveitamento de área.',
      },
      {
        titulo: 'Conformidade sanitária',
        texto: 'Nossos equipamentos são produzidos com aço AISI 304, o padrão exigido pela Anvisa para cozinhas de manipulação de alimentos, com solda contínua e ausência de frestas.',
      },
    ],
  },
  {
    slug: 'panificacao',
    titulo: 'Panificação e Confeitaria',
    seoTitle: 'Equipamentos em Inox para Panificação e Confeitaria | Pousinox',
    seoDescription: 'Mesas de trabalho, bancadas, armários e estantes em aço inox sob medida para padarias e confeitarias. Higiene, resistência e praticidade para produção em escala.',
    tagline: 'Estruturas em inox para padarias e confeitarias com higiene e resistência para produção diária.',
    intro: 'Padarias e confeitarias trabalham com farinha, açúcar, manteiga e outros ingredientes que exigem superfícies de fácil limpeza e resistentes à umidade constante. A Pousinox® fabrica mesas de trabalho, bancadas de produção, estantes para bandejas e formas, cubas de higienização e carrinhos de transporte em aço inox, projetados para o ritmo intenso das operações de panificação. Tudo sob medida para o tamanho e layout da sua produção.',
    image: heroPanificacao,
    produtos: [
      'Mesas de trabalho e manipulação',
      'Bancadas de produção',
      'Armários para utensílios',
      'Estantes para bandejas e formas',
      'Prateleiras de resfriamento',
      'Cubas de higienização',
      'Carrinhos para transporte',
      'Suportes e acessórios',
    ],
    beneficios: [
      {
        titulo: 'Superfície lisa e antiderrapante',
        texto: 'As bancadas em inox possuem superfície lisa que facilita a manipulação de massas e a limpeza entre produções, reduzindo o risco de contaminação cruzada.',
      },
      {
        titulo: 'Resistência à umidade',
        texto: 'O aço inox não enferruja nem incha com a umidade constante gerada por fornos, câmaras frias e lavagens frequentes, garantindo vida útil muito superior à madeira ou outros materiais.',
      },
      {
        titulo: 'Otimização do espaço',
        texto: 'Projetamos as estruturas sob medida para aproveitar ao máximo o espaço da sua padaria, com estantes, prateleiras e bancadas dimensionadas para o seu volume de produção.',
      },
      {
        titulo: 'Fácil higienização',
        texto: 'Superfícies sem frestas, soldas contínuas e acabamento escovado que não acumula resíduos. Limpeza rápida entre turnos sem risco de contaminação dos alimentos.',
      },
    ],
  },
  {
    slug: 'hospitalar',
    titulo: 'Hospitalar e Clínicas',
    seoTitle: 'Mobiliário em Inox para Hospitais e Clínicas | Pousinox',
    seoDescription: 'Carrinhos de curativo, bancadas, mesas de procedimento e armários em aço inox para hospitais e clínicas. Fabricação sob medida com rigor higiênico e durabilidade.',
    tagline: 'Mobiliário em inox com rigor higiênico e durabilidade para ambientes de saúde.',
    intro: 'Ambientes hospitalares e clínicas exigem mobiliário que suporte esterilização frequente, resistência a desinfetantes de alto nível e higiene absoluta. O aço inox AISI 304 é o padrão internacional para mobiliário médico: não é poroso, resiste à autoclave e a produtos clorados, e não oferece superfície para proliferação de micro-organismos. A Pousinox® fabrica carrinhos de curativo, mesas de procedimento, bancadas, armários hospitalares e lavabos sob medida, atendendo hospitais, clínicas, consultórios e centros cirúrgicos.',
    image: heroHospitalar,
    produtos: [
      'Carrinhos de curativo',
      'Mesas de apoio clínico',
      'Bancadas de procedimento',
      'Suportes de soro',
      'Armários hospitalares',
      'Mesas de instrumentação',
      'Cubas e lavabos',
      'Estantes para materiais',
    ],
    beneficios: [
      {
        titulo: 'Esterilizável e resistente à autoclave',
        texto: 'O inox suporta processos de esterilização por vapor, produtos clorados e desinfetantes de alto nível sem perder estrutura, cor ou acabamento.',
      },
      {
        titulo: 'Zero porosidade',
        texto: 'Superfície não porosa que não retém bactérias, vírus ou fungos — fundamental em UTIs, centros cirúrgicos e salas de procedimento.',
      },
      {
        titulo: 'Conformidade com normas sanitárias',
        texto: 'Fabricação com aço AISI 304, soldas contínuas e acabamento escovado, atendendo às normas da ANVISA e da RDC 50 para projetos físicos de estabelecimentos de saúde.',
      },
      {
        titulo: 'Mobilidade e ergonomia',
        texto: 'Carrinhos e suportes projetados com rodízios de qualidade hospitalar, travas de segurança e dimensões ergonômicas para facilitar o trabalho das equipes de saúde.',
      },
    ],
  },
  {
    slug: 'laboratorio',
    titulo: 'Laboratório Farmacêutico',
    seoTitle: 'Bancadas e Equipamentos em Inox para Laboratórios Farmacêuticos | Pousinox',
    seoDescription: 'Bancadas de laboratório, armários, mesas de pesagem e estruturas em aço inox resistentes a produtos químicos para laboratórios farmacêuticos. Pousinox, Pouso Alegre, MG.',
    tagline: 'Estruturas em inox resistentes a produtos químicos para laboratórios de alta exigência.',
    intro: 'Laboratórios farmacêuticos operam com reagentes, solventes e produtos químicos que exigem superfícies com altíssima resistência à corrosão e fácil descontaminação. O aço inox 304 e 316 é o material de referência para ambientes de pesquisa e produção farmacêutica. A Pousinox® fabrica bancadas de laboratório, armários para reagentes, mesas de pesagem, cubas de higienização e estruturas anticontaminação sob medida, atendendo às normas das boas práticas de fabricação (BPF) e às exigências da ANVISA para ambientes controlados.',
    image: heroLaboratorio,
    produtos: [
      'Bancadas de laboratório',
      'Armários para reagentes',
      'Mesas de pesagem',
      'Cubas de higienização',
      'Estantes para equipamentos',
      'Carrinhos de transporte',
      'Suportes e acessórios',
      'Estruturas anticontaminação',
    ],
    beneficios: [
      {
        titulo: 'Resistência química superior',
        texto: 'O inox 316 possui maior resistência a ácidos e cloretos do que o 304, sendo indicado para laboratórios com exposição a reagentes agressivos. Especificamos o aço correto para cada aplicação.',
      },
      {
        titulo: 'Conformidade com BPF e ANVISA',
        texto: 'Bancadas com soldas contínuas, sem frestas e com acabamento sanitário que facilita a limpeza e a auditoria de boas práticas de fabricação em ambientes farmacêuticos.',
      },
      {
        titulo: 'Precisão e estabilidade',
        texto: 'Estruturas rígidas e niveladas para equipamentos analíticos sensíveis, como balanças de precisão, espectrofotômetros e sistemas cromatográficos.',
      },
      {
        titulo: 'Projeto para sala limpa',
        texto: 'Fabricamos móveis e estruturas compatíveis com ambientes de sala limpa (clean room), com acabamento sanitário e sem arestas vivas ou pontos de acúmulo de partículas.',
      },
    ],
  },
  {
    slug: 'hotelaria',
    titulo: 'Hotelaria e Catering',
    seoTitle: 'Equipamentos em Inox para Hotelaria e Catering | Pousinox',
    seoDescription: 'Balcões de buffet, carrinhos de serviço, mesas de apoio e bancadas em aço inox para hotéis, pousadas e serviços de catering. Fabricação sob medida com acabamento de alto padrão.',
    tagline: 'Equipamentos em inox com acabamento e funcionalidade de alto padrão para hotelaria e eventos.',
    intro: 'Hotéis, pousadas e empresas de catering precisam de equipamentos que combinem funcionalidade, resistência e aparência impecável — afinal, eles fazem parte da experiência do hóspede. O inox oferece exatamente isso: durabilidade para uso intenso, limpeza rápida entre serviços e visual profissional que agrega valor à operação. A Pousinox® fabrica balcões de buffet, carrinhos de serviço, mesas de apoio, bancadas de cozinha e estruturas para eventos sob medida, com acabamento escovado ou espelhado de acordo com o projeto.',
    image: heroHotelaria,
    produtos: [
      'Balcões de buffet',
      'Carrinhos de serviço',
      'Mesas de apoio',
      'Bancadas de cozinha',
      'Armários de estoque',
      'Estantes para utensílios',
      'Cubas e pias',
      'Estruturas para eventos',
    ],
    beneficios: [
      {
        titulo: 'Visual profissional',
        texto: 'O acabamento escovado ou espelhado do inox transmite sofisticação e limpeza — atributos que os hóspedes associam diretamente à qualidade do serviço prestado.',
      },
      {
        titulo: 'Limpeza rápida entre serviços',
        texto: 'Entre um evento e outro, os equipamentos precisam ser higienizados com agilidade. O inox permite limpeza completa em minutos, sem deixar marcas ou odores residuais.',
      },
      {
        titulo: 'Resistência ao uso intenso',
        texto: 'Carrinhos, balcões e mesas passam por dezenas de serviços por semana. O aço inox mantém integridade estrutural e aparência mesmo sob uso contínuo e movimentação constante.',
      },
      {
        titulo: 'Personalização por projeto',
        texto: 'Fabricamos cada peça com as dimensões e especificações do seu ambiente — seja o salão do hotel, a cozinha central ou os espaços para eventos ao ar livre.',
      },
    ],
  },
  {
    slug: 'varejo',
    titulo: 'Comércio e Varejo',
    seoTitle: 'Equipamentos em Inox para Açougues, Peixarias e Supermercados | Pousinox',
    seoDescription: 'Balcões, bancadas de corte, pias e expositores em aço inox para açougues, peixarias, padarias e supermercados. Fabricação sob medida com higiene e durabilidade.',
    tagline: 'Balcões, bancadas e estruturas em inox para comércio alimentício de alto movimento.',
    intro: 'Açougues, peixarias, padarias e supermercados operam com alto volume de manipulação de alimentos e limpeza constante. Nesses ambientes, a escolha do material de bancadas, balcões e pias é determinante para a saúde dos clientes e para a conformidade com a Vigilância Sanitária. O aço inox é obrigatório em muitos desses estabelecimentos justamente porque não retém cheiro, não mancha com sangue ou gordura e resiste à limpeza agressiva com hipoclorito. A Pousinox® fabrica toda a linha de equipamentos sob medida para o comércio alimentício varejista.',
    image: heroComercio,
    produtos: [
      'Balcões de atendimento',
      'Bancadas para açougue',
      'Pias e cubas para peixaria',
      'Expositores e gôndolas',
      'Mesas de corte',
      'Prateleiras comerciais',
      'Armários e arquivos',
      'Muretas e divisórias',
    ],
    beneficios: [
      {
        titulo: 'Sem retenção de odor ou sangue',
        texto: 'Açougues e peixarias exigem superfícies que não retenham cheiro nem fluidos orgânicos. O inox é o único material que oferece esse nível de higiene com durabilidade comercial.',
      },
      {
        titulo: 'Resistência a hipoclorito e detergentes',
        texto: 'A limpeza diária com cloro, detergente e água quente não degrada o inox. Ao contrário do plástico ou madeira, ele mantém o aspecto original mesmo após anos de uso.',
      },
      {
        titulo: 'Apresentação profissional',
        texto: 'Balcões e expositores em inox transmitem limpeza e qualidade ao consumidor, influenciando positivamente a decisão de compra e a percepção de valor dos produtos expostos.',
      },
      {
        titulo: 'Conformidade com a Vigilância Sanitária',
        texto: 'Fabricamos equipamentos de acordo com as exigências dos órgãos sanitários municipais e estaduais, com material aprovado para contato com alimentos e acabamento sem frestas.',
      },
    ],
  },
  {
    slug: 'arquitetura',
    titulo: 'Arquitetura e Projetos Residenciais',
    seoTitle: 'Inox sob Medida para Arquitetura e Projetos Residenciais | Pousinox',
    seoDescription: 'Revestimentos, painéis decorativos, corrimãos, portas e elementos em aço inox para arquitetura e design de interiores. Peças únicas fabricadas sob medida em Pouso Alegre, MG.',
    tagline: 'Peças em inox únicas e personalizadas para projetos de arquitetura e design de alto padrão.',
    intro: 'O aço inox vem se consolidando como material nobre na arquitetura contemporânea. Sua capacidade de assumir diferentes acabamentos — escovado, espelhado, jateado, colorido — aliada à resistência e longevidade, faz dele um aliado dos arquitetos em projetos que buscam sofisticação e durabilidade. A Pousinox® atende escritórios de arquitetura e design com a fabricação de peças únicas e sob medida: revestimentos, painéis, portas, divisórias, corrimãos de design e elementos decorativos com acabamento e precisão de alto padrão.',
    image: heroArquitetura,
    produtos: [
      'Revestimentos em inox',
      'Painéis decorativos',
      'Portas e portais',
      'Divisórias e biombos',
      'Molduras e acabamentos',
      'Mesas e bancadas de design',
      'Estruturas e suportes',
      'Elementos escultóricos',
    ],
    beneficios: [
      {
        titulo: 'Versatilidade de acabamentos',
        texto: 'Escovado, espelhado, jateado, colorido por PVD — o inox oferece diferentes texturas e reflexos que se adaptam a estilos de projeto variados, do minimalista ao contemporâneo.',
      },
      {
        titulo: 'Longevidade sem manutenção',
        texto: 'Diferente de outros materiais de alto padrão, o inox não precisa de tratamento periódico, não oxida em ambientes externos e mantém o aspecto original por décadas.',
      },
      {
        titulo: 'Precisão de fabricação',
        texto: 'Utilizamos corte a laser e dobradeira CNC para entregar peças com tolerâncias milimétricas, essencial para projetos arquitetônicos onde o encaixe perfeito é determinante.',
      },
      {
        titulo: 'Parceria com o arquiteto',
        texto: 'Trabalhamos a partir do projeto do escritório, com agilidade no orçamento, produção do protótipo quando necessário e entrega dentro do cronograma da obra.',
      },
    ],
  },
  {
    slug: 'construcao',
    titulo: 'Construção Civil',
    seoTitle: 'Corrimãos, Guarda-corpos e Estruturas em Inox para Construção Civil | Pousinox',
    seoDescription: 'Corrimãos, guarda-corpos, grades, portões e estruturas metálicas em aço inox para obras residenciais, comerciais e industriais. Fabricação sob medida em Pouso Alegre, MG.',
    tagline: 'Corrimãos, guarda-corpos e estruturas em inox com acabamento superior para obra.',
    intro: 'Na construção civil, o inox é sinônimo de durabilidade e valor agregado. Corrimãos, guarda-corpos, grades, portões e estruturas metálicas em aço inox não enferrujam, não precisam de pintura e mantêm o acabamento visual mesmo em áreas expostas à chuva, sol e umidade. A Pousinox® atende construtoras, incorporadoras e obras residenciais com fabricação sob medida de todos os elementos em inox, com projeto técnico, produção em fábrica própria e instalação quando aplicável em Pouso Alegre e região sul de Minas.',
    image: heroConstrucao,
    produtos: [
      'Corrimãos e guarda-corpos',
      'Grades e cercas',
      'Portões e portas',
      'Calhas e rufos',
      'Estruturas metálicas',
      'Suportes e fixações',
      'Escadas e mezaninos',
      'Coberturas e pergolados',
    ],
    beneficios: [
      {
        titulo: 'Zero manutenção pós-instalação',
        texto: 'Diferente do ferro pintado que enferruja e exige repintura periódica, o inox é instalado uma vez e mantém o aspecto original por décadas — mesmo em fachadas expostas à chuva e sol.',
      },
      {
        titulo: 'Valorização do imóvel',
        texto: 'Corrimãos e guarda-corpos em inox são percebidos como elemento de acabamento superior, agregando valor ao imóvel e diferenciando o projeto no mercado.',
      },
      {
        titulo: 'Resistência estrutural',
        texto: 'O aço inox oferece relação resistência/peso superior a muitos outros materiais, permitindo estruturas mais esbeltas sem comprometer a segurança exigida pelas normas técnicas (ABNT NBR 6118).',
      },
      {
        titulo: 'Fabricação com projeto técnico',
        texto: 'Desenvolvemos o projeto técnico das peças com base nas medidas da obra, com cálculo de fixações e especificações para atender à norma de guarda-corpos (ABNT NBR 14718).',
      },
    ],
  },
]

export const segmentoMap = Object.fromEntries(segmentos.map(s => [s.slug, s]))
