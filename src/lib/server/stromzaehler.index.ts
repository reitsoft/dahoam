// $lib/server/stromzaehler.index.ts
import { env } from '$env/dynamic/private';
import * as real from './stromzaehler';
import * as mock from './stromzaehler.mock';

const impl = env.USE_MOCK_DATA === 'true' ? mock : real;

export const getVerbrauchProStunde = impl.getVerbrauchProStunde;
export const getAktuellerZaehlerstand = impl.getAktuellerZaehlerstand;
export const getVerbrauchHeute = impl.getVerbrauchHeute;
export const getVerbrauchProTagMonat = impl.getVerbrauchProTagMonat;
export const getVerbrauchVormonat = impl.getVerbrauchVormonat;
export const getVerbrauchMonat = impl.getVerbrauchMonat;
export const getVerbrauchLetzte7Tage = impl.getVerbrauchLetzte7Tage;
export const getAktuelleLeistung = impl.getAktuelleLeistung;