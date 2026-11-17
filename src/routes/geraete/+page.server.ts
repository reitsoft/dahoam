import { geschirrspuelerState } from '$lib/server/homeconnect';

export const load = async () => {
  return { geschirrspueler: { ...geschirrspuelerState } };
};
