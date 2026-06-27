function getMondayInWAT(now) {
  const ref = now || new Date();
  // Shift the UTC timestamp by +1h to get WAT wall-clock time.
  const wat = new Date(ref.getTime() + 60 * 60 * 1000);
  // getUTCDay() now reflects the WAT day-of-week because we shifted UTC by WAT offset.
  const dayOfWeek = wat.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon -> 0, Tue -> 1, ..., Sun -> 6
  const monday = new Date(wat);
  monday.setUTCDate(wat.getUTCDate() - daysSinceMonday);
  // Format as YYYY-MM-DD using the WAT-shifted date components.
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { getMondayInWAT };
