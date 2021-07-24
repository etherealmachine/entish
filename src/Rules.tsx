import Editor from "@monaco-editor/react";
import { useRef, useState } from "react";
import { Route, Switch, useParams, useRouteMatch } from "react-router";

import { Navbar } from "./App";
import Interpreter from "./entmoot";
import MarkdownRules from "./MarkdownRules";

const RuleBlock = () => {
  const { folder, file } = useParams<{ folder: string; file: string }>();
  const module = require(`./rules/${folder}/${file}`);
  const [block, setBlock] = useState<string>(module.default);
  const interpreter = new Interpreter("seed");
  const editorRef = useRef<any>(null);
  return (
    <div style={{ height: "calc(100vh - 70px)" }}>
      <div style={{ height: "50%", display: "flex" }}>
        <Editor
          defaultLanguage="markdown"
          defaultValue={module.default}
          onChange={(value) => {
            if (value) setBlock(value);
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            scrollbar: { alwaysConsumeMouseWheel: false },
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.layout();
          }}
        />
      </div>
      <MarkdownRules interpreter={interpreter} rules={block} />
    </div>
  );
};

export default function Rules() {
  const { path } = useRouteMatch();
  return (
    <>
      <Navbar>
        <h1>Entish</h1>
        <a href="//github.com/etherealmachine/entish#readme">README</a>
        <div style={{ marginLeft: "auto" }}>
          <span>
            <a href="//github.com/etherealmachine">James Pettit</a> ©2021
          </span>
        </div>
      </Navbar>
      <Switch>
        <Route path={`${path}/:folder/:file`}>
          <RuleBlock />
        </Route>
      </Switch>
    </>
  );
}
