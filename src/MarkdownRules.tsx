import React, { useEffect, useRef } from "react";
import { sanitize } from "dompurify";
import marked from "marked";

import Interpreter from "./entmoot";

export default function MarkdownRules({ interpreter, rules }: { interpreter: Interpreter; rules: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      const statements = Array.from(ref.current.querySelectorAll("code.language-entish"))
        .map((node) => (node.textContent ? interpreter.parse(node.textContent) : []))
        .flat();
      console.log(statements);
    }
  });
  return (
    <div>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: sanitize(marked(rules)) }} />
    </div>
  );
}
