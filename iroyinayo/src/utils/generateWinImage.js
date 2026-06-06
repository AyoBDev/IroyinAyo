const { createCanvas, registerFont } = require('canvas');
const path = require('path');

registerFont(path.join(__dirname, 'fonts', 'Satoshi-Bold.ttf'), { family: 'Satoshi', weight: 'bold' });
registerFont(path.join(__dirname, 'fonts', 'Satoshi-Black.ttf'), { family: 'Satoshi', weight: '900' });
registerFont(path.join(__dirname, 'fonts', 'DMSans-Regular.ttf'), { family: 'DM Sans' });
registerFont(path.join(__dirname, 'fonts', 'DMSans-Bold.ttf'), { family: 'DM Sans', weight: 'bold' });

const COLORS = {
  bg: '#0A0E17',
  surface: '#141B2D',
  border: '#1E2940',
  textPrimary: '#F0F4F8',
  textMuted: '#7B8BA3',
  textDim: '#4A5568',
  green: '#10B981',
  greenBg: 'rgba(16, 185, 129, 0.12)',
  yellow: '#F59E0B',
  indigo: '#6366F1',
  violet: '#A78BFA',
};

function generateWinImage({ marketTitle, outcomeLabel, payout, amountSpent, entryPrice, referralCode }) {
  const size = 1080;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, size, size);

  // Top accent gradient bar
  const topGrad = ctx.createLinearGradient(0, 0, size, 0);
  topGrad.addColorStop(0, COLORS.green);
  topGrad.addColorStop(0.5, COLORS.indigo);
  topGrad.addColorStop(1, COLORS.yellow);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, size, 8);

  // Trophy circle with green glow
  ctx.beginPath();
  ctx.arc(size / 2, 210, 70, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.greenBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // "W" in circle
  ctx.font = '900 56px "Satoshi"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.green;
  ctx.fillText('W', size / 2, 210);

  // "I WON" headline - Satoshi Black
  ctx.font = '900 58px "Satoshi"';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('I Won on IroyinMarket!', size / 2, 370);

  // Payout pill background
  const payoutText = `+${payout} pts`;
  ctx.font = '900 72px "Satoshi"';
  const payoutWidth = ctx.measureText(payoutText).width;
  const pillX = (size - payoutWidth) / 2 - 32;
  const pillY = 420;
  const pillW = payoutWidth + 64;
  const pillH = 100;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 20);
  ctx.fillStyle = COLORS.greenBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Payout amount
  ctx.font = '900 72px "Satoshi"';
  ctx.fillStyle = COLORS.green;
  ctx.textBaseline = 'middle';
  ctx.fillText(payoutText, size / 2, pillY + pillH / 2);

  // Multiplier
  const multiplier = amountSpent > 0 ? (payout / amountSpent).toFixed(1) : '0.0';
  ctx.font = 'bold 32px "DM Sans"';
  ctx.fillStyle = COLORS.yellow;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${multiplier}x return`, size / 2, 580);

  // Divider
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size * 0.15, 620);
  ctx.lineTo(size * 0.85, 620);
  ctx.stroke();

  // Market question card
  ctx.beginPath();
  ctx.roundRect(size * 0.1, 650, size * 0.8, 140, 16);
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Market title (inside card)
  ctx.font = '28px "DM Sans"';
  ctx.fillStyle = COLORS.textMuted;
  let title = marketTitle;
  if (title.length > 50) title = title.slice(0, 47) + '...';
  ctx.fillText(`"${title}"`, size / 2, 700);

  // Outcome picked (inside card)
  ctx.font = 'bold 34px "DM Sans"';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`Picked: ${outcomeLabel}`, size / 2, 755);

  // Entry price below card
  if (entryPrice != null) {
    const entryPercent = Math.round(entryPrice * 100);
    ctx.font = '26px "DM Sans"';
    ctx.fillStyle = COLORS.indigo;
    ctx.fillText(`Entry odds: ${entryPercent}%`, size / 2, 835);
  }

  // Referral CTA section
  if (referralCode) {
    ctx.beginPath();
    ctx.roundRect(size * 0.15, 880, size * 0.7, 60, 30);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 24px "DM Sans"';
    ctx.fillStyle = COLORS.indigo;
    ctx.fillText(`Join me: iroyinmarket.com/?ref=${referralCode}`, size / 2, 917);
  }

  // Brand footer
  ctx.font = 'bold 22px "Satoshi"';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('IroyinMarket', size / 2, 1010);
  ctx.font = '18px "DM Sans"';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Campus predictions. Real cash prizes.', size / 2, 1045);

  return canvas.toBuffer('image/png');
}

module.exports = { generateWinImage };
