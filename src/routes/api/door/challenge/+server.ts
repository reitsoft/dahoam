// src/routes/api/door/challenge/+server.ts
import { json, error } from '@sveltejs/kit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { rpID, loadCredentials, rememberChallenge } from '$lib/server/webauthn';

export const POST = async () => {
    const creds = await loadCredentials();
    if (creds.length === 0) throw error(409, 'Kein Passkey registriert');

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports })),
        userVerification: 'preferred'   // vorher: 'required'
    });
    rememberChallenge(options.challenge);
    return json(options);
};