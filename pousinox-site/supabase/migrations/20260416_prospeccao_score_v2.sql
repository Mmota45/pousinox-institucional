-- Remove critério "não contatado" do score — score passa a medir potencial, não prioridade
-- Máximo: telefone(3) + segmento(3) + distância(3) + email(1) = 10

ALTER TABLE prospeccao
  DROP COLUMN score;

ALTER TABLE prospeccao
  ADD COLUMN score INT GENERATED ALWAYS AS (
    CASE WHEN telefone1 IS NOT NULL THEN 3 ELSE 0 END
    +
    CASE segmento
      WHEN 'Revestimentos' THEN 3
      WHEN 'Construtoras'  THEN 2
      WHEN 'Arquitetura'   THEN 2
      WHEN 'Hotelaria'     THEN 1
      WHEN 'Hospitalar'    THEN 1
      ELSE 0
    END
    +
    CASE
      WHEN distancia_km IS NOT NULL AND distancia_km <= 150 THEN 3
      WHEN distancia_km IS NOT NULL AND distancia_km <= 300 THEN 2
      WHEN distancia_km IS NOT NULL AND distancia_km <= 500 THEN 1
      ELSE 0
    END
    +
    CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END
  ) STORED;
