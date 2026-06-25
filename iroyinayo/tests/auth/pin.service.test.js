const bcrypt = require('bcrypt');

jest.mock('../../src/config/database', () => {
  const fn = jest.fn();
  return fn;
});

const db = require('../../src/config/database');
const { setPin, verifyPin } = require('../../src/modules/auth/pin.service');

function setDb(impl) {
  db.mockImplementation(impl);
}

beforeEach(() => {
  db.mockReset();
});

describe('setPin', () => {
  test('hashes a valid 6-digit PIN and resets attempts', async () => {
    let updatePayload;
    let whereCond;
    setDb((table) => {
      expect(table).toBe('students');
      return {
        where: (cond) => {
          whereCond = cond;
          return {
            update: async (data) => {
              updatePayload = data;
              return 1;
            },
          };
        },
      };
    });

    await setPin({ authUserId: 'user-1', pin: '123456' });

    expect(whereCond).toEqual({ auth_user_id: 'user-1' });
    expect(updatePayload.pin_failed_attempts).toBe(0);
    expect(updatePayload.pin_hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    const matches = await bcrypt.compare('123456', updatePayload.pin_hash);
    expect(matches).toBe(true);
  });

  test('rejects a 5-digit PIN', async () => {
    await expect(setPin({ authUserId: 'user-1', pin: '12345' })).rejects.toThrow(/6 digits/);
  });

  test('rejects an alphanumeric PIN', async () => {
    await expect(setPin({ authUserId: 'user-1', pin: 'abcdef' })).rejects.toThrow(/6 digits/);
  });

  test('rejects a missing PIN', async () => {
    await expect(setPin({ authUserId: 'user-1', pin: undefined })).rejects.toThrow(/6 digits/);
  });
});

describe('verifyPin', () => {
  function makeStudentRow({ pinHash = null, failedAttempts = 0 } = {}) {
    return {
      auth_user_id: 'user-1',
      pin_hash: pinHash,
      pin_failed_attempts: failedAttempts,
    };
  }

  test('returns NO_PIN when student has no pin_hash', async () => {
    setDb(() => ({
      where: () => ({
        first: async () => makeStudentRow({ pinHash: null }),
      }),
    }));

    const result = await verifyPin({ authUserId: 'user-1', pin: '123456' });
    expect(result).toEqual({ ok: false, code: 'NO_PIN' });
  });

  test('returns PIN_LOCKED when already at 3 failures (no bcrypt call)', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    const hash = await bcrypt.hash('123456', 10);
    setDb(() => ({
      where: () => ({
        first: async () => makeStudentRow({ pinHash: hash, failedAttempts: 3 }),
      }),
    }));

    const result = await verifyPin({ authUserId: 'user-1', pin: '123456' });
    expect(result).toEqual({ ok: false, code: 'PIN_LOCKED' });
    expect(compareSpy).not.toHaveBeenCalled();
    compareSpy.mockRestore();
  });

  test('returns ok: true on correct PIN and resets counter', async () => {
    const hash = await bcrypt.hash('123456', 10);
    let updatePayload;
    setDb(() => ({
      where: () => ({
        first: async () => makeStudentRow({ pinHash: hash, failedAttempts: 1 }),
        update: async (data) => {
          updatePayload = data;
          return 1;
        },
      }),
    }));

    const result = await verifyPin({ authUserId: 'user-1', pin: '123456' });
    expect(result).toEqual({ ok: true });
    expect(updatePayload).toEqual({ pin_failed_attempts: 0 });
  });

  test('returns PIN_INVALID on wrong PIN and increments counter (1 of 3)', async () => {
    const hash = await bcrypt.hash('123456', 10);
    setDb(() => ({
      where: () => ({
        first: async () => makeStudentRow({ pinHash: hash, failedAttempts: 0 }),
        increment: async (col, by) => {
          expect(col).toBe('pin_failed_attempts');
          expect(by).toBe(1);
          return 1;
        },
      }),
    }));

    const result = await verifyPin({ authUserId: 'user-1', pin: '999999' });
    expect(result).toEqual({ ok: false, code: 'PIN_INVALID', attemptsRemaining: 2 });
  });

  test('returns PIN_LOCKED on the third wrong attempt', async () => {
    const hash = await bcrypt.hash('123456', 10);
    setDb(() => ({
      where: () => ({
        first: async () => makeStudentRow({ pinHash: hash, failedAttempts: 2 }),
        increment: async () => 1,
      }),
    }));

    const result = await verifyPin({ authUserId: 'user-1', pin: '999999' });
    expect(result).toEqual({ ok: false, code: 'PIN_LOCKED' });
  });

  test('returns PIN_INVALID for malformed PIN input and still increments counter', async () => {
    const hash = await bcrypt.hash('123456', 10);
    let incrementCalled = false;
    setDb(() => ({
      where: () => ({
        first: async () => makeStudentRow({ pinHash: hash, failedAttempts: 0 }),
        increment: async () => { incrementCalled = true; return 1; },
      }),
    }));

    const result = await verifyPin({ authUserId: 'user-1', pin: 'abcdef' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('PIN_INVALID');
    expect(incrementCalled).toBe(true);
  });
});
