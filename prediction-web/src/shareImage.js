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
    } else if (navigator.share) {
      await navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
    }
  } catch {
    fallbackShare(text);
  }
}

function fallbackShare(text) {
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text);
  }
}

export async function downloadImage(element, { fileName = 'iroyinmarket.png', backgroundColor } = {}) {
  const blob = await captureElement(element, { backgroundColor });
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
