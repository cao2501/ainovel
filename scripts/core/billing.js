/**
 * AI Novel Studio - Billing & VietQR Payment Engine
 * Handles Coin Metering, Topups, VietQR dynamic links, and Packages
 */

import { BILLING_CONFIG } from '../config.js';
import { storage } from './storage.js';

export class BillingEngine {
  static getPackages() {
    return BILLING_CONFIG.PACKAGES;
  }

  static getCosts() {
    return BILLING_CONFIG.COSTS;
  }

  /**
   * Generates a dynamic VietQR image URL for instant bank transfer
   */
  static generateVietQrUrl({
    bankId = 'MB',
    accountNumber = '0399888999',
    accountName = 'AI NOVEL VIETNAM',
    amount = 50000,
    memo = ''
  }) {
    const userCode = memo || 'TRUYEN' + Math.floor(1000 + Math.random() * 9000);
    const encodedMemo = encodeURIComponent(`NAPXU ${userCode}`);
    const encodedName = encodeURIComponent(accountName);
    
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${encodedName}`;

    return {
      qrUrl,
      bankId,
      accountNumber,
      accountName,
      amount,
      memo: `NAPXU ${userCode}`,
      formattedAmount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
    };
  }

  /**
   * Checks if user has enough coins for a specific action
   */
  static checkFunds(actionKey) {
    const cost = BILLING_CONFIG.COSTS[actionKey] || 1.0;
    const wallet = storage.getWallet();
    return {
      hasFunds: wallet.balance >= cost,
      cost,
      balance: wallet.balance,
      remainingAfter: wallet.balance - cost
    };
  }

  /**
   * Executes deduction of coins
   */
  static charge(actionKey, description) {
    const cost = BILLING_CONFIG.COSTS[actionKey] || 1.0;
    return storage.deductCoins(cost, description);
  }

  /**
   * Simulates immediate top-up
   */
  static simulateTopup(packageId) {
    const pkg = BILLING_CONFIG.PACKAGES.find(p => p.id === packageId) || BILLING_CONFIG.PACKAGES[0];
    const res = storage.addCoins(pkg.coins, `Nạp gói [${pkg.name}] qua VietQR (+${pkg.coins} Xu)`);
    return {
      ...res,
      package: pkg
    };
  }
}
