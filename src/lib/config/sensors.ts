// src/lib/config/sensors.ts
import type { MqttDeviceConfig } from './device';

export const SENSOR_LIST = [
  { id: 'keller', mqttId: 'keller', name: 'Keller', room: 'Keller' },
  { id: 'bad', mqttId: 'shellyhtg3-bad', name: 'Bad', room: 'Bad' }
] as const satisfies readonly MqttDeviceConfig[];

export type SensorId = (typeof SENSOR_LIST)[number]['id'];