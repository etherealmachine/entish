import peg from "pegjs";
import staticGrammar from "./entish.peg";
import seedrandom from "seedrandom";

let grammar: string;
if (staticGrammar === "entish.peg") {
  // Just so jest can access non-js resources
  const fs = require("fs");
  grammar = fs.readFileSync("./src/entish.peg").toString();
} else {
  grammar = staticGrammar;
}

export type Statement = Comment | Fact | Inference | Claim | Rolling | Query;

export type Comment = {
  type: "comment";
  value: string;
};

export type Fact = {
  type: "fact";
  table: string;
  fields: Expression[];
  negative?: boolean;
};

export type Inference = {
  type: "inference";
  left: Fact;
  right: Conjunction | Disjunction;
};

export type Clause = Fact | Conjunction | Disjunction | Comparison;

export type Conjunction = {
  type: "conjunction";
  clauses: Clause[];
};

export type Disjunction = {
  type: "disjunction";
  clauses: Clause[];
};

export type Comparison = {
  type: "comparison";
  operator: ComparisonOperator;
  left: Expression;
  right: Expression;
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
  left: Expression;
  right: Expression;
  operator: "+" | "-" | "*" | "/" | "^";
};

export type Function = {
  type: "function";
  function: "floor" | "sum" | "count" | "probability";
  arguments: Expression[];
};

export type Boolean = {
  type: "boolean";
  value: boolean;
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

export type Binding = {
  facts: Fact[];
  values: { [key: string]: Constant | undefined };
  comparisons: Comparison[];
  group?: Binding[];
};

export class Entception extends Error {}

export class BindingMismatch extends Error {}

export class TODO extends Error {}

function groupBy<T>(array: T[], f: (o: T) => string) {
  const groups: { [key: string]: T[] } = {};
  array.forEach((o) => {
    const group = f(o);
    groups[group] = groups[group] || [];
    groups[group].push(o);
  });
  return Object.keys(groups).map((group) => groups[group]);
}

function equal(expr1: Expression, expr2: Expression): boolean {
  if (expr1.type !== expr2.type) return false;
  if (expr1.type === "roll" && expr2.type === "roll") return rollToString(expr1) === rollToString(expr2);
  if ("value" in expr1 && "value" in expr2) return expr1.value === expr2.value;
  throw new Entception(`incomparable types: ${expr1.type} and ${expr2.type}`);
}

export default class Interpreter {
  parser: PEG.Parser;
  tables: { [key: string]: Constant[][] } = {};
  inferences: Inference[] = [];
  rng: () => number;

  constructor(seed: string) {
    this.parser = peg.generate(grammar);
    this.rng = seedrandom(seed);
  }

  exec(statement: Statement) {
    let results;
    switch (statement.type) {
      case "comment":
        return;
      case "fact":
        this.loadFact(statement);
        console.log(`added ${factToString(statement)}`);
        return;
      case "inference":
        console.log(`inferring ${inferenceToString(statement)}`);
        this.loadInference(statement);
        return;
      case "claim":
        console.log(`testing ${claimToString(statement)}`);
        if (!this.testClaim(statement)) {
          throw new Entception(`false claim: ${claimToString(statement)}`);
        } else {
          console.log(`verified ${claimToString(statement)}`);
        }
        return;
      case "query":
        console.log(`query: ${queryToString(statement)}`);
        results = this.query(statement);
        if (results.length === 0) console.warn("no matching facts found");
        results.forEach((f) => console.log(`found: ${factToString(f)}`));
        return;
      case "rolling":
        console.log(`rolling: ${rollingToString(statement)}`);
        results = this.roll(statement);
        if (results.length === 0) console.warn("no rolls found");
        results.forEach((f) => console.log(`rolled: ${factToString(f)}`));
        return;
      default:
        throw new TODO(`unhandled statement type: ${(statement as any).type}`);
    }
  }

  parse(input: string): Statement[] {
    try {
      return this.parser.parse(input).filter((x: any) => x);
    } catch (e: any) {
      if (e instanceof this.parser.SyntaxError) {
        console.log(input.slice(e.location.start.offset - 10, e.location.end.offset + 10));
      }
      throw e;
    }
  }

  load(input: string) {
    const statements = this.parse(input);
    for (let line in statements) {
      const statement = statements[line];
      this.exec(statement);
    }
  }

  loadFact(fact: Fact) {
    if (fact.negative) {
      this.tables[fact.table] = this.tables[fact.table].filter(
        (row) => !row.every((col, i) => equal(fact.fields[i], col))
      );
      return;
    }
    if (!this.tables[fact.table]) {
      this.tables[fact.table] = [];
    }
    if (fact.fields.some((expr) => expr.type !== "string" && expr.type !== "number" && expr.type !== "roll")) {
      throw new Entception(`facts must be grounded with strings or numbers: ${factToString(fact)}`);
    }
    if (!this.tables[fact.table].some((e) => e.every((f, i) => equal(f, fact.fields[i])))) {
      this.tables[fact.table].push(fact.fields as Constant[]);
      this.inferences.forEach((i) => this.loadInference(i, true));
    }
  }

  query(query: Query): Fact[] {
    return this.search(query.clause)
      .map((b) => b.facts)
      .flat();
  }

  roll(roll: Rolling): Fact[] {
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
    newFacts.forEach((fact) => this.loadFact(fact));
    return newFacts;
  }

  loadInference(inference: Inference, recursive: boolean = false) {
    const bindings = this.aggregate(inference.left, this.search(inference.right));
    const facts: Fact[] = bindings.map((binding) => {
      return {
        type: "fact",
        table: inference.left.table,
        negative: inference.left.negative,
        fields: inference.left.fields.map((f) => this.evaluateExpression(f, binding)),
      };
    });
    facts.forEach((f) => this.loadFact(f));
    if (!recursive && !this.inferences.some((inf) => inferenceToString(inf) === inferenceToString(inference))) {
      this.inferences.push(inference);
    }
  }

  search(clause: Clause): Binding[] {
    switch (clause.type) {
      case "fact":
        // facts return one binding per matching row of the table
        return (this.tables[clause.table] || [])
          .map((row) => this.bind(row, clause))
          .filter((b) => b !== undefined) as Binding[];
      case "conjunction":
        // conjunction joins bindings into a single binding
        let rows: Binding[][] = [];
        this.join(
          clause.clauses.map((clause) => this.search(clause)),
          [],
          rows
        );
        return rows.map((bindings) => this.reduceBindings(bindings)).filter((b) => b !== undefined) as Binding[];
      case "disjunction":
        // disjunction concatenates bindings
        return clause.clauses.map((clause) => this.search(clause)).flat();
      case "comparison":
        return [
          {
            facts: [] as Fact[],
            values: {},
            comparisons: [clause],
          },
        ];
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
      return bindings.reduce(
        (current, binding) => {
          Object.keys(current.values).forEach((key) => {
            const boundVariable = binding.values[key];
            const currBoundVariable = current.values[key];
            if (boundVariable === undefined || currBoundVariable === undefined) return;
            if (!equal(boundVariable, currBoundVariable)) {
              throw new BindingMismatch(
                `bindings disagree: ${expressionToString(boundVariable)} != ${expressionToString(currBoundVariable)}`
              );
            }
          });
          const newBinding = {
            facts: current.facts.concat(binding.facts),
            values: Object.assign(current.values, binding.values),
            comparisons: binding.comparisons,
          };
          binding.comparisons.forEach((comparison) => {
            if (!this.compare(comparison, newBinding)) {
              throw new BindingMismatch(`false comparison: ${clauseToString(comparison)}, ${newBinding.values}`);
            }
          });
          return newBinding;
        },
        {
          facts: [],
          values: {},
          comparisons: [],
        } as Binding
      );
    } catch (e) {
      if (e instanceof BindingMismatch) return undefined;
      throw e;
    }
  }

  bind(constants: Constant[], clause: Fact): Binding | undefined {
    try {
      const bindings = constants.map((value, i) => {
        const field = clause.fields[i];
        switch (field.type) {
          case "string":
          case "number":
          case "roll":
            if (!equal(value, field)) {
              throw new BindingMismatch(`binding mismatch: ${value} != ${field}`);
            }
            return [`${clause.table}[${i}]`, value];
          case "variable":
            if (field.value === "?") {
              return [`${clause.table}[${i}]`, value];
            }
            return [field.value, value];
          default:
            throw new Entception(`can't handle ${field.type} ${expressionToString(field)} in clause`);
        }
      });
      return {
        facts: [
          {
            type: "fact",
            table: clause.table,
            fields: constants,
          },
        ],
        values: Object.fromEntries(bindings),
        comparisons: [],
      };
    } catch (e) {
      if (e instanceof BindingMismatch) return undefined;
      throw e;
    }
  }

  compare(comparison: Comparison, binding: Binding): boolean {
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

  testClaim(claim: Claim): boolean {
    if (claim.clause.type === "fact") {
      const table = this.tables[claim.clause.table];
      if (table) {
        for (const row of table) {
          if (row.length !== claim.clause.fields.length) continue;
          if (
            claim.clause.fields.every(
              (field, i) => field.type === row[i].type && JSON.stringify(field) === JSON.stringify(row[i])
            )
          ) {
            return !claim.clause.negative;
          }
        }
      }
      return !!claim.clause.negative;
    } else if (claim.clause.type === "conjunction") {
      const bindings = this.search(claim.clause);
      return bindings.length > 0;
    } else if (claim.clause.type === "comparison") {
      const result = this.evaluateExpression(claim.clause, {
        facts: [],
        values: {},
        comparisons: [],
      });
      if (result.type === "boolean") return result.value;
    }
    throw new Entception(`can't verify claims of type ${claim.clause.type}`);
  }

  evaluateFunction(fn: Function, binding: Binding): Constant {
    switch (fn.function) {
      case "floor":
        const arg = this.evaluateExpression(fn.arguments[0], binding);
        if (arg.type !== "number") {
          throw new Entception(`floor requires numeric argument, got ${arg.type}`);
        }
        return { type: "number", value: Math.floor(arg.value) };
      case "sum":
        if (binding.group === undefined) {
          return {
            type: "number",
            value: 0,
          };
        }
        const sumArg = fn.arguments[0];
        if (sumArg.type !== "variable") {
          throw new Entception(`sum function requires a single variable argument, got ${sumArg.type}`);
        }
        return {
          type: "number",
          value: binding.group
            .map((g) => g.values[sumArg.value])
            .reduce((total, curr) => {
              if (curr === undefined) return total;
              if (curr.type === "roll") return total;
              if (curr.type !== "number")
                throw new Entception(`sum got a non-numerical argument, ${sumArg.value} = ${curr.type}`);
              return total + curr.value;
            }, 0),
        };
      case "probability":
        if (fn.arguments[0].type === "comparison") {
          const roll = this.evaluateExpression(fn.arguments[0].left, binding);
          const operator = fn.arguments[0].operator;
          const target = this.evaluateExpression(fn.arguments[0].right, binding);
          if (roll.type !== "roll" || target.type !== "number") {
            throw new Entception(`can't compute probability for ${fn.arguments[0]}`);
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
      case "count":
      default:
        throw new TODO();
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
        const boundVariable = binding.values[expr.value];
        if (boundVariable === undefined) {
          throw new Entception(`variable ${expr.value} missing from binding`);
        }
        return boundVariable;
      case "comparison":
        return { type: "boolean", value: this.compare(expr, binding) };
      case "boolean":
      case "string":
      case "number":
      case "roll":
        return expr;
      default:
        throw new Entception(`unhandled expression type ${(expr as any).type}`);
    }
  }

  aggregate(fact: Fact, bindings: Binding[]): Binding[] {
    const aggregations = fact.fields
      .map((e) =>
        this.searchExpression(e, (e) => {
          if (e.type === "function" && e.function === "sum") return e;
          return undefined;
        })
      )
      .flat()
      .filter((e) => e !== undefined) as Function[];
    const variables = fact.fields
      .map((e) =>
        this.searchExpression(e, (e) => {
          if (e.type === "function" && e.function === "sum") return false;
          if (e.type === "variable") return e;
          return undefined;
        })
      )
      .flat()
      .filter((e) => e !== undefined) as Variable[];
    if (aggregations.length === 0) {
      return bindings;
    }
    const groups = groupBy(bindings, (b) => {
      const group = Object.fromEntries(variables.map((v) => [v.value, b.values[v.value]]));
      return JSON.stringify(group);
    });
    return groups.map((g) => {
      return {
        facts: g.map((b) => b.facts).flat(),
        values: g[0].values,
        comparisons: g.map((b) => b.comparisons).flat(),
        group: g,
      };
    });
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
}

export function statementToString(stmt: Statement): string {
  switch (stmt.type) {
    case "claim":
      return claimToString(stmt);
    case "inference":
      return inferenceToString(stmt);
    case "query":
      return queryToString(stmt);
    case "comment":
      return `// ${stmt.value}`;
    default:
      return `[${stmt.type}]`;
  }
}

export function inferenceToString(inf: Inference): string {
  return `${factToString(inf.left)} :- ${clauseToString(inf.right)}.`;
}

export function queryToString(q: Query): string {
  return `${clauseToString(q.clause)}?`;
}

export function factToString(fact: Fact): string {
  return `${fact.negative ? "~" : ""}${fact.table}(${fact.fields.map((e) => expressionToString(e)).join(", ")})`;
}

export function clauseToString(clause: Clause): string {
  switch (clause.type) {
    case "fact":
      return factToString(clause);
    case "conjunction":
      return "(" + clause.clauses.map((c) => clauseToString(c)).join(" & ") + ")";
    case "disjunction":
      return "(" + clause.clauses.map((c) => clauseToString(c)).join(" | ") + ")";
    case "comparison":
      return comparisonToString(clause);
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
  }
}

export function comparisonToString(comparison: Comparison): string {
  return `${expressionToString(comparison.left)} ${comparison.operator} ${expressionToString(comparison.right)}`;
}

export function rollToString(roll: Roll): string {
  const mod = roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier < 0 ? `-${roll.modifier}` : "";
  return `${roll.count}d${roll.die}${mod}`;
}

export function claimToString(claim: Claim): string {
  return `∴ ${clauseToString(claim.clause)}`;
}

export function rollingToString(roll: Rolling): string {
  return `🎲 ${clauseToString(roll.clause)}`;
}
