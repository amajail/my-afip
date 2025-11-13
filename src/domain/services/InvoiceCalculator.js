/**
 * InvoiceCalculator Domain Service
 *
 * Stateless service for invoice-related calculations.
 * Contains business logic for VAT, amounts, and pricing calculations.
 */

const Money = require('../value-objects/Money');
const { ValidationError } = require('../../shared/errors');

/**
 * Domain service for invoice calculations
 */
class InvoiceCalculator {
  /**
   * Standard VAT rates in Argentina
   */
  static VAT_RATES = {
    STANDARD: 0.21,    // 21% - Most goods and services
    REDUCED: 0.105,    // 10.5% - Reduced rate
    ZERO: 0            // 0% - Exempt or zero-rated
  };

  /**
   * Calculate VAT amount from net amount
   * @param {Money} netAmount - Net amount before VAT
   * @param {number} vatRate - VAT rate (e.g., 0.21 for 21%)
   * @returns {Money} VAT amount
   * @throws {ValidationError} If inputs are invalid
   */
  static calculateVAT(netAmount, vatRate = InvoiceCalculator.VAT_RATES.STANDARD) {
    if (!(netAmount instanceof Money)) {
      throw ValidationError.forField('netAmount', 'Must be a Money instance');
    }

    if (vatRate < 0 || vatRate > 1) {
      throw ValidationError.forField('vatRate', 'Must be between 0 and 1');
    }

    const vatAmount = netAmount.amount * vatRate;
    return new Money(vatAmount, netAmount.currency);
  }

  /**
   * Calculate total amount (net + VAT)
   * @param {Money} netAmount - Net amount before VAT
   * @param {Money} vatAmount - VAT amount
   * @returns {Money} Total amount
   * @throws {ValidationError} If inputs are invalid
   */
  static calculateTotal(netAmount, vatAmount) {
    if (!(netAmount instanceof Money) || !(vatAmount instanceof Money)) {
      throw ValidationError.forField('amount', 'Both amounts must be Money instances');
    }

    return netAmount.add(vatAmount);
  }

  /**
   * Calculate net amount from total when VAT rate is known
   * @param {Money} totalAmount - Total amount including VAT
   * @param {number} vatRate - VAT rate (e.g., 0.21 for 21%)
   * @returns {Money} Net amount before VAT
   * @throws {ValidationError} If inputs are invalid
   */
  static calculateNetFromTotal(totalAmount, vatRate = InvoiceCalculator.VAT_RATES.STANDARD) {
    if (!(totalAmount instanceof Money)) {
      throw ValidationError.forField('totalAmount', 'Must be a Money instance');
    }

    if (vatRate < 0 || vatRate > 1) {
      throw ValidationError.forField('vatRate', 'Must be between 0 and 1');
    }

    const netAmount = totalAmount.amount / (1 + vatRate);
    return new Money(netAmount, totalAmount.currency);
  }

  /**
   * Calculate VAT amount from total when VAT rate is known
   * @param {Money} totalAmount - Total amount including VAT
   * @param {number} vatRate - VAT rate (e.g., 0.21 for 21%)
   * @returns {Money} VAT amount
   */
  static calculateVATFromTotal(totalAmount, vatRate = InvoiceCalculator.VAT_RATES.STANDARD) {
    const netAmount = InvoiceCalculator.calculateNetFromTotal(totalAmount, vatRate);
    return totalAmount.subtract(netAmount);
  }

  /**
   * Split total amount into net and VAT components
   * @param {Money} totalAmount - Total amount including VAT
   * @param {number} vatRate - VAT rate (e.g., 0.21 for 21%)
   * @returns {{net: Money, vat: Money, total: Money}} Amount breakdown
   */
  static splitTotal(totalAmount, vatRate = InvoiceCalculator.VAT_RATES.STANDARD) {
    const netAmount = InvoiceCalculator.calculateNetFromTotal(totalAmount, vatRate);
    const vatAmount = InvoiceCalculator.calculateVAT(netAmount, vatRate);

    return {
      net: netAmount,
      vat: vatAmount,
      total: totalAmount
    };
  }

  /**
   * Determine if VAT should be applied based on amount and business rules
   * @param {Money} amount - Transaction amount
   * @param {Object} options - Additional options
   * @param {boolean} [options.isMonotributista=true] - Whether seller is Monotributista
   * @param {boolean} [options.isFinalConsumer=true] - Whether buyer is final consumer
   * @returns {boolean} Whether VAT should be applied
   */
  static shouldApplyVAT(amount, options = {}) {
    const { isMonotributista = true, isFinalConsumer = true } = options;

    // Monotributistas selling to final consumers don't charge VAT (Type C invoices)
    if (isMonotributista && isFinalConsumer) {
      return false;
    }

    // Other cases may require VAT
    return true;
  }

  /**
   * Calculate invoice amounts with appropriate VAT
   * @param {Money} totalAmount - Total transaction amount
   * @param {Object} options - Calculation options
   * @param {boolean} [options.includeVAT=false] - Whether to include VAT
   * @param {number} [options.vatRate] - VAT rate to use
   * @returns {{netAmount: Money, vatAmount: Money, totalAmount: Money}} Invoice amounts
   */
  static calculateInvoiceAmounts(totalAmount, options = {}) {
    const {
      includeVAT = false,
      vatRate = InvoiceCalculator.VAT_RATES.STANDARD
    } = options;

    if (!includeVAT) {
      // No VAT - net equals total
      return {
        netAmount: totalAmount,
        vatAmount: new Money(0, totalAmount.currency),
        totalAmount: totalAmount
      };
    }

    // Split total into net and VAT
    return InvoiceCalculator.splitTotal(totalAmount, vatRate);
  }

  /**
   * Round money amount to specified decimal places
   * @param {Money} amount - Amount to round
   * @param {number} [decimals=2] - Number of decimal places
   * @returns {Money} Rounded amount
   */
  static roundAmount(amount, decimals = 2) {
    if (!(amount instanceof Money)) {
      throw ValidationError.forField('amount', 'Must be a Money instance');
    }

    const multiplier = Math.pow(10, decimals);
    const roundedAmount = Math.round(amount.amount * multiplier) / multiplier;
    return new Money(roundedAmount, amount.currency);
  }

  /**
   * Validate that amounts are consistent (net + VAT = total)
   * @param {Money} netAmount - Net amount
   * @param {Money} vatAmount - VAT amount
   * @param {Money} totalAmount - Total amount
   * @param {number} [tolerance=0.01] - Acceptable difference due to rounding
   * @returns {boolean} Whether amounts are consistent
   */
  static validateAmounts(netAmount, vatAmount, totalAmount, tolerance = 0.01) {
    const calculatedTotal = netAmount.add(vatAmount);
    const difference = Math.abs(calculatedTotal.amount - totalAmount.amount);
    return difference <= tolerance;
  }
}

module.exports = InvoiceCalculator;
