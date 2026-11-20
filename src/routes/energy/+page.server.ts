// src/routes/energy/+page.server.ts
import { getAktuellerZaehlerstand } from '$lib/server/stromzaehler';
import { getMonatsVerbrauch, getNetzbezugProMonatJahr } from '$lib/server/smaHomeManager';
export const load = async () => {
	const [zaehlerstand, monat, verbrauchJahr] = await Promise.all([
		getAktuellerZaehlerstand(),
		getMonatsVerbrauch(),
		getNetzbezugProMonatJahr()
	]);
	return {
		zaehlerstand,
		verbrauchProTag: monat.tage.map(({ tag, netzbezug, pv }) => ({ tag, netzbezug, pv })),
		verbrauchVormonat: monat.vormonatNetzbezug,
		verbrauchJahr
	};
};
