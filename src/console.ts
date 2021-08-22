import chalk from "chalk";
import Interpreter, { factToString, statementToString } from "./entmoot";

function main() {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const interpreter = new Interpreter("1234", false);

  function handleInput(input: string) {
    try {
      const statements = interpreter.parse(input);
      statements.forEach((stmt) => {
        const result = interpreter.exec(stmt);
        if (result instanceof Array) {
          result.forEach((f) => {
            console.log(factToString(f));
          });
        } else if (result.type === "boolean" && !result.value) {
          console.log(statementToString(stmt, true));
        }
      });
    } catch (e: any) {
      if ("location" in e) {
        console.log(e.toString());
        let line = input.split("\n")[e.location.start.line - 1];
        if (!line && interpreter.lastInput) {
          line = interpreter.lastInput.split("\n")[e.location.start.line - 1];
        }
        if (line) {
          const left = line.slice(0, e.location.start.column - 1);
          const mid = line[e.location.start.column - 1];
          const right = line.slice(e.location.start.column);
          console.log(chalk.green(left || "") + chalk.red(mid || "") + (right || ""));
        }
      } else {
        console.error(e);
      }
    }
    rl.question("> ", handleInput);
  }

  rl.question("> ", handleInput);

  rl.on("close", function () {
    process.exit(0);
  });
}

main();
