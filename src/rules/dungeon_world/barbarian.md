# Barbarian

The Barbarian has:

- Hit points equal to 8 plus their charisma bonus
- A max load of 8 plus their strength bonus
- A base damage of 1d10

```entish
hit_points(character, 8+cha) :- class(character, Barbarian) & bonus(character, Charisma, cha).
max_load(character, 8+str) :- class(character, Barbarian) & bonus(character, Strength, str).
damage(character, 1d10) :- class(character, Barbarian).
```

```entish
∴ class(character, Barbarian) & carrying(character, DungeonRations, 5) & wielding(character, Dagger).
∴ class(character, Barbarian) & wielding(character, Axe) ⊕ wielding(character, TwoHandedSword).
∴ class(character, Barbarian) & carrying(character, AdventuringGear) & carrying(character, DungeonRations, 5) ⊕ wearing(character, Chainmail).
```
