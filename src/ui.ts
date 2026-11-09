import { audio } from './audio.ts';
import { PALETTE as C } from './config.ts';
import { rupiah, type Game } from './game.ts';
import { shareResult } from './share.ts';

declare const __BUILD_LABEL__: string;

const buildLabel = () =>
  typeof __BUILD_LABEL__ === 'string' && __BUILD_LABEL__ ? __BUILD_LABEL__ : 'dev';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

/**
 * Owns the DOM: HUD numbers, the two cards, the mute switch, and the toast.
 * The canvas never draws text that the browser can render better.
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
    this.mute.addEventListener('click', () => {
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
    this.bar.style.background =
      game.weight >= 8 ? C.red : game.weight >= 5 ? C.gold : 'rgba(227, 176, 75, 0.65)';
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('is-visible');
    }, 1900);
  }

  showReady(): void {
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
          <p class="rev">rev ${buildLabel()}</p>
        </div>
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
      line = game.weight
        ? `${game.weight} amplop, semuanya tercatat di berkas.`
        : 'Tangan kosong, tetap dicurigai.';
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
