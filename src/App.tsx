import React, { useRef, useState } from 'react';
import styled from 'astroturf/react';
import Editor from "@monaco-editor/react";

import Interpreter, { Constant, expressionToString } from './entmoot';
import useMonacoEntish from './useMonacoEntish';
import dungeon_world from './dungeon_world.ent';

const Container = styled("div")`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;

  select {
    padding: 5px;
    font-size: 0.875rem;
    border: 0.0625rem solid #375EAB;
    height: 30px;
  }
`;

const Navbar = styled("div")`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10px 16px 10px 16px;
  background-color: #E0EBF5;

  h1 {
    margin-right: 16px;
    font-size: 20px;
    font-family: sans-serif;
  }

  * {
    margin-top: 10px;
    margin-bottom: 10px;
    margin-right: 12px;
    border-radius: 5px;
    box-sizing: border-box;
  }

  button {
    border: 1px solid #375EAB;
    font-size: 16px;
    font-family: sans-serif;
    background: #375EAB;
    color: white;
    height: 30px;
  }
`;

function Database({ interpreter }: { interpreter: Interpreter }) {
  const [selectedTableName, setSelectedTableName] = useState<string | undefined>(undefined);
  return <div style={{ margin: "16px 24px" }}>
    {Object.keys(interpreter.tables).length > 0 &&
      <select onChange={event => { setSelectedTableName(event.target.value) }}>
        {Object.keys(interpreter.tables).map(table_name => <option
          key={table_name} value={table_name}>
          {table_name}
        </option>)}
      </select>
    }
    {selectedTableName &&
      <Table name={selectedTableName} rows={interpreter.tables[selectedTableName]} />
    }
  </div >;
}

function Table({ name, rows }: { name: string, rows: Constant[][] }) {
  return <table>
    <tbody>
      {rows.map((row, i) => <tr key={`${name}-${i}`}>
        {row.map((val, j) => <td key={`${name}-${i}-${j}`}>
          {expressionToString(val)}
        </td>)}
      </tr>)}
    </tbody>
  </table>;
}

function App() {
  useMonacoEntish();
  const examples: { [key: string]: string } = {
    dungeon_world: dungeon_world,
    clear: '',
  };
  const [interpreter, setInterpreter] = useState<Interpreter>(new Interpreter());
  const [code, setCode] = useState<string>(examples.dungeon_world);
  const [error, setError] = useState<string | undefined>(undefined);
  const [log, setLog] = useState<string[]>([]);
  const editorRef = useRef<any>(null);
  const onExampleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const example = examples[event.target.value];
    setCode(example);
    editorRef.current?.getModel().setValue(example);
    setInterpreter(new Interpreter());
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
    setInterpreter(interpreter);
  }
  return <Container>
    <Navbar>
      <h1>Entish Playground</h1>
      <button onClick={run}>Run</button>
      <select onChange={onExampleChange} defaultValue={"dungeon_world"}>
        <option value="clear">Clear</option>
        <option value="dungeon_world">Dungeon World</option>
      </select>
      <a href="//github.com/etherealmachine/entish#readme">README</a>
      <div style={{ marginLeft: "auto" }}>
        <span><a href="//github.com/etherealmachine">James Pettit</a> ©2021</span>
      </div>
    </Navbar>
    <div style={{ height: "calc(100vh - 70px)" }}>
      <div style={{ height: "60%" }}>
        <Editor
          defaultLanguage="entish"
          defaultValue={code}
          onChange={value => { if (value) setCode(value) }}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, scrollbar: { alwaysConsumeMouseWheel: false } }}
          onMount={editor => { editorRef.current = editor; editor.layout(); }}
        />
      </div>
      <div style={{ height: "40%", display: "flex", justifyContent: "flex-start" }}>
        <div style={{ height: "100%", overflow: "scroll" }}>
          <p style={{ color: "#900" }}>{error}</p>
          <div>
            {log.map((msg, i) => <p key={`log-msg-${i}`}>{msg}</p>)}
          </div>
        </div>
        <Database interpreter={interpreter} />
      </div>
    </div>
  </Container>;
}

export default App;
