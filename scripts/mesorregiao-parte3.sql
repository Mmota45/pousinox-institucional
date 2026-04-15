-- 3. Popula mesorregiao/microrregiao — um UPDATE por UF para evitar timeout
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'AC';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'AL';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'AM';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'AP';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'BA';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'CE';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'DF';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'ES';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'GO';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'MA';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'MG';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'MS';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'MT';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'PA';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'PB';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'PE';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'PI';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'PR';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'RJ';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'RN';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'RO';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'RR';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'RS';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'SC';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'SE';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'SP';
UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = 'TO';

-- 4. Funções para filtros dinâmicos no admin
CREATE OR REPLACE FUNCTION get_mesorregioes_ufs(p_ufs text[])
RETURNS TABLE(mesorregiao text) LANGUAGE sql AS $$
  SELECT DISTINCT mesorregiao FROM prospeccao
  WHERE uf = ANY(p_ufs) AND mesorregiao IS NOT NULL
  ORDER BY mesorregiao;
$$;

CREATE OR REPLACE FUNCTION get_cidades_ufs(p_ufs text[])
RETURNS TABLE(cidade text) LANGUAGE sql AS $$
  SELECT DISTINCT cidade FROM prospeccao
  WHERE uf = ANY(p_ufs) AND cidade IS NOT NULL
  ORDER BY cidade;
$$;

CREATE OR REPLACE FUNCTION get_cidades_meso(p_ufs text[], p_meso text[])
RETURNS TABLE(cidade text) LANGUAGE sql AS $$
  SELECT DISTINCT cidade FROM prospeccao
  WHERE uf = ANY(p_ufs)
    AND mesorregiao = ANY(p_meso)
    AND cidade IS NOT NULL
  ORDER BY cidade;
$$;
