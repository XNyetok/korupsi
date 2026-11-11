const SITE = 'https://korupsi.web.id/';

/** `saved` is the image downloaded; `cancelled` is the player closing the sheet. */
export type ShareOutcome = 'shared' | 'saved' | 'copied' | 'cancelled' | 'failed';

export interface Share {
  /** One line: the outcome and the numbers. It never says which choices led there. */
  text: string;
  /** The result card as a PNG, or null when it could not be made. */
  image: Blob | null;
  filename: string;
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

function download(image: Blob, filename: string): void {
  const url = URL.createObjectURL(image);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Shares the result as a picture. On a phone that opens the share sheet with
 * the image in it, so it can go straight to a story or a chat; anywhere else
 * the image is saved. Without an image it falls back to the line of text.
 */
export async function shareResult({ text, image, filename }: Share): Promise<ShareOutcome> {
  const caption = `${text} ${SITE}`;

  if (image) {
    const file = new File([image], filename, { type: 'image/png' });
    if (isMobile() && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      try {
        // No timeout: choosing where to post a picture takes as long as it takes.
        await navigator.share({ files: [file], text: caption });
        return 'shared';
      } catch (error) {
        if (aborted(error)) return 'cancelled';
        // The sheet refused the file: saving it is still better than nothing.
      }
    }
    try {
      download(image, filename);
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
