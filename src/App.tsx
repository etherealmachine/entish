import React, { useContext, useRef, useState } from 'react';
import styled from 'astroturf/react';
import Editor from "@monaco-editor/react";

import Interpreter, { String, Integer } from './entmoot';
import useMonacoEntish from './useMonacoEntish';
import Highlight from './Highlight';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  margin: 24px;
`;

const Database = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
`;

function Table({ name, rows }: { name: string, rows: (String | Integer)[][] }) {
  return <div>
    <h1>{name}</h1>
    <table>
      <tbody>
        {rows.map((row, i) => <tr key={`${name}-${i}`}>
          {row.map((val, j) => <td key={`${name}-${i}-${j}`}>
            {val.value}
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

const InterpreterContext = React.createContext(new Interpreter());

function Example({ children }: { children: React.ReactElement }) {
  const initialCode = children?.props?.children.toString().trim() || '';
  const interpreter = useContext(InterpreterContext);
  const [code, setCode] = useState<string>(initialCode);
  const [error, setError] = useState<string | undefined>(undefined);
  const [log, setLog] = useState<string[]>([]);
  const editorRef = useRef<any>(null);
  const reset = () => {
    setCode(initialCode);
    editorRef.current?.getModel().setValue(initialCode);
  }
  const run = () => {
    const tmp = (console as any).log;
    const newLog: string[] = [];
    (console as any).log = (msg: string) => {
      newLog.push(msg);
    }
    try {
      interpreter.load(code);
      setError(undefined);
    } catch (e) {
      setError(e.message);
    }
    (console as any).log = tmp;
    setLog(newLog);
  }
  return <div style={{ display: 'flex', flexDirection: 'column', width: "100%" }}>
    <Editor
      defaultLanguage="entish"
      defaultValue={initialCode}
      onChange={value => { if (value) setCode(value) }}
      options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, scrollbar: { alwaysConsumeMouseWheel: false } }}
      onMount={editor => { editorRef.current = editor; editor.layout({ height: editor.getModel().getLineCount() * 19 }); }}
    />
    <p>{error}</p>
    <button onClick={reset}>Reset</button>
    <button onClick={run}>Run</button>
    <div>{log.map((msg, i) => <p key={`log-msg-${i}`}>{msg}</p>)}</div>
  </div>
}

function App() {
  useMonacoEntish();
  const interpreter = new Interpreter();
  return <Container>
    <h1>Entish is a declarative Datalog-like language implemented in Typescript</h1>
    <p>It exists to play with implementing table-top RPG rules in formal logic.</p>
    <h2>Huh?</h2>
    <dl>
      <dt>Declarative</dt>
      <dd>You load rules into Entish and the interpreter figures out other rules</dd>
      <dt>Datalog-Like</dt>
      <dd>
        This might be the only Javascript-based <a href="//en.wikipedia.org/wiki/Datalog">Datalog</a> implementation in existence.
        That means you can play around with it right in your browser.
      </dd>
      <dt>Table-Top RPG Rules</dt>
      <dd>
        I build Entish becaues I wanted to try implementing rules for table-top RPGs in formal logic.
        It includes some not-exactly-standard features to support this, like aggregations.
      </dd>
    </dl>
    <InterpreterContext.Provider value={interpreter}>
      <h3>For these examples, we're going to talk about our first character - a Barbarian named "Auric"</h3>
      <p>So let's talk about Auric...</p>
      <Example>
        <code>{`
// Auric has the Barbarian class
class(Auric, Barbarian).

// Auric has a Strength of 16
attribute(Auric, Strength, 16).

// Auric has a Wisdom of 16
attribute(Auric, Wisdom, 9).

// A character's bonus is half their attribute score minus ten
bonus(character, attr, floor((score-10)/2)) :- attribute(character, attr, score).

// Therefore, Auric has a Strength bonus of 3
∴ bonus(Auric, Strength, 3).

// Therefore, Auric has a Wisdom bonus of -1
∴ bonus(Auric, Wisdom, -1).
        `}</code>
      </Example>
      <p>
        This shows the basics of Entish. We define some <b>facts</b>,
        like <Highlight language="entish">attribute(Auric, Strength, 16)</Highlight>.
        Then, we can <b>infer</b> other facts from those ones, like a character's bonus.
        We can also make <b>claims</b> (∴ is a common math symbol for "therefore").
        This is basically testing, but baked into the language.
      </p>
      <p>On to defining equipment...</p>
      <Example>
        <code>{`
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
damage(TwoHandedSword, 1).
tag(TwoHandedSword, Close).

// Given gear has a tag and the character is wearing the gear, add the tag to the character
tag(character, tag) :- (wearing(character, gear) | wielding(character, gear)) & tag(gear, tag).

// Given a character, their armor is the sum of the armor of gear they are wearing/wielding
armor(character, sum(armor)) :- (wearing(character, gear) | wielding(character, gear)) & armor(gear, armor).

// Given a character, their load is the sum of the weights of gear they are wearing and wielding
load(character, sum(weight)) :- (wearing(character, gear) | wielding(character, gear)) & weight(gear, weight).

// The max load of a Barbarian is 8 plus their strength bonus
max_load(character, 8+str) :- class(character, Barbarian) & bonus(character, Strength, str).
        `}</code>
      </Example>
      <p>
        Equipment/gear has a few facts associate with it, like weight, damage, and maybe tags.
        I'm also setting up two types of gear - worn and wielded, because the distinction might be useful later.
        Armor shows off something new - <b>aggregations</b>. Aggregated facts are kind of like "GROUP BY" in SQL.
        We group all non-aggregated fields first, then apply the aggregation function to the group.
        This produces one fact per group.
        Max load also shows off just doing straight up <b>math</b> in an inference. As far as I know,
        this isn't really covered in standard Datalog but it's obviously useful.
      </p>
      <Example>
        <code>{`
// Give Auric his gear
wearing(Auric, FullPlate).
wielding(Auric, RoundShield).
wielding(Auric, TwoHandedSword).

// So Auric is Clumsy, but he's got 4 armor a load of 7, and a max load of 11
∴ tag(Auric, Clumsy).
∴ armor(Auric, 4).
∴ load(Auric, 7).
∴ max_load(Auric, 11).
        `}</code>
      </Example>
      <p>
        Now that we have <b>load</b> and <b>max load</b> the next obvious thing to do is compare them:
      </p>
      <Example>
        <code>{`
// Given a character and max load, they are tagged with Encumbered if their load is greater than their max load
tag(character, Encumbered) :- load(character, load) & max_load(character, max_load) & load > max_load.

// Therefore Auric is not Encumbered
∴ ~tag(Auric, Encumbered).
        `}</code>
      </Example>
      <p>
        You can start to see the possibilities of formalizing the rules. A nice UI could show us all
        tags asssociated with a character (maybe even on a map!). As Auric adds and drops gear, the
        tag gets added and removed from the database and thus the UI. We can even add a nice popover
        to link the inferred tag to the rule description. All this because we know <em>why</em> you're
        encumbered and <em>what</em> that means.
      </p>
      <p>
        It's been a minute - maybe you've forgotten what Auric has on him.
        &nbsp;<b>Queries</b> are a standard part of Datalog, so Entish has them as well. These just
        return any facts that pattern match what you give them:
      </p>
      <Example>
        <code>{`
wielding(Auric, ?)?
wearing(Auric, ?)?
        `}</code>
      </Example>
      <p>
        One final example:
      </p>
      <Example>
        <code>{`
// The move "Full Plate and Packing Steel" negates the Clumsy tag
~tag(character, Clumsy) :- move(character, FullPlateAndPackingSteel).

// Auric has the move "Full Plate and Packing Steel"
move(Auric, FullPlateAndPackingSteel).

// Auric is not Clumsy
∴ ~tag(Auric, Clumsy).
        `}</code>
      </Example>
      <p>
        Now we're really deviating from Datalog! <b>Negating</b> facts makes things complicated, but it's
        worth it because sometimes you want rules that tell you to ignore other rules.
      </p>
    </InterpreterContext.Provider>
  </Container>;
}

export default App;
