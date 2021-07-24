import React from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

import entish from "./ent.hljs";

hljs.registerLanguage("entish", entish);

export default function Highlight(props: React.PropsWithChildren<{ language: string }>) {
  const highlight = hljs.highlight(props.children as string, {
    language: props.language,
  });
  return (
    <pre>
      <code dangerouslySetInnerHTML={{ __html: highlight.value }} />
    </pre>
  );
}
