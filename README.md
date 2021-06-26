# entish
Entish is a logic programming language for implementing RPG rules.

## Wait, What?
This is loosely based on the Dungeon World RPG rules.

Let's make a character named "Auric". Auric is a barbarian. He's pretty strong, but not very wise:
```
class(Auric, Barbarian).
attribute(Auric, Strength, 16).
attribute(Auric, Wisdom, 9).
```

Now to set up some rules. How about pulling the standard attribute bonus from D&D/Pathfinder:

```
bonus(character, attr, floor((score-10)/2)) :- attribute(character, attr, score).
∴ bonus(Auric, Strength, 3).
∴ bonus(Auric, Wisdom, -1).
```

What just happened?

Ok, so first we set up what a bonus looks like: `bonus(character, attr, floor((score-10)/2))`. This means we can set a bonus for a character's attribute by taking half of their attribute score minus 10 (rounded down).

And we get the score by looking it up in the attribute table `attribute(character, attr, score)` (more on that later).

`∴` is short-hand for "therefore". This is sort of like test-driven development. After I've defined the rules, I've also made some assertions to double check my logic. The Entish interpreter (Entmoot) can verify these for me.

## But Wait, There's More...
How about adding equipment to the equation:

```
weight(FullPlate, 4).
armor(FullPlate, 3).
tag(FullPlate, Clumsy).

wearing(Auric, FullPlate).

tag(character, tag) :- wearing(character, gear) & tag(gear, tag).

∴ tag(Auric, Clumsy).
```

Let's define a piece of equipment, "Full Plate". Full Plate is armor, it's pretty heavy (4 units), and it's Clumsy. We also state the fact that Auric is wearing some Full Plate.

Next, we say if a character is wearing some gear, and the gear has a tag, the tag also applies to the character.

So because Auric is wearing his Full Plate, he's got the Clumsy tag.

## It Just Keeps on Going
```
weight(TwoHandedSword, 2).
damage(TwoHandedSword, 1).
tag(TwoHandedSword, Close).

wielding(Auric, TwoHandedSword).

load(character, sum(weight)) :- (wearing(character, gear) | wielding(character, gear)) & weight(gear, weight).

load(Auric, ?).
> 6
```

So Auric also has a big two-handed sword. It's also pretty heavy, but less so than plate armor.

Auric is carrying a couple of things now. How much exactly?

Well, we can defined a character's "Load" as the sum of their item's weights, provided they're wearing or weilding the item.

Then, we can just ask for Auric's load - 6.

```
max_load(character, 8+str) :- class(character, Barbarian) & bonus(character, Strength, str).

tag(character, Encumbered) :- load(character, load) & max_load(character, max_load) & load > max_load.
∴ max_load(Auric, 11).
∴ ~tag(Auric, Encumbered).
```

So Auric's carrying a bit, but how much is too much?

Well, let's say the max load of a Barbarian is 8 plus their strength modifier.

Then, we'll tag a character as Encumbered if their load is more than their max load.

Based on this, Auric should have a max load of 11, so he's NOT (`~`) Encumbered right now.

## And More
```
move(Auric, FullPlateAndPackingSteel).

~tag(character, Clumsy) :- move(character, FullPlateAndPackingSteel) & armor(gear, ?) & tag(gear, Clumsy) & wearing(character, gear).

∴ tag(Auric, Clumsy).
```

We'll give Auric his first Move, "Full Plate and Packing Steel". This move negates the Clumsy tag on armor the character is wearing.

Now that Auric has this move, the fact that he's wearing Full Plate no longer makes him Clumsy. Yay!
