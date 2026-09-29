-- Tempo da partida (do sorteio ao envio; na party, do início da rodada ao fim), medido no servidor.
-- Desempata pontuações iguais no ranking (menor tempo na frente). NULL = partidas antigas (ficam atrás no empate).
ALTER TABLE scores ADD COLUMN duration_ms INTEGER;
