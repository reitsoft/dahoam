import { getAktuellerZaehlerstand, getVerbrauchProTagMonat, getVerbrauchVormonat  } from '$lib/server/stromzaehler.index';

export const load = async () => {
	const [zaehlerstand, verbrauchProTag, verbrauchVormonat] = await Promise.all([
		getAktuellerZaehlerstand(),
		getVerbrauchProTagMonat(),
		getVerbrauchVormonat()
	]);

	return {zaehlerstand, verbrauchProTag, verbrauchVormonat };
};