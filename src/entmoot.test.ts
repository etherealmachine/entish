import Interpreter from "./entmoot";
import fs from "fs";
import marked from "marked";

test("parsing", () => {
  const interpreter = new Interpreter("seed");
  expect(
    interpreter.parse(
      "∴ class(character, Barbarian) & (wielding(character, Axe) ⊕ wielding(character, TwoHandedSword)).",
      true
    )
  ).toBe([
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
  expect(
    interpreter.parse(
      "∴ class(character, Barbarian) & ((carrying(character, AdventuringGear) & carrying(character, DungeonRations, 5)) ⊕ wearing(character, Chainmail)).",
      true
    )
  ).toBe([
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
  expect(
    interpreter.parse("bonus(character, attr, floor((score-10)/2)) :- attribute(character, attr, score).", true)
  ).toBe([
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

test("load and exec rules for dungeon world", () => {
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
  interpreter.load("carrying(Auric, DungeonRations, 5).");
  interpreter.load("wielding(Auric, Dagger).");
  interpreter.load("wielding(Auric, Axe).");
  statements.forEach((stmt) => interpreter.exec(stmt));
});
