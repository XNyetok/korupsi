import type { Game } from '../core/game.ts';
import { formatSeed } from '../core/rng.ts';
import { rupiah } from '../core/rules.ts';
import { audio } from '../platform/audio.ts';
import { shareResult } from '../platform/share.ts';
import { track } from '../platform/telemetry.ts';
import { PALETTE as C } from '../view/palette.ts';
import { debugOn } from './debug.ts';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

/**
 * Owns the DOM: HUD numbers, the ready, pause and result cards, the mute
 * switch, and the toast. The canvas only draws the world.
 */
export class Ui {
  private overlay = el<HTMLDivElement>('overlay');
  private money = el<HTMLSpanElement>('hud-money');
  private height = el<HTMLSpanElement>('hud-height');
  private weight = el<HTMLSpanElement>('hud-weight');
  private bar = el<HTMLElement>('hud-bar');
  private mute = el<HTMLButtonElement>('mute');
  private toastEl = el<HTMLDivElement>('toast');
  private toastTimer = 0;
  private cache = '';

  constructor() {
    this.mute.addEventListener('click', (event) => {
      // A mouse click leaves focus on the button, and Space would then toggle
      // the sound instead of jumping. Keyboard activation keeps focus.
      if (event.detail > 0) this.mute.blur();
      audio.setMuted(!audio.muted);
      if (!audio.muted) audio.play('start');
      this.renderMute();
    });
    this.renderMute();
  }

  private renderMute(): void {
    const muted = audio.muted;
    this.mute.setAttribute('aria-pressed', String(muted));
    this.mute.setAttribute('aria-label', muted ? 'Nyalakan suara' : 'Matikan suara');
  }

  update(game: Game): void {
    const key = `${game.money}|${game.heightMetres}|${game.weight}`;
    if (key === this.cache) return;
    this.cache = key;

    this.money.textContent = rupiah(game.money);
    this.height.textContent = `${game.heightMetres} m`;
    this.weight.textContent = `Beban ${game.weight}`;

    const pct = Math.max(0, Math.min(100, (game.weight / 12) * 100));
    this.bar.style.width = `${pct}%`;
    this.bar.style.background = game.weight >= 8 ? C.red : game.weight >= 5 ? C.gold : 'rgba(227, 176, 75, 0.65)';
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('is-visible');
    }, 1900);
  }

  /** `fixedSeed` is set when the page was opened with `?seed=`. */
  showReady(fixedSeed: number | null = null): void {
    const replay = fixedSeed === null ? '' : `<p class="seed">Seed tetap <b>${formatSeed(fixedSeed)}</b></p>`;
    this.overlay.innerHTML = `
      <div class="card ready">
        <div>
          <p class="eyebrow">v${__VERSION__}</p>
          <h1>Korupsi</h1>
          <p class="lede">Dua pijakan tiap jenjang. Ambil yang bergaris emas untuk skor,
            tapi makin berat, makin pendek lompatanmu.</p>
          <div class="legend">
            <span><i class="dot aman"></i>aman</span>
            <span><i class="dot amplop"></i>amplop</span>
            <span><i class="dot auditor"></i>auditor</span>
          </div>
        </div>
        <div>
          <p class="cta">Tap untuk mulai</p>
          ${replay}
        </div>
      </div>`;
    this.overlay.classList.add('is-visible');
    document.body.classList.remove('is-playing');
  }

  showPaused(game: Game): void {
    this.overlay.innerHTML = `
      <div class="card">
        <p class="stamp">dijeda</p>
        <h1 class="money">${rupiah(game.money)}</h1>
        <p class="lede">Berkasmu menunggu. Pergi lebih dari semenit, dianggap kabur.</p>
        <p class="cta">Tap untuk lanjut</p>
      </div>`;
    this.overlay.classList.add('is-visible');
    document.body.classList.remove('is-playing');
  }

  showResult(game: Game): void {
    const cause = game.cause;
    const eyebrow =
      cause === 'auditor'
        ? 'tertangkap'
        : cause === 'fall'
          ? 'terjatuh'
          : cause === 'abandoned'
            ? 'ditinggal'
            : 'ketinggalan';

    let line: string;
    if (cause === 'auditor') {
      line = game.weight
        ? `Ditangkap dengan ${game.weight} amplop di dalam tas.`
        : 'Ditangkap tanpa membawa apa pun. Tetap diperiksa.';
    } else if (cause === 'fall') {
      line = game.weight
        ? `Jatuh, ${game.weight} amplop ikut berhamburan.`
        : 'Jatuh dari pijakan yang belum diresmikan.';
    } else if (cause === 'abandoned') {
      line = game.weight
        ? `Kamu pergi. ${game.weight} amplop, berkasnya tetap diproses.`
        : 'Kamu pergi. Berkasnya diproses tanpa kamu.';
    } else {
      line = game.weight ? `${game.weight} amplop, semuanya tercatat di berkas.` : 'Tangan kosong, tetap dicurigai.';
    }

    this.overlay.innerHTML = `
      <div class="card">
        <p class="stamp">${eyebrow}</p>
        <h1 class="money">${rupiah(game.money)}</h1>
        <p class="lede">${line}</p>
        <div class="stats">
          <span><i>Amplop</i><b>${game.weight}</b></span>
          <span><i>Tinggi</i><b>${game.heightMetres} m</b></span>
        </div>
        <p class="record">Rekor ${rupiah(game.best.money)}</p>
        <button class="share" type="button">Bagikan hasil</button>
        <p class="cta">Tap untuk ulang</p>
        ${debugOn ? `<p class="seed">Seed <b>${formatSeed(game.seed)}</b></p>` : ''}
      </div>`;

    const share = this.overlay.querySelector<HTMLButtonElement>('.share');
    if (share) {
      const label =
        eyebrow === 'tertangkap'
          ? 'Ditangkap'
          : eyebrow === 'terjatuh'
            ? 'Terjatuh'
            : eyebrow === 'ditinggal'
              ? 'Ditinggal'
              : 'Ketinggalan';
      const text = `${label}: ${game.weight} amplop, ${rupiah(game.money)}, ${game.heightMetres} m.`;
      share.addEventListener('click', async (event) => {
        event.stopPropagation();
        const outcome = await shareResult(text);
        if (outcome !== 'failed') track('shared', { via: outcome });
        if (outcome === 'copied') this.toast('Disalin ke papan klip');
        if (outcome === 'failed') this.toast('Tidak bisa membagikan');
      });
    }

    this.overlay.classList.add('is-visible');
    document.body.classList.remove('is-playing');
  }

  hideOverlay(): void {
    this.overlay.classList.remove('is-visible');
    document.body.classList.add('is-playing');
  }
}
