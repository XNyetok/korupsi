import { ATRIUM_LEDGES, ATRIUM_SPAWN, VERIFICATION } from './tower.ts';
import type { FloorDef } from './types.ts';

/** The separate dev preview stops at the first balcony and does not keep a score. */
export const ATRIUM: FloorDef = {
  id: 'kecamatan-atrium',
  name: 'Nomor Berikutnya',
  height: 492,
  ledges: ATRIUM_LEDGES,
  auditors: [],
  stamps: [],
  amplop: [],
  checkpoints: [ATRIUM_SPAWN],
  exit: VERIFICATION,
};
