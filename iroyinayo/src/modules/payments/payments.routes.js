const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const paystack = require('./paystack');
const { authenticateStudent } = require('../../middleware/studentAuth');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');

router.get('/banks', authenticateStudent, async (req, res, next) => {
  try {
    const banks = await paystack.listBanks();
    res.json(banks);
  } catch (err) { next(err); }
});

router.post('/verify-account', authenticateStudent, async (req, res, next) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) throw new ValidationError('Account number and bank code required');
    const result = await paystack.verifyAccountNumber(accountNumber, bankCode);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/set-payout-account', authenticateStudent, async (req, res, next) => {
  try {
    const { accountNumber, bankCode, accountName } = req.body;
    if (!accountNumber || !bankCode || !accountName) {
      throw new ValidationError('Account number, bank code, and account name required');
    }

    const recipient = await paystack.createTransferRecipient(accountName, accountNumber, bankCode);

    await db('students').where({ id: req.student.id }).update({
      payout_recipient_code: recipient.recipient_code,
      payout_account_name: accountName,
      payout_bank_code: bankCode,
    });

    res.json({ recipientCode: recipient.recipient_code, accountName });
  } catch (err) { next(err); }
});

router.post('/payout-winner', authenticate, async (req, res, next) => {
  try {
    const { weekStart, amount } = req.body;
    if (!weekStart || !amount) throw new ValidationError('weekStart and amount required');

    const week = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
    if (!week) throw new ValidationError('Week not found');
    if (week.prize_paid) throw new ValidationError('Prize already paid for this week');
    if (!week.winner_id) throw new ValidationError('No winner for this week');

    const winner = await db('students').where({ id: week.winner_id }).first();
    if (!winner.payout_recipient_code) {
      throw new ValidationError('Winner has not set up payout account');
    }

    const transfer = await paystack.initiateTransfer(
      winner.payout_recipient_code,
      amount,
      `IroyinMarket weekly prize — ${week.week_start}`
    );

    await db('weekly_leaderboards').where({ id: week.id }).update({ prize_paid: true });

    res.json({ transfer, winner: winner.name, amount });
  } catch (err) { next(err); }
});

module.exports = router;
