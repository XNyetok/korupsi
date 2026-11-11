/**
 * The browser's own full screen, where it has one. Android and desktop
 * browsers do; Safari on an iPhone does not, and there the game is full
 * screen only when it was opened from the home screen (see the meta tags in
 * index.html).
 */

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function canFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** Enters or leaves full screen. A refusal is not an error worth showing. */
export async function toggleFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  const root = document.documentElement as FullscreenElement;
  try {
    if (isFullscreen()) await (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
    else await (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root);
  } catch {
    /* the browser said no: nothing to do */
  }
}

/** Calls `listener` whenever full screen is entered or left. */
export function onFullscreenChange(listener: () => void): void {
  document.addEventListener('fullscreenchange', listener);
  document.addEventListener('webkitfullscreenchange', listener);
}
