-- Fama do personagem (anime e games): 1 mainstream, 2 médio, 3 obscuro. Define a dificuldade em que ele aparece.
-- NULL no Pokémon (o modo usa o filtro de gerações).
ALTER TABLE characters ADD COLUMN tier INTEGER;
