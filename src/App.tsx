import styled from "astroturf/react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import Playground from "./Playground";
import Rules from "./Rules";

const Container = styled("div")`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;

  select {
    padding: 5px;
    font-size: 0.875rem;
    border: 0.0625rem solid #375eab;
    height: 30px;
  }
`;

export const Navbar = styled("div")`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10px 16px 10px 16px;
  background-color: #e0ebf5;

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
    border: 1px solid #375eab;
    font-size: 16px;
    font-family: sans-serif;
    background: #375eab;
    color: white;
    height: 30px;
  }
`;

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/entish/rules">
          <Container>
            <Rules />
          </Container>
        </Route>
        <Route path="/entish">
          <Container>
            <Playground />
          </Container>
        </Route>
      </Switch>
    </Router>
  );
}
