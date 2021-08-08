import Interpreter from "./entmoot";
import fs from "fs";
import marked from "marked";

test("parsing single fact", () => {
  const interpreter = new Interpreter("seed");
  expect(interpreter.parse("class(Auric, Barbarian).", true)).toStrictEqual([
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
  expect(interpreter.parse("ergo ((1+2)*4)=12.", true)).toStrictEqual([
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
      "ergo class(character, Barbarian) & (wielding(character, Axe) ^ wielding(character, TwoHandedSword)).",
      true
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
      "ergo class(character, Barbarian) & ((carrying(character, AdventuringGear) & carrying(character, DungeonRations, 5)) ^ wearing(character, Chainmail)).",
      true
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
  expect(interpreter.parse("ergo 2+3*4 = 14.", true)).toStrictEqual([
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
  expect(interpreter.parse("ergo 1+2 < 10.", true)).toStrictEqual([
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
    interpreter.parse("bonus(character, attr, floor((score-10)/2)) :- attribute(character, attr, score).", true)
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
            function: "floor",
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
  expect(interpreter.parse("ergo attr(str) & attr(dex) & str + dex >= 10.", true)).toStrictEqual([
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

test("basic facts and claims", () => {
  const interpreter = new Interpreter("seed");
  interpreter.load("class(Auric, Barbarian).");
  interpreter.load("carrying(Auric, AdventuringGear).");
  interpreter.load("tag(character, Adventurer) :- class(character, ?) & carrying(character, AdventuringGear).");
  interpreter.load("ergo tag(Auric, Adventurer).")
});

test("load and exec rules from file", () => {
  const interpreter = new Interpreter("seed");
  const statements = interpreter.parse(fs.readFileSync("./src/dungeon_world.ent").toString());
  statements.forEach((stmt) => interpreter.exec(stmt));
});

test("load and exec markdown rules for dungeon world", () => {
  const interpreter = new Interpreter("seed");
  const statements = fs
    .readdirSync("./src/rules/dungeon_world")
    .map((filename) => {
      if (filename.endsWith(".md")) {
        const markdown = new DOMParser().parseFromString(
          marked(fs.readFileSync("./src/rules/dungeon_world/" + filename).toString()),
          "text/html"
        );
        return Array.from(markdown.querySelectorAll("code.language-entish"))
          .map((node) => (node.textContent ? interpreter.parse(node.textContent, true) : []))
          .flat();
      }
      return [];
    })
    .flat();
  interpreter.load("class(Auric, Barbarian).");
  interpreter.load("carrying(Auric, AdventuringGear).");
  interpreter.load("carrying(Auric, DungeonRations, 5).");
  interpreter.load("wielding(Auric, Dagger).");
  interpreter.load("wielding(Auric, Axe).");
  statements.forEach((stmt) => interpreter.exec(stmt));
});
