import "@fontsource/bungee/400.css";
import "@fontsource-variable/nunito/index.css";
import "./styles/app.css";

import {
	isRouteErrorResponse,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import { TopBar } from "./components/TopBar.js";
import { currentWallet } from "./lib/.server/auth.js";
import { nowSeconds, services } from "./lib/.server/context.js";
import { clusterInfos, originFor } from "./lib/.server/env.js";
import type { PublicConfig } from "./lib/public-config.js";
import { WalletProvider } from "./wallet/WalletProvider.js";

export const links: Route.LinksFunction = () => [
	{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const [clusters, session] = await Promise.all([
		clusterInfos(app.config),
		currentWallet(app.db, request, nowSeconds()),
	]);
	const config: PublicConfig = {
		origin: originFor(app.config, request),
		clusters,
		defaultCluster: app.config.defaultCluster,
		features: {
			...app.config.features,
			swaps: app.env.CATALOG_FIXTURES === "true" ||
				app.config.enabledClusters.includes("mainnet"),
		},
		session,
	};

	return { config };
}

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#f3edda" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return (
		<WalletProvider>
			<a className="skip-link" href="#main">Skip to content</a>
			<TopBar />
			<Outlet />
		</WalletProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const root = useRouteLoaderData<typeof loader>("root");
	const page = <ErrorPage error={error} />;

	// With root data the error keeps the normal chrome, so there is a way back.
	return root
		? (
			<WalletProvider>
				<TopBar />
				{page}
			</WalletProvider>
		)
		: page;
}

function ErrorPage({ error }: Readonly<{ error: unknown }>) {
	const notFound = isRouteErrorResponse(error) && error.status === 404;
	const title = notFound ? "Nothing in this chest" : "Something jammed";
	const detail = isRouteErrorResponse(error)
		? typeof error.data === "string" && error.data
			? error.data
			: error.statusText
		: "An unexpected error stopped this page. Try again in a moment.";

	return (
		<main id="main" className="page page-narrow error-page">
			<img
				src="/chest/disappointed-final.webp"
				alt=""
				width={220}
				height={220}
			/>
			<h1 className="display">{title}</h1>
			<p className="lede">{detail}</p>
			<p className="button-row">
				<Link className="button button-primary" to="/">Go home</Link>
				<Link className="button" to="/explore">Explore lootboxes</Link>
			</p>
			{import.meta.env.DEV && error instanceof Error && (
				<pre className="error-stack">{error.stack}</pre>
			)}
		</main>
	);
}
