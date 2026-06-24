import html2canvas from 'html2canvas-pro';

export async function captureElement(element, { backgroundColor = '#fbf7ef' } = {}) {
  const canvas = await html2canvas(element, {
    backgroundColor,
    scale: 2,
    useCORS: true,
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function captureFile(element, { fileName = 'iroyinmarket.png', backgroundColor } = {}) {
  const blob = await captureElement(element, { backgroundColor });
  if (!blob) return null;
  return new File([blob], fileName, { type: 'image/png' });
}

// Must be called synchronously from a user gesture on mobile (especially iOS Safari).
// Pass a pre-captured File so navigator.share fires without any awaits in between.
export function shareFile({ file, text, url, title }) {
  if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
    return navigator.share({ text, title, url, files: [file] }).catch((err) => {
      if (err?.name === 'AbortError') return;
      console.warn('navigator.share with file failed:', err);
      throw err;
    });
  }
  if (file) {
    downloadBlob(file, file.name);
    return Promise.resolve();
  }
  if (navigator.share) {
    return navigator.share({ text, title, url }).catch((err) => {
      if (err?.name === 'AbortError') return;
      console.warn('navigator.share text fallback failed:', err);
    });
  }
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.resolve();
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
