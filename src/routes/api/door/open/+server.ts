// src/routes/api/door/open/+server.ts
import { json, error } from '@sveltejs/kit';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import {
	rpID, origin, loadCredentials, toCredential, updateCounter, consumeChallenge
} from '$lib/server/webauthn';
import { triggerDoorOpener } from '$lib/server/mqtt';

export const POST = async ({ request }) => {
	const assertion = await request.json().catch(() => null);
	if (!assertion?.id) throw error(400, 'Ungültige Anfrage');

	const stored = (await loadCredentials()).find((c) => c.id === assertion.id);
	if (!stored) throw error(401, 'Unbekannter Passkey');

	try {
		const v = await verifyAuthenticationResponse({
			response: assertion,
			expectedChallenge: consumeChallenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: toCredential(stored),
			requireUserVerification: true
		});
		if (!v.verified) throw new Error('nicht verifiziert');
		await updateCounter(stored.id, v.authenticationInfo.newCounter);
	} catch (e) {
		console.warn('Türöffnung abgelehnt:', e);
		throw error(401, 'Verifikation fehlgeschlagen');
	}

	try {
		await triggerDoorOpener();
	} catch (e) {
		console.error('❌ Türöffner nicht ausgelöst:', e);
		throw error(502, 'Türöffner nicht erreichbar');
	}

	console.log(`🚪 Tür geöffnet (${stored.name})`);
	return json({ success: true });
};