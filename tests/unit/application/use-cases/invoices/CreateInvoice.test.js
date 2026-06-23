'use strict';

const CreateInvoice = require('../../../../../src/application/use-cases/invoices/CreateInvoice');
const Order = require('../../../../../src/domain/entities/Order');
const { DomainError } = require('../../../../../src/shared/errors');

// A valid, unprocessed SELL order dated today so it passes the age check.
const makeOrder = (overrides = {}) => {
  const today = new Date();
  const orderDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return Order.fromJSON({
    orderNumber: '22898552614455627776',
    amount: 100,
    price: 1990,
    totalPrice: 199000,
    asset: 'USDT',
    fiat: 'ARS',
    tradeType: 'SELL',
    createTime: today.getTime(),
    orderDate,
    ...overrides
  });
};

describe('CreateInvoice — failure handling', () => {
  let orderRepository;
  let afipGateway;
  let useCase;

  beforeEach(() => {
    const order = makeOrder();
    orderRepository = {
      findByOrderNumber: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue(undefined)
    };
    afipGateway = {
      createInvoice: jest.fn()
    };
    useCase = new CreateInvoice(orderRepository, afipGateway);
  });

  it('does NOT mark the order processed on a transient infrastructure error', async () => {
    // Simulate the AFIP TLS/DH handshake failure: a generic thrown error.
    const tlsError = new Error('write EPROTO ... dh key too small');
    tlsError.code = 'UNKNOWN_ERROR';
    afipGateway.createInvoice.mockRejectedValue(tlsError);

    await expect(
      useCase.execute({ orderNumber: '22898552614455627776' })
    ).rejects.toThrow('dh key too small');

    // The order must be left untouched so the next run retries it.
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it('marks the order failed on a permanent AFIP rejection error', async () => {
    const rejected = new Error('AFIP rejected the invoice');
    rejected.code = 'AFIP_INVOICE_REJECTED';
    afipGateway.createInvoice.mockRejectedValue(rejected);

    await expect(
      useCase.execute({ orderNumber: '22898552614455627776' })
    ).rejects.toThrow('AFIP rejected the invoice');

    // Permanent failure: the order is recorded as processed-failed.
    expect(orderRepository.update).toHaveBeenCalledTimes(1);
    const savedOrder = orderRepository.update.mock.calls[0][0];
    expect(savedOrder.isProcessed()).toBe(true);
    expect(savedOrder.isFailed()).toBe(true);
  });

  it('marks the order failed on the AFIP "already exists" (10016) error', async () => {
    const dup = new Error('El numero de comprobante no se corresponde con el proximo a autorizar');
    afipGateway.createInvoice.mockRejectedValue(dup);

    await expect(
      useCase.execute({ orderNumber: '22898552614455627776' })
    ).rejects.toThrow();

    expect(orderRepository.update).toHaveBeenCalledTimes(1);
    const savedOrder = orderRepository.update.mock.calls[0][0];
    expect(savedOrder.isFailed()).toBe(true);
    expect(savedOrder.errorMessage).toContain('AFIP sync issue');
  });

  it('does NOT mark the order processed when the AFIP connection drops', async () => {
    const conn = new Error('connect ECONNREFUSED');
    conn.code = 'ECONNREFUSED';
    afipGateway.createInvoice.mockRejectedValue(conn);

    await expect(
      useCase.execute({ orderNumber: '22898552614455627776' })
    ).rejects.toThrow('ECONNREFUSED');

    expect(orderRepository.update).not.toHaveBeenCalled();
  });
});
