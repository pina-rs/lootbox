/** Base64 helpers that work the same in browsers and Workers. */
export function toBase64(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) binary += String.fromCharCode(byte);

	return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

/** `AbCd…WxYz` for addresses in tight spaces. */
export function shortAddress(value: string, edge = 4): string {
	return value.length <= edge * 2 + 1
		? value
		: `${value.slice(0, edge)}…${value.slice(-edge)}`;
}
