/**
 * The title a climb earns. The result is a decree (surat keputusan) that
 * appoints the player to something, and what it appoints them to depends on
 * how they climbed: how fast, how often caught, how much they carried.
 *
 * The rules are tried in order and the first that fits wins, so the rarer
 * and harder titles come first.
 */

export interface Climb {
  /** Seconds on the clock at the door. */
  time: number;
  deaths: number;
  /** Envelopes carried out, and how many the floor has. */
  weight: number;
  total: number;
}

export interface Gelar {
  id: string;
  title: string;
  /** One dry sentence about how it went. */
  line: string;
}

/** Under this many seconds a climb counts as quick. */
export const QUICK = 45;
/** From this many seconds a climb counts as slow. */
export const SLOW = 180;

const RULES: { id: string; title: string; fits(c: Climb): boolean; line(c: Climb): string }[] = [
  {
    id: 'raja',
    title: 'Raja Amplop',
    fits: (c) => c.weight === c.total && c.deaths === 0,
    line: () => 'Semua amplop terbawa, tak sekali pun tertangkap.',
  },
  {
    id: 'belut',
    title: 'Belut Birokrasi',
    fits: (c) => c.deaths === 0 && c.time < QUICK,
    line: () => 'Licin. Tak tersentuh dan tak terkejar.',
  },
  {
    id: 'teladan',
    title: 'Pegawai Teladan',
    fits: (c) => c.weight === 0 && c.deaths === 0,
    line: () => 'Bersih tanpa amplop. Tidak ada yang percaya.',
  },
  {
    id: 'langganan',
    title: 'Langganan OTT',
    fits: (c) => c.deaths >= 10,
    line: (c) => `${c.deaths} kali OTT, dan tetap naik jabatan.`,
  },
  {
    id: 'kolektor',
    title: 'Kolektor Amplop',
    fits: (c) => c.weight === c.total,
    line: (c) => `Semua amplop terbawa. Ongkosnya ${c.deaths} kali OTT.`,
  },
  {
    id: 'kosong',
    title: 'Tangan Kosong',
    fits: (c) => c.weight === 0,
    line: (c) => `${c.deaths} kali OTT tanpa membawa apa-apa. Rugi.`,
  },
  {
    id: 'emas',
    title: 'Anak Emas',
    fits: (c) => c.deaths === 0,
    line: () => 'Tak sekali pun tertangkap. Rapi.',
  },
  {
    id: 'lembur',
    title: 'Pegawai Lembur',
    fits: (c) => c.time >= SLOW,
    line: () => 'Pelan, tapi sampai juga. Lemburnya tidak dibayar.',
  },
  {
    id: 'kebal',
    title: 'Kebal Hukum',
    fits: (c) => c.deaths >= 5,
    line: (c) => `${c.deaths} kali OTT dan masih di sini.`,
  },
];

/** Every title there is, in the order the rules are tried; the last is what is left. */
export const TITLES: readonly string[] = [...RULES.map((rule) => rule.title), 'Oknum'];

export function gelarFor(climb: Climb): Gelar {
  for (const rule of RULES) {
    if (rule.fits(climb)) return { id: rule.id, title: rule.title, line: rule.line(climb) };
  }
  return {
    id: 'oknum',
    title: 'Oknum',
    line: `${climb.weight} amplop, ${climb.deaths} kali OTT. Namanya juga oknum.`,
  };
}

/**
 * Caught this often and the portrait on the decree is taken in the orange
 * vest, against a height chart.
 */
export const VEST_FROM = 5;
