import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title: string
  description: string
  path?: string
}

const BASE_URL = 'https://pousinox.com.br'
const OG_IMAGE = `${BASE_URL}/og-image.webp`

const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'Manufacturer'],
  '@id': `${BASE_URL}/#business`,
  name: 'POUSINOX® — A Arte em Inox',
  alternateName: ['Pousinox', 'Pousinox Inox', 'POUSINOX Pouso Alegre'],
  description: 'Fabricante de equipamentos e mobiliário em aço inox sob medida em Pouso Alegre, MG. Atendemos restaurantes, hospitais, laboratórios, arquitetura e construção civil em todo o Sul de Minas Gerais e Brasil.',
  url: BASE_URL,
  telephone: '+55-35-3423-8994',
  email: 'contato@pousinox.com.br',
  foundingDate: '2001',
  logo: `${BASE_URL}/favicon-pousinox.png`,
  image: `${BASE_URL}/og-image.webp`,
  priceRange: '$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Av. Antonio Mariosa, 4545',
    addressLocality: 'Pouso Alegre',
    addressRegion: 'MG',
    postalCode: '37550-360',
    addressCountry: 'BR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -22.2430805,
    longitude: -45.9564762,
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday'], opens: '07:30', closes: '18:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Friday'], opens: '07:30', closes: '17:00' },
  ],
  areaServed: [
    { '@type': 'AdministrativeArea', name: 'Sul de Minas Gerais' },
    { '@type': 'City', name: 'Pouso Alegre' },
    { '@type': 'City', name: 'Varginha' },
    { '@type': 'City', name: 'Poços de Caldas' },
    { '@type': 'City', name: 'Itajubá' },
    { '@type': 'City', name: 'Santa Rita do Sapucaí' },
    { '@type': 'City', name: 'Alfenas' },
    { '@type': 'City', name: 'Três Corações' },
    { '@type': 'City', name: 'Lavras' },
    { '@type': 'City', name: 'Passos' },
    { '@type': 'City', name: 'Machado' },
    { '@type': 'City', name: 'Cambuí' },
    { '@type': 'City', name: 'Extrema' },
    { '@type': 'State', name: 'Minas Gerais' },
  ],
  knowsAbout: [
    'equipamentos inox sob medida',
    'fabricação de inox Pouso Alegre',
    'bancada inox cozinha industrial',
    'mesa inox restaurante',
    'coifa inox',
    'pia inox',
    'mobiliário hospitalar inox',
    'corte a laser inox Sul de Minas',
    'aço inox 304',
    'aço inox 430',
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Equipamentos em Aço Inox',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Bancadas em Inox' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Mesas em Inox' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Coifas em Inox' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Pias em Inox' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Corte a Laser em Inox' } },
    ],
  },
  hasMap: 'https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8',
  sameAs: [
    'https://www.instagram.com/pousinox/',
    'https://www.facebook.com/www.pousinox.com.br/',
    'https://www.linkedin.com/company/pousinox-ltda/',
    'https://www.youtube.com/@pousinoxarteeminox41',
    'https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '43',
    bestRating: '5',
  },
}

export default function SEO({ title, description, path = '' }: SEOProps) {
  const url = `${BASE_URL}${path}`
  const fullTitle = title.includes('Pousinox') || title.includes('POUSINOX')
    ? title
    : `${title} | POUSINOX® Pouso Alegre`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="inox Pouso Alegre, equipamentos inox Sul de Minas, fábrica inox Pouso Alegre MG, bancada inox cozinha industrial, mesa inox restaurante, coifa inox, pia inox, mobiliário hospitalar inox, corte a laser inox Sul de Minas, aço inox sob medida, fabricante inox MG, POUSINOX" />

      {/* Geo tags — essencial para SEO local */}
      <meta name="geo.region" content="BR-MG" />
      <meta name="geo.placename" content="Pouso Alegre, Minas Gerais" />
      <meta name="geo.position" content="-22.2430805;-45.9564762" />
      <meta name="ICBM" content="-22.2430805, -45.9564762" />

      {/* Canonical */}
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="POUSINOX®" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {/* Schema.org LocalBusiness */}
      <script type="application/ld+json">
        {JSON.stringify(LOCAL_BUSINESS_SCHEMA)}
      </script>
    </Helmet>
  )
}
