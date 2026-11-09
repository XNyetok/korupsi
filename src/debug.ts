import { audio } from './audio.ts';
import { PARAMS } from './config.ts';
import type { Game } from './game.ts';

declare global {
  interface Window {
    __korupsi?: Game & { params: typeof PARAMS; audio: typeof audio };
  }
}

const CONTROLS: { key: keyof typeof PARAMS; label: string; min: number; max: number; step: number }[] =
  [
    { key: 'jumpV', label: 'Lompat', min: 500, max: 900, step: 10 },
    { key: 'gravity', label: 'Gravitasi', min: 1200, max: 2600, step: 20 },
    { key: 'weightPenalty', label: 'Berat/amplop', min: 0, max: 0.12, step: 0.005 },
    { key: 'cameraBase', label: 'Scroll awal', min: 6, max: 60, step: 1 },
    { key: 'cameraAccel', label: 'Scroll naik', min: 0, max: 1.5, step: 0.05 },
    { key: 'goldChance', label: 'Peluang emas', min: 0, max: 1, step: 0.05 },
  ];

export interface Debug {
  tick(): void;
}

export function mountDebug(game: Game): Debug | null {
  if (!new URLSearchParams(location.search).has('debug')) return null;

  // Expose the running game in the console, so a session can be inspected or
  // driven by hand while tuning.
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
    const factor = game.jumpFactor();
    const jv = PARAMS.jumpV * factor;
    const rise = (jv * jv) / (2 * PARAMS.gravity);
    const air = (2 * jv) / PARAMS.gravity;
    readout.textContent =
      `factor ${factor.toFixed(2)} · rise ${Math.round(rise)}px · ` +
      `air ${air.toFixed(2)}s · scroll ${game.camSpeed.toFixed(0)}px/s`;
  }, 250);

  return {
    tick() {
      panel.classList.toggle('is-muted', game.phase !== 'playing');
    },
  };
}
