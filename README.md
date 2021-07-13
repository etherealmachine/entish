# Entish is a declarative Datalog-like language implemented in Typescript

It exists to play with implementing table-top RPG rules in formal logic.

Try it for yourself in the [Playground](//etherealmachine.github.io/entish)!

or

Install it with `npm install entish` or `yarn add entish`.

## What is Entish?

- Declarative
  - You load rules into Entish and the interpreter figures out other rules
- Datalog-Like
  - This might be the only Javascript-based [Datalog](//en.wikipedia.org/wiki/Datalog) implementation in existence.
    That means you can [play around with it](//etherealmachine.github.io/entish) right in your browser.
- Table-Top RPG Rules
  - I build Entish because I wanted to try implementing rules for table-top RPGs in formal logic.
    It includes some not-exactly-standard features to support this, like aggregations and rolls.

## For these examples, we're going to talk about our first character - a Barbarian named "Auric"

So let's talk about Auric...

```
// Auric has the Barbarian class
class(Auric, Barbarian).

// Auric has a Strength of 16
attribute(Auric, Strength, 16).

// Auric has a Wisdom of 9
attribute(Auric, Wisdom, 9).

// A character's bonus is half their attribute score minus ten
bonus(character, attr, floor((score-10)/2)) :- attribute(character, attr, score).

// Therefore, Auric has a Strength bonus of 3
∴ bonus(Auric, Strength, 3).

// Therefore, Auric has a Wisdom bonus of -1
∴ bonus(Auric, Wisdom, -1).
```

This shows the basics of Entish. We define some **facts**, like `attribute(Auric, Strength, 16)`.
Then, we can **infer** other facts from those ones, like a character's bonus.
We can also make **claims** (∴ is a common math symbol for "therefore").
This is basically testing, but baked into the language.

On to defining equipment...

```
// Full Plate has an armor bonus of 3
armor(FullPlate, 3).

// Full Plate has a weight of 4
weight(FullPlate, 4).

// Full Plate has the clumsy tag
tag(FullPlate, Clumsy).

// A small shield
weight(RoundShield, 1).
armor(RoundShield, 1).

// And a sword
weight(TwoHandedSword, 2).
damage(TwoHandedSword, 1d8).
tag(TwoHandedSword, Close).

// Given gear has a tag and the character is wearing the gear, add the tag to the character
tag(character, tag) :- (wearing(character, gear) | wielding(character, gear)) & tag(gear, tag).

// Given a character, their armor is the sum of the armor of gear they are wearing/wielding
armor(character, sum(armor)) :- (wearing(character, gear) | wielding(character, gear)) & armor(gear, armor).

// Given a character, their load is the sum of the weights of gear they are wearing and wielding
load(character, sum(weight)) :- (wearing(character, gear) | wielding(character, gear)) & weight(gear, weight).

// The max load of a Barbarian is 8 plus their strength bonus
max_load(character, 8+str) :- class(character, Barbarian) & bonus(character, Strength, str).
```

Equipment/gear has a few facts associate with it, like weight, damage, and maybe tags.
I'm also setting up two types of gear - worn and wielded, because the distinction might be useful later.
Armor shows off something new - **aggregations**. Aggregated facts are kind of like "GROUP BY" in SQL.
We group all non-aggregated fields first, then apply the aggregation function to the group.
This produces one fact per group.
Max load also shows off just doing straight up **math** in an inference. As far as I know,
this isn't really covered in standard Datalog but it's obviously useful.

```
// Give Auric his gear
wearing(Auric, FullPlate).
wielding(Auric, RoundShield).
wielding(Auric, TwoHandedSword).

// So Auric is Clumsy, but he's got 4 armor a load of 7, and a max load of 11
∴ tag(Auric, Clumsy).
∴ armor(Auric, 4).
∴ load(Auric, 7).
∴ max_load(Auric, 11).
```

Now that we have **load** and **max load** the next obvious thing to do is compare them:

```
// Given a character and max load, they are tagged with Encumbered if their load is greater than their max load
tag(character, Encumbered) :- load(character, load) & max_load(character, max_load) & load > max_load.

// Therefore Auric is not Encumbered
∴ ~tag(Auric, Encumbered).
```

You can start to see the possibilities of formalizing the rules. A nice UI could show us all
tags asssociated with a character (maybe even on a map!). As Auric adds and drops gear, the
tag gets added and removed from the database and thus the UI. We can even add a nice popover
to link the inferred tag to the rule description. All this because we know _why_ you're
encumbered and _what_ that means.

It's been a minute - maybe you've forgotten what Auric has on him.
**Queries** are a standard part of Datalog, so Entish has them as well. These just
return any facts that pattern match what you give them:

```
? wielding(Auric, ?) | wearing(Auric, ?).
> wielding(Auric, RoundShield)
> wielding(Auric, TwoHandedSword)
> wearing(Auric, FullPlate)
```

One final example:

```
// The move "Full Plate and Packing Steel" negates the Clumsy tag
~tag(character, Clumsy) :- move(character, FullPlateAndPackingSteel).

// Auric has the move "Full Plate and Packing Steel"
move(Auric, FullPlateAndPackingSteel).

// Auric is not Clumsy
∴ ~tag(Auric, Clumsy).
```

Now we're really deviating from Datalog! **Negating** facts makes things complicated, but it's
worth it because sometimes you want rules that tell you to ignore other rules.

**Work In Progress**: Rolls and probability

```
// Rolls and probability - work in progress
attack(Barbarian, 1d20+2).

∴ attack(Barbarian, roll) & Pr(roll >= 15) = 0.4.

enemy(Orc).
armor(Orc, 10).

hit(character, weapon, enemy, roll, armor) :- class(character, class) & attack(class, roll) & wielding(character, weapon) & damage(weapon, ?) & enemy(enemy) & armor(enemy, armor) & roll >= armor.

🎲 attack(Barbarian, ?) & enemy(Orc).

∴ hit(Auric, TwoHandedSword, Orc)

🎲 damage(TwoHandedSword, ?).

∴ damage(TwoHandedSword, 7).

max_health(Orc, 10).

health(character, max_health - sum(damage)) :- max_health(character, max_health) & hit(?, weapon, character) & damage(weapon, damage).

∴ health(Orc, 3).
```

This example is pre-loaded in the [Playground](//etherealmachine.github.io/entish)

# FAQ

## How is this useful?

The idea is to integrate Entish into an easy-to-use "virtual tabletop" UI. Sort of like Roll20 or Foundry, but with an emphasis on fast play driven by the automatic rule evaluation and inference. So maybe it's a language for building customizable virtual tabletops. Don't like the rules? Pull them up in Entish and modify/homebrew them to your liking.

I'd also love to use it inside my [Mapmaker](https://etherealmachine.github.io/mapmaker) app and combine this into a one-stop-shop for rules and maps. The grand vision is that all of this could help drive Procedural Generation in RPGs, so imagine you have a Roguelike but it's still driven by a GM, with opportunities for kitbashing rules and content, crunchy combat, and the roleplay you can only get from real people.

## What about rolls and dice?

This is in progress. I've got a start on probability calculation - you can see the last part of the
example calculates the probability of a 1d20+2 rolling more than a 15 is 40%. Still TODO is how to
instantiate facts from "probabilistic facts", i.e. facts with rolls in them, and then trying to
include more randomization techniques, like coin flips, dice pools, and decks of cards.
