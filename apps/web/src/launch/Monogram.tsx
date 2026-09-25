/**
 * A neutral ticker roundel for a prize token.
 *
 * Company logos are deliberately not used: the prizes are PreStocks tokens,
 * not the companies' own securities, and the site is not affiliated with or
 * endorsed by any of them.
 */
export function Monogram(
	{ symbol, size = 40 }: Readonly<{ symbol: string; size?: number }>,
) {
	const text = symbol.slice(0, 10).toUpperCase();
	const fontSize = Math.max(9, Math.min(22, 64 / Math.max(3, text.length)));

	return (
		<svg
			className="monogram"
			viewBox="0 0 40 40"
			width={size}
			height={size}
			aria-hidden="true"
			data-symbol={text}
		>
			<circle cx="20" cy="20" r="18.5" className="monogram-ring" />
			<circle cx="20" cy="20" r="14.5" className="monogram-core" />
			<text
				x="20"
				y="20"
				dominantBaseline="central"
				textAnchor="middle"
				fontSize={fontSize}
				className="monogram-text"
			>
				{text}
			</text>
		</svg>
	);
}
