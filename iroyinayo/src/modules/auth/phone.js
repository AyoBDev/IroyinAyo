function normalizePhone(raw) {
  let cleaned = String(raw || '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
}

function isValidNigerianNumber(normalized) {
  if (typeof normalized !== 'string') return false;
  if (normalized.length !== 13) return false;
  if (!normalized.startsWith('234')) return false;
  const carrierDigit = normalized[3];
  return carrierDigit === '7' || carrierDigit === '8' || carrierDigit === '9';
}

module.exports = { normalizePhone, isValidNigerianNumber };
