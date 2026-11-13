// src/routes/energy/+page.server.ts
import {
	getAktuellerZaehlerstand,
	getVerbrauchMonat,
	getVerbrauchProMonatJahr
} from '$lib/server/stromzaehler.index';
import { getMonatsVerbrauch } from '$lib/server/smaHomeManager';

export const load = async () => {
	const [zaehlerstand, monat, verbrauchMonat, verbrauchJahr] = await Promise.all([
		getAktuellerZaehlerstand(),
		getMonatsVerbrauch(),
		getVerbrauchMonat(),
		getVerbrauchProMonatJahr()
	]);

	return {
		zaehlerstand,
		verbrauchProTag: monat.tage.map(({ tag, netzbezug, pv }) => ({ tag, netzbezug, pv })),
		verbrauchVormonat: monat.vormonatNetzbezug,
		verbrauchMonat,
		verbrauchJahr
	};
};