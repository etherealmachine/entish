import React, { useContext, useRef, useState } from 'react';
import styled from 'astroturf/react';
import Editor from "@monaco-editor/react";

import Interpreter, { String, Integer } from './entmoot';
import useMonacoEntish from './useMonacoEntish';
import Highlight from './Highlight';
import example from './example.ent';

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

function EditorWithCode({ children }: { children: React.ReactElement }) {
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
    <InterpreterContext.Provider value={interpreter}>
      <EditorWithCode><code>{example}</code></EditorWithCode>
    </InterpreterContext.Provider>
    <Highlight language="entish">{example}</Highlight>
  </Container>;
}

export default App;
