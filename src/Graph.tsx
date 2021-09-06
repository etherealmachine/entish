import Cytoscape from "cytoscape";
import COSEBilkent from "cytoscape-cose-bilkent";
import DAGRE from "cytoscape-dagre";
import { useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import Interpreter, { Binding, Clause, clauseToString, expressionToString, Query } from "./entmoot";

Cytoscape.use(COSEBilkent);
Cytoscape.use(DAGRE);

function buildGraph(p: Clause | undefined, c: Clause, a: cytoscape.ElementDefinition[]) {
  const id = clauseToString(c);
  a.push({
    data: {
      id: id,
      label: id,
      clause: c,
    },
  });
  if (p !== undefined) {
    const pid = clauseToString(p);
    a.push({
      data: {
        source: pid,
        target: id,
      },
    });
  }
  switch (c.type) {
    case "fact":
    case "comparison":
      return;
    default:
      c.clauses.forEach((child) => buildGraph(c, child, a));
  }
}

function Bindings(props: { bindings: Binding[] }) {
  const { bindings } = props;
  const keySet = new Set<string>();
  bindings.forEach((binding) => {
    Object.keys(binding).forEach((key) => {
      keySet.add(key);
    });
  });
  const keys = Array.from(keySet);
  return (
    <table>
      <thead>
        <tr>
          {keys.map((k, i) => (
            <th key={i}>{k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bindings.map((binding, i) => (
          <tr key={i}>
            {keys.map((k, j) => {
              const value = binding[k];
              return <td key={j}>{value ? expressionToString(value) : ""}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Graph() {
  const [selectedNode, setSelectedNode] = useState<cytoscape.ElementDefinition>();
  const interpreter = new Interpreter("seed");
  interpreter.load("foo(0).");
  interpreter.load("foo(1).");
  interpreter.load("foo(2).");
  interpreter.load("bar(0).");
  interpreter.load("bar(1).");
  const stmts = interpreter.parse("? foo(x) & x > 1 & bar(y) & y = 0.");
  interpreter.exec(stmts[0]);
  const query = stmts[0] as Query;
  const elements: cytoscape.ElementDefinition[] = [];
  buildGraph(undefined, query.clause, elements);
  const layout = { name: "dagre" };
  const onClick = (id: string) => {
    const el = elements.find((e) => e.data.id === id);
    setSelectedNode(el);
  };
  return (
    <>
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100vw", height: "100vh" }}
        layout={layout}
        cy={(cy) => {
          cy.on("tap", "node", (event) => onClick(event.target.id()));
        }}
      />
      {selectedNode && (
        <div style={{ position: "absolute", right: "0", bottom: "0" }}>
          {selectedNode.data.clause.bindings && <Bindings bindings={selectedNode.data.clause.bindings} />}
        </div>
      )}
    </>
  );
}
