/*
Language: Entish
Description: Entish is a datalog-like language for developing RPG rules
Category: 
Website: https://github.com/etherealmachine/entish
*/
import hljs, { HLJSApi } from "highlight.js";

/** @type LanguageFn */
export default function entish(api?: HLJSApi) {
  return {
    name: 'Entish',
    aliases: ['ent'],
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.COMMENT(
        '/\\*', // begin
        '\\*/', // end
        {
          contains: [
            {
              scope: 'doc', begin: '@\\w+'
            }
          ]
        }
      ),
      {
        scope: 'keyword',
        begin: '∴'
      },
      {
        scope: 'keyword',
        begin: '^[?]'
      },
      {
        scope: 'keyword',
        begin: ':-'
      },
      {
        begin: [/\)/, /\./],
        beginScope: { 2: 'keyword' }
      },
      {
        scope: 'symbol',
        begin: /[0-9]+d[0-9]+([+-][0-9]+)?/
      },
      {
        scope: 'number',
        begin: hljs.NUMBER_RE
      },
      {
        begin: [/[a-z_]+/, /\(/],
        beginScope: { 1: 'title.function' }
      },
      {
        scope: 'operator',
        begin: /-|\+|\/|\*|\^|&|\||>|<|=|>=|<=|!=/
      },
      {
        scope: 'string',
        begin: /[A-Z]/,
        end: /[a-zA-Z]+/
      },
      {
        scope: 'variable',
        begin: /[a-z_]+/
      },
      {
        begin: [/,\s+/, /\?/],
        beginScope: { 2: 'variable.language' }
      }
    ] as unknown as any
  };
}
