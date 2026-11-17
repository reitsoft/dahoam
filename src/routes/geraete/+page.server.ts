import { geschirrspuelerState } from '$lib/server/homeconnect';
import { waescheStates } from '$lib/server/waesche';

export const load = () => ({
	geschirrspueler: { ...geschirrspuelerState },
	waesche: Object.fromEntries(waescheStates)
});
