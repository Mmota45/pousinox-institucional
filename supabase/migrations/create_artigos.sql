-- Tabela de artigos do blog
CREATE TABLE IF NOT EXISTS artigos (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  resumo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tempo_leitura TEXT NOT NULL DEFAULT '5 min',
  meta_descricao TEXT DEFAULT '',
  palavras_chave TEXT[] DEFAULT '{}',
  publicado BOOLEAN DEFAULT TRUE,
  data_publicacao TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Leitura pública (blog é público)
ALTER TABLE artigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_publica" ON artigos FOR SELECT USING (publicado = TRUE);
CREATE POLICY "insercao_admin" ON artigos FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "atualizacao_admin" ON artigos FOR UPDATE USING (TRUE);
CREATE POLICY "exclusao_admin" ON artigos FOR DELETE USING (TRUE);

-- Migração dos artigos existentes
INSERT INTO artigos (slug, titulo, categoria, resumo, conteudo, tempo_leitura, data_publicacao) VALUES

('por-que-inox-304-em-cozinhas-profissionais',
'Por que o aço inox AISI 304 é o padrão em cozinhas profissionais?',
'Restaurantes e Food Service',
'Entenda as propriedades do inox 304 que o tornam a escolha obrigatória em cozinhas industriais: resistência à corrosão, higiene e durabilidade mesmo sob uso intenso.',
'O aço inox AISI 304 é, sem dúvida, o material mais utilizado em cozinhas profissionais ao redor do mundo — e não é por acaso. A composição química desse aço, com 18% de cromo e 8% de níquel, forma uma camada passiva de óxido que protege a superfície contra a corrosão, mesmo em ambientes úmidos e com contato constante com alimentos ácidos, sal e produtos de limpeza.

**Resistência à corrosão**

Em uma cozinha industrial, bancadas, pias e mesas de preparo são expostas diariamente a umidade, ácidos orgânicos (vinagre, sucos cítricos) e agentes de limpeza agressivos. O inox 304 resiste a todos esses agentes sem oxidar ou liberar contaminantes nos alimentos — requisito básico das normas sanitárias da ANVISA e do Ministério da Saúde.

**Higienização facilitada**

A superfície do inox 304 é não porosa, o que impede o acúmulo de bactérias e facilita a higienização. Com um simples pano úmido e detergente neutro, a superfície fica completamente limpa. Esse atributo é fundamental em ambientes onde contaminação cruzada representa risco real à saúde dos clientes.

**Durabilidade sob uso intenso**

Cozinhas profissionais trabalham de 10 a 16 horas por dia, 7 dias por semana. Equipamentos e mobiliário precisam suportar impactos, peso e uso contínuo sem deformar ou degradar. A resistência mecânica do inox 304 garante décadas de uso com manutenção mínima.

**Conformidade com normas**

A Resolução RDC 216/2004 da ANVISA e a NBR 14028 estabelecem critérios claros para materiais utilizados em superfícies de preparo de alimentos. O inox 304 atende integralmente a essas exigências, facilitando a obtenção e renovação de alvarás sanitários.

**Na POUSINOX®**

Todos os nossos equipamentos para food service são fabricados em aço inox AISI 304. Do corte a laser ao acabamento escovado, cada peça passa por controle de qualidade rigoroso antes de chegar à sua cozinha. Fabricamos sob medida para que cada solução se encaixe perfeitamente no seu espaço e rotina de trabalho.',
'5 min', '10 Mar 2026'),

('mobiliario-hospitalar-em-inox',
'Mobiliário hospitalar em inox: higiene e segurança acima de tudo',
'Hospitalar e Clínicas',
'Clínicas e hospitais têm exigências rigorosas para mobiliário. Saiba como os equipamentos em inox atendem às normas sanitárias e facilitam a rotina das equipes de saúde.',
'O ambiente hospitalar é um dos mais exigentes quando o assunto é higiene e segurança. Carrinhos de curativo, mesas de procedimento, suportes e armários precisam ser fabricados com materiais que não acumulem agentes patogênicos, resistam à desinfecção química frequente e durem décadas sem desgaste visível.

**Por que o inox é obrigatório em ambientes de saúde**

A RDC 50/2002 da ANVISA, que regulamenta o projeto físico de estabelecimentos de saúde, exige que superfícies de trabalho em áreas críticas sejam de material liso, lavável, impermeável e resistente a desinfetantes. O aço inox atende a todos esses requisitos de forma superior a qualquer outro material.

**Resistência a desinfetantes**

Hipoclorito de sódio, álcool 70%, glutaraldeído e outros agentes hospitalares são extremamente corrosivos. O inox AISI 304 e o AISI 316 (para ambientes com maior agressividade química) resistem a esses produtos sem oxidar, descascar ou liberar substâncias nocivas.

**Carrinhos e mesas com design funcional**

Na POUSINOX®, desenvolvemos carrinhos hospitalares com prateleiras ajustáveis, rodízios com travas, cantos arredondados (que facilitam a limpeza e evitam acidentes) e acabamento escovado que mascara pequenos riscos mantendo a aparência limpa.

**Mesas de procedimento e exame**

Fabricadas sob medida para cada especialidade — de consultórios odontológicos a salas cirúrgicas —, nossas mesas combinam resistência estrutural com acabamento que facilita a higienização entre cada atendimento.

**Resultado: segurança para pacientes e profissionais**

Investir em mobiliário hospitalar de qualidade não é custo — é prevenção de infecções hospitalares (IH), que representam um dos maiores riscos para pacientes internados e um dos maiores custos operacionais de hospitais e clínicas.',
'4 min', '28 Fev 2026'),

('inox-na-arquitetura',
'Inox na arquitetura: tendência ou necessidade?',
'Arquitetura e Projetos Residenciais',
'Arquitetos e designers têm apostado cada vez mais no inox como elemento estético e funcional. Veja exemplos de aplicações em projetos residenciais e comerciais.',
'Durante décadas, o inox foi associado exclusivamente a ambientes industriais e de alimentação. Hoje, o cenário mudou completamente: o aço inox tornou-se um dos materiais de acabamento mais desejados em projetos de arquitetura de alto padrão, tanto residenciais quanto comerciais.

**A estética do inox no design contemporâneo**

O acabamento escovado do inox cria um visual sofisticado e atemporal. Diferentemente de outros materiais metálicos, o inox não enferruja, não perde o brilho e mantém o aspecto original por décadas — mesmo em ambientes externos expostos à umidade e variações climáticas.

**Aplicações em projetos residenciais**

- **Cozinhas planejadas**: ilhas centrais, coifas, painéis de parede e frentes de armários em inox são tendência em cozinhas de alto padrão
- **Banheiros e lavabos**: espelhos, bancadas, suportes e acessórios em inox combinam sofisticação com praticidade
- **Escadas e mezaninos**: guarda-corpos e corrimãos em inox estrutural com vidro temperado
- **Fachadas e painéis externos**: revestimentos e elementos decorativos que resistem às intempéries

**Fabricação sob medida como diferencial**

Projetos de arquitetura são únicos. Uma ilha de cozinha precisa ter exatamente as medidas do projeto; um guarda-corpo precisa seguir o ângulo específico da escada. Por isso, a fabricação sob medida é fundamental — e é o que a POUSINOX® faz desde 2001.

**Parceria com arquitetos e designers**

Trabalhamos como parceiros estratégicos de escritórios de arquitetura: analisamos o projeto, sugerimos soluções técnicas, entregamos arquivo DXF/DWG quando necessário e produzimos com tolerância milimétrica. Do briefing ao acabamento, garantimos que a peça chegue à obra exatamente como foi projetada.',
'6 min', '15 Fev 2026'),

('corrimoes-guarda-corpos-inox',
'Corrimãos e guarda-corpos em inox: segurança com design',
'Construção Civil',
'Além de atender às normas de segurança da ABNT, corrimãos em inox oferecem resistência à oxidação e acabamento moderno para obras residenciais e comerciais.',
'Corrimãos e guarda-corpos são elementos de segurança obrigatórios em qualquer edificação. Mas além de proteger, eles também compõem o visual da obra — e a escolha do material impacta diretamente na durabilidade, manutenção e estética do espaço.

**Normas que regem o projeto**

A NBR 9077 (Saídas de emergência) e a NBR 14718 (Guarda-corpos para edificação) estabelecem os requisitos mínimos de resistência estrutural, altura mínima (1,05m a 1,10m dependendo do tipo de edificação) e espaçamento entre balaústres. O inox atende — e supera — todos esses requisitos.

**Vantagens do inox sobre o ferro galvanizado**

O ferro galvanizado era a opção mais comum no passado. Mas o revestimento de zinco se desgasta com o tempo, especialmente em ambientes externos e litorâneos, levando à oxidação. O inox, por sua natureza, não depende de tratamento superficial para resistir à corrosão — a proteção é intrínseca ao material.

**Tipos de acabamento**

- **Escovado (satinado)**: visual sofisticado, mascara arranhões do dia a dia, mais comum em projetos residenciais de alto padrão
- **Polido espelhado**: brilho intenso, visual impactante, exige maior manutenção para conservar o aspecto
- **Fosco**: aspecto mais industrial, muito usado em projetos comerciais e de arquitetura brutalista

**Combinações com vidro temperado**

Guarda-corpos em perfil de inox com enchimento em vidro temperado 10mm são a combinação mais elegante para escadas internas, varandas e passarelas. O resultado é leve, seguro e visualmente amplo — perfeito para apartamentos e casas de alto padrão.

**Fabricação POUSINOX®**

Produzimos corrimãos e guarda-corpos em perfis tubulares redondos, quadrados ou retangulares, com solda MIG/TIG de alta qualidade e acabamento uniforme. Entregamos cortado, curvado e polido, pronto para instalação.',
'4 min', '5 Fev 2026'),

('como-limpar-conservar-inox',
'Como limpar e conservar equipamentos em inox corretamente',
'Nossa Fábrica',
'Dicas práticas de limpeza e conservação para prolongar a vida útil dos seus equipamentos em aço inox, evitando manchas, riscos e oxidação precoce.',
'O aço inox é reconhecido pela durabilidade, mas isso não significa que não exige cuidados. Uma limpeza inadequada pode causar manchas, riscos e, em casos extremos, oxidação localizada. Com as práticas corretas, seus equipamentos POUSINOX® durarão décadas mantendo o visual original.

**O que usar**

- **Detergente neutro + água morna**: suficiente para a limpeza diária. Aplique com esponja macia ou pano de microfibra, sempre no sentido do acabamento (no sentido das linhas do escovado)
- **Álcool isopropílico**: excelente para remover gordura e manchas de impressão digital sem deixar resíduos
- **Vinagre branco diluído**: eficiente para remover manchas de calcário e depósitos minerais de água dura

**O que NÃO usar**

- Esponjas de aço ou palha de aço: riscam permanentemente a superfície e depositam partículas de ferro que oxidam
- Cloro concentrado: em contato prolongado, pode atacar a camada passiva do inox
- Produtos com cloretos: evite limpadores à base de cloro sem enxágue imediato
- Materiais abrasivos: pós de limpeza e esponjas ásperas causam microriscos que acumulam sujeira

**Cuidado com a direção do polimento**

Sempre limpe no sentido das linhas do acabamento escovado — isso evita riscos visíveis e mantém o aspecto uniforme da superfície.

**Manutenção preventiva**

Aplique uma fina camada de óleo mineral ou cera específica para inox a cada 3-6 meses. Isso cria uma barreira protetora adicional e facilita a limpeza do cotidiano.

**Manchas difíceis**

Para manchas de ferrugem de transferência (causadas por contato com outros metais), use uma solução de ácido oxálico diluído (produtos específicos para inox disponíveis em lojas especializadas) e enxágue abundantemente em seguida.',
'3 min', '20 Jan 2026'),

('fabricacao-sob-medida-vs-linha-padrao',
'Fabricação sob medida vs. linha padrão: qual escolher?',
'Projetos Entregues',
'Cada projeto tem suas particularidades. Entenda quando vale a pena investir em fabricação sob medida e quando a linha padrão resolve de forma ágil e econômica.',
'Uma das dúvidas mais comuns de quem está equipando uma cozinha industrial, uma clínica ou um espaço comercial é: devo optar por produtos da linha padrão ou investir em fabricação sob medida? A resposta depende de alguns fatores-chave que vamos detalhar aqui.

**Quando a linha padrão resolve**

Produtos padronizados — mesas de 1,50m, bancadas de 60cm de profundidade, armários suspensos com medidas padrão — são ideais quando:

- O espaço disponível comporta as medidas convencionais sem adaptações
- O orçamento é mais restrito e o prazo é curto
- A necessidade é de reposição de um item já existente com a mesma especificação
- Não há requisitos técnicos especiais de carga, acabamento ou formato

**Quando sob medida é o caminho certo**

A fabricação sob medida se justifica quando:

- O espaço tem dimensões irregulares (paredes fora de esquadro, pilares, desníveis)
- O projeto de arquitetura exige integração precisa com outros elementos
- Há requisitos técnicos específicos: capacidade de carga elevada, acabamento especial, perfuração para equipamentos, dreno integrado
- O cliente quer diferencial competitivo — uma cozinha profissional sob medida é mais eficiente operacionalmente do que uma adaptada com produtos padrão

**O processo na POUSINOX®**

Nosso processo de fabricação sob medida começa com uma consulta técnica para entender o espaço, o uso e o objetivo. Desenvolvemos o projeto com desenho técnico detalhado (com aprovação do cliente antes de cortar qualquer peça), fabricamos internamente com tecnologia CNC e entregamos no prazo combinado.

**Custo-benefício real**

Um equipamento sob medida que se encaixa perfeitamente no espaço, otimiza o fluxo de trabalho e dura 20+ anos tem custo-benefício superior a qualquer adaptação improvisada. Na prática, clientes que escolhem sob medida raramente voltam à linha padrão.',
'5 min', '8 Jan 2026'),

('bancada-inox-sob-medida',
'Bancada em inox sob medida: como especificar corretamente',
'Restaurantes e Food Service',
'Altura, profundidade, espessura da chapa, tipo de acabamento e dreno integrado — saiba quais são as especificações que definem a qualidade de uma bancada industrial em inox.',
'A bancada de inox é o equipamento central de qualquer cozinha profissional, açougue, laboratório ou área de manipulação de alimentos. Escolher uma bancada errada — com espessura inadequada, sem dreno, altura incorreta ou sem reforço estrutural — pode comprometer a operação por anos. Neste guia, explicamos como especificar corretamente.

**Altura ergonômica**

A altura padrão de bancadas industriais é 85 cm, mas o ideal varia conforme a atividade. Para manipulação de massas (padaria e confeitaria), bancadas mais baixas — entre 75 e 80 cm — reduzem o esforço. Para trabalhos de detalhe (laboratório, cozinha fina), 90 cm pode ser mais ergonômico. Sempre considere a estatura média da equipe que vai usar a bancada.

**Espessura da chapa**

- **0,8 mm (18 gauge)**: uso leve, escritórios e áreas de apoio
- **1,0 mm (20 gauge)**: uso moderado, cozinhas domésticas e áreas de apoio industrial
- **1,2 mm (18 gauge)**: padrão industrial, cozinhas profissionais e açougues
- **1,5 mm ou mais**: uso pesado, mesas de corte, bancadas de laboratório com equipamentos pesados

Na POUSINOX®, o padrão mínimo para cozinhas industriais é 1,2 mm com reforço nas extremidades.

**Profundidade e comprimento**

A profundidade padrão é 60 cm, mas pode variar de 50 cm (espaços compactos) a 80 cm (áreas de produção). O comprimento é sempre sob medida — fabricamos desde 50 cm até 6 metros em peça única, sem emenda.

**Dreno e cuba integrada**

Bancadas de manipulação de alimentos devem ter inclinação de 1% em direção ao dreno central para facilitar a higienização. Pias e cubas integradas podem ser soldadas diretamente na bancada, eliminando frestas onde bactérias se acumulam.

**Acabamento**

- **Escovado 4B**: padrão para cozinhas industriais — mascara arranhões e é fácil de limpar
- **Polido espelhado (BA)**: usado em laboratórios e ambientes controlados
- **Jateado**: acabamento fosco, usado em bancadas de design e arquitetura

**Estrutura e pés**

Pés tubulares com regulagem de nível são essenciais. Estrutura em tubo quadrado 40x40 ou 50x50 mm para bancadas pesadas. Prateleira inferior reforça a estrutura e aumenta a capacidade de armazenamento.

**Na POUSINOX®**

Desenvolvemos o projeto com base nas medidas e necessidades do seu espaço, com desenho técnico para aprovação antes da fabricação. Prazo médio: 7 a 15 dias úteis após aprovação. Atendemos Pouso Alegre e região sul de Minas, com entrega para todo o Brasil.',
'5 min', '18 Mar 2026'),

('inox-304-vs-316',
'Inox 304 vs Inox 316: qual escolher para o seu projeto?',
'Nossa Fábrica',
'A diferença entre os dois aços inox mais usados na indústria — composição química, resistência à corrosão e quando cada um deve ser especificado.',
'O aço inox não é um material único — existem dezenas de ligas diferentes, cada uma com propriedades específicas. Para a maioria das aplicações industriais e comerciais, os tipos AISI 304 e AISI 316 são os mais utilizados. Entender a diferença entre eles evita especificações erradas e custos desnecessários.

**Composição química**

O inox 304 contém 18% de cromo e 8% de níquel. Já o 316 tem 16% de cromo, 10% de níquel e, o que o diferencia, 2% de molibdênio. É esse molibdênio que faz toda a diferença na resistência química.

**Quando usar o 304**

O 304 é o padrão para:
- Cozinhas industriais e food service em geral
- Mobiliário hospitalar e clínicas
- Panificação e confeitaria
- Hotelaria e catering
- Arquitetura e projetos residenciais
- Construção civil (corrimãos, guarda-corpos)

Ele resiste muito bem a ácidos orgânicos (vinagre, sucos, molhos), umidade, temperatura e produtos de limpeza convencionais. Para 90% das aplicações, o 304 é o aço correto.

**Quando usar o 316**

O 316 é especificado quando há:
- Exposição a cloretos em alta concentração (ambientes marinhos, piscinas com cloro)
- Contato com ácidos inorgânicos (clorídrico, sulfúrico) em laboratórios
- Ambientes farmacêuticos com requisitos de sala limpa (GMP)
- Equipamentos para processamento de carnes salgadas ou pescados em alta escala
- Instalações em regiões litorâneas com vento marinho constante

O 316 tem custo aproximadamente 20 a 30% superior ao 304. Especificá-lo quando o 304 resolve é desperdício; não especificá-lo quando é necessário é um erro técnico que resulta em corrosão precoce.

**Como identificar o aço correto**

Na dúvida, uma forma simples de testar é usar um imã: o inox austenítico (304 e 316) não é fortemente magnético. Se o imã gruda com força, pode ser outro tipo de aço. Para confirmação técnica, solicite o certificado do material ao fornecedor — a POUSINOX® fornece certificado de origem e composição para todos os projetos que exigem rastreabilidade.

**Na POUSINOX®**

Trabalhamos com ambos os tipos e especificamos o material correto de acordo com a aplicação de cada projeto. Em caso de dúvida, nossa equipe técnica orienta sem custo no orçamento.',
'4 min', '20 Mar 2026'),

('equipamentos-inox-pouso-alegre',
'Equipamentos em inox em Pouso Alegre, MG: por que escolher uma fábrica local',
'Nossa Fábrica',
'Fabricar equipamentos em inox com uma empresa de Pouso Alegre significa projeto personalizado, visita técnica, prazo real e suporte pós-entrega. Veja as vantagens.',
'Quando você busca equipamentos em inox em Pouso Alegre ou no Sul de Minas Gerais, tem uma vantagem que empresas de outros estados não conseguem oferecer: a proximidade. Mas o que isso significa na prática?

**Visita técnica sem custo adicional**

Antes de fabricar qualquer peça, nossa equipe pode visitar o seu espaço em Pouso Alegre, Varginha, Poços de Caldas, Itajubá, Santa Rita do Sapucaí, Alfenas, Três Corações e municípios vizinhos sem custo de deslocamento adicional. Medimos, fotografamos e identificamos desafios que só aparecem ao vivo — um pilar fora do lugar, uma tubulação que passa pelo meio do ambiente, um desnível no piso.

**Prazo real e logística simplificada**

Com fábrica própria em Pouso Alegre, na Av. Antonio Mariosa, 4545, controlamos todo o processo de fabricação internamente. Isso significa prazos previsíveis, sem dependência de fornecedores externos, e entrega facilitada para toda a região Sul de Minas — sem frete de longa distância nem risco de avarias no transporte.

**Suporte pós-entrega na porta da sua empresa**

Problemas acontecem. Uma regulagem de pé, uma solda que precisa de reforço, um ajuste de dimensão após a instalação. Com uma fábrica local, esses ajustes são feitos rapidamente, sem burocracia e sem esperar semanas por uma assistência técnica de outro estado.

**25 anos servindo o Sul de Minas**

A POUSINOX® foi fundada em 2001 em Pouso Alegre. Em 25 anos, atendemos centenas de restaurantes, hospitais, clínicas, padarias, hotéis e projetos de arquitetura em toda a região. Esse histórico representa um banco de soluções acumulado que beneficia cada novo projeto.

**Quem atendemos na região**

- Restaurantes e redes de alimentação em Pouso Alegre, Varginha e Poços de Caldas
- Hospitais e clínicas médicas e odontológicas em todo o Sul de Minas
- Padarias e confeitarias que precisam de bancadas ergonômicas e higiênicas
- Arquitetos e construtoras com projetos em execução na região
- Laboratórios farmacêuticos e de análises clínicas
- Hotéis e pousadas com necessidade de equipamentos de catering

**Da visita técnica à entrega instalada**

Nosso processo completo em Pouso Alegre e região: visita técnica → projeto com desenho técnico → aprovação do cliente → fabricação CNC → acabamento escovado → entrega e instalação → assistência técnica. Tudo feito por uma equipe de Pouso Alegre, que conhece o Sul de Minas e fala a mesma língua do seu negócio.',
'5 min', '25 Mar 2026'),

('cozinha-industrial-inox-sul-de-minas',
'Cozinha industrial em inox no Sul de Minas: do projeto à entrega',
'Restaurantes e Food Service',
'Guia completo para equipar sua cozinha profissional com equipamentos em inox no Sul de Minas Gerais — o que considerar no projeto, quais peças são obrigatórias e como escolher o fornecedor certo.',
'Equipar uma cozinha industrial é um investimento de longo prazo. Escolher mal os equipamentos significa gastos com manutenção, retrabalho e, no pior caso, interdição sanitária. Este guia foi desenvolvido pela equipe da POUSINOX® com base em 25 anos atendendo restaurantes, padarias, hotéis e cozinhas industriais em Pouso Alegre e em todo o Sul de Minas Gerais.

**O que uma cozinha industrial em inox precisa ter**

A ANVISA (RDC 216/2004) exige que superfícies de preparo de alimentos sejam de material liso, impermeável, resistente à corrosão e de fácil higienização. O aço inox AISI 304 atende todos esses requisitos e é o padrão no setor. Os itens obrigatórios em qualquer cozinha profissional incluem:

- Bancadas e mesas de preparo em inox com dreno integrado
- Pias e cubas em inox (simples, duplas ou triplas conforme a operação)
- Prateleiras e estantes em inox para armazenamento
- Coifas e exaustores em inox sobre equipamentos de cocção
- Armários e gaveteiros para utensílios e EPIs

**Dimensionamento correto para o Sul de Minas**

A realidade dos restaurantes e estabelecimentos de alimentação no Sul de Minas varia muito: desde pequenos bares e lanchonetes em municípios menores até restaurantes de grande porte em Pouso Alegre, Varginha e Poços de Caldas. O dimensionamento correto dos equipamentos depende do número de refeições por turno, do cardápio e do fluxo da equipe.

Na POUSINOX®, fazemos o dimensionamento com base no seu projeto específico — não vendemos produtos de prateleira sem antes entender a sua operação.

**Bancada sob medida vs. bancada padrão**

Para cozinhas no Sul de Minas, onde os espaços muitas vezes não seguem plantas regulares (especialmente em imóveis adaptados), a bancada sob medida faz toda a diferença. Uma bancada que respeita as medidas reais do ambiente elimina cantos mortos, aproveita todo o espaço disponível e integra drenos e cubas na posição exata onde serão usados.

**Prazo e logística na região**

Com fabricação própria em Pouso Alegre, na Av. Antonio Mariosa, 4545, atendemos todo o Sul de Minas com prazo médio de 7 a 15 dias úteis para projetos padrão. Para projetos complexos com múltiplos ambientes, trabalhamos com cronograma de entrega parcial para não interromper a operação.

**Como evitar erros comuns ao equipar uma cozinha industrial**

Os erros mais frequentes: escolher espessura de chapa insuficiente para o uso, não prever dreno na bancada, não calcular a altura ergonômica correta para a equipe, e comprar equipamentos padronizados que não cabem no espaço disponível.

**Solicite uma visita técnica gratuita**

Para estabelecimentos em Pouso Alegre e municípios próximos, fazemos visita técnica gratuita para levantamento de medidas e diagnóstico da cozinha. Entre em contato pelo WhatsApp (35) 3423-8994 ou pelo formulário de orçamento no site.',
'6 min', '22 Mar 2026'),

('corte-laser-pouso-alegre-sul-minas',
'Corte a laser em Pouso Alegre e Sul de Minas: serviço especializado em chapas metálicas',
'Corte a Laser',
'A POUSINOX® opera serviço de corte a laser de chapas metálicas em Pouso Alegre, MG. Precisão milimétrica para inox, aço carbono e alumínio — peças sob medida para indústria, arquitetura e comunicação visual.',
'O corte a laser de chapas metálicas é um dos serviços mais procurados por indústrias, construtoras e empresas de comunicação visual no Sul de Minas Gerais. A POUSINOX® opera em Pouso Alegre com máquina de corte a laser de fibra 3015G, atendendo demandas de toda a região com precisão milimétrica e prazo competitivo.

**O que é corte a laser de fibra e por que é superior**

O corte a laser de fibra utiliza um feixe de luz de alta intensidade para cortar metais com tolerância de décimos de milímetro. Diferente do corte plasma (que gera zona de influência térmica e rebarbas), o laser de fibra entrega bordas limpas, sem deformação e sem necessidade de retrabalho — direto da máquina para a aplicação.

**Materiais que cortamos em Pouso Alegre**

Nossa máquina opera com:
- Aço inox AISI 304, 430 e 316 — espessuras de 0,5 mm a 8 mm
- Aço carbono — espessuras de 1 mm a 20 mm
- Ligas de alumínio — espessuras de 1 mm a 10 mm
- Aço galvanizado e demais chapas planas

**Aplicações mais frequentes no Sul de Minas**

Atendemos clientes de vários setores na região com serviços de corte a laser:

- Indústrias em Pouso Alegre e municípios vizinhos que precisam de componentes metálicos e flanges
- Empresas de comunicação visual que cortam letras, logos e painéis em inox e aço carbono
- Arquitetos e construtoras que precisam de elementos decorativos e revestimentos em metal
- Fabricantes de máquinas e equipamentos que demandam peças técnicas de precisão
- Serralheiros e metalúrgicas que terceirizam o corte para aumentar capacidade

**Vantagens de fazer o corte a laser em Pouso Alegre**

Contratar o serviço de corte a laser localmente, em Pouso Alegre, elimina o custo e o tempo de frete de chapas pesadas para corte em outros centros. Também facilita a comunicação técnica: nossos operadores podem receber o arquivo DXF/DWG por e-mail ou WhatsApp, revisar junto com o cliente e iniciar o corte no mesmo dia.

**Arquivo e especificação**

Aceitamos arquivos nos formatos DXF, DWG, PDF técnico e até esboços para orçamento inicial. Para quem não tem arquivo técnico, nossa equipe cria o desenho com base em medidas e fotos. O prazo médio para corte após aprovação do orçamento é de 1 a 3 dias úteis.

**Solicite orçamento de corte a laser**

Entre em contato pelo WhatsApp (35) 3423-8994 com as especificações do material (tipo, espessura, quantidade) e o arquivo DXF/DWG. Para clientes de Pouso Alegre, também é possível trazer a chapa diretamente para nossa fábrica na Av. Antonio Mariosa, 4545.',
'5 min', '21 Mar 2026');
