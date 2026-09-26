/**
 * A strict, tiny XML well-formedness check for the renderer's output.
 *
 * The renderer emits a narrow dialect (elements, double-quoted attributes,
 * escaped text), so a small tokenizer catches every realistic regression
 * without pulling a full XML parser into the test suite.
 */
const OPEN = /^<([A-Za-z][\w:-]*)((?:\s+[A-Za-z][\w:-]*="[^"<]*")*)\s*(\/?)>/;
const CLOSE = /^<\/([A-Za-z][\w:-]*)\s*>/;
const ATTRIBUTE = /([A-Za-z][\w:-]*)="([^"<]*)"/g;
const ENTITY = /&(?!(?:amp|lt|gt|quot|apos);)/;
const BAD_NUMBER = /\b(?:NaN|undefined|Infinity|null)\b/;

export type XmlSummary = Readonly<{ root: string; elements: number }>;

export function assertWellFormedXml(xml: string): XmlSummary {
	const stack: string[] = [];
	let root = "";
	let elements = 0;
	let rest = xml;

	while (rest.length) {
		if (!rest.startsWith("<")) {
			const end = rest.indexOf("<");
			const text = end < 0 ? rest : rest.slice(0, end);

			if (!stack.length && text.trim()) {
				throw new Error(`Text outside the root: ${text.slice(0, 40)}`);
			}

			if (ENTITY.test(text)) {
				throw new Error(`Unescaped & in text: ${text.slice(0, 40)}`);
			}

			rest = end < 0 ? "" : rest.slice(end);
			continue;
		}

		const close = CLOSE.exec(rest);

		if (close) {
			const expected = stack.pop();

			if (expected !== close[1]) {
				throw new Error(`Expected </${expected}>, found </${close[1]}>`);
			}

			rest = rest.slice(close[0].length);
			continue;
		}

		const open = OPEN.exec(rest);

		if (!open) {
			throw new Error(`Malformed tag near: ${rest.slice(0, 60)}`);
		}

		const [whole, name = "", attributes = "", selfClosing] = open;
		const seen = new Set<string>();

		for (const [, key = "", value = ""] of attributes.matchAll(ATTRIBUTE)) {
			if (seen.has(key)) {
				throw new Error(`Duplicate attribute ${key} on <${name}>`);
			}

			if (ENTITY.test(value) || BAD_NUMBER.test(value)) {
				throw new Error(`Bad value ${key}="${value}" on <${name}>`);
			}

			seen.add(key);
		}

		if (!stack.length) {
			if (root) {
				throw new Error(`Second root element <${name}>`);
			}

			root = name;
		}

		elements++;

		if (!selfClosing) {
			stack.push(name);
		}

		rest = rest.slice(whole.length);
	}

	if (stack.length) {
		throw new Error(`Unclosed elements: ${stack.join(" > ")}`);
	}

	return { root, elements };
}
