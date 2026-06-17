import html2canvas from 'html2canvas';

export async function captureElement(element, { backgroundColor = '#fbf7ef' } = {}) {
  const canvas = await html2canvas(element, {
    backgroundColor,
    scale: 2,
    useCORS: true,
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function shareWithImage(element, { text, fileName = 'iroyinmarket.png', backgroundColor } = {}) {
  try {
    const blob = await captureElement(element, { backgroundColor });
    if (!blob) return fallbackShare(text);

    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ text, files: [file] });
    } else {
      // Can't share with file — download the image instead
      downloadBlob(blob, fileName);
    }
  } catch {
    fallbackShare(text);
  }
}

function fallbackShare(text) {
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
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
