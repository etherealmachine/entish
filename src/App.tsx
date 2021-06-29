import React, { useState } from 'react';
import styled from 'astroturf/react';
import Editor from "@monaco-editor/react";

import Interpreter, { String, Integer } from './entmoot';
import example from './example.ent';
import useMonacoEntish from './useMonacoEntish';

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

function App() {
  useMonacoEntish();
  const interpreter = new Interpreter();
  const [code, setCode] = useState<string>(example);
  const [log, setLog] = useState<string[]>([]);
  const runExample = () => {
    const tmp = (console as any).log;
    const newLog: string[] = [];
    (console as any).log = (msg: string) => {
      newLog.push(msg);
    }
    interpreter.load(code);
    (console as any).log = tmp;
    setLog(newLog);
  }
  return <Container>
    <h1>Entish is a declarative datalog-like language implemented in Typescript</h1>
    <h2>Why?</h2>
    <p>I designed Entish to play around with implementing table-top RPG rules in formal logic.</p>
    <h2>Example</h2>
    <div style={{ display: 'flex', flexDirection: 'column', width: "100%" }}>
      <Editor
        height="50vh"
        defaultLanguage="entish"
        defaultValue={example}
        onChange={value => { if (value) setCode(value) }}
        options={{ minimap: { enabled: false } }}
      />
      <button onClick={runExample}>Run</button>
      <div>{log.map((msg, i) => <p key={`log-msg-${i}`}>{msg}</p>)}</div>
    </div>
  </Container>;
}

export default App;
