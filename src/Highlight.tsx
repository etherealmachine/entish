import React, { useEffect, useRef } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

import entish from './ent.hljs';

hljs.registerLanguage('entish', entish);

export default function Highlight(props: React.PropsWithChildren<{ language: string }>) {
	const ref = useRef<HTMLElement>(null);
	useEffect(() => {
		if (ref) {
			const node = ref.current;;
			if (node) hljs.highlightElement(node);
		}
	});
	return <pre>
		<code
			ref={ref}
			className={`language-${props.language}`}
			dangerouslySetInnerHTML={{ __html: props.children?.toString() || "" }} />
	</pre>;
}
