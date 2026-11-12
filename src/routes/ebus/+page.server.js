import { getEbusData } from '$lib/server/ebus.js';

export function load() {
  return { ebus: getEbusData() };
}