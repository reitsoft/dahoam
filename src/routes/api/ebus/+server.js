import { json } from '@sveltejs/kit';
import { getEbusData, getEbusRaw } from '$lib/server/ebus';

export function GET({ url }) {
  return json(url.searchParams.has('raw') ? getEbusRaw() : getEbusData());
}