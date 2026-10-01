-- Categoria Pokémon: geração de cada Pokémon (1–9), para o filtro de gerações. NULL nas outras categorias.
ALTER TABLE characters ADD COLUMN generation INTEGER;
