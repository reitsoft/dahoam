import { json } from '@sveltejs/kit';
import { geschirrspuelerState } from '$lib/server/homeconnect';

export const GET = () => json(geschirrspuelerState, { headers: { 'Cache-Control': 'no-store' } });
