const { createCanvas, registerFont } = require('canvas');
const path = require('path');

registerFont(path.join(__dirname, 'fonts', 'Fraunces-Bold.ttf'), { family: 'Fraunces', weight: 'bold' });
registerFont(path.join(__dirname, 'fonts', 'Fraunces-Black.ttf'), { family: 'Fraunces', weight: '900' });
registerFont(path.join(__dirname, 'fonts', 'InstrumentSans-Regular.ttf'), { family: 'Instrument Sans' });
registerFont(path.join(__dirname, 'fonts', 'InstrumentSans-Medium.ttf'), { family: 'Instrument Sans', weight: '500' });
registerFont(path.join(__dirname, 'fonts', 'InstrumentSans-Bold.ttf'), { family: 'Instrument Sans', weight: 'bold' });
registerFont(path.join(__dirname, 'fonts', 'JetBrainsMono-Medium.ttf'), { family: 'JetBrains Mono', weight: '500' });
registerFont(path.join(__dirname, 'fonts', 'JetBrainsMono-Bold.ttf'), { family: 'JetBrains Mono', weight: 'bold' });

const C = {
  bone: '#fbf7ef',
  paper: '#f4efe6',
  paperHover: '#ede7db',
  emerald: '#0f3d2e',
  emeraldDeep: '#144d39',
  gold: '#e6c764',
  ochre: '#b08923',
  ink: '#14110f',
  inkDeep: '#2a2521',
  inkMuted: '#6b6055',
  line: '#d6cdb8',
  green: '#2d8a6e',
  greenBg: 'rgba(45, 138, 110, 0.08)',
  greenBorder: 'rgba(45, 138, 110, 0.25)',
  yellow: '#c9922a',
  yellowBg: 'rgba(201, 146, 42, 0.08)',
  yellowBorder: 'rgba(201, 146, 42, 0.25)',
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

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function generateWinImage({ marketTitle, outcomeLabel, payout, amountSpent, entryPrice, referralCode }) {
  const size = 1080;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Bone background (warm parchment)
  ctx.fillStyle = C.bone;
  ctx.fillRect(0, 0, size, size);

  // Main card — flat paper surface, no shadow
  const cardX = 56, cardY = 56, cardW = size - 112, cardH = size - 112;
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Gold decorative accent line at top of card
  const accentY = cardY + 48;
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cardX + 80, accentY);
  ctx.lineTo(cardX + cardW - 80, accentY);
  ctx.stroke();

  // Trophy/crown icon in gold
  const cx = size / 2;
  ctx.font = 'bold 48px "Instrument Sans"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.yellow;
  ctx.fillText('★', cx, accentY + 64);

  // "You Won!" — editorial serif headline
  ctx.font = '900 72px "Fraunces"';
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('You Won!', cx, accentY + 168);

  // Market title — body text (Instrument Sans)
  ctx.font = '500 28px "Instrument Sans"';
  ctx.fillStyle = C.inkMuted;
  const titleLines = wrapText(ctx, `“${marketTitle}”`, cardW - 160);
  let titleY = accentY + 216;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, cx, titleY);
    titleY += 38;
  }

  // Payout card — nested paper container with border
  const payCardX = cardX + 56, payCardY = titleY + 24, payCardW = cardW - 112, payCardH = 200;
  roundRect(ctx, payCardX, payCardY, payCardW, payCardH, 16);
  ctx.fillStyle = C.bone;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  // "TOTAL PAYOUT" label — mono label style
  ctx.font = '500 14px "JetBrains Mono"';
  ctx.fillStyle = C.inkMuted;
  ctx.letterSpacing = '1.76px';
  ctx.fillText('TOTAL PAYOUT', cx, payCardY + 48);

  // Payout amount — green, large serif
  ctx.font = '900 80px "Fraunces"';
  ctx.fillStyle = C.green;
  ctx.fillText(`+${payout}`, cx, payCardY + 132);

  // "pts" label beside
  ctx.font = '500 28px "Instrument Sans"';
  ctx.fillStyle = C.inkMuted;
  ctx.fillText('points', cx, payCardY + 172);

  // Profit/invested line
  const profit = payout - amountSpent;
  const statsY = payCardY + payCardH + 40;

  if (profit > 0) {
    ctx.font = '400 24px "Instrument Sans"';
    ctx.fillStyle = C.inkMuted;
    ctx.fillText(`${amountSpent} invested → ${profit} profit`, cx, statsY);
  }

  // Stats row — outcome pill + multiplier pill
  const pillY = statsY + 40;
  const multiplier = amountSpent > 0 ? (payout / amountSpent).toFixed(1) : '0.0';

  // Outcome pill
  ctx.font = 'bold 22px "Instrument Sans"';
  const outcomeW = ctx.measureText(outcomeLabel).width + 40;
  const outcomeX = cx - outcomeW / 2 - 60;
  roundRect(ctx, outcomeX, pillY, outcomeW, 44, 22);
  ctx.fillStyle = C.greenBg;
  ctx.fill();
  ctx.strokeStyle = C.greenBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.textBaseline = 'middle';
  ctx.fillText(outcomeLabel, outcomeX + outcomeW / 2, pillY + 22);

  // Multiplier pill
  const multText = `${multiplier}x`;
  const multW = ctx.measureText(multText).width + 40;
  const multX = cx + 60 - multW / 2;
  roundRect(ctx, multX, pillY, multW, 44, 22);
  ctx.fillStyle = C.yellowBg;
  ctx.fill();
  ctx.strokeStyle = C.yellowBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = C.yellow;
  ctx.fillText(multText, multX + multW / 2, pillY + 22);

  // Entry price (if provided)
  ctx.textBaseline = 'alphabetic';
  if (entryPrice != null) {
    const entryPercent = Math.round(entryPrice * 100);
    ctx.font = '500 20px "JetBrains Mono"';
    ctx.fillStyle = C.inkMuted;
    ctx.fillText(`Entry: ${entryPercent}%`, cx, pillY + 80);
  }

  // Divider
  const dividerY = pillY + 110;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 80, dividerY);
  ctx.lineTo(cardX + cardW - 80, dividerY);
  ctx.stroke();

  // CTA button — emerald primary
  if (referralCode) {
    const btnY = dividerY + 28, btnH = 56;
    roundRect(ctx, cardX + 72, btnY, cardW - 144, btnH, 12);
    ctx.fillStyle = C.emerald;
    ctx.fill();

    ctx.font = 'bold 22px "Instrument Sans"';
    ctx.fillStyle = C.bone;
    ctx.textBaseline = 'middle';
    ctx.fillText(`Predict & Win → iroyinmarket.com/?ref=${referralCode}`, cx, btnY + btnH / 2);
  }

  // Brand footer — editorial serif
  const footerY = cardY + cardH - 48;
  ctx.font = 'bold 22px "Fraunces"';
  ctx.fillStyle = C.inkMuted;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('IroyinMarket', cx, footerY);
  ctx.font = '400 16px "Instrument Sans"';
  ctx.fillStyle = C.inkMuted;
  ctx.fillText('Campus predictions • Real cash prizes', cx, footerY + 28);

  // Gold decorative accent line at bottom
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cardX + 80, footerY + 48);
  ctx.lineTo(cardX + cardW - 80, footerY + 48);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

module.exports = { generateWinImage };
