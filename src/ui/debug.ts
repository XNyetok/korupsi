import type { Game } from '../core/game.ts';
import { jumpFactor } from '../core/game.ts';
import { PARAMS } from '../core/params.ts';
import { audio } from '../platform/audio.ts';

declare global {
  interface Window {
    __korupsi?: Game & { params: typeof PARAMS; audio: typeof audio };
  }
}

const CONTROLS: { key: keyof typeof PARAMS; label: string; min: number; max: number; step: number }[] = [
  { key: 'jumpV', label: 'Lompat', min: 240, max: 400, step: 5 },
  { key: 'gravity', label: 'Gravitasi', min: 600, max: 1600, step: 20 },
  { key: 'runSpeed', label: 'Lari', min: 60, max: 150, step: 2 },
  { key: 'dashSpeed', label: 'Ngeles', min: 140, max: 320, step: 5 },
  { key: 'weightPenalty', label: 'Berat/amplop', min: 0, max: 0.05, step: 0.0025 },
  { key: 'coyote', label: 'Coyote', min: 0, max: 0.2, step: 0.01 },
];

export interface Debug {
  tick(): void;
}

/** Debug tooling shows only with `?debug=1`: the tuning panel and the game on `window`. */
export const debugOn = new URLSearchParams(location.search).has('debug');

export function mountDebug(game: Game): Debug | null {
  if (!debugOn) return null;

  // Expose the running game in the console, so a session can be inspected or
  // driven by hand while tuning. The browser tests use the same handle.
  window.__korupsi = Object.assign(game, { params: PARAMS, audio });

  const panel = document.getElementById('debug');
  if (!panel) return null;
  panel.classList.add('is-on');

  panel.innerHTML =
    CONTROLS.map(
      (c) => `
      <label>${c.label} <b data-out="${c.key}">${PARAMS[c.key]}</b>
        <input type="range" data-key="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${PARAMS[c.key]}">
      </label>`,
    ).join('') + '<div class="readout" data-readout></div>';

  panel.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-key]');
    if (!input) return;
    const key = input.dataset.key as keyof typeof PARAMS;
    PARAMS[key] = Number(input.value);
    const out = panel.querySelector(`[data-out="${key}"]`);
    if (out) out.textContent = String(PARAMS[key]);
  });

  const readout = panel.querySelector('[data-readout]');
  window.setInterval(() => {
    if (!readout) return;
    const factor = jumpFactor(game.weight);
    const jv = PARAMS.jumpV * factor;
    const rise = (jv * jv) / (2 * PARAMS.gravity);
    const p = game.player;
    readout.textContent =
      `factor ${factor.toFixed(2)} · rise ${rise.toFixed(1)}px · ` +
      `x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} · ledge ${p.ground}`;
  }, 250);

  return {
    tick() {
      panel.classList.toggle('is-muted', game.phase !== 'playing');
    },
  };
}
