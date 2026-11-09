const rupiah = (n) =>
  'Rp ' + Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });

const short = (n) => {
  const value = Number(n) || 0;
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.0', '') + ' jt';
  if (value >= 1_000) return Math.round(value / 1_000) + ' rb';
  return String(value);
};

const dayLabel = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const timeLabel = (ms) => {
  const date = new Date(ms);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};

const totalsEl = document.getElementById('totals');
const dailyBody = document.querySelector('#daily tbody');
const causesEl = document.getElementById('causes');
const mediansEl = document.getElementById('medians');
const errorsEl = document.getElementById('errors');
const revsEl = document.getElementById('revs');

let days = 30;

function renderTotals(data) {
  const cards = [
    { label: 'Kunjungan', value: data.totals.visits },
    { label: 'Run selesai', value: data.totals.ended },
    { label: 'Run / kunjungan', value: data.totals.visits ? (data.totals.ended / data.totals.visits).toFixed(2) : '—' },
    { label: 'Dibagikan', value: data.totals.shared, tone: 'gold' },
    { label: 'Error', value: data.totals.errors, tone: 'red' },
  ];

  totalsEl.replaceChildren(
    ...cards.map((card) => {
      const box = el('dl', 'total' + (card.tone ? ' ' + card.tone : ''));
      box.append(el('dt', null, card.label), el('dd', null, card.value));
      return box;
    }),
  );
}

function renderDaily(data) {
  const rows = [...data.daily].reverse();
  dailyBody.replaceChildren(
    ...rows.map((row) => {
      const tr = el('tr');
      tr.append(
        el('td', null, dayLabel(row.day)),
        el('td', null, row.visits),
        el('td', null, row.ended),
        el('td', null, row.shared),
        el('td', null, row.errors),
      );
      return tr;
    }),
  );

  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', 'empty', 'Belum ada data pada rentang ini.');
    td.colSpan = 5;
    tr.append(td);
    dailyBody.replaceChildren(tr);
  }
}

function renderCauses(data) {
  const total = data.causes.reduce((sum, row) => sum + row.n, 0);
  if (!total) {
    causesEl.replaceChildren(el('p', 'empty', 'Belum ada run yang selesai.'));
    return;
  }

  causesEl.replaceChildren(
    ...data.causes.map((row) => {
      const wrap = el('div', 'bar');
      const track = el('div', 'track');
      const fill = el('div', 'fill');
      fill.style.width = Math.max(3, Math.round((row.n / total) * 100)) + '%';
      track.append(fill);
      wrap.append(el('span', null, row.cause), track, el('span', 'n', row.n));
      return wrap;
    }),
  );
}

function renderMedians(data) {
  const rows = [
    ['Uang', data.medians.money != null ? rupiah(data.medians.money) : '—'],
    ['Tinggi', data.medians.height != null ? `${data.medians.height} m` : '—'],
    ['Durasi', data.medians.duration != null ? `${data.medians.duration}s` : '—'],
    ['Sampel', data.medians.samples],
  ];

  mediansEl.replaceChildren(
    ...rows.map(([label, value]) => {
      const box = el('div');
      box.append(el('dt', null, label), el('dd', null, value));
      return box;
    }),
  );
}

function renderErrors(data) {
  if (!data.errors.length) {
    errorsEl.replaceChildren(el('li', 'empty', 'Tidak ada error pada rentang ini.'));
    return;
  }

  errorsEl.replaceChildren(
    ...data.errors.map((row) => {
      const item = el('li');
      item.append(
        el('span', 'msg', row.message),
        el('span', 'meta', `${row.n}× · terakhir ${timeLabel(row.last)} · rev ${row.rev ?? '—'}`),
      );
      return item;
    }),
  );
}

function renderRevs(data) {
  if (!data.revs.length) {
    revsEl.replaceChildren(el('li', 'empty', 'Belum ada data build.'));
    return;
  }

  revsEl.replaceChildren(
    ...data.revs.map((row) => {
      const item = el('li');
      item.append(el('span', 'msg', row.rev ?? 'tanpa rev'), el('span', 'meta', `${row.n} event`));
      return item;
    }),
  );
}

async function load() {
  document.body.dataset.loading = 'true';
  try {
    const response = await fetch(`/api/stats?days=${days}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderTotals(data);
    renderDaily(data);
    renderCauses(data);
    renderMedians(data);
    renderErrors(data);
    renderRevs(data);
    document.body.dataset.loading = 'false';
  } catch (error) {
    totalsEl.replaceChildren(el('p', 'empty', 'Gagal memuat data: ' + error.message));
    document.body.dataset.loading = 'false';
  }
}

document.querySelectorAll('[data-days]').forEach((button) => {
  button.addEventListener('click', () => {
    days = Number(button.dataset.days);
    document.querySelectorAll('[data-days]').forEach((other) => {
      other.classList.toggle('on', other === button);
    });
    void load();
  });
});

document.getElementById('refresh').addEventListener('click', () => void load());

void load();
