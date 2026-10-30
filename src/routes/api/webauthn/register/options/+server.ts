// src/routes/api/webauthn/register/options/+server.ts
import { json, error } from '@sveltejs/kit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { rpID, rpName, loadCredentials, rememberChallenge, checkSetupSecret } from '$lib/server/webauthn';

export const POST = async ({ request }) => {
    if (!checkSetupSecret(request)) throw error(403, 'Nicht erlaubt');

    const existing = await loadCredentials();
    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: 'haus',
        userID: new TextEncoder().encode('haus-owner'),
        attestationType: 'none',
        excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
        }
    });
    rememberChallenge(options.challenge);
    return json(options);
};