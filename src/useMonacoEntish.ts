import { useMonaco } from "@monaco-editor/react";

export default function useMonacoEntish() {
	const monaco = useMonaco();
	if (monaco) {
		monaco.languages.register({ id: 'entish' });

		// Register a tokens provider for the language
		monaco.languages.setMonarchTokensProvider('entish', {
			defaultToken: 'invalid',
			keywords: [],
			brackets: [
				{ open: '(', close: ')', token: 'delimiter.parenthesis' }
			],
			tokenizer: {
				root: [
					[/\/\/.*$/, 'comment'],
					[/[A-Z][a-z]*/, 'constant'],
					[/\d+/, 'number'],
					[/[()]/, '@brackets'],
					[/([a-z_]+)\(/, 'identifier'],
					[/[a-z_]+/, 'variable.name'],
					[/[,]/, 'delimiter'],
					[/∴|:-|\.|\?/, 'keyword'],
					[/~|=|>|<|!=|>=|<=|\*|\/|\+|-|\^|&|\|/, 'operators'],
					[/[ \t\r\n]+/, ''],
				],
			},
		});
	}
}
