import { getZaehlerDaten } from '$lib/server/stromzaehler';
import { getMonatsVerbrauch, getNetzbezugProMonatJahr } from '$lib/server/smaHomeManager';

export const load = async () => {
	const [zaehler, monat, verbrauchJahr] = await Promise.all([
		getZaehlerDaten(),
		getMonatsVerbrauch(),
		getNetzbezugProMonatJahr()
	]);
	return {
		zaehler,
		verbrauchProTag: monat.tage.map(({ tag, netzbezug, pv }) => ({ tag, netzbezug, pv })),
		verbrauchVormonat: monat.vormonatNetzbezug,
		verbrauchJahr
	};
};
