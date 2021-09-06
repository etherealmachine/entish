import chalk from "chalk";
import fs from "fs";
import marked from "marked";
import peg from "pegjs";
import seedrandom from "seedrandom";

if (typeof document === "undefined") {
  const { JSDOM } = require("jsdom");
  globalThis.document = new JSDOM().window.document;
}

require("./raw-loader.js").register(/\.peg$/);
const staticGrammar = require("./entish.peg");
let grammar: string;
if (staticGrammar === "entish.peg") {
  // Just so jest can access non-js resources
  const fs = require("fs");
  grammar = fs.readFileSync("./src/entish.peg").toString();
} else if (typeof staticGrammar === "string") {
  grammar = staticGrammar;
} else {
  grammar = staticGrammar.default;
}

export type Statement = Comment | Command | Fact | Inference | Claim | Rolling | Query | Function;

export type Comment = {
  type: "comment";
  value: string;
};

export type Command = {
  type: "command";
  command: "load" | "set" | "get" | "verify";
  arguments: Expression[];
};

export type Fact = {
  type: "fact";
  table: string;
  fields: Expression[];
  negative?: boolean;
  matches?: Fact[];
  bindings?: Binding[];
};

export type Inference = {
  type: "inference";
  left: Fact;
  right: Conjunction | Disjunction;
};

export type Clause = Fact | Conjunction | Disjunction | ExclusiveDisjunction | Comparison;

export type Conjunction = {
  type: "conjunction";
  clauses: Clause[];
  negative?: boolean;
  veracity?: boolean;
  bindings?: Binding[];
};

export type Disjunction = {
  type: "disjunction";
  clauses: Clause[];
  negative?: boolean;
  veracity?: boolean;
  bindings?: Binding[];
};

export type ExclusiveDisjunction = {
  type: "exclusive_disjunction";
  clauses: Clause[];
  negative?: boolean;
  veracity?: boolean;
  bindings?: Binding[];
};

export type Comparison = {
  type: "comparison";
  operator: ComparisonOperator;
  left: Expression;
  right: Expression;
  veracity?: boolean;
  bindings?: Binding[];
};

export type ComparisonOperator = "=" | ">" | "<" | ">=" | "<=" | "!=";

export type Claim = {
  type: "claim";
  clause: Clause;
};

export type Rolling = {
  type: "rolling";
  clause: Clause;
};

export type Query = {
  type: "query";
  clause: Clause;
};

export type Expression = Constant | Function | BinaryOperation | Variable | Comparison;

export type Constant = Boolean | String | Number | Roll;

export type BinaryOperation = {
  type: "binary_operation";
  operator: "+" | "-" | "*" | "/" | "^";
  left: Expression;
  right: Expression;
};

export type Function = {
  type: "function";
  function: "Floor" | "Ceil" | "Min" | "Max" | "Sum" | "Count" | "Pr";
  arguments: Expression[];
};

export type Boolean = {
  type: "boolean";
  value: boolean;
};

const TRUE: Boolean = {
  type: "boolean",
  value: true,
};

const FALSE: Boolean = {
  type: "boolean",
  value: true,
};

export type String = {
  type: "string";
  value: string;
};

export type Variable = {
  type: "variable";
  value: string;
};

export type Number = {
  type: "number";
  value: number;
};

export type Roll = {
  type: "roll";
  count: number;
  die: number;
  modifier: number;
};

export type Binding = { [key: string]: Constant | undefined };

export class Entception extends Error {}

export class BindingMismatch extends Error {
  type: string = "BindingMismatch";
}

export class TODO extends Error {}

function groupBy<T>(array: T[], f: (o: T) => string): T[][] {
  const groups: { [key: string]: T[] } = {};
  array.forEach((o) => {
    const group = f(o);
    groups[group] = groups[group] || [];
    groups[group].push(o);
  });
  return Object.keys(groups).map((group) => groups[group]);
}

function equal(expr1: Expression | Fact, expr2: Expression | Fact): boolean {
  if (expr1.type !== expr2.type) return false;
  if (expr1.type === "fact" && expr2.type === "fact") {
    if (expr1.fields.length !== expr2.fields.length) return false;
    return expr1.fields.every((f, i) => equal(f, expr2.fields[i]));
  }
  if (expr1.type === "roll" && expr2.type === "roll") return rollToString(expr1) === rollToString(expr2);
  if ("value" in expr1 && "value" in expr2) return expr1.value === expr2.value;
  throw new Entception(`incomparable types: ${expr1.type} and ${expr2.type}`);
}

function isConstant(expr: Expression): expr is Constant {
  return ["string", "number", "boolean", "roll"].includes(expr.type);
}

type TraceEvent = {
  type: string;
  rule: string;
  location: {
    start: {
      offset: number;
      line: number;
      column: number;
    };
    end: {
      offset: number;
      line: number;
      column: number;
    };
  };
};

export default class Interpreter {
  strict: boolean;
  parser: PEG.Parser;
  traceEvents: TraceEvent[] = [];
  tables: { [key: string]: Fact[] } = {};
  inferences: Inference[] = [];
  claims: Clause[] = [];
  lastInput?: string;
  rng: () => number;

  constructor(seed: string, strict: boolean = true) {
    this.strict = strict;
    this.parser = peg.generate(grammar, { trace: true });
    this.rng = seedrandom(seed);
  }

  exec(statement: Statement): Fact[] | Constant {
    switch (statement.type) {
      case "comment":
        return [];
      case "command":
        switch (statement.command) {
          case "load":
            if (statement.arguments[0].type !== "string") {
              throw new Entception(`expected load(<filename:string)>, got ${statement.arguments[0].type}`);
            }
            this.loadFromFile(statement.arguments[0].value);
            return TRUE;
          case "set":
            let key = statement.arguments[0];
            const value = statement.arguments[1];
            (this as any)[(key as any).value] = eval((value as any).value);
            return TRUE;
          case "get":
            key = statement.arguments[0];
            return {
              type: "string",
              value: JSON.stringify((this as any)[(key as any).value], null, 2),
            };
          case "verify":
            return {
              type: "boolean",
              value: this.claims.every((claim) => this.claim(claim)),
            };
          default:
            throw new TODO(`can't handle command of type ${(statement as any).command}`);
        }
      case "fact":
        return this.loadFact(statement, []);
      case "inference":
        return this.loadInference(statement, []);
      case "claim":
        if (!this.claim(statement.clause)) {
          if (this.strict) {
            throw new Entception(`unable to verify ${clauseToString(statement.clause, true)}`);
          }
          return FALSE;
        }
        return TRUE;
      case "query":
        return this.query(statement.clause);
      case "rolling":
        return this.roll(statement);
      case "function":
        return this.evaluateFunction(statement, {});
      default:
        throw new TODO(`unhandled statement type: ${(statement as any).type}`);
    }
  }

  parse(input: string): Statement[] {
    try {
      return this.parser.parse(input, { tracer: this }).filter((x: any) => x);
    } finally {
      this.traceEvents = [];
    }
  }

  trace(event: TraceEvent) {
    this.traceEvents.push(event);
  }

  load(input: string) {
    this.lastInput = input;
    const statements = this.parse(input);
    for (let line in statements) {
      const statement = statements[line];
      this.exec(statement);
    }
  }

  loadFromFile(path: string) {
    if (path.endsWith(".ent")) {
      const rules = fs.readFileSync(path).toString();
      this.load(rules);
    } else if (path.endsWith(".md")) {
      const markdown = fs.readFileSync(path).toString();
      const block = document.createElement("div");
      block.innerHTML = marked(markdown);
      Array.from(block.querySelectorAll("code.language-entish")).forEach((node) => {
        if (node.textContent) this.load(node.textContent);
      });
    } else if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
      fs.readdirSync(path).forEach((f) => {
        this.loadFromFile(path + "/" + f);
      });
    }
  }

  loadFact(fact: Fact, ignore: Inference[]): Fact[] {
    if (!this.tables[fact.table]) {
      this.tables[fact.table] = [];
    }
    if (fact.fields.some((expr) => !isConstant(expr))) {
      throw new Entception(`facts must be grounded with strings or numbers: ${factToString(fact)}`);
    }
    if (fact.negative) {
      this.tables[fact.table] = this.tables[fact.table].filter(
        (fact) => !fact.fields.every((col, i) => equal(fact.fields[i], col))
      );
      return [];
    }
    if (this.alreadyExists(fact)) {
      return [];
    }
    this.tables[fact.table].push(fact);
    return [fact].concat(
      this.inferences
        .filter((inf) => {
          return !ignore.includes(inf);
        })
        .map((inf) => this.loadInference(inf, ignore))
        .flat()
    );
  }

  alreadyExists(thing: Fact | Inference): boolean {
    if (thing.type === "fact") {
      return this.tables[thing.table].some((existingFact) => equal(existingFact, thing));
    }
    return this.inferences.some((inf) => inferenceToString(inf) === inferenceToString(thing));
  }

  query(clause: Clause): Fact[] {
    this.search(clause);
    return [];
    /*
    return this.search(clause)
      .map((b) => b.facts)
      .flat();
    */
  }

  claim(clause: Clause): boolean {
    return false;
    /*
    if (clause.type === "function") {
      throw new Entception("can't verify functions");
    }
    this.claims.push(clause);
    this.search(clause).forEach((binding) => {
      binding.comparisons.forEach((comparison) => {
        this.evaluateExpression(comparison, binding);
      });
    });
    if (clause.type === "fact") {
      const veracity = clause.matches !== undefined && clause.matches.length > 0;
      return (!!!clause.negative && veracity) || (!!clause.negative && !veracity);
    }
    this.evaluateVeracity(clause);
    return !!clause.veracity;
    */
  }

  roll(roll: Rolling): Fact[] {
    return [];
    /*
    const newFacts: Fact[] = this.search(roll.clause)
      .map((b) => b.facts)
      .flat()
      .map((fact) => {
        return {
          type: "fact",
          table: fact.table,
          fields: fact.fields.map((f) => (f.type === "roll" ? this.generateRoll(f) : f)),
        };
      });
    newFacts.forEach((fact) => this.loadFact(fact, []));
    return newFacts;
    */
  }

  loadInference(inference: Inference, ignore: Inference[]): Fact[] {
    return [];
    /*
    const bindings = this.aggregate(inference.left, this.search(inference.right));
    const facts: Fact[] = bindings.map((binding) => {
      return {
        type: "fact",
        table: inference.left.table,
        negative: inference.left.negative,
        fields: inference.left.fields.map((f) => this.evaluateExpression(f, binding)),
      };
    });
    if (!this.alreadyExists(inference)) {
      this.inferences.push(inference);
    }
    ignore.push(inference);
    const inferredFacts = facts.map((f) => this.loadFact(f, ignore)).flat();
    return inferredFacts;
    */
  }

  search(clause: Clause) {
    if (clause.type === "fact" && clause.matches === undefined) clause.matches = [];
    switch (clause.type) {
      case "fact":
        // facts return one binding per matching row of the table
        (this.tables[clause.table] || []).forEach((fact) => this.bind(fact, clause));
        break;
      case "conjunction":
      case "disjunction":
      case "exclusive_disjunction":
        clause.clauses.forEach((child) => {
          this.search(child);
          if (clause.bindings === undefined) clause.bindings = [];
          clause.bindings = clause.bindings.concat(child.bindings || []);
        });
        break;
      case "comparison":
        return [];
      default:
        throw new TODO(`can't handle ${(clause as any).type} in clause`);
    }
  }

  join(bindings: Binding[][], group: Binding[], result: Binding[][]) {
    if (bindings.length === 0) {
      result.push(group);
      return;
    }
    const first = bindings[0];
    const rest = bindings.slice(1);
    for (let binding of first) {
      this.join(rest, group.concat([binding]), result);
    }
  }

  // reduce joins bindings together where same-named variables match
  // it discards non-matching bindings (i.e. bindings that "disagree on the facts")
  reduceBindings(bindings: Binding[]): Binding | undefined {
    try {
      return bindings.reduce((current, binding) => {
        Object.keys(current).forEach((key) => {
          const boundVariable = binding[key];
          const currBoundVariable = current[key];
          if (boundVariable === undefined || currBoundVariable === undefined) return;
          if (!equal(boundVariable, currBoundVariable)) {
            throw new BindingMismatch(
              `bindings disagree: ${expressionToString(boundVariable)} != ${expressionToString(currBoundVariable)}`
            );
          }
        });
        return Object.assign(current, binding);
      }, {});
    } catch (e: any) {
      if (e.type === "BindingMismatch") return undefined;
      throw e;
    }
  }

  bind(fact: Fact, clause: Fact) {
    if (clause.bindings === undefined) clause.bindings = [];
    const entries: [string, Constant][] = [];
    for (let i = 0; i < fact.fields.length; i++) {
      const value = fact.fields[i];
      if (!isConstant(value)) {
        throw new Entception(`can't bind non-constant field of type ${value.type} in ${factToString(fact)}`);
      }
      if (i >= clause.fields.length) break;
      const field = clause.fields[i];
      if (field.type === "variable" && field.value !== "?") {
        entries.push([field.value, value]);
      } else if (
        (field.type === "string" || field.type === "number" || field.type === "roll") &&
        !equal(value, field)
      ) {
        return undefined;
      }
    }
    if (clause.matches === undefined) {
      clause.matches = [];
    }
    clause.matches.push(fact);
    clause.bindings.push(Object.fromEntries(entries));
  }

  evaluateComparison(comparison: Comparison, binding: Binding): boolean {
    const left = this.evaluateExpression(comparison.left, binding);
    const right = this.evaluateExpression(comparison.right, binding);
    const l = left.type === "roll" ? this.averageRoll(left) : left.value;
    const r = right.type === "roll" ? this.averageRoll(right) : right.value;
    switch (comparison.operator) {
      case "=":
        return l === r;
      case "!=":
        return l !== r;
      case ">":
        return l > r;
      case ">=":
        return l >= r;
      case "<":
        return l < r;
      case "<=":
        return l <= r;
    }
  }

  probability(roll: Roll, op: ComparisonOperator, target: number): number {
    let outcomes = 0;
    let positive_outcomes = 0;
    for (let i = 0; i < roll.count; i++) {
      for (let j = 1; j <= roll.die; j++) {
        const r = j + roll.modifier;
        outcomes++;
        switch (op) {
          case "=":
            if (r === target) positive_outcomes++;
            break;
          case "!=":
            if (r !== target) positive_outcomes++;
            break;
          case ">=":
            if (r >= target) positive_outcomes++;
            break;
          case "<=":
            if (r <= target) positive_outcomes++;
            break;
          case ">":
            if (r > target) positive_outcomes++;
            break;
          case "<":
            if (r < target) positive_outcomes++;
            break;
        }
      }
    }
    return positive_outcomes / outcomes;
  }

  averageRoll(roll: Roll): number {
    let total = 0;
    for (let i = 0; i < roll.count; i++) {
      total += Math.floor(0.5 * roll.die) + 1 + roll.modifier;
    }
    return total;
  }

  generateRoll(roll: Roll): Number {
    let total = 0;
    for (let i = 0; i < roll.count; i++) {
      total += Math.floor(this.rng() * roll.die) + 1 + roll.modifier;
    }
    return {
      type: "number",
      value: total,
    };
  }

  aggregate(variables: string[], bindings: Binding[]): Binding[][] {
    return groupBy(bindings, (b) => {
      const group = Object.fromEntries(variables.map((v) => [v, b[v]]));
      return JSON.stringify(group);
    });
  }

  evaluateFunction(fn: Function, binding: Binding): Constant {
    let arg: Expression;
    switch (fn.function) {
      case "Floor":
        arg = this.evaluateExpression(fn.arguments[0], binding);
        if (arg.type !== "number") {
          throw new Entception(`Floor requires numeric argument, got ${arg.type}`);
        }
        return { type: "number", value: Math.floor(arg.value) };
      case "Ceil":
        arg = this.evaluateExpression(fn.arguments[0], binding);
        if (arg.type !== "number") {
          throw new Entception(`Floor requires numeric argument, got ${arg.type}`);
        }
        return { type: "number", value: Math.floor(arg.value) };
      case "Pr":
        if (fn.arguments[0].type === "comparison") {
          const roll = this.evaluateExpression(fn.arguments[0].left, binding);
          const operator = fn.arguments[0].operator;
          const target = this.evaluateExpression(fn.arguments[0].right, binding);
          if (roll.type !== "roll" || target.type !== "number") {
            throw new Entception(`can't compute probability for ${expressionToString(fn.arguments[0])}`);
          }
          return {
            type: "number",
            value: this.probability(roll, operator, target.value),
          };
        } else {
          const roll = this.evaluateExpression(fn.arguments[0], binding);
          if (roll.type !== "roll") throw new Entception(`first argument to probability function must be a roll`);
          return roll;
        }
      default:
        throw new TODO(`can't handle function ${fn.function}`);
    }
  }

  evaluateAggregateFunction(fn: Function, bindings: Binding[]): Constant[] {
    if (fn.arguments[0].type !== "variable") {
      throw new Entception(`${fn.function} function requires a single variable argument, got ${fn.arguments[0].type}`);
    }
    const arg = fn.arguments[0];
    const agg = this.aggregate([arg.value], bindings);
    switch (fn.function) {
      case "Count":
        return agg.map((group: Binding[]) => {
          return {
            type: "number",
            value: group.length,
          };
        });
      case "Sum":
        return agg.map((group: Binding[]) => {
          return {
            type: "number",
            value: group
              .map((b) => b[arg.value])
              .reduce((total, curr) => {
                if (curr === undefined) return total;
                if (curr.type === "roll") return total;
                if (curr.type !== "number")
                  throw new Entception(`Sum got a non-numerical argument, ${arg.value} = ${curr.type}`);
                return total + curr.value;
              }, 0),
          };
        });
      default:
        throw new TODO(`can't handle aggregate function "${fn.function}"`);
    }
  }

  evaluateBinaryOperation(op: BinaryOperation, binding: Binding): number {
    const left = this.evaluateExpression(op.left, binding);
    if (left.type !== "number") {
      throw new Entception(`binary operation requires number on left-hand side, got ${left.type}`);
    }
    const right = this.evaluateExpression(op.right, binding);
    if (right.type !== "number") {
      throw new Entception(`binary operation requires number on right-hand side, got ${right.type}`);
    }
    switch (op.operator) {
      case "+":
        return left.value + right.value;
      case "-":
        return left.value - right.value;
      case "/":
        return left.value / right.value;
      case "*":
        return left.value * right.value;
      case "^":
        return Math.pow(left.value, right.value);
    }
  }

  evaluateExpression(expr: Expression, binding: Binding): Constant {
    switch (expr.type) {
      case "binary_operation":
        return {
          type: "number",
          value: this.evaluateBinaryOperation(expr, binding),
        };
      case "function":
        return this.evaluateFunction(expr, binding);
      case "variable":
        const boundVariable = binding[expr.value];
        if (boundVariable === undefined) {
          throw new Entception(`variable ${expr.value} missing from binding`);
        }
        return boundVariable;
      case "comparison":
        return { type: "boolean", value: this.evaluateComparison(expr, binding) };
      case "boolean":
      case "string":
      case "number":
      case "roll":
        return expr;
      default:
        throw new Entception(`unhandled expression type ${(expr as any).type}: ${expressionToString(expr)}`);
    }
  }

  searchExpression<T>(expr: Expression, fn: (expr: Expression) => T | undefined | false): T[] {
    const result = fn(expr);
    if (result === false) return [];
    const a = result === undefined ? [] : [result];
    switch (expr.type) {
      case "boolean":
      case "number":
      case "roll":
      case "variable":
      case "string":
        return a;
      case "comparison":
        return a.concat(this.searchExpression(expr.left, fn).concat(this.searchExpression(expr.right, fn)));
      case "binary_operation":
        return a.concat(this.searchExpression(expr.left, fn).concat(this.searchExpression(expr.right, fn)));
      case "function":
        return a.concat(expr.arguments.map((e) => this.searchExpression(e, fn)).flat());
    }
  }

  evaluateVeracity(clause: Clause): boolean {
    switch (clause.type) {
      case "fact":
        return (
          (clause.negative && (clause.matches || []).length === 0) ||
          (!clause.negative && (clause.matches || []).length > 0)
        );
      case "comparison":
        if (clause.veracity === undefined) {
          throw new Entception(`expected comparison to have veracity: ${comparisonToString(clause)}`);
        }
        return clause.veracity;
      case "conjunction":
        clause.veracity = clause.clauses.every((c) => this.evaluateVeracity(c));
        break;
      case "disjunction":
        clause.veracity = clause.clauses.some((c) => this.evaluateVeracity(c));
        break;
      case "exclusive_disjunction":
        clause.veracity = clause.clauses.filter((c) => this.evaluateVeracity(c)).length === 1;
        break;
      default:
        throw new TODO(`can't evaluate veracity of ${(clause as any).type}`);
    }
    clause.veracity = (clause.negative && !clause.veracity) || (!clause.negative && clause.veracity);
    return clause.veracity;
  }
}

export function statementToString(stmt: Statement, color: boolean = false): string {
  switch (stmt.type) {
    case "claim":
      return claimToString(stmt, color);
    case "inference":
      return inferenceToString(stmt, color);
    case "query":
      return queryToString(stmt, color);
    case "comment":
      return `// ${stmt.value}`;
    case "command":
      return commandToString(stmt);
    default:
      return JSON.stringify(stmt, null, 2);
  }
}

export function inferenceToString(inf: Inference, color: boolean = false): string {
  return `${factToString(inf.left, color)} :- ${clauseToString(inf.right, color)}.`;
}

export function queryToString(q: Query, color: boolean = false): string {
  return `? ${clauseToString(q.clause, color)}`;
}

export function factToString(fact: Fact, color: boolean = false): string {
  const s = `${fact.negative ? "~" : ""}${fact.table}(${fact.fields.map((e) => expressionToString(e)).join(", ")})`;
  if (color) {
    if (fact.matches === undefined) {
      return chalk.yellow(s);
    } else if (fact.matches.length === 0) {
      return chalk.red(s);
    } else {
      return chalk.green(s);
    }
  }
  return s;
}

const JUNCTION_OPERATOR = {
  conjunction: "&",
  disjunction: "|",
  exclusive_disjunction: "^",
};

export function clauseToString(clause: Clause, color: boolean = false): string {
  const neg = "negative" in clause && clause.negative ? "~" : "";
  switch (clause.type) {
    case "fact":
      return factToString(clause, color);
    case "conjunction":
    case "disjunction":
    case "exclusive_disjunction":
      const op = " " + JUNCTION_OPERATOR[clause.type] + " ";
      let parens = ["(", ")"];
      if (clause.veracity === true) {
        parens = parens.map((s) => chalk.green(s));
      } else if (clause.veracity === false) {
        parens = parens.map((s) => chalk.red(s));
      } else {
        parens = parens.map((s) => chalk.yellow(s));
      }
      return neg + parens[0] + clause.clauses.map((c) => clauseToString(c, color)).join(op) + parens[1];
    case "comparison":
      if (clause.veracity === true) {
        return chalk.green(comparisonToString(clause));
      } else if (clause.veracity === false) {
        return chalk.red(comparisonToString(clause));
      } else {
        return chalk.yellow(comparisonToString(clause));
      }
    default:
      return JSON.stringify(clause, null, 2);
  }
}

export function expressionToString(expr: Expression): string {
  switch (expr.type) {
    case "boolean":
      return expr.value.toString();
    case "string":
      return expr.value;
    case "number":
      return expr.value.toString();
    case "roll":
      return rollToString(expr);
    case "variable":
      return expr.value;
    case "binary_operation":
      return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
    case "function":
      return `${expr.function}(${expr.arguments.map((e) => expressionToString(e)).join(", ")})`;
    case "comparison":
      return comparisonToString(expr);
    default:
      return JSON.stringify(expr, null, 2);
  }
}

export function comparisonToString(comparison: Comparison): string {
  return `${expressionToString(comparison.left)} ${comparison.operator} ${expressionToString(comparison.right)}`;
}

export function rollToString(roll: Roll): string {
  const mod = roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier < 0 ? `-${roll.modifier}` : "";
  return `${roll.count}d${roll.die}${mod}`;
}

export function claimToString(claim: Claim, color: boolean = false): string {
  return `ergo ${clauseToString(claim.clause, color)}`;
}

export function rollingToString(roll: Rolling): string {
  return `roll ${clauseToString(roll.clause)}`;
}

export function commandToString(command: Command): string {
  return `${command.command}(${command.arguments.map((e) => expressionToString(e)).join(", ")})`;
}
