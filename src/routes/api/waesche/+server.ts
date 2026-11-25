// routes/api/waesche/+server.ts
import { json } from '@sveltejs/kit';
import { waescheStates } from '$lib/server/waesche';

export const GET = () =>
	json(Object.fromEntries(waescheStates), { headers: { 'Cache-Control': 'no-store' } });
