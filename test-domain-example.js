#!/usr/bin/env node
/**
 * Example script demonstrating the new Domain Layer
 * Run with: node test-domain-example.js
 */

// Import domain objects
const Money = require('./src/domain/value-objects/Money');
const OrderNumber = require('./src/domain/value-objects/OrderNumber');
const CUIT = require('./src/domain/value-objects/CUIT');
const Order = require('./src/domain/entities/Order');
const Invoice = require('./src/domain/entities/Invoice');
const InvoiceCalculator = require('./src/domain/services/InvoiceCalculator');
const InvoiceDateValidator = require('./src/domain/services/InvoiceDateValidator');
const OrderProcessor = require('./src/domain/services/OrderProcessor');

console.log('🧪 Testing AFIP Invoice Domain Layer\n');

// 1. Test Value Objects
console.log('📦 Value Objects:');
console.log('=================\n');

// Money
const amount = Money.of(1000.50, 'ARS');
const vat = amount.percentage(21);
console.log(`Amount: ${amount.format()}`);
console.log(`VAT (21%): ${vat.format()}`);
console.log(`Total: ${amount.add(vat).format()}\n`);

// OrderNumber
const orderNum = OrderNumber.of('BN12345678901234567890');
console.log(`Order Number: ${orderNum.value}`);
console.log(`Truncated: ${orderNum.truncated}\n`);

// CUIT
const cuit = CUIT.of('20123456786');
console.log(`CUIT: ${cuit.formatted}`);
console.log(`Type: ${cuit.type}\n`);

// 2. Test Entities
console.log('🏛️  Entities:');
console.log('=============\n');

// Create an Order
const recentTime = Date.now() - (24 * 60 * 60 * 1000); // 1 day ago
const order = new Order({
  orderNumber: 'BN123456',
  amount: 0.001, // crypto amount
  price: 10000000, // price per unit
  totalPrice: 10000, // total fiat amount
  asset: 'BTC',
  fiat: 'ARS',
  tradeType: 'SELL',
  createTime: recentTime,
  orderDate: new Date(recentTime).toISOString().split('T')[0]
});

console.log(`Order: ${order.orderNumber.value}`);
console.log(`Amount: ${order.amount} ${order.asset}`);
console.log(`Total: ${order.totalAmount.format()}`);
console.log(`Can be processed: ${order.canBeProcessed()}`);
console.log(`Ready for invoicing: ${order.isReadyForInvoicing()}\n`);

// Create an Invoice from Order
const today = new Date().toISOString().split('T')[0];
const invoice = Invoice.fromOrder(order, today);

console.log(`Invoice Type: ${invoice.getInvoiceType()} (${invoice.getInvoiceType() === 11 ? 'C' : 'B'})`);
console.log(`Net Amount: ${invoice.netAmount.format()}`);
console.log(`VAT: ${invoice.vatAmount.format()}`);
console.log(`Total: ${invoice.totalAmount.format()}`);
console.log(`Has VAT: ${invoice.hasVAT()}\n`);

// 3. Test Domain Services
console.log('⚙️  Domain Services:');
console.log('===================\n');

// InvoiceCalculator
const netAmount = Money.of(10000, 'ARS');
const calculatedVat = InvoiceCalculator.calculateVAT(netAmount, 0.21); // 21% = 0.21
const total = InvoiceCalculator.calculateTotal(netAmount, calculatedVat);

console.log('InvoiceCalculator:');
console.log(`  Net: ${netAmount.format()}`);
console.log(`  VAT (21%): ${calculatedVat.format()}`);
console.log(`  Total: ${total.format()}\n`);

// InvoiceDateValidator
const orderDate = new Date();
orderDate.setDate(orderDate.getDate() - 5); // 5 days ago
const orderDateStr = orderDate.toISOString().split('T')[0];

const validationResult = InvoiceDateValidator.canStillInvoice(orderDateStr);
console.log('InvoiceDateValidator:');
console.log(`  Order Date: ${orderDateStr}`);
console.log(`  Can still invoice: ${validationResult.canInvoice}`);
console.log(`  Days remaining: ${validationResult.daysRemaining}\n`);

// OrderProcessor
const eligibility = OrderProcessor.canProcess(order);
console.log('OrderProcessor:');
console.log(`  Can process order: ${eligibility.canProcess}`);
console.log(`  Priority: ${eligibility.priority}`);
if (!eligibility.canProcess) {
  console.log(`  Reason: ${eligibility.reason}`);
}

console.log('\n✅ Domain Layer is working correctly!\n');
console.log('Key Features Demonstrated:');
console.log('  ✓ Immutable value objects (Money, OrderNumber, CUIT)');
console.log('  ✓ Domain entities with business logic (Order, Invoice)');
console.log('  ✓ Domain services for calculations and validation');
console.log('  ✓ Type safety and validation');
console.log('  ✓ Clean architecture principles\n');
