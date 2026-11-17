import type { PageServerLoad } from './$types';
import { geschirrspuelerState } from '$lib/server/homeconnect';

export const load: PageServerLoad = () => ({
	geschirrspueler: { ...geschirrspuelerState }
});
