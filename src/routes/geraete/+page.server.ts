import { geschirrspuelerState } from '$lib/server/homeconnect';

export async function load() {
  return { /* ... */ geschirrspueler: { ...geschirrspuelerState } };
};
