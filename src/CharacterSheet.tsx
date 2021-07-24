import React, { useState } from "react";

import Interpreter, { factToString } from "./entmoot";
import MarkdownRules from "./MarkdownRules";

import barbarian from "./rules/dungeon_world/barbarian.md";
import characters from "./rules/dungeon_world/characters.md";

const Selector = ({
  interpreter,
  options: query,
  onSelect,
}: {
  interpreter: Interpreter;
  options: string;
  onSelect: (selection: string) => void;
}) => {
  const options = interpreter.query(interpreter.parser.parse(query)[0]);
  return (
    <select>
      {options.map((o, i) => (
        <option key={`option-${i}`}>{(o.fields[0] as any).value}</option>
      ))}
    </select>
  );
};

const Table = ({ interpreter, query }: { interpreter: Interpreter; query: string }) => {
  const results = interpreter.query(interpreter.parser.parse(query)[0]);
  return (
    <div>
      {results.map((r, i) => (
        <div key={`query-result-${i}`}>{factToString(r)}</div>
      ))}
    </div>
  );
};

export default function CharacterSheet({ interpreter }: { interpreter: Interpreter }) {
  const [selectedCharacter, setSelectedCharacter] = useState<string | undefined>();
  return (
    <div>
      <MarkdownRules interpreter={interpreter} rules={characters} />
      <MarkdownRules interpreter={interpreter} rules={barbarian} />
      <Selector
        interpreter={interpreter}
        options="? character(?)."
        onSelect={(selection) => setSelectedCharacter(selection)}
      />
      <div>
        <Table
          interpreter={interpreter}
          query={`? wielding(${selectedCharacter}, ?) | wearing(${selectedCharacter}, ?).`}
        />
      </div>
    </div>
  );
}
