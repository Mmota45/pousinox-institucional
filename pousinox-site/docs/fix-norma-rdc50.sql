-- Reinserir RDC ANVISA 50/2002 (foi deletada por engano no fix-norma-ref.sql)
INSERT INTO portfolio_normas (norma, orgao, titulo, status, segmentos, penalidade, observacao)
VALUES (
  'RDC ANVISA 50/2002',
  'ANVISA',
  'Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde',
  'vigente',
  ARRAY['Hospitalar','Laboratórios','Odontologia','Clínica','Veterinária'],
  'Interdição do estabelecimento — ANVISA pode cassar alvará sanitário',
  'Define materiais para superfícies de trabalho e mobiliário em ambientes de saúde. Aço inox 304 é o padrão para armários, bancadas e pias em áreas críticas e semicríticas.'
)
ON CONFLICT (norma) DO UPDATE SET
  segmentos = EXCLUDED.segmentos,
  penalidade = EXCLUDED.penalidade,
  observacao = EXCLUDED.observacao;
