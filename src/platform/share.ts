const SITE = 'https://korupsi.web.id/';

/**
 * `saved` is the picture downloaded; `show` asks the caller to put the picture
 * on screen for a long press; `cancelled` is the player closing the sheet.
 */
export type ShareOutcome = 'shared' | 'saved' | 'copied' | 'show' | 'cancelled' | 'failed';

export interface Share {
  /** One line: the outcome and the numbers. Used only when there is no picture. */
  text: string;
  /** The result card as a PNG file, or null when it could not be made. */
  file: File | null;
}

function isMobile(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports a desktop Safari user agent, so touch points are the tell.
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const aborted = (error: unknown) => (error as DOMException | undefined)?.name === 'AbortError';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Shares the result as a picture. Call it straight from the press: nothing in
 * here waits for anything before the share sheet is asked for, because Safari
 * only opens it from the press itself.
 *
 * On a phone the sheet gets the picture and nothing else. A caption sent with
 * it makes iOS treat the share as text with an attachment, and apps that only
 * take pictures (a story, most of all) drop out of the sheet. The address is
 * on the picture anyway. A phone without a sheet for files gets `show`.
 * Anything that is not a phone saves the file.
 */
export async function shareResult({ text, file }: Share): Promise<ShareOutcome> {
  if (file) {
    if (isMobile()) {
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          // No timeout: choosing where to post a picture takes as long as it takes.
          await navigator.share({ files: [file] });
          return 'shared';
        } catch (error) {
          if (aborted(error)) return 'cancelled';
          // The sheet refused the file: show it instead.
        }
      }
      return 'show';
    }
    try {
      download(file);
      return 'saved';
    } catch {
      /* fall through to the text */
    }
  }

  if (isMobile() && typeof navigator.share === 'function') {
    try {
      await withTimeout(navigator.share({ title: 'Korupsi', text, url: SITE }), 12000);
      return 'shared';
    } catch (error) {
      if (aborted(error)) return 'cancelled';
      // Anything else (no sheet available, timeout) falls back to the clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${SITE}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
