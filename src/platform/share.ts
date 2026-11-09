const SITE = 'https://korupsi.web.id/';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

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

/**
 * Native sheet on phones, clipboard everywhere else. The text is only the
 * outcome and the numbers; it never says which choices led there.
 */
export async function shareResult(text: string): Promise<ShareOutcome> {
  if (isMobile() && typeof navigator.share === 'function') {
    try {
      await withTimeout(navigator.share({ title: 'Korupsi', text, url: SITE }), 12000);
      return 'shared';
    } catch (error) {
      // The player closed the sheet; that is not a failure.
      if ((error as DOMException | undefined)?.name === 'AbortError') return 'shared';
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
