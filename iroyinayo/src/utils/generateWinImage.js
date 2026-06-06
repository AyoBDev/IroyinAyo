const { createCanvas, registerFont } = require('canvas');
const path = require('path');

registerFont(path.join(__dirname, 'fonts', 'Satoshi-Bold.ttf'), { family: 'Satoshi', weight: 'bold' });
registerFont(path.join(__dirname, 'fonts', 'Satoshi-Black.ttf'), { family: 'Satoshi', weight: '900' });
registerFont(path.join(__dirname, 'fonts', 'DMSans-Regular.ttf'), { family: 'DM Sans' });
registerFont(path.join(__dirname, 'fonts', 'DMSans-Bold.ttf'), { family: 'DM Sans', weight: 'bold' });

const C = {
  bgPrimary: '#0A0E17',
  bgCard: '#141B2D',
  bgSurface: '#1A2338',
  bgSurfaceHigh: '#1E2940',
  border: '#1E2940',
  borderLight: '#283550',
  textPrimary: '#F0F4F8',
  textSecondary: '#7B8BA3',
  textTertiary: '#4A5568',
  green: '#10B981',
  greenBg: 'rgba(16, 185, 129, 0.10)',
  greenBorder: 'rgba(16, 185, 129, 0.25)',
  yellow: '#F59E0B',
  yellowBg: 'rgba(245, 158, 11, 0.08)',
  indigo: '#6366F1',
  indigoBg: 'rgba(99, 102, 241, 0.08)',
  violet: '#A78BFA',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateWinImage({ marketTitle, outcomeLabel, payout, amountSpent, entryPrice, referralCode }) {
  const size = 1080;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Full background
  ctx.fillStyle = C.bgPrimary;
  ctx.fillRect(0, 0, size, size);

  // Main card — mimics the app modal
  const cardX = 60, cardY = 50, cardW = size - 120, cardH = size - 100;
  roundRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.fillStyle = C.bgCard;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Gradient glow at top of card
  const glowGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 160);
  glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.06)');
  glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.04)');
  glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
  roundRect(ctx, cardX, cardY, cardW, 160, 48);
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // Trophy circle with double ring
  const cx = size / 2, cy = 220;
  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, 72, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
  ctx.fill();
  // Inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.fill();
  ctx.strokeStyle = C.greenBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Trophy symbol
  ctx.font = '900 38px "Satoshi"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.yellow;
  ctx.fillText('WINNER', cx, cy);

  // "You Won!" headline
  ctx.font = '900 54px "Satoshi"';
  ctx.fillStyle = C.textPrimary;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('You Won!', cx, 360);

  // Market title as context text
  ctx.font = '26px "DM Sans"';
  ctx.fillStyle = C.textSecondary;
  let title = marketTitle;
  if (title.length > 48) title = title.slice(0, 45) + '...';
  ctx.fillText(`"${title}"`, cx, 410);

  // Payout card — nested surface container
  const payCardX = cardX + 60, payCardY = 450, payCardW = cardW - 120, payCardH = 180;
  roundRect(ctx, payCardX, payCardY, payCardW, payCardH, 24);
  ctx.fillStyle = C.bgSurface;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // "TOTAL PAYOUT" label
  ctx.font = 'bold 16px "DM Sans"';
  ctx.fillStyle = C.textTertiary;
  ctx.fillText('TOTAL PAYOUT', cx, payCardY + 40);

  // Payout amount
  ctx.font = '900 64px "Satoshi"';
  ctx.fillStyle = C.green;
  ctx.fillText(`+${payout} pts`, cx, payCardY + 110);

  // Profit line
  const profit = payout - amountSpent;
  if (profit > 0) {
    ctx.font = '22px "DM Sans"';
    ctx.fillStyle = C.textSecondary;
    ctx.fillText(`${amountSpent} invested → ${profit} profit`, cx, payCardY + 155);
  }

  // Stats row — outcome + entry price + multiplier
  const statsY = 680;
  const multiplier = amountSpent > 0 ? (payout / amountSpent).toFixed(1) : '0.0';

  // Outcome pill
  const outcomeText = outcomeLabel;
  ctx.font = 'bold 22px "DM Sans"';
  const outcomeW = ctx.measureText(outcomeText).width + 40;
  roundRect(ctx, cx - outcomeW / 2 - 100, statsY, outcomeW, 44, 22);
  ctx.fillStyle = C.greenBg;
  ctx.fill();
  ctx.strokeStyle = C.greenBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.textBaseline = 'middle';
  ctx.fillText(outcomeText, cx - 100, statsY + 22);

  // Multiplier pill
  const multText = `${multiplier}x`;
  ctx.font = 'bold 22px "DM Sans"';
  const multW = ctx.measureText(multText).width + 40;
  roundRect(ctx, cx + 60, statsY, multW, 44, 22);
  ctx.fillStyle = C.yellowBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = C.yellow;
  ctx.fillText(multText, cx + 60 + multW / 2, statsY + 22);

  // Entry price
  if (entryPrice != null) {
    const entryPercent = Math.round(entryPrice * 100);
    ctx.font = '22px "DM Sans"';
    ctx.fillStyle = C.textTertiary;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Entry: ${entryPercent}%`, cx, statsY + 80);
  }

  // Divider
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 80, 810);
  ctx.lineTo(cardX + cardW - 80, 810);
  ctx.stroke();

  // Referral CTA button
  if (referralCode) {
    const btnY = 840, btnH = 56;
    roundRect(ctx, cardX + 80, btnY, cardW - 160, btnH, 28);
    ctx.fillStyle = C.green;
    ctx.fill();

    ctx.font = 'bold 22px "DM Sans"';
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Predict & Win → iroyinmarket.com/?ref=${referralCode}`, cx, btnY + btnH / 2);
  }

  // Brand footer
  ctx.font = 'bold 20px "Satoshi"';
  ctx.fillStyle = C.textTertiary;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('IroyinMarket', cx, 960);
  ctx.font = '16px "DM Sans"';
  ctx.fillStyle = C.textTertiary;
  ctx.fillText('Campus predictions • Real cash prizes', cx, 990);

  return canvas.toBuffer('image/png');
}

module.exports = { generateWinImage };
