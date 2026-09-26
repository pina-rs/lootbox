import { between, randomFrom, seedFrom } from "../random.ts";
import { lettering } from "./lettering.ts";
import {
	type Art,
	type Color,
	ellipse,
	type Geometry,
	type Gradient,
	group,
	INK,
	line,
	type Point,
	polar,
	poly,
	rect,
	shape,
	star,
} from "./model.ts";
import { motion, use } from "./motion.ts";

const sunTurn = motion("sunburst-turn", 8, {
	rotation: [[0, 0], [.999, Math.PI / 8], [1, 0]],
}, true);
const starTwinkle = motion("star-twinkle", 2, {
	opacity: [[0, 1], [.5, .35], [1, 1]],
});
const cloudDrift = motion("cloud-drift", 8, {
	x: [[0, 0], [.5, 40], [1, 0]],
});
const swell = motion("sea-swell", 4, {
	y: [[0, 0], [.5, 6], [1, 0]],
	x: [[0, 0], [.5, -10], [1, 0]],
});
const aurora = motion("aurora-sway", 8, {
	x: [[0, 0], [.5, 30], [1, 0]],
	scaleY: [[0, 1], [.5, 1.12], [1, 1]],
});
const lightPulse = motion("light-pulse", 4, {
	opacity: [[0, .7], [.5, 1], [1, .7]],
});

/**
 * Full-bleed backdrops on the 1024² canvas. Indices match the `background` URI
 * field and the `BACKGROUNDS` catalog in `traits.ts`.
 *
 * The chest occupies roughly x 260..764, y 280..880 and the tier plaque the
 * bottom 140 px, so scenery lives in the upper band and the margins.
 */
export const CANVAS = 1024;

const FULL = rect(CANVAS / 2, CANVAS / 2, CANVAS, CANVAS);

function fill(name: string, paint: Color | Gradient): Art {
	return shape(name, FULL, paint, 0);
}

function vertical(stops: readonly (readonly [number, Color])[]): Gradient {
	return { kind: "linear", from: [0, 0], to: [0, CANVAS], stops };
}

function radial(
	center: Point,
	radius: number,
	stops: readonly (readonly [number, Color])[],
): Gradient {
	return {
		kind: "radial",
		from: center,
		to: [center[0] + radius, center[1]],
		stops,
	};
}

/** Scatter `count` dots with a fixed seed, so every render matches. */
function scatter(
	label: string,
	count: number,
	area: Readonly<{ top: number; bottom: number }>,
	size: readonly [number, number],
): Geometry[] {
	const random = randomFrom(seedFrom(label));

	return Array.from({ length: count }, () => {
		const diameter = between(random, size[0], size[1]);

		return ellipse(
			between(random, 16, CANVAS - 16),
			between(random, area.top, area.bottom),
			diameter,
			diameter,
		);
	});
}

function ivoryStudio(): Art[] {
	return [
		fill(
			"Ivory",
			radial([512, 470], 720, [[0, "FFFBF5E4"], [.7, "FFF3EDDA"], [
				1,
				"FFE6DCC0",
			]]),
		),
		shape("Floor", rect(512, 900, 1024, 248), "0F243D40", 0),
		line("Horizon", [[0, 776], [1024, 776]], "1F243D40", 3),
	];
}

function dusk(): Art[] {
	return [
		fill(
			"Sky",
			vertical([[0, "FF2E3A6B"], [.45, "FF7B5EA7"], [.75, "FFF4845F"], [
				1,
				"FFF7B267",
			]]),
		),
		shape(
			"Sun",
			ellipse(512, 760, 520, 520),
			radial([512, 760], 260, [[0, "CCFFE8A3"], [.6, "66FFD08A"], [
				1,
				"00FFD08A",
			]]),
			0,
		),
		shape(
			"Stars",
			scatter("dusk", 26, { top: 20, bottom: 300 }, [2, 5]),
			"CCFFF4D6",
			0,
		),
		shape(
			"Hills",
			poly(
				[[0, 1024], [0, 800], [180, 770], [360, 800], [620, 760], [860, 790], [
					1024,
					770,
				], [1024, 1024]],
				true,
				60,
			),
			"FF3C2F5C",
			0,
		),
	];
}

function openSea(): Art[] {
	const wave = (y: number, phase: number): Geometry => {
		const points: Point[] = [];

		for (let x = -20; x <= 1044; x += 34) {
			points.push([x, y + Math.sin(x / 34 + phase) * 6]);
		}

		return poly(points, false, 14);
	};

	return [
		fill(
			"Sky",
			vertical([[0, "FF8ECFE0"], [.62, "FFD7F1F2"], [1, "FFD7F1F2"]]),
		),
		shape(
			"Sea",
			rect(512, 842, 1024, 364),
			vertical([[.64, "FF3C9DBE"], [1, "FF1E5F84"]]),
			0,
		),
		group("Swell", {}, [
			shape(
				"Waves",
				[
					wave(700, 0),
					wave(760, 1.7),
					wave(830, .6),
					wave(910, 2.4),
					wave(990, 1.2),
				],
				undefined,
				4,
				"80FFFFFF",
			),
		], { motion: use(swell) }),
		group("Drifting cloud", {}, [
			shape(
				"Cloud",
				[
					ellipse(210, 180, 150, 54),
					ellipse(260, 160, 110, 70),
					ellipse(170, 168, 80, 50),
				],
				"F2FFFFFF",
				0,
			),
		], { motion: use(cloudDrift) }),
		line(
			"Gull",
			[[760, 210], [776, 200], [790, 212], [804, 200], [820, 210]],
			INK,
			3.5,
			6,
		),
		line(
			"Gull",
			[[850, 260], [860, 254], [868, 262], [876, 254], [886, 260]],
			INK,
			3,
			4,
		),
	];
}

function bankVault(): Art[] {
	const bolts = Array.from({ length: 12 }, (_, i) => {
		const [x, y] = polar(386, i * Math.PI / 6);

		return ellipse(512 + x, 470 + y, 22, 22);
	});
	const spokes = [0, 1, 2].map((i) => {
		const [x, y] = polar(420, i * Math.PI / 3 + .3);

		return poly([[512 - x, 470 - y], [512 + x, 470 + y]], false);
	});

	return [
		fill("Steel", vertical([[0, "FF4E5B63"], [1, "FF6F7E86"]])),
		shape("Door", ellipse(512, 470, 860, 860), "FF8C9AA2", 8, "FF3A454B"),
		shape("Door ring", ellipse(512, 470, 700, 700), undefined, 6, "FF6F7E86"),
		shape("Bolts", bolts, "FFB8C3C8", 4, "FF3A454B"),
		shape("Handle", spokes, undefined, 18, "FF5B676E"),
		shape("Floor", rect(512, 920, 1024, 208), "FF3A454B", 0),
		line("Floor edge", [[0, 816], [1024, 816]], "FF2C353A", 4),
	];
}

function meadow(): Art[] {
	const random = randomFrom(seedFrom("meadow"));
	const flowers = Array.from({ length: 18 }, (): Art => {
		const x = between(random, 30, 994);
		const y = between(random, 760, 870);
		const color = random() > .5 ? "FFFFF6E8" : "FFFFD35A";

		return shape("Flower", star(x, y, 18, 18, 5, .5), color, 2);
	});

	return [
		fill("Sky", vertical([[0, "FF8FD3F4"], [.7, "FFD8F1FB"], [1, "FFD8F1FB"]])),
		shape("Far hill", ellipse(250, 860, 900, 330), "FF9BD37F", 0),
		shape("Near hill", ellipse(820, 880, 900, 300), "FF7CC46E", 0),
		shape("Field", rect(512, 930, 1024, 200), "FF5DAA5B", 0),
		group("Drifting cloud", {}, [
			shape(
				"Cloud",
				[
					ellipse(800, 170, 160, 58),
					ellipse(850, 148, 110, 74),
					ellipse(752, 160, 84, 50),
				],
				"FFFFFFFF",
				3,
				"33243D40",
			),
		], { motion: use(cloudDrift, .5) }),
		...flowers,
	];
}

function starfield(): Art[] {
	return [
		fill("Space", radial([512, 420], 760, [[0, "FF232D63"], [1, "FF0B1026"]])),
		shape(
			"Dust",
			scatter("starfield-dust", 90, { top: 0, bottom: 1024 }, [1.5, 3.5]),
			"B3FFFFFF",
			0,
		),
		...Array.from({ length: 8 }, (_, i) => {
			const random = randomFrom(seedFrom(`starfield-${i}`));

			return group(
				"Bright star",
				{
					x: between(random, 40, 984),
					y: between(random, 40, 700),
				},
				[shape("Star", star(0, 0, 22, 22, 4, .28), "FFFFF6D6", 0)],
				{
					motion: use(starTwinkle, i / 8),
				},
			);
		}),
		shape("Planet", ellipse(830, 190, 110, 110), "FFE39A55", 4, INK),
		shape("Planet ring", ellipse(830, 196, 190, 40), undefined, 5, "FFF5C54E"),
		shape("Moon", ellipse(150, 170, 64, 64), "FFD5DEE1", 3, INK),
	];
}

function attic(): Art[] {
	return [
		fill("Wall", vertical([[0, "FF5C3A26"], [1, "FF8A5A3C"]])),
		shape("Beam", poly([[0, 0], [0, 150], [470, 0]]), "FF3E2618", 0),
		shape("Beam", poly([[1024, 0], [1024, 150], [554, 0]]), "FF3E2618", 0),
		shape("Window", ellipse(512, 140, 150, 150), "FFFFE3A3", 8, "FF3E2618"),
		shape(
			"Window bars",
			[
				poly([[437, 140], [587, 140]], false),
				poly([[512, 65], [512, 215]], false),
			],
			undefined,
			7,
			"FF3E2618",
		),
		shape(
			"Light beam",
			poly([[450, 190], [574, 190], [860, 880], [164, 880]]),
			vertical([[.15, "4DFFE9B0"], [1, "00FFE9B0"]]),
			0,
		),
		shape("Floor", rect(512, 910, 1024, 228), "FF6B4430", 0),
		shape(
			"Floorboards",
			[0, 1, 2, 3, 4, 5, 6].map((i) =>
				poly([[i * 160 + 40, 800], [i * 190 - 80, 1024]], false)
			),
			undefined,
			3,
			"FF4A2E1F",
		),
		shape(
			"Cobweb",
			[
				poly([[0, 0], [120, 0]], false),
				poly([[0, 0], [0, 120]], false),
				poly([[0, 0], [90, 90]], false),
				poly([[60, 0], [44, 44], [0, 60]], false, 10),
				poly([[110, 0], [80, 80], [0, 110]], false, 16),
			],
			undefined,
			2,
			"80E8DCC8",
		),
	];
}

function blueprint(): Art[] {
	const minor: Geometry[] = [];
	const major: Geometry[] = [];

	for (let v = 32; v < CANVAS; v += 32) {
		const list = v % 128 === 0 ? major : minor;

		list.push(
			poly([[v, 0], [v, CANVAS]], false),
			poly([[0, v], [CANVAS, v]], false),
		);
	}

	return [
		fill("Paper", "FF1F4E8C"),
		shape("Grid", minor, undefined, 1, "1FFFFFFF"),
		shape("Major grid", major, undefined, 2, "33FFFFFF"),
		shape(
			"Dimension",
			[
				poly([[252, 250], [252, 890]], false),
				poly([[240, 250], [264, 250]], false),
				poly([[240, 890], [264, 890]], false),
				poly([[268, 920], [760, 920]], false),
			],
			undefined,
			2.5,
			"B3FFFFFF",
		),
		shape("Compass arc", ellipse(512, 560, 640, 640), undefined, 2, "40FFFFFF"),
		lettering("Figure", "FIG. 1", 900, 60, 26, "CCFFFFFF", 3, "end"),
		lettering(
			"Caption",
			"CHEST, EMPTY-ISH",
			900,
			100,
			14,
			"99FFFFFF",
			2,
			"end",
		),
	];
}

function sunburst(): Art[] {
	const rays = Array.from({ length: 16 }, (_, i) => {
		const a = i * Math.PI / 8;
		const [x1, y1] = polar(1100, a - Math.PI / 32);
		const [x2, y2] = polar(1100, a + Math.PI / 32);

		return poly([[0, 0], [x1, y1], [x2, y2]]);
	});

	return [
		fill("Base", "FFFBE3A8"),
		group("Rays", { x: 512, y: 560 }, [shape("Rays", rays, "FFF7C873", 0)], {
			motion: use(sunTurn),
		}),
		shape(
			"Glow",
			ellipse(512, 560, 700, 700),
			radial([512, 560], 350, [[0, "CCFFF6DA"], [1, "00FFF6DA"]]),
			0,
		),
	];
}

function picnicBlanket(): Art[] {
	const band = (horizontal: boolean) =>
		Array.from({ length: 8 }, (_, i) => {
			const at = i * 128 + 32;

			return horizontal
				? rect(512, at + 32, 1024, 64)
				: rect(at + 32, 512, 64, 1024);
		});

	return [
		fill("Cloth", "FFFFF6F2"),
		shape("Rows", band(true), "59E8574A", 0),
		shape("Columns", band(false), "59E8574A", 0),
		...[[120, 180], [150, 196], [180, 188], [210, 204]].map(([x = 0, y = 0]) =>
			group("Ant", { x, y, rotation: .3 }, [
				shape(
					"Ant",
					[ellipse(-7, 0, 8, 7), ellipse(0, 0, 7, 6), ellipse(8, 0, 10, 8)],
					INK,
					0,
				),
				line("Legs", [[-4, -6], [0, 0], [4, -6]], INK, 1.5),
			])
		),
	];
}

function deepSea(): Art[] {
	const bubbles = scatter("deep-bubbles", 16, { top: 60, bottom: 760 }, [
		10,
		30,
	]);

	return [
		fill(
			"Water",
			vertical([[0, "FF0E4D64"], [.55, "FF07243A"], [1, "FF03121F"]]),
		),
		shape(
			"Light shafts",
			[
				poly([[300, 0], [380, 0], [260, 760], [160, 760]]),
				poly([[560, 0], [620, 0], [700, 760], [600, 760]]),
				poly([[800, 0], [840, 0], [980, 700], [920, 700]]),
			],
			vertical([[0, "33BFF4FF"], [.8, "00BFF4FF"]]),
			0,
		),
		shape("Bubbles", bubbles, undefined, 2.5, "80BFF4FF"),
		shape(
			"Glowing plankton",
			scatter("deep-plankton", 30, { top: 80, bottom: 980 }, [3, 7]),
			"CC7FFFD4",
			0,
		),
		shape(
			"Seabed",
			poly(
				[[0, 1024], [0, 850], [260, 820], [520, 860], [780, 826], [1024, 860], [
					1024,
					1024,
				]],
				true,
				80,
			),
			"FF0A1C28",
			0,
		),
	];
}

function velvetCurtain(): Art[] {
	const curtain = (side: 1 | -1): Art => {
		const x = side < 0 ? 0 : 1024;
		const inner = x - side * 210;
		const folds = [1, 2, 3].map((i) =>
			poly([[x - side * i * 52, 0], [x - side * i * 60, 900]], false)
		);

		return group(side < 0 ? "Left curtain" : "Right curtain", {}, [
			shape(
				"Curtain",
				poly(
					[[x, 0], [inner, 0], [inner + side * 30, 440], [
						inner - side * 20,
						900,
					], [x, 900]],
					true,
					60,
				),
				"FFA3243A",
				0,
			),
			shape("Folds", folds, undefined, 6, "66000000"),
			shape(
				"Tieback",
				ellipse(x - side * 150, 470, 34, 34),
				"FFF5C54E",
				3.5,
				INK,
			),
		]);
	};

	return [
		fill("Backdrop", vertical([[0, "FF4A0F1C"], [1, "FF7A1E2C"]])),
		shape(
			"Spotlight",
			poly([[450, 0], [574, 0], [860, 860], [164, 860]]),
			vertical([[0, "40FFF1C2"], [1, "0FFFF1C2"]]),
			0,
		),
		shape("Stage", rect(512, 930, 1024, 188), "FF6B4430", 0),
		line("Stage lip", [[0, 836], [1024, 836]], "FF3E2618", 6),
		shape("Pool of light", ellipse(512, 860, 660, 90), "33FFF1C2", 0),
		curtain(-1),
		curtain(1),
		shape(
			"Valance",
			poly([
				[0, 0],
				[1024, 0],
				[1024, 70],
				[896, 96],
				[768, 70],
				[640, 96],
				[512, 70],
				[384, 96],
				[256, 70],
				[128, 96],
				[0, 70],
			]),
			"FF8C1D30",
			0,
		),
		line(
			"Valance trim",
			[
				[0, 70],
				[128, 96],
				[256, 70],
				[384, 96],
				[512, 70],
				[640, 96],
				[768, 70],
				[896, 96],
				[1024, 70],
			],
			"FFF5C54E",
			5,
		),
	];
}

function auroraSky(): Art[] {
	const ribbon = (y: number, color: string, phase: number): Art =>
		group("Aurora ribbon", { x: 0, y }, [
			shape(
				"Ribbon",
				poly(
					[
						[-40, 0],
						[200, -60],
						[420, 10],
						[640, -70],
						[860, 0],
						[1064, -50],
						[1064, 90],
						[860, 140],
						[
							640,
							60,
						],
						[420, 150],
						[200, 80],
						[-40, 140],
					],
					true,
					80,
				),
				{
					kind: "linear",
					from: [0, -60],
					to: [0, 150],
					stops: [[0, "00FFFFFF"], [.35, color], [1, "00FFFFFF"]],
				},
				0,
			),
		], { motion: use(aurora, phase) });

	return [
		fill(
			"Night",
			vertical([[0, "FF071429"], [.6, "FF12304F"], [1, "FF1B4466"]]),
		),
		shape(
			"Stars",
			scatter("aurora-stars", 60, { top: 0, bottom: 600 }, [1.5, 3.5]),
			"CCFFFFFF",
			0,
		),
		ribbon(120, "A67CFFB0", 0),
		ribbon(230, "8C5CE0FF", .35),
		ribbon(330, "66C39BFF", .7),
		shape(
			"Snow hills",
			poly(
				[[0, 1024], [0, 790], [220, 760], [470, 800], [720, 750], [1024, 790], [
					1024,
					1024,
				]],
				true,
				90,
			),
			"FFE6EEF6",
			3,
			"66A9BCD9",
		),
	];
}

function treasureHoard(): Art[] {
	const random = randomFrom(seedFrom("hoard"));
	const coins = Array.from({ length: 70 }, (): Art => {
		const x = between(random, 20, 1004);
		const edge = x < 512 ? 700 - (512 - x) * .35 : 700 - (x - 512) * .3;
		const y = between(random, Math.max(edge, 560), 900);
		const tilt = between(random, .35, .8);

		return shape(
			"Coin",
			ellipse(x, y, 34, 34 * tilt),
			"FFF5C54E",
			2,
			"FFB07A24",
		);
	});

	return [
		fill("Cave", vertical([[0, "FF2A1A10"], [1, "FF5A3418"]])),
		shape(
			"Glow",
			ellipse(512, 640, 1100, 700),
			radial([512, 640], 550, [[0, "80FFD27A"], [1, "00FFD27A"]]),
			0,
		),
		shape("Left heap", ellipse(170, 900, 620, 460), "FFE0A93A", 3, "FFB07A24"),
		shape("Right heap", ellipse(860, 910, 620, 420), "FFE0A93A", 3, "FFB07A24"),
		shape(
			"Front heap",
			ellipse(512, 1010, 1200, 300),
			"FFF2C14E",
			3,
			"FFB07A24",
		),
		...coins,
		...[[120, 700, "FFD9534A"], [900, 720, "FF4C7FD1"], [300, 860, "FF2E9E6B"]]
			.map(([x, y, color]) =>
				shape(
					"Gem",
					poly(
						[[Number(x), Number(y) - 16], [Number(x) + 13, Number(y)], [
							Number(x),
							Number(y) + 16,
						], [
							Number(x) - 13,
							Number(y),
						]],
						true,
						2,
					),
					String(color),
					3,
				)
			),
		...[[200, 640], [760, 660], [420, 900], [640, 880]].map((
			[x = 0, y = 0],
			i,
		) =>
			group("Hoard glint", { x, y }, [
				shape("Glint", star(0, 0, 26, 26, 4, .28), "FFFFFFFF", 0),
			], {
				motion: use(starTwinkle, i / 4),
			})
		),
	];
}

function biggerChest(): Art[] {
	const planks = Array.from(
		{ length: 9 },
		(_, i) => poly([[0, 150 + i * 100], [1024, 146 + i * 100]], false),
	);

	return [
		fill("Giant wood", vertical([[0, "FF1F6F68"], [1, "FF2F8F86"]])),
		shape("Plank seams", planks, undefined, 5, "66163A3A"),
		shape("Giant strap", rect(110, 560, 120, 1120), "FFD9A635", 6, INK),
		shape("Giant strap", rect(914, 560, 120, 1120), "FFD9A635", 6, INK),
		shape(
			"Rivets",
			[110, 914].flatMap((x) =>
				[260, 480, 700].map((y) => ellipse(x, y, 22, 22))
			),
			INK,
			0,
		),
		shape("Lid shadow", rect(512, 60, 1024, 120), "B3163A3A", 0),
		line("Lid edge", [[0, 120], [1024, 120]], INK, 6),
		group("Keyhole light", { x: 512, y: 60 }, [
			shape(
				"Beam",
				poly([[-26, 0], [26, 0], [220, 900], [-220, 900]]),
				vertical([[0, "66FFF1C2"], [.8, "00FFF1C2"]]),
				0,
			),
			shape(
				"Keyhole",
				poly(
					[[-14, -34], [14, -34], [8, 0], [16, 34], [-16, 34], [-8, 0]],
					true,
					8,
				),
				"FFFFF6DA",
				4,
				INK,
			),
		], { motion: use(lightPulse) }),
	];
}

const DRAWINGS: readonly (() => Art[])[] = [
	ivoryStudio,
	dusk,
	openSea,
	bankVault,
	meadow,
	starfield,
	attic,
	blueprint,
	sunburst,
	picnicBlanket,
	deepSea,
	velvetCurtain,
	auroraSky,
	treasureHoard,
	biggerChest,
];

export const BACKGROUND_ART_COUNT = DRAWINGS.length;

/** The backdrop for background `index`, in painter's order. */
export function backgroundArt(index: number): Art[] {
	const draw = DRAWINGS[index];

	if (!draw) {
		throw new RangeError(`No background art at ${index}`);
	}

	return draw();
}
