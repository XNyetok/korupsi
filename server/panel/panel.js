/**
 * The panel reads /api/stats and lays it out to be understood at a glance:
 * the headline numbers, the days as one chart, then how runs ended, split
 * into the ones that reached the door and the ones that were left.
 *
 * Everything from the API is put on the page with textContent, never as HTML.
 * No inline styles in the markup either: the collector's content security
 * policy forbids them. Sizes are set through the style object, which it allows.
 */

const SVG = 'http://www.w3.org/2000/svg';

const number = (n) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const decimal = (n) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const rupiah = (n) => 'Rp ' + number(n);
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) + '%' : '—');

/** 96 -> "1:36". */
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;

const shortDay = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const longDay = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

const timeLabel = (ms) =>
  new Date(ms).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

const byId = (id) => document.getElementById(id);

/** The three lines of the daily chart: fixed order, fixed colour, whatever the data. */
const SERIES = [
  { key: 'visits', name: 'Kunjungan' },
  { key: 'runs', css: 'starts', name: 'Mulai main' },
  { key: 'finished', name: 'Tamat' },
];

/** What the collector's short names mean, in the words the game uses. */
const HAZARD_NAMES = { auditor: 'Auditor', stempel: 'Stempel' };
const SECTION_NAMES = ['Lobi, sebelum mesin absen pertama', 'Setelah mesin absen pertama', 'Setelah mesin absen kedua'];
const DEVICE_NAMES = { touch: 'Layar sentuh', keys: 'Keyboard' };
const LAYOUT_NAMES = {
  window: 'Dalam kotak (komputer)',
  'fill-tall': 'Layar penuh, HP tegak',
  'fill-wide': 'Layar penuh, HP miring',
};
const SHARE_NAMES = {
  shared: 'Menu berbagi HP',
  saved: 'Gambar diunduh',
  show: 'Gambar ditampilkan untuk ditekan lama',
  copied: 'Teks disalin',
};
const TITLE_NAMES = {
  raja: 'Raja Amplop',
  belut: 'Belut Birokrasi',
  teladan: 'Pegawai Teladan',
  langganan: 'Langganan OTT',
  kolektor: 'Kolektor Amplop',
  kosong: 'Tangan Kosong',
  emas: 'Anak Emas',
  lembur: 'Pegawai Lembur',
  kebal: 'Kebal Hukum',
  oknum: 'Oknum',
};

/** Rows recorded before the game sent these details have none; say so rather than show nothing. */
const NOT_YET = 'Belum ada data. Rincian ini baru dicatat sejak v0.7.0.';
const PLAY_NOT_YET = 'Belum ada data. Rincian cara bermain dicatat mulai versi setelah v0.7.1.';

/** A sum of seconds: minutes and seconds under an hour, hours above. */
const span = (seconds) => (seconds < 3600 ? clock(seconds) : `${decimal(seconds / 3600)} jam`);

/** How runs of the first version of the game ended. Shown as one row, so they do not crowd the rest. */
const LEGACY = new Set(['auditor', 'band', 'fall']);

let days = 30;
let lastStats = null;

// ---------- data ----------

/** The API only lists days that had events. A chart needs every day, zeros included. */
function everyDay(stats) {
  const known = new Map(stats.daily.map((row) => [row.day, row]));
  const out = [];
  const end = new Date();
  for (let i = stats.days - 1; i >= 0; i--) {
    const date = new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const row = known.get(date);
    out.push({
      day: date,
      visits: row?.visits ?? 0,
      runs: row?.runs ?? 0,
      finished: row?.finished ?? 0,
      shared: row?.shared ?? 0,
      errors: row?.errors ?? 0,
    });
  }
  return out;
}

const count = (stats, cause) => stats.causes.find((row) => row.cause === cause)?.n ?? 0;

// ---------- headline tiles ----------

function tile({ label, value, what, share, ratio }) {
  const box = el('dl', 'tile');
  box.append(el('dt', null, label), el('dd', null, value));
  if (what) box.append(el('p', 'what', what));
  if (share) box.append(el('p', 'share', share));
  if (ratio != null) {
    const meter = el('div', 'meter');
    const fill = el('i');
    fill.style.width = Math.max(0, Math.min(100, ratio * 100)) + '%';
    meter.append(fill);
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', share ?? '');
    box.append(meter);
  }
  return box;
}

function renderTiles(stats) {
  const { visits, runs, shared } = stats.totals;
  const finished = stats.finished.n;

  byId('tiles').replaceChildren(
    tile({ label: 'Kunjungan', value: number(visits), what: 'Berapa kali halaman game dibuka.' }),
    tile({
      label: 'Mulai main',
      value: number(runs),
      what: 'Berapa kali tombol Mulai atau Main lagi ditekan.',
      share: visits ? `${decimal(runs / visits)} permainan per kunjungan` : 'Belum ada kunjungan',
    }),
    tile({
      label: 'Tamat',
      value: number(finished),
      what: 'Permainan yang sampai ke pintu kecamatan.',
      share: runs ? `${percent(finished, runs)} dari permainan yang dimulai` : 'Belum ada permainan',
      ratio: runs ? finished / runs : 0,
    }),
    tile({
      label: 'Dibagikan',
      value: number(shared),
      what: 'Berapa kali tombol Bagikan hasil dipakai.',
      share: finished ? `${percent(shared, finished)} dari yang tamat` : 'Belum ada yang tamat',
      ratio: finished ? shared / finished : 0,
    }),
  );
}

// ---------- bars ----------

/**
 * One row per part: a name, a bar from a shared baseline, and the figure at
 * its tip. Each row is a share of all the rows together, or of `of` when the
 * rows are steps out of one whole (how many of the runs got this far). A row
 * with a `label` shows that instead of a count and a share.
 */
function bars(target, rows, emptyText, of) {
  const total = of ?? rows.reduce((sum, row) => sum + row.n, 0);
  if (!total || !rows.length) {
    target.replaceChildren(el('p', 'empty', emptyText));
    return;
  }
  const longest = of ?? Math.max(...rows.map((row) => row.n));

  target.replaceChildren(
    ...rows.map((row) => {
      const wrap = el('div', 'bar');
      const name = el('div', 'name', row.name);
      if (row.note) name.append(el('small', null, row.note));

      const run = el('div', 'run');
      const fill = el('div', 'fill');
      // The longest bar takes 78% of the track, leaving room for its figure.
      fill.style.width = (longest ? (row.n / longest) * 78 : 0) + '%';
      const value = el('span', 'value', row.label ?? number(row.n) + ' ');
      if (row.label == null) value.append(el('small', null, percent(row.n, total)));
      run.append(fill, value);

      wrap.append(name, run);
      wrap.title =
        row.label == null
          ? `${row.name}: ${number(row.n)} dari ${number(total)} (${percent(row.n, total)})`
          : `${row.name}: ${row.label}`;
      return wrap;
    }),
  );
}

function renderEnds(stats) {
  const legacy = stats.causes.filter((row) => LEGACY.has(row.cause)).reduce((sum, row) => sum + row.n, 0);
  const rows = [
    { name: 'Tamat', note: 'sampai pintu kecamatan', n: count(stats, 'finished') },
    { name: 'Ditinggal', note: 'ditutup atau diulang sebelum tamat', n: count(stats, 'abandoned') },
  ];
  if (legacy) rows.push({ name: 'Versi lama', note: 'game satu tombol, sebelum v0.5.0', n: legacy });
  bars(byId('ends'), rows, 'Belum ada permainan yang berakhir pada rentang ini.');
}

function renderQuit(stats) {
  const rows = stats.quit.map((band) => ({
    name: band.to == null ? `${band.from} m ke atas` : `${band.from}–${band.to} m`,
    n: band.n,
  }));
  bars(byId('quit'), rows, 'Belum ada permainan yang ditinggal pada rentang ini.');
}

function renderRevs(stats) {
  bars(
    byId('revs'),
    stats.revs.map((row) => ({ name: row.rev ?? 'tanpa versi', n: row.n })),
    'Belum ada data versi.',
  );
}

function renderSections(stats) {
  bars(
    byId('sections'),
    stats.sections.map((row) => ({
      name: SECTION_NAMES[row.checkpoint] ?? `Setelah mesin absen ke-${row.checkpoint}`,
      n: row.n,
    })),
    NOT_YET,
  );
}

const hazardName = (row) =>
  row.kind === 'jatuh' ? 'Jatuh di bawah garis audit' : `${HAZARD_NAMES[row.kind] ?? row.kind} di pijakan ${row.ledge}`;

function renderHazards(stats) {
  bars(
    byId('hazards'),
    stats.hazards.map((row) => ({ name: hazardName(row), note: `di ${number(row.runs)} permainan`, n: row.catches })),
    NOT_YET,
  );
}

/** Fills a table's body with one row per list of cell texts, or one row saying why it is empty. */
function fillTable(id, rows, emptyText) {
  const body = document.querySelector(`#${id} tbody`);
  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', null, emptyText);
    td.colSpan = document.querySelectorAll(`#${id} thead th`).length;
    tr.append(td);
    body.replaceChildren(tr);
    return;
  }
  body.replaceChildren(
    ...rows.map((cells) => {
      const tr = el('tr');
      tr.append(...cells.map((text) => el('td', null, text)));
      return tr;
    }),
  );
}

function renderDevices(stats) {
  fillTable(
    'devices',
    stats.devices.map((row) => [
      DEVICE_NAMES[row.device] ?? row.device,
      number(row.visits),
      number(row.runs),
      number(row.finished),
      percent(row.finished, row.runs),
    ]),
    NOT_YET,
  );
  bars(
    byId('layouts'),
    stats.layouts.map((row) => ({ name: LAYOUT_NAMES[row.layout] ?? row.layout, n: row.visits })),
    NOT_YET,
  );
}

function renderTitles(stats) {
  bars(
    byId('titles'),
    stats.titles.map((row) => ({ name: TITLE_NAMES[row.title] ?? row.title, n: row.n })),
    NOT_YET,
  );
}

function renderShares(stats) {
  bars(
    byId('shares'),
    stats.shares.map((row) => ({ name: SHARE_NAMES[row.via] ?? row.via, n: row.n })),
    NOT_YET,
  );
  const { runs, muted } = stats.sound;
  byId('sound').textContent = runs
    ? `${percent(muted, runs)} permainan berakhir dengan suara dimatikan (${number(muted)} dari ${number(runs)}).`
    : NOT_YET;
}

// ---------- medians ----------

const MEDIAN = 'Angka di bawah adalah nilai tengah: separuh permainan di bawahnya, separuh di atasnya.';

function renderFinished(stats) {
  const f = stats.finished;
  byId('finished-hint').textContent = f.n
    ? `Dari ${number(f.n)} permainan yang sampai ke pintu. ${MEDIAN}`
    : 'Belum ada permainan yang tamat pada rentang ini.';
  byId('finished').replaceChildren(
    tile({ label: 'Waktu tamat', value: f.duration != null ? clock(f.duration) : '—', what: 'menit:detik' }),
    tile({ label: 'Uang dibawa', value: f.money != null ? rupiah(f.money) : '—' }),
    tile({ label: 'Amplop dibawa', value: f.weight != null ? number(f.weight) : '—', what: 'dari 6 di lantai ini' }),
    tile({ label: 'Kena OTT', value: f.deaths != null ? number(f.deaths) : '—', what: 'kali, sebelum tamat' }),
  );
}

function renderAbandoned(stats) {
  const a = stats.abandoned;
  byId('abandoned-hint').textContent = a.n
    ? `Dari ${number(a.n)} permainan yang ditutup atau diulang sebelum tamat. ${MEDIAN}`
    : 'Belum ada permainan yang ditinggal pada rentang ini.';
  byId('abandoned').replaceChildren(
    tile({
      label: 'Bertahan selama',
      value: a.duration != null ? clock(a.duration) : '—',
      what: 'menit:detik sebelum pergi',
    }),
    tile({
      label: 'Sampai setinggi',
      value: a.height != null ? `${number(a.height)} m` : '—',
      what: 'titik tertinggi yang dicapai',
    }),
    tile({ label: 'Kena OTT', value: a.deaths != null ? number(a.deaths) : '—', what: 'kali, sebelum pergi' }),
  );
}

// ---------- how runs are played ----------

const stopName = (to) => (to === 'door' ? 'pintu kecamatan' : `mesin absen ${to}`);

function renderRoute(stats) {
  const { runs, stretches } = stats.route;
  const what =
    'berapa yang sampai ke tiap mesin absen dan ke pintu, dan berapa lama tiap bagian ditempuh oleh yang melewatinya (nilai tengah, menit:detik).';
  byId('route-hint').textContent = runs ? `Dari ${number(runs)} permainan: ${what}` : `Dari semua permainan: ${what}`;
  bars(
    byId('route'),
    stretches.map((stretch, i) => {
      const from = i === 0 ? 'lobi' : stopName(stretches[i - 1].to);
      const took = stretch.seconds != null ? `: ${clock(stretch.seconds)}` : '';
      return {
        name: `Sampai ${stopName(stretch.to)}`,
        note: `${from} → ${stopName(stretch.to)}${took}`,
        n: stretch.reached,
      };
    }),
    PLAY_NOT_YET,
    runs,
  );
}

function renderLastCatch(stats) {
  const { left, uncaught, soon, hazards } = stats.lastCatch;
  byId('last-hint').textContent = left
    ? `Dari ${number(left)} permainan yang ditinggal: rintangan yang terakhir menangkap pemainnya sebelum ia pergi. ${number(uncaught)} pergi tanpa pernah tertangkap.`
    : '';
  bars(
    byId('last'),
    hazards.map((row) => ({
      name: hazardName(row),
      note: `${number(row.soon)} pergi kurang dari ${soon} detik sesudahnya`,
      n: row.runs,
    })),
    left ? 'Tidak ada yang tertangkap sebelum pergi.' : PLAY_NOT_YET,
    left || undefined,
  );
}

function renderEnvelopes(stats) {
  const { runs, finished, lost, lostRuns, list } = stats.envelopes;
  fillTable(
    'envelopes',
    list.map((row) => [
      `Amplop ${row.envelope + 1}`,
      `${number(row.picked)} (${percent(row.picked, runs)})`,
      `${number(row.kept)} (${percent(row.kept, finished)})`,
    ]),
    PLAY_NOT_YET,
  );
  byId('lost').textContent = runs
    ? `${number(lost)} amplop lepas lagi karena kena OTT, di ${number(lostRuns)} dari ${number(runs)} permainan.`
    : '';
  fillTable(
    'carrying',
    stats.carrying.map((row) => [
      number(row.envelopes),
      span(row.seconds),
      number(row.catches),
      row.seconds ? decimal(row.catches / (row.seconds / 60)) : '—',
    ]),
    PLAY_NOT_YET,
  );
}

function renderMoves(stats) {
  const { moves, breaks } = stats;
  byId('moves-hint').textContent = moves.runs
    ? `Dari ${number(moves.runs)} permainan. Lompat dan ngeles adalah nilai tengah per permainan.`
    : PLAY_NOT_YET;
  byId('moves').replaceChildren(
    tile({ label: 'Lompat', value: moves.jumps != null ? number(moves.jumps) : '—', what: 'kali per permainan' }),
    tile({ label: 'Ngeles', value: moves.dashes != null ? number(moves.dashes) : '—', what: 'kali per permainan' }),
    tile({ label: 'Pernah ngeles', value: percent(moves.dashed, moves.runs), what: 'permainan yang memakai ngeles' }),
    tile({ label: 'Pernah dijeda', value: percent(breaks.paused, breaks.runs), what: 'permainan yang dijeda pemain' }),
    tile({
      label: 'Ditinggal sebentar',
      value: percent(breaks.away, breaks.runs),
      what: 'pindah aplikasi di tengah main, lalu kembali',
    }),
  );
  const longest = [...stats.dwell].sort((a, b) => b.seconds - a.seconds || a.ledge - b.ledge).slice(0, 8);
  bars(
    byId('dwell'),
    longest.map((row) => ({
      name: row.ledge === 0 ? 'Lantai dasar' : `Pijakan ${row.ledge}`,
      note: `${number(row.runs)} permainan`,
      n: row.seconds,
      label: clock(row.seconds),
    })),
    PLAY_NOT_YET,
  );
}

function renderAttempts(stats) {
  const played = stats.attempts.some((row) => row.started || row.ended);
  fillTable(
    'attempts',
    played
      ? stats.attempts.map((row) => [
          row.to == null ? `Ke-${row.from} dan seterusnya` : `Ke-${row.from}`,
          number(row.started),
          number(row.ended),
          number(row.finished),
          percent(row.finished, row.ended),
        ])
      : [],
    PLAY_NOT_YET,
  );
  const { new: fresh, returning } = stats.returning;
  fillTable(
    'returning',
    fresh.runs || returning.runs
      ? [
          // A first finish is always a record, so for new players the column would only repeat Tamat.
          ['Baru', number(fresh.runs), number(fresh.finished), percent(fresh.finished, fresh.runs), '—'],
          [
            'Lama',
            number(returning.runs),
            number(returning.finished),
            percent(returning.finished, returning.runs),
            number(returning.records),
          ],
        ]
      : [],
    PLAY_NOT_YET,
  );
}

// ---------- the floor map ----------

/** What the map draws, keyed in its legend. */
const MAP_KEYS = [
  { css: 'catch', name: 'Tempat kena OTT' },
  { css: 'ledge', name: 'Pijakan' },
  { css: 'amplop', name: 'Amplop' },
  { css: 'beat', name: 'Jalur auditor' },
  { css: 'stamp', name: 'Stempel' },
  { css: 'machine', name: 'Mesin absen' },
  { css: 'door', name: 'Pintu' },
];

function renderMapLegend() {
  byId('map-legend').replaceChildren(
    ...MAP_KEYS.map(({ css, name }) => {
      const item = el('li');
      item.append(el('span', 'swatch ' + css), el('span', null, name));
      return item;
    }),
  );
}

function renderMap(stats) {
  const host = byId('map');
  const floor = stats.floor;
  if (!floor) {
    host.replaceChildren(el('p', 'empty', 'Denah lantai tidak tersedia.'));
    return;
  }
  const pad = 8;
  // The game measures height up from the ground floor; the page measures down from the top.
  const Y = (height) => floor.height - height;
  const ledgeY = (index) => floor.ledges[index]?.y ?? 0;
  const catches = stats.spots.reduce((sum, cell) => sum + cell.n, 0);

  const map = svg('svg', {
    class: 'floor',
    viewBox: `${-pad} ${-pad} ${floor.width + pad * 2} ${floor.height + pad * 2}`,
    role: 'img',
    'aria-label': `Denah lantai ${floor.name} dengan ${number(catches)} kejadian kena OTT. Daftar rintangan di atas memuat angka yang sama per rintangan.`,
  });

  floor.ledges.forEach((ledge, i) => {
    if (ledge.travel) {
      const y = Y(ledge.y) + 1.5;
      map.append(
        svg('line', {
          class: 'travel',
          x1: ledge.x - ledge.travel,
          x2: ledge.x + ledge.w + ledge.travel,
          y1: y,
          y2: y,
        }),
      );
    }
    map.append(
      svg('rect', { class: `ledge ${ledge.kind ?? 'solid'}`, x: ledge.x, y: Y(ledge.y), width: ledge.w, height: 3 }),
    );
    if (i === 0) return;
    // The number sits past the right end, or before the left end where the wall is close.
    const right = ledge.x + ledge.w + 14 <= floor.width;
    const label = svg('text', {
      class: 'label',
      x: right ? ledge.x + ledge.w + 3 : ledge.x - 3,
      y: Y(ledge.y) + 3,
      'text-anchor': right ? 'start' : 'end',
    });
    label.textContent = String(i);
    map.append(label);
  });

  for (const beat of floor.auditors) {
    const y = Y(ledgeY(beat.ledge)) - 12;
    map.append(svg('line', { class: 'beat', x1: beat.from, x2: beat.to, y1: y, y2: y }));
  }
  for (const stamp of floor.stamps) {
    map.append(svg('rect', { class: 'stamp', x: stamp.x - 7, y: Y(ledgeY(stamp.ledge)) - 30, width: 14, height: 8 }));
  }
  floor.checkpoints.forEach((spot, i) => {
    if (i === 0) return;
    map.append(svg('rect', { class: 'machine', x: spot.x - 3, y: Y(ledgeY(spot.ledge)) - 12, width: 6, height: 12 }));
  });
  map.append(
    svg('rect', { class: 'door', x: floor.exit.x - 6, y: Y(ledgeY(floor.exit.ledge)) - 20, width: 12, height: 20 }),
  );
  floor.amplop.forEach((spot, i) => {
    map.append(svg('circle', { class: 'amplop', cx: spot.x, cy: Y(spot.y), r: 3.5 }));
    const label = svg('text', { class: 'label', x: spot.x + 6, y: Y(spot.y) + 3 });
    label.textContent = String(i + 1);
    map.append(label);
  });

  // The busiest squares are drawn last, on top.
  const most = Math.max(1, ...stats.spots.map((cell) => cell.n));
  for (const cell of [...stats.spots].sort((a, b) => a.n - b.n)) {
    const share = cell.n / most;
    // A catch is recorded at the feet; the dot sits on the body.
    const dot = svg('circle', {
      class: 'catch',
      cx: cell.x,
      cy: Y(cell.y) - 10,
      r: 2.5 + 7.5 * Math.sqrt(share),
      'fill-opacity': (0.35 + 0.5 * share).toFixed(2),
    });
    const title = svg('title');
    title.textContent = `${number(cell.n)} kali kena OTT di sekitar sini`;
    dot.append(title);
    map.append(dot);
  }

  host.replaceChildren(map);
}

// ---------- errors ----------

const ICONS = {
  good: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.3 5.3-4 4a1 1 0 0 1-1.4 0l-1.8-1.8 1.4-1.4L6.6 8.2l3.3-3.3z',
  critical: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-1 3h2v5H7zm0 6h2v2H7z',
};

function state(kind, text) {
  const row = el('p', 'state ' + kind);
  const icon = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
  icon.append(svg('path', { d: ICONS[kind] }));
  row.append(icon, el('span', null, text));
  return row;
}

function renderErrors(stats) {
  const list = byId('errors');
  if (!stats.errors.length) {
    list.replaceChildren(state('good', 'Tidak ada error pada rentang ini.'));
    return;
  }
  list.replaceChildren(
    state('critical', `${number(stats.totals.errors)} error, ${number(stats.errors.length)} jenis.`),
    ...stats.errors.map((row) => {
      const item = el('li');
      item.append(
        el('span', 'msg', row.message),
        el('span', 'meta', `${number(row.n)} kali · terakhir ${timeLabel(row.last)} · versi ${row.rev ?? '—'}`),
      );
      return item;
    }),
  );
}

// ---------- the daily chart ----------

/** A round number at or above `value`, so the axis ends on a tick people can read. */
function niceCeil(value) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

const tip = byId('tip');

function hideTip() {
  tip.hidden = true;
}

function showTip(row, x, y) {
  const list = el('ul');
  for (const series of SERIES) {
    const item = el('li');
    // The number leads; the name follows. A stroke, not a box, keys the series.
    item.append(
      el('span', 'key ' + (series.css ?? series.key)),
      el('b', null, number(row[series.key])),
      el('span', null, series.name),
    );
    list.append(item);
  }
  tip.replaceChildren(el('p', 'when', longDay(row.day)), list);
  tip.hidden = false;
  const box = tip.getBoundingClientRect();
  const left = x + 14 + box.width > window.innerWidth ? x - 14 - box.width : x + 14;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, Math.min(window.innerHeight - box.height - 8, y - box.height / 2)) + 'px';
}

function renderChart(stats) {
  const host = byId('chart');
  const rows = everyDay(stats);
  const width = Math.max(320, Math.floor(host.clientWidth));
  const height = 250;
  // On a narrow screen the names at the line ends would take half the plot;
  // the legend above and the reading on touch carry them instead.
  const roomy = width >= 520;
  const pad = { top: 12, right: roomy ? 118 : 14, bottom: 26, left: 38 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const top = niceCeil(Math.max(...rows.flatMap((row) => SERIES.map((s) => row[s.key]))));
  const xAt = (i) => pad.left + (rows.length > 1 ? (i / (rows.length - 1)) * plotW : plotW / 2);
  const yAt = (v) => pad.top + plotH - (v / top) * plotH;

  const total = rows.reduce((sum, row) => sum + row.visits + row.runs + row.finished, 0);
  const plot = svg('svg', {
    class: 'plot',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    tabindex: 0,
    'aria-label': `Grafik harian ${stats.days} hari: kunjungan, permainan dimulai, dan tamat. Panah kiri dan kanan membaca tiap hari; tabel di bawah berisi angka yang sama.`,
  });

  // Hairline grid and round ticks; the baseline is one step darker.
  for (let i = 0; i <= 4; i++) {
    const value = (top / 4) * i;
    const y = yAt(value);
    plot.append(svg('line', { class: i === 0 ? 'base' : 'grid', x1: pad.left, x2: pad.left + plotW, y1: y, y2: y }));
    const label = svg('text', { x: pad.left - 8, y: y + 4, 'text-anchor': 'end' });
    label.textContent = number(value);
    plot.append(label);
  }

  // As many dates as fit without touching; always the first and the last.
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(plotW / 64))));
  rows.forEach((row, i) => {
    const last = i === rows.length - 1;
    if (i % every !== 0 && !last) return;
    if (!last && rows.length - 1 - i < every * 0.75) return;
    const label = svg('text', { x: xAt(i), y: height - 8, 'text-anchor': i === 0 ? 'start' : last ? 'end' : 'middle' });
    label.textContent = shortDay(row.day);
    plot.append(label);
  });

  if (!total) {
    const none = svg('text', { x: pad.left + plotW / 2, y: pad.top + plotH / 2, 'text-anchor': 'middle' });
    none.textContent = 'Belum ada data pada rentang ini.';
    plot.append(none);
    host.replaceChildren(plot);
    return;
  }

  for (const series of SERIES) {
    const d = rows.map((row, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(row[series.key]).toFixed(1)}`).join(' ');
    plot.append(svg('path', { class: 'line ' + (series.css ?? series.key), d }));
  }

  // Each line is named where it ends. Labels that would sit on top of each
  // other are spread apart and tied back to their line with a hairline.
  const lastRow = rows[rows.length - 1];
  const endX = xAt(rows.length - 1);
  const ends = SERIES.map((series) => ({ series, y: yAt(lastRow[series.key]), at: yAt(lastRow[series.key]) })).sort(
    (a, b) => a.at - b.at,
  );
  const gap = 15;
  for (let i = 1; i < ends.length; i++) ends[i].at = Math.max(ends[i].at, ends[i - 1].at + gap);
  const overflow = ends[ends.length - 1].at - (pad.top + plotH);
  if (overflow > 0) for (const end of ends) end.at -= overflow;

  for (const end of ends) {
    if (!roomy) {
      plot.append(svg('circle', { class: 'dot ' + (end.series.css ?? end.series.key), cx: endX, cy: end.y, r: 4 }));
      continue;
    }
    if (Math.abs(end.at - end.y) > 2) {
      plot.append(svg('line', { class: 'lead', x1: endX + 6, y1: end.y, x2: endX + 12, y2: end.at }));
    }
    plot.append(svg('circle', { class: 'dot ' + (end.series.css ?? end.series.key), cx: endX, cy: end.y, r: 4 }));
    const label = svg('text', { class: 'end', x: endX + 14, y: end.at + 4 });
    const figure = svg('tspan');
    figure.textContent = number(lastRow[end.series.key]);
    label.append(figure, document.createTextNode(' ' + end.series.name));
    plot.append(label);
  }

  // The reader aims at a day, never at a two-pixel line: the whole plot is
  // the target, and the crosshair snaps to the nearest day.
  const cross = svg('line', { class: 'cross', y1: pad.top, y2: pad.top + plotH, visibility: 'hidden' });
  const marks = SERIES.map((series) => {
    const dot = svg('circle', { class: 'dot ' + (series.css ?? series.key), r: 4, visibility: 'hidden' });
    return { series, dot };
  });
  plot.append(cross, ...marks.map((m) => m.dot));

  let current = -1;
  const select = (i) => {
    current = Math.max(0, Math.min(rows.length - 1, i));
    const x = xAt(current);
    cross.setAttribute('x1', x);
    cross.setAttribute('x2', x);
    cross.setAttribute('visibility', 'visible');
    for (const { series, dot } of marks) {
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', yAt(rows[current][series.key]));
      dot.setAttribute('visibility', 'visible');
    }
    const box = plot.getBoundingClientRect();
    showTip(rows[current], box.left + x, box.top + pad.top + plotH / 2);
  };
  const clear = () => {
    current = -1;
    cross.setAttribute('visibility', 'hidden');
    for (const { dot } of marks) dot.setAttribute('visibility', 'hidden');
    hideTip();
  };

  plot.addEventListener('pointermove', (event) => {
    const box = plot.getBoundingClientRect();
    const ratio = (event.clientX - box.left - pad.left) / plotW;
    select(Math.round(ratio * (rows.length - 1)));
  });
  plot.addEventListener('pointerleave', clear);
  // The same reading from the keyboard as from the pointer.
  plot.addEventListener('focus', () => select(rows.length - 1));
  plot.addEventListener('blur', clear);
  plot.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') select((current < 0 ? rows.length : current) - 1);
    else if (event.key === 'ArrowRight') select(current + 1);
    else if (event.key === 'Escape') clear();
    else return;
    event.preventDefault();
  });

  host.replaceChildren(plot);
}

function renderLegend() {
  byId('legend').replaceChildren(
    ...SERIES.map((series) => {
      const item = el('li');
      item.append(el('span', 'key ' + (series.css ?? series.key)), el('span', null, series.name));
      return item;
    }),
  );
}

/** The chart's twin: the same days as rows, for reading exact figures. */
function renderTable(stats) {
  const body = document.querySelector('#daily tbody');
  const rows = everyDay(stats).reverse();
  body.replaceChildren(
    ...rows.map((row) => {
      const tr = el('tr');
      tr.append(
        el('td', null, longDay(row.day)),
        el('td', null, number(row.visits)),
        el('td', null, number(row.runs)),
        el('td', null, number(row.finished)),
        el('td', null, number(row.shared)),
        el('td', null, number(row.errors)),
      );
      return tr;
    }),
  );
}

// ---------- loading ----------

function render(stats) {
  renderTiles(stats);
  renderChart(stats);
  renderTable(stats);
  renderEnds(stats);
  renderFinished(stats);
  renderAbandoned(stats);
  renderQuit(stats);
  renderSections(stats);
  renderHazards(stats);
  renderMap(stats);
  renderRoute(stats);
  renderLastCatch(stats);
  renderEnvelopes(stats);
  renderMoves(stats);
  renderAttempts(stats);
  renderDevices(stats);
  renderTitles(stats);
  renderShares(stats);
  renderErrors(stats);
  renderRevs(stats);
}

function renderPeriod(stats) {
  const first = new Date(stats.since + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  byId('period').textContent = `${first} – ${today} · diperbarui ${now}`;
}

async function load() {
  // The page keeps its last render, dimmed, while the new numbers arrive.
  document.body.dataset.loading = 'true';
  const failure = byId('failure');
  try {
    const response = await fetch(`/api/stats?days=${days}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    lastStats = await response.json();
    failure.hidden = true;
    renderPeriod(lastStats);
    render(lastStats);
  } catch (error) {
    failure.textContent = 'Gagal memuat data: ' + (error instanceof Error ? error.message : String(error));
    failure.hidden = false;
  } finally {
    document.body.dataset.loading = 'false';
  }
}

for (const button of document.querySelectorAll('[data-days]')) {
  button.addEventListener('click', () => {
    days = Number(button.dataset.days);
    for (const other of document.querySelectorAll('[data-days]')) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    void load();
  });
}

byId('refresh').addEventListener('click', () => void load());

// The same numbers as one file, with the collector's own notes on what each
// part means: for an agent, a script, or a spreadsheet.
byId('export').addEventListener('click', () => {
  if (!lastStats) return;
  const file = new Blob([JSON.stringify(lastStats, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = el('a');
  link.href = url;
  link.download = `korupsi-stats-${lastStats.days}d-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
});

// The chart is drawn to the width it has, so it is redrawn when that changes.
let resizing = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizing);
  resizing = window.setTimeout(() => {
    if (lastStats) renderChart(lastStats);
  }, 150);
});

renderLegend();
renderMapLegend();
void load();
