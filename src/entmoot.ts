import peg from 'pegjs';
import staticGrammar from './entish.peg';
import seedrandom from 'seedrandom';
import Tracer from 'pegjs-backtrace';

let grammar: string;
if (staticGrammar === 'entish.peg') {
  // Just so jest can access non-js resources
  const fs = require('fs');
  grammar = fs.readFileSync('./src/entish.peg').toString();
} else {
  grammar = staticGrammar;
}

export type Statement = Comment | Fact | Inference | Claim | Rolling | Query

export type Comment = {
  type: 'comment'
  value: string
}

export type Fact = {
  type: 'fact'
  table: string
  fields: Expression[]
  negative?: boolean
}

export type Inference = {
  type: 'inference'
  left: Fact
  right: Conjunction | Disjunction
}

export type Clause = Fact | Conjunction | Disjunction | Comparison

export type Conjunction = {
  type: 'conjunction'
  clauses: Clause[]
}

export type Disjunction = {
  type: 'disjunction'
  clauses: Clause[]
}

export type Comparison = {
  type: 'comparison'
  operator: ComparisonOperator
  left: Expression
  right: Expression
}

export type ComparisonOperator = '=' | '>' | '<' | '>=' | '<=' | '!='

export type Claim = {
  type: 'claim'
  clause: Clause
}

export type Rolling = {
  type: 'rolling'
  clause: Clause
}

export type Query = {
  type: 'query'
  clause: Clause
}

export type Expression = Constant | Function | BinaryOperation | Variable | Comparison | Aggregation

export type Constant = Boolean | String | Number | Roll

export type BinaryOperation = {
  type: 'binary_operation'
  left: Expression
  right: Expression
  operator: '+' | '-' | '*' | '/' | '^'
}

export type Function = {
  type: 'function'
  function: 'floor' | 'sum' | 'count' | 'probability'
  arguments: Expression[]
}

export type Boolean = {
  type: 'boolean'
  value: boolean
}

export type String = {
  type: 'string'
  value: string
}

export type Variable = {
  type: 'variable'
  value: string
}

export type Number = {
  type: 'number'
  value: number
}

export type Roll = {
  type: 'roll'
  count: number
  die: number
  modifier: number
}

export type Aggregation = {
  type: 'aggregation'
  function: 'sum' | 'count'
  arguments: (Constant | Aggregation)[]
}

export type Binding = {
  facts: Fact[]
  values: { [key: string]: Constant | Aggregation }
  comparisons: Comparison[]
}

export class Entception extends Error { }

export class BindingMismatch extends Error { }

export class TODO extends Error { }

function groupBy<T>(array: T[], f: (o: T) => string) {
  const groups: { [key: string]: T[] } = {};
  array.forEach(o => {
    const group = f(o);
    groups[group] = groups[group] || [];
    groups[group].push(o);
  });
  return Object.keys(groups).map(group => groups[group]);
}

function equal(expr1: Expression, expr2: Expression): boolean {
  if (expr1.type !== expr2.type) return false;
  if (expr1.type === 'roll' && expr2.type === 'roll') return rollToString(expr1) === rollToString(expr2);
  if ('value' in expr1 && 'value' in expr2) return expr1.value === expr2.value;
  throw new Entception(`incomparable types: ${expr1.type} and ${expr2.type}`);
}

export default class Interpreter {

  parser: PEG.Parser;
  tables: { [key: string]: Constant[][] } = {}
  inferences: Inference[] = []
  rng: () => number

  constructor(seed: string) {
    this.parser = peg.generate(grammar, { trace: true });
    this.rng = seedrandom(seed);
  }

  exec(statement: Statement) {
    let results;
    switch (statement.type) {
      case 'comment':
        return;
      case 'fact':
        this.loadFact(statement);
        console.log(`added ${factToString(statement)}`);
        return;
      case 'inference':
        console.log(`inferring ${inferenceToString(statement)}`);
        this.loadInference(statement);
        return;
      case 'claim':
        console.log(`testing ${claimToString(statement)}`)
        if (!this.testClaim(statement)) {
          throw new Entception(`false claim: ${claimToString(statement)}`);
        } else {
          console.log(`verified ${claimToString(statement)}`);
        }
        return;
      case 'query':
        console.log(`query: ${queryToString(statement)}`);
        results = this.query(statement);
        if (results.length === 0) console.warn('no matching facts found');
        results.forEach(f => console.log(`found: ${factToString(f)}`));
        return;
      case 'rolling':
        console.log(`rolling: ${rollingToString(statement)}`);
        results = this.roll(statement);
        if (results.length === 0) console.warn('no rolls found');
        results.forEach(f => console.log(`rolled: ${factToString(f)}`));
        return;
      default:
        throw new TODO(`unhandled statement type: ${(statement as any).type}`);
    }
  }

  load(input: string) {
    const tracer = new Tracer(input, { useColor: false });
    try {
      const statements = this.parser.parse(input, { tracer: tracer }).filter((x: any) => x);
      for (let line in statements) {
        const statement = statements[line];
        this.exec(statement);
      }
    } catch (e) {
      if ('location' in e) {
        console.error(tracer.getBacktraceString());
        throw new Error(`line ${e.location.start.line} Column ${e.location.start.column}: ${e.message}`);
      } else {
        console.error(e);
        throw e;
      }
    }
  }

  loadFact(fact: Fact) {
    if (fact.negative) {
      this.tables[fact.table] = this.tables[fact.table].filter(row => !row.every((col, i) => equal(fact.fields[i], col)));
      return;
    }
    if (!this.tables[fact.table]) {
      this.tables[fact.table] = [];
    }
    if (fact.fields.some(expr => expr.type !== 'string' && expr.type !== 'number' && expr.type !== 'roll')) {
      throw new Entception(`facts must be grounded with strings or numbers: ${factToString(fact)}`);
    }
    if (!this.tables[fact.table].some(e => e.every((f, i) => equal(f, fact.fields[i])))) {
      this.tables[fact.table].push(fact.fields as Constant[]);
      this.inferences.forEach(i => this.loadInference(i, true));
    }
  }

  query(query: Query): Fact[] {
    return this.search(query.clause).map(b => b.facts).flat();
  }

  roll(roll: Rolling): Fact[] {
    const newFacts: Fact[] = this.search(roll.clause).map(b => b.facts).flat().map(fact => {
      return {
        type: 'fact',
        table: fact.table,
        fields: fact.fields.map(f => f.type === 'roll' ? this.generateRoll(f) : f),
      };
    });
    newFacts.forEach(fact => this.loadFact(fact));
    return newFacts;
  }

  loadInference(inference: Inference, recursive: boolean = false) {
    const bindings = this.search(inference.right);
    let facts = bindings.map(binding => this.ground(inference.left, binding));
    if (facts.some(fact => fact.fields.some(field => field.type === 'aggregation'))) {
      facts = groupBy(facts, fact => {
        return fact.fields
          .filter(f => f.type === 'string' || f.type === 'number')
          .map(f => (f as String | Number).value)
          .join('-');
      }).map(facts => {
        const first = facts[0];
        return {
          type: 'fact',
          table: first.table,
          fields: first.fields.map((e, i) => this.aggregate(e, i, facts))
        };
      });
    }
    facts.forEach(f => this.loadFact(f));
    if (!recursive && !this.inferences.some(inf => inferenceToString(inf) === inferenceToString(inference))) {
      this.inferences.push(inference);
    }
  }

  aggregate(expr: Expression, index: number, groups: Fact[]): Expression {
    switch (expr.type) {
      case 'string':
      case 'number':
        return expr;
      case 'aggregation':
        if (expr.function === 'sum') {
          const args = groups.map(f => {
            const field = f.fields[index];
            if (field.type !== 'aggregation') {
              throw new TODO();
            }
            return field.arguments;
          });
          return {
            type: 'number',
            value: args.flat().reduce((n, c) => {
              if (c.type !== 'number') throw new Entception(`Can't sum type ${c.type}`);
              return n + c.value;
            }, 0),
          };
        }
        throw new Entception(`Non-existent aggregation function ${expr.function}`);
      default:
        throw new TODO();
    }
  }

  ground(fact: Fact, binding: Binding): Fact {
    return {
      type: 'fact',
      table: fact.table,
      fields: fact.fields.map(expr => {
        const result = this.evaluateExpression(expr, binding);
        switch (typeof (result)) {
          case 'number':
            return {
              type: 'number',
              value: result,
            };
          case 'string':
            return {
              type: 'string',
              value: result,
            };
          case 'object':
            return result;
          default:
            throw new Entception(`unknown expression result type ${typeof (result)}`);
        }
      }),
      negative: fact.negative,
    }
  }

  search(clause: Clause): Binding[] {
    switch (clause.type) {
      case 'fact':
        // facts return one binding per matching row of the table
        return (this.tables[clause.table] || []).map(row => this.bind(row, clause)).filter(b => b !== undefined) as Binding[];
      case 'conjunction':
        // conjunction joins bindings into a single binding
        let rows: Binding[][] = [];
        this.join(clause.clauses.map(clause => this.search(clause)), [], rows);
        return rows.map(bindings => this.reduceBindings(bindings)).filter(b => b !== undefined) as Binding[];
      case 'disjunction':
        // disjunction concatenates bindings
        return clause.clauses.map(clause => this.search(clause)).flat();
      case 'comparison':
        return [{
          facts: [] as Fact[],
          values: {},
          comparisons: [clause],
        }];
    }
  }

  join(bindings: Binding[][], group: Binding[], result: Binding[][]) {
    if (bindings.length === 0) {
      result.push(group)
      return
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
        Object.keys(current.values).forEach(key => {
          if (binding.values[key] && !equal(binding.values[key], current.values[key])) {
            throw new BindingMismatch(`bindings disagree: ${expressionToString(binding.values[key])} != ${expressionToString(current.values[key])}`);
          }
        });
        const newBinding = {
          facts: current.facts.concat(binding.facts),
          values: Object.assign(current.values, binding.values),
          comparisons: binding.comparisons,
        };
        binding.comparisons.forEach(comparison => {
          if (!this.compare(comparison, newBinding)) {
            throw new BindingMismatch(`false comparison: ${clauseToString(comparison)}, ${newBinding.values}`);
          }
        });
        return newBinding;
      }, {
        facts: [],
        values: {},
        comparisons: [],
      } as Binding);
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
          case 'string':
          case 'number':
          case 'roll':
            if (!equal(value, field)) {
              throw new BindingMismatch(`binding mismatch: ${value} != ${field}`);
            }
            return [`${clause.table}[${i}]`, value];
          case 'variable':
            if (field.value === '?') {
              return [`${clause.table}[${i}]`, value];
            }
            return [field.value, value];
          default:
            throw new Entception(`can't handle ${field.type} ${expressionToString(field)} in clause`);
        }
      });
      return {
        facts: [{
          type: 'fact',
          table: clause.table,
          fields: constants,
        }],
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
    if (left.type === 'aggregation' || right.type === 'aggregation') {
      return false;
    }
    const l = left.type === 'roll' ? this.averageRoll(left) : left.value;
    const r = right.type === 'roll' ? this.averageRoll(right) : right.value;
    switch (comparison.operator) {
      case '=':
        return l === r;
      case '!=':
        return l !== r;
      case '>':
        return l > r;
      case '>=':
        return l >= r;
      case '<':
        return l < r;
      case '<=':
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
          case '=':
            if (r === target) positive_outcomes++;
            break;
          case '!=':
            if (r !== target) positive_outcomes++;
            break;
          case '>=':
            if (r >= target) positive_outcomes++;
            break;
          case '<=':
            if (r <= target) positive_outcomes++;
            break;
          case '>':
            if (r > target) positive_outcomes++;
            break;
          case '<':
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
      type: 'number',
      value: total,
    };
  }

  testClaim(claim: Claim): boolean {
    if (claim.clause.type === 'fact') {
      const table = this.tables[claim.clause.table];
      if (table) {
        for (const row of table) {
          if (row.length !== claim.clause.fields.length) continue;
          if (claim.clause.fields.every((field, i) => field.type === row[i].type && JSON.stringify(field) === JSON.stringify(row[i]))) { return !claim.clause.negative }
        }
      }
      return !!claim.clause.negative;
    } else if (claim.clause.type === 'conjunction') {
      const bindings = this.search(claim.clause);
      return bindings.length > 0;
    } else if (claim.clause.type === 'comparison') {
      const result = this.evaluateExpression(claim.clause, { facts: [], values: {}, comparisons: [] });
      if (result.type === 'boolean') return result.value;
    }
    throw new Entception(`can't verify claims of type ${claim.clause.type}`);
  }

  evaluateFunction(fn: Function, binding: Binding): Constant | Aggregation {
    switch (fn.function) {
      case 'floor':
        const arg = this.evaluateExpression(fn.arguments[0], binding);
        if (arg.type !== 'number') {
          throw new Entception(`floor requires numeric argument, got ${arg.type}`);
        }
        return { type: 'number', value: Math.floor(arg.value) };
      case 'sum':
        return {
          type: 'aggregation',
          function: 'sum',
          arguments: fn.arguments.map(expr => this.evaluateExpression(expr, binding)),
        };
      case 'probability':
        if (fn.arguments[0].type === 'comparison') {
          const roll = this.evaluateExpression(fn.arguments[0].left, binding);
          const operator = fn.arguments[0].operator;
          const target = this.evaluateExpression(fn.arguments[0].right, binding);
          if (roll.type !== 'roll' || target.type !== 'number') {
            throw new Entception(`can't compute probability for ${fn.arguments[0]}`);
          }
          return { type: 'number', value: this.probability(roll, operator, target.value) };
        } else {
          const roll = this.evaluateExpression(fn.arguments[0], binding);
          if (roll.type !== 'roll') throw new Entception(`first argument to probability function must be a roll`);
          return roll;
        }
      case 'count':
      default:
        throw new TODO();
    }
  }

  evaluateBinaryOperation(op: BinaryOperation, binding: Binding): number {
    const left = this.evaluateExpression(op.left, binding);
    if (left.type !== 'number') {
      throw new Entception(`binary operation requires number on left-hand side, got ${left}`);
    }
    const right = this.evaluateExpression(op.right, binding);
    if (right.type !== 'number') {
      throw new Entception(`binary operation requires number on right-hand side, got ${right}`);
    }
    switch (op.operator) {
      case '+':
        return left.value + right.value;
      case '-':
        return left.value - right.value;
      case '/':
        return left.value / right.value;
      case '*':
        return left.value * right.value;
      case '^':
        return Math.pow(left.value, right.value);
    }
  }

  evaluateExpression(expr: Expression, binding: Binding): Constant | Aggregation {
    switch (expr.type) {
      case 'binary_operation':
        return { type: 'number', value: this.evaluateBinaryOperation(expr, binding) };
      case 'function':
        return this.evaluateFunction(expr, binding);
      case 'variable':
        return binding.values[expr.value];
      case 'comparison':
        return { type: 'boolean', value: this.compare(expr, binding) };
      case 'boolean':
      case 'string':
      case 'number':
      case 'roll':
      case 'aggregation':
        return expr;
    }
  }
}

export function statementToString(stmt: Statement): string {
  switch (stmt.type) {
    case 'claim':
      return claimToString(stmt);
    case 'inference':
      return inferenceToString(stmt);
    case 'query':
      return queryToString(stmt);
    default:
      return `[${stmt.type}]`;
  }
}

export function inferenceToString(inf: Inference): string {
  return `${factToString(inf.left)} :- ${clauseToString(inf.right)}.`
}

export function queryToString(q: Query): string {
  return `${clauseToString(q.clause)}?`;
}

export function factToString(fact: Fact): string {
  return `${fact.negative ? '~' : ''}${fact.table}(${fact.fields.map(e => expressionToString(e)).join(', ')})`;
}

export function clauseToString(clause: Clause): string {
  switch (clause.type) {
    case 'fact':
      return factToString(clause);
    case 'conjunction':
      return '(' + clause.clauses.map(c => clauseToString(c)).join(' & ') + ')';
    case 'disjunction':
      return '(' + clause.clauses.map(c => clauseToString(c)).join(' | ') + ')';
    case 'comparison':
      return comparisonToString(clause);
  }
}

export function expressionToString(expr: Expression): string {
  switch (expr.type) {
    case 'boolean':
      return expr.value.toString();
    case 'string':
      return expr.value;
    case 'number':
      return expr.value.toString();
    case 'roll':
      return rollToString(expr);
    case 'variable':
      return expr.value;
    case 'binary_operation':
      return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
    case 'function':
      return `${expr.function}(${expr.arguments.map(e => expressionToString(e)).join(', ')})`;
    case 'comparison':
      return comparisonToString(expr);
    case 'aggregation':
      return `${expr.function}(${expr.arguments.map(e => {
        if (typeof (e) === 'object') return expressionToString(e);
        return e;
      }).join(', ')})`;
  }
}

export function comparisonToString(comparison: Comparison): string {
  return `${expressionToString(comparison.left)} ${comparison.operator} ${expressionToString(comparison.right)}`;
}

export function rollToString(roll: Roll): string {
  const mod = roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier < 0 ? `-${roll.modifier}` : '';
  return `${roll.count}d${roll.die}${mod}`;
}

export function claimToString(claim: Claim): string {
  return `∴ ${clauseToString(claim.clause)}`;
}

export function rollingToString(roll: Rolling): string {
  return `🎲 ${clauseToString(roll.clause)}`;
}