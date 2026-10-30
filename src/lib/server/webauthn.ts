// src/lib/server/webauthn.ts
import { env } from '$env/dynamic/private';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type { AuthenticatorTransportFuture, WebAuthnCredential } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export const rpID = env.WEBAUTHN_RP_ID;
export const origin = env.WEBAUTHN_ORIGIN;
export const rpName = 'Dahoam';

type Stored = {
    id: string;
    publicKey: string; // base64url
    counter: number;
    transports?: AuthenticatorTransportFuture[];
    name: string;
    created: number;
};

const FILE = env.WEBAUTHN_STORE ?? './data/passkeys.json';

export async function loadCredentials(): Promise<Stored[]> {
    try {
        return JSON.parse(await readFile(FILE, 'utf8'));
    } catch {
        return [];
    }
}

async function save(list: Stored[]) {
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(list, null, 2), { mode: 0o600 });
}

export async function addCredential(c: WebAuthnCredential, name: string) {
    const list = await loadCredentials();
    list.push({
        id: c.id,
        publicKey: isoBase64URL.fromBuffer(c.publicKey),
        counter: c.counter,
        transports: c.transports,
        name,
        created: Date.now()
    });
    await save(list);
}

export async function updateCounter(id: string, counter: number) {
    const list = await loadCredentials();
    const c = list.find((x) => x.id === id);
    if (c) {
        c.counter = counter;
        await save(list);
    }
}

export function toCredential(s: Stored): WebAuthnCredential {
    return {
        id: s.id,
        publicKey: isoBase64URL.toBuffer(s.publicKey),
        counter: s.counter,
        transports: s.transports
    };
}

// Einmal-Challenges, 60 s gültig (reicht bei einem Prozess unter pm2)
const challenges = new Map<string, number>();

export function rememberChallenge(c: string) {
    const now = Date.now();
    for (const [k, exp] of challenges) if (exp < now) challenges.delete(k);
    challenges.set(c, now + 60_000);
}

export function consumeChallenge(c: string): boolean {
    const exp = challenges.get(c);
    challenges.delete(c);
    return exp !== undefined && exp > Date.now();
}

export function checkSetupSecret(request: Request): boolean {
    const given = Buffer.from(request.headers.get('x-setup-secret') ?? '');
    const expected = Buffer.from(env.WEBAUTHN_SETUP_SECRET ?? '');
    return expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}