// routes/+page.server.ts
import { env } from '$env/dynamic/private';
import { getVerbrauchHeute, getVerbrauchMonat } from '$lib/server/stromzaehler';

const formatEuro = (n: number) => n.toFixed(2).replace('.', ',');

export const load = async () => {
	const preisProKwh = Number(env.PREIS_PRO_KWH);
	
	const [kwhHeute, kwhMonat] = await Promise.all([
		getVerbrauchHeute(),
		getVerbrauchMonat()
	]);

	return {
		strom: {
			kwhHeute: Math.round(kwhHeute ?? 0),
			kostenHeute: formatEuro((kwhHeute ?? 0) * preisProKwh),
			kwhMonat: Math.round(kwhMonat ?? 0),
			kostenMonat: formatEuro((kwhMonat ?? 0) * preisProKwh)
		}
	};
};