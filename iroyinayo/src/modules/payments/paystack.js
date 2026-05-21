const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const BASE_URL = 'https://api.paystack.co';

async function paystackRequest(path, options = {}) {
  if (!PAYSTACK_SECRET) throw new Error('PAYSTACK_SECRET_KEY not configured');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Paystack request failed');
  return data.data;
}

async function createTransferRecipient(name, accountNumber, bankCode) {
  return paystackRequest('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    }),
  });
}

async function initiateTransfer(recipientCode, amount, reason) {
  return paystackRequest('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: amount * 100,
      recipient: recipientCode,
      reason,
    }),
  });
}

async function verifyAccountNumber(accountNumber, bankCode) {
  return paystackRequest(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
}

async function listBanks() {
  return paystackRequest('/bank?country=nigeria&perPage=100');
}

module.exports = { createTransferRecipient, initiateTransfer, verifyAccountNumber, listBanks };
