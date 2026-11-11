import { clock, type Game, rupiah } from '../core/game.ts';
import { gelarFor } from '../core/gelar.ts';
import { audio } from '../platform/audio.ts';
import { canFullscreen, isFullscreen, onFullscreenChange, toggleFullscreen } from '../platform/fullscreen.ts';
import { shareResult } from '../platform/share.ts';
import { track } from '../platform/telemetry.ts';
import { C } from '../view/palette.ts';
import { paintLogo } from '../view/pixel.ts';
import { paintShareCard } from '../view/sharecard.ts';

/** Who made the game: shown on the title card and under the result. */
const CREDIT = { name: 'nyetok.id', url: 'https://nyetok.id' } as const;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

export interface UiHooks {
  start(): void;
  resume(): void;
  restart(): void;
  pause(): void;
}

/**
 * Owns the DOM: the HUD, the title, pause and result cards, the sound switch
 * and the toast. The canvas only draws the world.
 */
export class Ui {
  private overlay = el<HTMLDivElement>('overlay');
  private floor = el<HTMLSpanElement>('hud-floor');
  private money = el<HTMLSpanElement>('hud-money');
  private weight = el<HTMLSpanElement>('hud-weight');
  private deaths = el<HTMLSpanElement>('hud-deaths');
  private time = el<HTMLSpanElement>('hud-time');
  private mute = el<HTMLButtonElement>('mute');
  private pause = el<HTMLButtonElement>('pause');
  private full = el<HTMLButtonElement>('full');
  private toastEl = el<HTMLDivElement>('toast');
  private toastTimer = 0;
  private cache = '';
  private lockedUntil = 0;

  constructor(hooks: UiHooks) {
    this.mute.addEventListener('click', (event) => {
      // A mouse click leaves focus on the button, and Space would then toggle
      // the sound instead of jumping. Keyboard activation keeps focus.
      if (event.detail > 0) this.mute.blur();
      audio.setMuted(!audio.muted);
      if (!audio.muted) audio.play('start');
      this.renderMute();
    });
    this.renderMute();

    // Full screen is offered only where the browser has it.
    if (canFullscreen()) {
      this.full.hidden = false;
      document.body.classList.add('has-fullscreen');
      this.full.addEventListener('click', (event) => {
        if (event.detail > 0) this.full.blur();
        void toggleFullscreen();
      });
      onFullscreenChange(() => {
        const on = isFullscreen();
        this.full.setAttribute('aria-pressed', String(on));
        this.full.setAttribute('aria-label', on ? 'Keluar dari layar penuh' : 'Layar penuh');
      });
    }

    this.pause.addEventListener('click', (event) => {
      if (event.detail > 0) this.pause.blur();
      hooks.pause();
    });

    this.overlay.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-do]');
      if (!button || performance.now() < this.lockedUntil) return;
      const action = button.dataset.do;
      if (action === 'start') hooks.start();
      else if (action === 'resume') hooks.resume();
      else if (action === 'restart') hooks.restart();
    });
  }

  private renderMute(): void {
    const muted = audio.muted;
    this.mute.setAttribute('aria-pressed', String(muted));
    this.mute.setAttribute('aria-label', muted ? 'Nyalakan suara' : 'Matikan suara');
  }

  /** Enter, or the jump key while a card is up: the same as its main button. */
  confirm(): void {
    if (!this.overlay.classList.contains('is-visible')) return;
    this.overlay.querySelector<HTMLButtonElement>('button.primary')?.click();
  }

  update(game: Game): void {
    const seconds = Math.floor(game.time);
    const key = `${game.weight}|${game.deaths}|${seconds}`;
    if (key === this.cache) return;
    this.cache = key;

    this.floor.textContent = `01 ${game.floor.name}`;
    this.money.textContent = rupiah(game.money);
    this.weight.textContent = `Beban ${game.weight}`;
    this.weight.hidden = game.weight === 0;
    this.weight.classList.toggle('is-heavy', game.weight >= game.floor.amplop.length - 1);
    this.deaths.textContent = `OTT ${game.deaths}`;
    this.time.textContent = clock(game.time);
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('is-visible');
    }, 1900);
  }

  private show(html: string, lockMs = 0): void {
    this.overlay.innerHTML = html;
    this.overlay.classList.add('is-visible');
    document.body.classList.remove('is-playing');
    this.lockedUntil = performance.now() + lockMs;
  }

  showTitle(): void {
    this.show(`
      <div class="card title">
        <canvas class="logo" aria-label="Korupsi" role="img"></canvas>
        <p class="lede">Tim audit sudah di lobi. Jalan keluar cuma satu: naik.</p>
        <ul class="rules">
          <li><i class="dot amplop"></i><span><b>Amplop</b> itu uang, juga beban: makin banyak dibawa, makin pendek lompatanmu.</span></li>
          <li><i class="dot bahaya"></i><span><b>Auditor</b> dan <b>stempel</b> berarti OTT. Kamu balik ke mesin absen terakhir.</span></li>
          <li><i class="dot ngeles"></i><span><b>Ngeles</b> menembus auditor dan menyeberangi celah yang terlalu lebar.</span></li>
        </ul>
        <button class="primary" type="button" data-do="start">Mulai</button>
        <p class="keys"><kbd>←</kbd><kbd>→</kbd> jalan <kbd>Spasi</kbd> lompat <kbd>Shift</kbd> ngeles <kbd>Esc</kbd> jeda</p>
        <p class="version"><span class="v">v${__VERSION__}</span> · dibuat oleh <a href="${CREDIT.url}" target="_blank" rel="noopener">${CREDIT.name}</a></p>
      </div>`);
    const logo = this.overlay.querySelector<HTMLCanvasElement>('.logo');
    if (logo) paintLogo(logo, C.gold, C.redDark);
  }

  showPaused(game: Game): void {
    this.show(`
      <div class="card">
        <p class="stamp">dijeda</p>
        <h1 class="big">${clock(game.time)}</h1>
        <p class="lede">Berkasmu menunggu di meja. Auditornya juga.</p>
        <button class="primary" type="button" data-do="resume">Lanjut</button>
        <button class="secondary" type="button" data-do="restart">Ulang dari lobi</button>
      </div>`);
  }

  /** `lockMs` keeps the buttons dead for a moment, so the press that won the floor does not restart it. */
  showResult(game: Game, lockMs: number): void {
    const total = game.floor.amplop.length;
    const { weight, deaths } = game;

    // What the climb earned: the same title the shared decree carries.
    const gelar = gelarFor({ time: game.time, deaths, weight, total });

    const records = [
      game.record.time ? 'Rekor waktu baru' : game.best.time ? `Rekor waktu ${clock(game.best.time)}` : '',
      game.record.money ? 'Rekor uang baru' : game.best.money ? `Rekor uang ${rupiah(game.best.money)}` : '',
    ].filter(Boolean);

    this.show(
      `
      <div class="card result">
        <p class="stamp lolos">lolos</p>
        <h1 class="big">${clock(game.time)}</h1>
        <p class="gelar">${gelar.title}</p>
        <p class="lede">${gelar.line}</p>
        <div class="stats">
          <span class="stat"><i>OTT</i><b>${deaths}</b></span>
          <span class="stat"><i>Amplop</i><b>${weight}/${total}</b></span>
          <span class="stat"><i>Uang</i><b class="gold">${rupiah(game.money)}</b></span>
        </div>
        <p class="record">${records.join(' · ')}</p>
        <button class="primary" type="button" data-do="restart">Main lagi</button>
        <button class="secondary share" type="button">Bagikan hasil</button>
        <p class="version">Lantai berikutnya, Kecamatan, masih dibangun.</p>
        <p class="version">Dibuat oleh <a href="${CREDIT.url}" target="_blank" rel="noopener">${CREDIT.name}</a></p>
      </div>`,
      lockMs,
    );

    const share = this.overlay.querySelector<HTMLButtonElement>('.share');
    if (share) {
      const text = `${gelar.title}: lolos dari ${game.floor.name} dalam ${clock(game.time)}, ${deaths} kali OTT, ${weight} amplop (${rupiah(game.money)}).`;
      const filename = `korupsi-${game.floor.name.toLowerCase()}.png`;

      // The picture is painted right after the card appears, not on the press.
      // A share sheet only opens straight from a press: anything that has to
      // be waited for in between, and Safari refuses. So the button is dead
      // until the file exists, and the press does nothing but share it.
      let card: HTMLCanvasElement | null = null;
      let file: File | null = null;
      share.disabled = true;
      window.setTimeout(() => {
        try {
          card = paintShareCard(game);
          card.toBlob((blob) => {
            if (blob) file = new File([blob], filename, { type: 'image/png' });
            share.disabled = false;
          }, 'image/png');
        } catch {
          share.disabled = false;
        }
      }, 30);

      share.addEventListener('click', () => {
        if (share.disabled) return;
        share.disabled = true;
        void shareResult({ text, file }).then((outcome) => {
          share.disabled = false;
          if (outcome === 'show' && card) this.showPicture(card.toDataURL('image/png'));
          if (outcome !== 'cancelled' && outcome !== 'failed') track('shared', { via: outcome });
          if (outcome === 'saved') this.toast('Gambar hasil disimpan');
          if (outcome === 'copied') this.toast('Disalin ke papan klip');
          if (outcome === 'failed') this.toast('Tidak bisa membagikan');
        });
      });
    }
  }

  /**
   * Shows the result picture itself, for a phone whose share sheet would not
   * take it: a long press on a picture is the one thing every phone browser
   * offers for saving or sharing it.
   */
  private showPicture(src: string): void {
    const viewer = document.createElement('div');
    viewer.className = 'viewer';
    viewer.innerHTML = `
      <img alt="Gambar hasil">
      <p>Tekan lama gambar, lalu pilih <b>Simpan ke Foto</b> atau <b>Bagikan</b>.</p>
      <button type="button">Tutup</button>`;
    viewer.querySelector('img')?.setAttribute('src', src);
    viewer.querySelector('button')?.addEventListener('click', () => viewer.remove());
    this.overlay.append(viewer);
  }

  hideOverlay(): void {
    this.overlay.classList.remove('is-visible');
    this.overlay.innerHTML = '';
    document.body.classList.add('is-playing');
  }
}
