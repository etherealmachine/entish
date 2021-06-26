import React from 'react';
import styled from 'astroturf/react';

import Highlight from './Highlight';
import Interpreter, { String, Integer } from './entmoot';
import example from './example.ent';

const Container = styled.div`
  display: flex;
  flex-direction: row;
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
  const interpreter = new Interpreter();
  interpreter.load(example);
  return <Container>
    <Highlight language="entish">{example}</Highlight>
    <Database>
      {Object.entries(interpreter.tables).map(([name, rows]) => <Table key={name} name={name} rows={rows} />)}
    </Database>
  </Container>;
}

export default App;
