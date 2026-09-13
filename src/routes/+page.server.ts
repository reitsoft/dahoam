// routes/+page.server.ts
import { env } from '$env/dynamic/private';
import { getVerbrauchHeute, getVerbrauchMonat } from '$lib/server/stromzaehler';

const formatEuro = (n: number) => {
    if (isNaN(n) || n === null || n === undefined) return '0,00';
    return n.toFixed(2).replace('.', ',');
};

export const load = async () => {
    // Fallback auf 0.30 €/kWh, falls die Umgebungsvariable nicht gesetzt oder ungültig ist
    const rawPreis = env.PREIS_PRO_KWH ? parseFloat(env.PREIS_PRO_KWH.replace(',', '.')) : 0.30;
    const preisProKwh = isNaN(rawPreis) ? 0.30 : rawPreis;

    const [kwhHeute, kwhMonat] = await Promise.all([
        getVerbrauchHeute(),
        getVerbrauchMonat()
    ]);

    const heuteVal = kwhHeute ?? 0;
    const monatVal = kwhMonat ?? 0;

    return {
        strom: {
            kwhHeute: Math.round(heuteVal),
            kostenHeute: formatEuro(heuteVal * preisProKwh),
            kwhMonat: Math.round(monatVal),
            kostenMonat: formatEuro(monatVal * preisProKwh)
        }
    };
};