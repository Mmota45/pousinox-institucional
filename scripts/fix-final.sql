-- Fix final: cidades com nomes divergentes do IBGE
UPDATE prospeccao SET mesorregiao = 'Sudoeste Rio-grandense', microrregiao = 'Campanha Central'
WHERE uf = 'RS' AND cidade = 'SANTANA DO LIVRAMENTO';

UPDATE prospeccao SET mesorregiao = 'Centro-Sul Mato-grossense', microrregiao = 'Cuiabá'
WHERE uf = 'MT' AND cidade = 'SANTO ANTONIO DO LEVERGER';

UPDATE prospeccao SET mesorregiao = 'Ocidental do Tocantins', microrregiao = 'Miracema do Tocantins'
WHERE uf = 'TO' AND cidade = 'COUTO DE MAGALHAES';

UPDATE prospeccao SET mesorregiao = 'Sul de Roraima', microrregiao = 'Sudeste de Roraima'
WHERE uf = 'RR' AND cidade = 'SAO LUIZ';

UPDATE prospeccao SET mesorregiao = 'Oriental do Tocantins', microrregiao = 'Dianópolis'
WHERE uf = 'TO' AND cidade = 'SAO VALERIO DA NATIVIDADE';

UPDATE prospeccao SET mesorregiao = 'Ocidental do Tocantins', microrregiao = 'Miracema do Tocantins'
WHERE uf = 'TO' AND cidade = 'FORTALEZA DO TABOCAO';

UPDATE prospeccao SET mesorregiao = 'Sul/Sudoeste de Minas', microrregiao = 'Itajubá'
WHERE uf = 'MG' AND cidade = 'BRASOPOLIS';

UPDATE prospeccao SET mesorregiao = 'Leste Sergipano', microrregiao = 'Propriá'
WHERE uf = 'SE' AND cidade = 'AMPARO DE SAO FRANCISCO';

UPDATE prospeccao SET mesorregiao = 'Vale do Rio Doce', microrregiao = 'Caratinga'
WHERE uf = 'MG' AND cidade = 'PINGO D''AGUA';

UPDATE prospeccao SET mesorregiao = 'Zona da Mata', microrregiao = 'Viçosa'
WHERE uf = 'MG' AND cidade = 'AMPARO DA SERRA';

UPDATE prospeccao SET mesorregiao = 'Vale São-Franciscano da Bahia', microrregiao = 'Barra'
WHERE uf = 'BA' AND cidade = 'MUQUEM DE SAO FRANCISCO';

-- Deletar registros com CEP no campo cidade (dados corrompidos)
DELETE FROM prospeccao WHERE uf = 'SE' AND cidade ~ '^[0-9]';
