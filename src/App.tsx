import React from 'react';
import styled from 'astroturf/react';

import Highlight from './Highlight';
import Interpreter from './entmoot';
import example from './example.ent';

const Container = styled.div`
`;

function App() {
  const interpreter = new Interpreter();
  return <Container>
    <Highlight language="entish">{example}</Highlight>
  </Container>;
}

export default App;
