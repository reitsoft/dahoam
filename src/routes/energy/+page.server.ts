import { getAktuellerZaehlerstand, getVerbrauchProTagMonat, getVerbrauchVormonat  } from '$lib/server/stromzaehler';

export const load = async () => {
	const [zaehlerstand, verbrauchProTag, verbrauchVormonat] = await Promise.all([
		getAktuellerZaehlerstand(),
		getVerbrauchProTagMonat(),
		getVerbrauchVormonat()
	]);
	console.log({zaehlerstand, verbrauchProTag, verbrauchVormonat });

	return {zaehlerstand, verbrauchProTag, verbrauchVormonat };
};