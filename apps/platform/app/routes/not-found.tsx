export function loader() {
	throw new Response(
		"That page is not here. It may have moved, or never existed.",
		{
			status: 404,
		},
	);
}

export default function NotFound() {
	return null;
}
