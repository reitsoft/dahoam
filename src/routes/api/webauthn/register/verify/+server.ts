// src/routes/api/webauthn/register/verify/+server.ts
import { json, error } from '@sveltejs/kit';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { rpID, origin, addCredential, consumeChallenge, checkSetupSecret } from '$lib/server/webauthn';

export const POST = async ({ request }) => {
    if (!checkSetupSecret(request)) throw error(403, 'Nicht erlaubt');
    const { response, name } = await request.json();

    try {
        const v = await verifyRegistrationResponse({
            response,
            expectedChallenge: consumeChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true
        });
        if (!v.verified) throw error(400, 'Nicht verifiziert');
        await addCredential(v.registrationInfo.credential, name ?? 'Gerät');
        return json({ success: true });
    } catch (e) {
        console.error('Passkey-Registrierung fehlgeschlagen:', e);
        throw error(400, 'Registrierung fehlgeschlagen');
    }
};