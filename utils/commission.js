// ============================================================
// NaijaWorks — Commission & Fee Utilities
// ============================================================

const config = require('../config/config');

/**
 * Get the commission rate for a worker at a given moment.
 * VIP rate only applies if VIP is currently active.
 */
function getCommissionRate(isVIP, vipEndDate) {
  if (!isVIP) return config.platform.standardCommissionRate;

  const now = new Date();
  const vipEnd = vipEndDate?.toDate ? vipEndDate.toDate() : new Date(vipEndDate);

  if (vipEnd && vipEnd > now) {
    return config.platform.vipCommissionRate;
  }

  return config.platform.standardCommissionRate;
}

/**
 * Calculate commission breakdown for a given price.
 */
function calculateCommission(priceNaira, commissionRate) {
  const commissionAmount = Math.round(priceNaira * commissionRate);
  const workerNetAmount = priceNaira - commissionAmount;
  const commissionPercent = Math.round(commissionRate * 100);

  return {
    agreedPrice: priceNaira,
    commissionRate,
    commissionPercent,
    platformCommissionAmount: commissionAmount,
    workerNetAmount,
  };
}

/**
 * Get withdrawal fee for an amount.
 */
function getWithdrawalFee(amountNaira) {
  const tiers = config.platform.withdrawal.feeTiers;

  for (const tier of tiers) {
    if (amountNaira >= tier.minNaira && amountNaira <= tier.maxNaira) {
      return {
        feeNaira: tier.feeNaira,
        netAmount: amountNaira - tier.feeNaira,
        tier,
      };
    }
  }

  // Above all defined tiers — use the last tier's fee or return error
  const lastTier = tiers[tiers.length - 1];
  if (amountNaira > lastTier.maxNaira) {
    return {
      feeNaira: lastTier.feeNaira,
      netAmount: amountNaira - lastTier.feeNaira,
      tier: lastTier,
      aboveDefinedTiers: true,
    };
  }

  return null; // Below minimum
}

/**
 * Validate withdrawal amount.
 */
function validateWithdrawalAmount(amountNaira) {
  const min = config.platform.withdrawal.minimumNaira;
  if (amountNaira < min) {
    return { valid: false, message: `Minimum withdrawal is ₦${min.toLocaleString()}` };
  }
  const fee = getWithdrawalFee(amountNaira);
  if (!fee) {
    return { valid: false, message: 'Invalid withdrawal amount' };
  }
  return { valid: true, fee };
}

/**
 * Convert naira to kobo (Paystack uses kobo).
 */
function nairaToKobo(naira) {
  return Math.round(naira * 100);
}

/**
 * Convert kobo to naira.
 */
function koboToNaira(kobo) {
  return kobo / 100;
}

module.exports = {
  getCommissionRate,
  calculateCommission,
  getWithdrawalFee,
  validateWithdrawalAmount,
  nairaToKobo,
  koboToNaira,
};
