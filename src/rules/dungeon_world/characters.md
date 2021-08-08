# Characters

## Attributes

Characters have attributes, defining how good they are in 6 core areas:

- Strength
- Dexterity
- Constitution
- Intelligence
- Wisdom
- Charisma

You get up to 73 points to distribution amongst your 6 attributes.
Each attribute can be between 5 and 16.

```entish
ergo attribute(?, Strength, str) &
	   attribute(?, Dexterity, dex) &
     attribute(?, Constitution, con) &
	   attribute(?, Intelligence, int) &
	   attribute(?, Wisdom, wis) &
	   attribute(?, Charisma, cha) &
	   (str+dex+con+int+wis+cha) <= 73 &
	   str <= 16 & dex <= 16 & con <= 16 & int <= 16 & wis <= 16 & cha <= 16 &
	   str >= 5 & dex >= 5 & con >= 5 & int >= 5 & wis >= 5 & cha >= 5.
```

### Attribute bonus

A character's bonus is half their attribute score minus ten

```entish
bonus(character, attr, floor((score-10)/2)) :- attribute(character, attr, score).
```

## Gear

Gear is the stuff your character has. It might be something you can wear, like armor, or something
you can wield, like a sword or an axe. It might also just be something they're carrying, like a
a backpack or a spellbook.

```entish
carrying(character, gear) :- wearing(character, gear) | wielding(character, gear).
```

### Armor

Your armor is the sum of the armor of the gear you're wearing (like Chainmail) or wielding (like a Shield).

```entish
armor(character, sum(armor)) :- (wearing(character, gear) | wielding(character, gear)) & armor(gear, armor).
```

### Load

A character's load is the sum of the weights of everying they are carrying.

```entish
load(character, sum(weight)) :- carrying(character, gear) & weight(gear, weight).
```

## Tags

A character gets tagged with the tags of any gear they are carrying.

```entish
tag(character, tag) :- (wearing(character, gear) | wielding(character, gear)) & tag(gear, tag).
```
