import { json } from '@sveltejs/kit';
import { getHausKarte } from '$lib/server/ebus';

export const GET = () => json(getHausKarte());