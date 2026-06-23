import html2canvas from 'html2canvas-pro';

function debug(msg) {
  if (typeof window === 'undefined') return;
  const list = (window.__shareDebug = window.__shareDebug || []);
  list.push(`${Date.now() % 100000}: ${msg}`);
  window.dispatchEvent(new CustomEvent('share-debug', { detail: msg }));
}

export async function captureElement(element, { backgroundColor = '#fbf7ef' } = {}) {
  debug(`captureElement start (el=${!!element}, w=${element?.offsetWidth})`);
  const canvas = await html2canvas(element, {
    backgroundColor,
    scale: 2,
    useCORS: true,
  });
  debug(`html2canvas done (${canvas.width}x${canvas.height})`);
  return new Promise((resolve) => canvas.toBlob((b) => {
    debug(`toBlob done (size=${b?.size ?? 'null'})`);
    resolve(b);
  }, 'image/png'));
}

export async function shareWithImage(element, { text, fileName = 'iroyinmarket.png', backgroundColor } = {}) {
  debug('shareWithImage called');
  try {
    const blob = await captureElement(element, { backgroundColor });
    if (!blob) {
      debug('blob is null → fallbackShare');
      return fallbackShare(text);
    }

    const file = new File([blob], fileName, { type: 'image/png' });
    const canShareFile = navigator.share && navigator.canShare?.({ files: [file] });
    debug(`navigator.share=${!!navigator.share} canShare={files}=${canShareFile}`);
    if (canShareFile) {
      try {
        await navigator.share({ text, files: [file] });
        debug('navigator.share resolved');
      } catch (e) {
        debug(`navigator.share threw: ${e?.name}: ${e?.message}`);
        throw e;
      }
    } else {
      debug('falling back to downloadBlob');
      downloadBlob(blob, fileName);
    }
  } catch (err) {
    debug(`shareWithImage caught: ${err?.name}: ${err?.message}`);
    console.warn('shareWithImage capture failed:', err);
    fallbackShare(text);
  }
}

function fallbackShare(text) {
  debug('fallbackShare invoked');
  if (navigator.share) {
    navigator.share({ text }).then(
      () => debug('fallback navigator.share resolved'),
      (e) => debug(`fallback navigator.share rejected: ${e?.name}: ${e?.message}`)
    );
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    debug('clipboard write');
  } else {
    debug('no share method available');
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadImage(element, { fileName = 'iroyinmarket.png', backgroundColor } = {}) {
  const blob = await captureElement(element, { backgroundColor });
  if (!blob) return;
  downloadBlob(blob, fileName);
}
