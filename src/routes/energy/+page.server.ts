// src/routes/+page.server.ts
import { 
    getAktuellerZaehlerstand, 
    getVerbrauchMonat, 
    getVerbrauchProTagMonat, 
    getVerbrauchVormonat,
    getVerbrauchProMonatJahr 
} from '$lib/server/stromzaehler.index';

export const load = async () => {
    const [zaehlerstand, verbrauchProTagRoh, verbrauchVormonat, verbrauchMonat, verbrauchJahr] = await Promise.all([
        getAktuellerZaehlerstand(),
        getVerbrauchProTagMonat(),
        getVerbrauchVormonat(),
        getVerbrauchMonat(),
        getVerbrauchProMonatJahr()
    ]);

    const verbrauchProTag = verbrauchProTagRoh.map(({ tag, value }) => ({
        tag,
        netzbezug: value,
        pv: null as number | null
    }));

    return { zaehlerstand, verbrauchProTag, verbrauchVormonat, verbrauchMonat, verbrauchJahr };
};