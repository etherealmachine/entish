import Interpreter from "./entmoot";
import fs from "fs";

test("parsing single fact", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("class(Auric, Barbarian).")).toStrictEqual([
    {
      type: "fact",
      table: "class",
      fields: [
        { type: "string", value: "Auric" },
        { type: "string", value: "Barbarian" },
      ],
    },
  ]);
});

test("parsing simple claim", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("ergo ((1+2)*4)=12.")).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "comparison",
        operator: "=",
        left: {
          type: "binary_operation",
          operator: "*",
          left: {
            type: "binary_operation",
            operator: "+",
            left: {
              type: "number",
              value: 1,
            },
            right: {
              type: "number",
              value: 2,
            },
          },
          right: {
            type: "number",
            value: 4,
          },
        },
        right: {
          type: "number",
          value: 12,
        },
      },
    },
  ]);
});

test("parsing claim with a few clauses", () => {
  const interpreter = new Interpreter("seed");
  expect(
    interpreter.parse(
      "ergo class(character, Barbarian) & (wielding(character, Axe) ^ wielding(character, TwoHandedSword))."
    )
  ).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "conjunction",
        clauses: [
          {
            type: "fact",
            table: "class",
            fields: [
              {
                type: "variable",
                value: "character",
              },
              {
                type: "string",
                value: "Barbarian",
              },
            ],
          },
          {
            type: "exclusive_disjunction",
            clauses: [
              {
                type: "fact",
                table: "wielding",
                fields: [
                  {
                    type: "variable",
                    value: "character",
                  },
                  { type: "string", value: "Axe" },
                ],
              },
              {
                type: "fact",
                table: "wielding",
                fields: [
                  {
                    type: "variable",
                    value: "character",
                  },
                  { type: "string", value: "TwoHandedSword" },
                ],
              },
            ],
          },
        ],
      },
    },
  ]);
});

test("parsing claim with more complicated clauses", () => {
  const interpreter = new Interpreter("seed");
  expect(
    interpreter.parse(
      "ergo class(character, Barbarian) & ((carrying(character, AdventuringGear) & carrying(character, DungeonRations, 5)) ^ wearing(character, Chainmail))."
    )
  ).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "conjunction",
        clauses: [
          {
            type: "fact",
            table: "class",
            fields: [
              { type: "variable", value: "character" },
              { type: "string", value: "Barbarian" },
            ],
          },
          {
            type: "exclusive_disjunction",
            clauses: [
              {
                type: "conjunction",
                clauses: [
                  {
                    type: "fact",
                    table: "carrying",
                    fields: [
                      { type: "variable", value: "character" },
                      { type: "string", value: "AdventuringGear" },
                    ],
                  },
                  {
                    type: "fact",
                    table: "carrying",
                    fields: [
                      { type: "variable", value: "character" },
                      { type: "string", value: "DungeonRations" },
                      { type: "number", value: 5 },
                    ],
                  },
                ],
              },
              {
                type: "fact",
                table: "wearing",
                fields: [
                  { type: "variable", value: "character" },
                  { type: "string", value: "Chainmail" },
                ],
              },
            ],
          },
        ],
      },
    },
  ]);
});

test("parsing claim with operator precedence", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("ergo 2+3*4 = 14.")).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "comparison",
        operator: "=",
        left: {
          type: "binary_operation",
          operator: "+",
          left: {
            type: "number",
            value: 2,
          },
          right: {
            type: "binary_operation",
            operator: "*",
            left: {
              type: "number",
              value: 3,
            },
            right: {
              type: "number",
              value: 4,
            },
          },
        },
        right: {
          type: "number",
          value: 14,
        },
      },
    },
  ]);
});

test("parsing claim with binary operation and comparisons", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("ergo 1+2 < 10.")).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "comparison",
        operator: "<",
        left: {
          type: "binary_operation",
          operator: "+",
          left: {
            type: "number",
            value: 1,
          },
          right: {
            type: "number",
            value: 2,
          },
        },
        right: {
          type: "number",
          value: 10,
        },
      },
    },
  ]);
});

test("parsing inference", () => {
  const interpreter = new Interpreter("seed");
  expect(
    interpreter.parse("bonus(character, attr, Floor((score-10)/2)) :- attribute(character, attr, score).")
  ).toStrictEqual([
    {
      type: "inference",
      left: {
        type: "fact",
        table: "bonus",
        fields: [
          { type: "variable", value: "character" },
          { type: "variable", value: "attr" },
          {
            type: "function",
            function: "Floor",
            arguments: [
              {
                type: "binary_operation",
                operator: "/",
                left: {
                  type: "binary_operation",
                  operator: "-",
                  left: { type: "variable", value: "score" },
                  right: { type: "number", value: 10 },
                },
                right: { type: "number", value: 2 },
              },
            ],
          },
        ],
      },
      right: {
        type: "fact",
        table: "attribute",
        fields: [
          { type: "variable", value: "character" },
          { type: "variable", value: "attr" },
          { type: "variable", value: "score" },
        ],
      },
    },
  ]);
});

test("parsing claim with an expression", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("ergo attr(str) & attr(dex) & str + dex >= 10.")).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "conjunction",
        clauses: [
          {
            type: "fact",
            table: "attr",
            fields: [{ type: "variable", value: "str" }],
          },
          {
            type: "fact",
            table: "attr",
            fields: [{ type: "variable", value: "dex" }],
          },
          {
            type: "comparison",
            operator: ">=",
            left: {
              type: "binary_operation",
              operator: "+",
              left: { type: "variable", value: "str" },
              right: { type: "variable", value: "dex" },
            },
            right: {
              type: "number",
              value: 10,
            },
          },
        ],
      },
    },
  ]);
});

test("parsing long expression", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("ergo 1+2+3 = 6 & 1 < 2 & 2 < 3.")).toStrictEqual([
    {
      type: "claim",
      clause: {
        type: "conjunction",
        clauses: [
          {
            type: "comparison",
            operator: "=",
            left: {
              type: "binary_operation",
              operator: "+",
              left: {
                type: "binary_operation",
                operator: "+",
                left: {
                  type: "number",
                  value: 1,
                },
                right: {
                  type: "number",
                  value: 2,
                },
              },
              right: {
                type: "number",
                value: 3,
              },
            },
            right: {
              type: "number",
              value: 6,
            },
          },
          {
            type: "comparison",
            operator: "<",
            left: {
              type: "number",
              value: 1,
            },
            right: {
              type: "number",
              value: 2,
            },
          },
          {
            type: "comparison",
            operator: "<",
            left: {
              type: "number",
              value: 2,
            },
            right: {
              type: "number",
              value: 3,
            },
          },
        ],
      },
    },
  ]);
});

test("non-strict", () => {
  const interpreter = new Interpreter("seed", false);
  interpreter.load("ergo 2+2 = 5.");
});

test("basic facts and claims", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("class(Auric, Barbarian).");
  interpreter.load("carrying(Auric, AdventuringGear).");
  interpreter.load("tag(character, Adventurer) :- class(character, ?) & carrying(character, AdventuringGear).");
  interpreter.load("ergo tag(Auric, Adventurer).");
});

test("negating facts and claims", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("class(Auric, Barbarian).");
  interpreter.load("carrying(Auric, AdventuringGear).");
  interpreter.load("tag(Auric, Commoner).");
  interpreter.load("tag(character, Adventurer) :- class(character, ?) & carrying(character, AdventuringGear).");
  interpreter.load("~tag(character, Commoner) :- tag(character, Adventurer).");
  interpreter.load("ergo ~tag(Auric, Commoner).");
});

test("load and exec rules from file", () => {
  const interpreter = new Interpreter("seed", false);
  interpreter.load('load("./src/dungeon_world.ent").');
  interpreter.load("set(strict, true).");
  interpreter.load("verify.");
});

test("load and exec markdown rules for dungeon world", () => {
  const interpreter = new Interpreter("seed");

  interpreter.load("attribute(Auric, Strength, 16).");
  interpreter.load("attribute(Auric, Dexterity, 14).");
  interpreter.load("attribute(Auric, Constitution, 14).");
  interpreter.load("attribute(Auric, Intelligence, 10).");
  interpreter.load("attribute(Auric, Wisdom, 8).");
  interpreter.load("attribute(Auric, Charisma, 11).");
  interpreter.load("class(Auric, Barbarian).");
  interpreter.load("carrying(Auric, AdventuringGear).");
  interpreter.load("carrying(Auric, DungeonRations, 5).");
  interpreter.load("wielding(Auric, Dagger).");
  interpreter.load("wielding(Auric, Axe).");
  interpreter.load('load("./src/rules/dungeon_world").');
});

test("self-referential inferences", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("foo(x+1) :- foo(x).");
  interpreter.load("foo(0).");
  interpreter.load("ergo foo(1).");
  interpreter.load("ergo ~foo(2).");
});

test("mutually-referential inferences", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("foo(x+1) :- bar(x).");
  interpreter.load("bar(x+1) :- foo(x).");
  interpreter.load("foo(0).");
  interpreter.load("ergo bar(1).");
  interpreter.load("ergo ~foo(2).");
});

test("complicated claims", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("ergo ((1+1 = 2) | (1+2 != 3)).");
  interpreter.load("ergo ~((1+1 = 3) | (2+2 = 5)).");
});

test("inferring graphs", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("sibling(x, y) :- parent(x, p) & parent(y, p) & x != y.");
  interpreter.load("parent(Bin, Paula).");
  interpreter.load("parent(Jane, Paula).");
  interpreter.load("ergo sibling(Bin, Jane) & sibling(Jane, Bin).");
  interpreter.load("ergo ~sibling(Bin, Bin) & ~sibling(Jane, Jane).");
});

test("counts", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("sibling(x, y) :- parent(x, p) & parent(y, p) & x != y.");
  interpreter.load("parent(Bin, Paula).");
  interpreter.load("parent(Jane, Paula).");
  interpreter.load("ergo sibling(Bin, Jane) & sibling(Jane, Bin).");
  interpreter.load("ergo ~sibling(Bin, Bin) & ~sibling(Jane, Jane).");
  interpreter.load("? sibling(?, ?).");
  interpreter.load("ergo sibling(sibling1, sibling2) & Count(sibling1) = 2.");
});
