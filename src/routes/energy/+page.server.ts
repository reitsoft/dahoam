import { getAktuellerZaehlerstand } from '$lib/server/stromzaehler';

export const load = async () => {
	const zaehlerstand = await getAktuellerZaehlerstand();

	return {
		zaehlerstand: zaehlerstand ?? 0
	};
};