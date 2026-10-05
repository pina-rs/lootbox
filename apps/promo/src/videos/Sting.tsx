/** Four seconds of logo: the sting that opens and closes everything. */
import { Paper } from "../kit/Paper.tsx";
import { Music } from "../kit/Sound.tsx";
import { type LogoLayout, LogoReveal } from "../scenes/LogoReveal.tsx";

export const STING_FRAMES = 150;

export function Sting({ layout }: Readonly<{ layout: LogoLayout }>) {
	return (
		<Paper>
			<LogoReveal layout={layout} />
			<Music
				track="logo-sting"
				durationInFrames={STING_FRAMES}
				fadeOut={10}
				volume={0.9}
			/>
		</Paper>
	);
}
