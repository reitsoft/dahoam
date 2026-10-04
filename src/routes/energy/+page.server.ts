// src/routes/+page.server.ts
import { 
    getAktuellerZaehlerstand, 
    getVerbrauchMonat, 
    getVerbrauchProTagMonat, 
    getVerbrauchVormonat,
    getVerbrauchProMonatJahr 
} from '$lib/server/stromzaehler.index';

export const load = async () => {
    const [zaehlerstand, verbrauchProTag, verbrauchVormonat, verbrauchMonat, verbrauchJahr] = await Promise.all([
        getAktuellerZaehlerstand(),
        getVerbrauchProTagMonat(),
        getVerbrauchVormonat(),
        getVerbrauchMonat(),
        getVerbrauchProMonatJahr() // Liefert ein Array von 12 Zahlen/null zurück
    ]);

    return { zaehlerstand, verbrauchProTag, verbrauchVormonat, verbrauchMonat, verbrauchJahr };
};