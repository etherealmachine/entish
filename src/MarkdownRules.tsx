import { useEffect, useRef, useState } from "react";
import { sanitize } from "dompurify";
import marked from "marked";

import Interpreter, { Statement, statementToString } from "./entmoot";

export default function MarkdownRules({ interpreter, rules }: { interpreter: Interpreter; rules: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [statements, setStatements] = useState<Statement[]>();
  useEffect(() => {
    if (ref.current) {
      setStatements(
        Array.from(ref.current.querySelectorAll("code.language-entish"))
          .map((node) => (node.textContent ? interpreter.parse(node.textContent) : []))
          .flat()
      );
    }
  }, [interpreter]);
  return (
    <div>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: sanitize(marked(rules)) }} />
      {statements && statements.map((stmt, i) => <div key={`statement-${i}`}>{statementToString(stmt)}</div>)}
    </div>
  );
}
