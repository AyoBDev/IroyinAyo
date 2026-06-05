const { createCanvas } = require('canvas');

function generateWinImage({ marketTitle, outcomeLabel, payout, amountSpent, entryPrice, referralCode }) {
  const size = 1080;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0A0E17');
  grad.addColorStop(1, '#0f1a12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Top accent bar
  const topGrad = ctx.createLinearGradient(0, 0, size, 0);
  topGrad.addColorStop(0, '#10B981');
  topGrad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, size, 8);

  // Trophy circle
  ctx.beginPath();
  ctx.arc(size / 2, 240, 80, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Trophy emoji
  ctx.font = '72px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u{1F3C6}', size / 2, 240);

  // "I Won on IroyinMarket!" headline
  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = '#F0F4F8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('I Won on IroyinMarket!', size / 2, 400);

  // Payout amount
  ctx.font = 'bold 80px sans-serif';
  ctx.fillStyle = '#10B981';
  ctx.fillText(`+${payout} pts`, size / 2, 520);

  // Multiplier badge
  const multiplier = amountSpent > 0 ? (payout / amountSpent).toFixed(1) : '0.0';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(`${multiplier}x return`, size / 2, 590);

  // Market title (truncated)
  ctx.font = '32px sans-serif';
  ctx.fillStyle = '#7B8BA3';
  let title = marketTitle;
  if (title.length > 45) title = title.slice(0, 42) + '...';
  ctx.fillText(`"${title}"`, size / 2, 680);

  // Outcome picked
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#F0F4F8';
  ctx.fillText(`Picked: ${outcomeLabel}`, size / 2, 740);

  // Entry price
  if (entryPrice != null) {
    const entryPercent = Math.round(entryPrice * 100);
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#6366F1';
    ctx.fillText(`Bought at ${entryPercent}%`, size / 2, 800);
  }

  // Divider line
  ctx.strokeStyle = 'rgba(123, 139, 163, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size * 0.2, 860);
  ctx.lineTo(size * 0.8, 860);
  ctx.stroke();

  // Referral link
  if (referralCode) {
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillText(`Join me: iroyinmarket.com/?ref=${referralCode}`, size / 2, 920);
  }

  // Brand footer
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#4A5568';
  ctx.fillText('IroyinMarket — Predict & compete for cash', size / 2, 1000);

  return canvas.toBuffer('image/png');
}

module.exports = { generateWinImage };
