const { proto } = require('@whiskeysockets/baileys');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const db = require('../config/database');

async function usePostgresAuthState() {
  async function readData(key) {
    const row = await db('baileys_auth').where({ key }).first();
    if (!row) return null;
    return JSON.parse(JSON.stringify(row.value), BufferJSON.reviver);
  }

  async function writeData(key, value) {
    const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
    await db('baileys_auth')
      .insert({ key, value: serialized, updated_at: new Date() })
      .onConflict('key')
      .merge({ value: serialized, updated_at: new Date() });
  }

  async function removeData(key) {
    await db('baileys_auth').where({ key }).del();
  }

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          for (const id of ids) {
            const value = await readData(`${type}-${id}`);
            if (value) {
              if (type === 'app-state-sync-key') {
                result[id] = proto.Message.AppStateSyncKeyData.fromObject(value);
              } else {
                result[id] = value;
              }
            }
          }
          return result;
        },
        set: async (data) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              const key = `${type}-${id}`;
              if (value) {
                await writeData(key, value);
              } else {
                await removeData(key);
              }
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
  };
}

module.exports = { usePostgresAuthState };
