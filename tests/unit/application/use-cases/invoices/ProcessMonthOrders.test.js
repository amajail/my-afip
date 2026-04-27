'use strict';

const ProcessMonthOrders = require('../../../../../src/application/use-cases/invoices/ProcessMonthOrders');
const { ValidationError } = require('../../../../../src/shared/errors');

const makeOrder = (orderDate, orderNumber = '1234567890') => ({
  orderNumber: { value: orderNumber },
  orderDate,
  canBeProcessed: () => true,
  isSellTrade: () => true,
  isProcessed: () => false,
});

describe('ProcessMonthOrders', () => {
  let orderRepository;
  let afipGateway;
  let useCase;

  beforeEach(() => {
    orderRepository = {
      findUnprocessed: jest.fn(),
      findByOrderNumber: jest.fn(),
      update: jest.fn(),
    };
    afipGateway = {
      createInvoice: jest.fn(),
    };
    useCase = new ProcessMonthOrders(orderRepository, afipGateway);
  });

  describe('validateInput', () => {
    it('should throw ValidationError when input is null', () => {
      expect(() => useCase.validateInput(null)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing year', () => {
      expect(() => useCase.validateInput({ month: 1 })).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing month', () => {
      expect(() => useCase.validateInput({ year: 2026 })).toThrow(ValidationError);
    });

    it('should throw ValidationError for year out of range', () => {
      expect(() => useCase.validateInput({ year: 1999, month: 1 })).toThrow(ValidationError);
      expect(() => useCase.validateInput({ year: 2101, month: 1 })).toThrow(ValidationError);
    });

    it('should throw ValidationError for month out of range', () => {
      expect(() => useCase.validateInput({ year: 2026, month: 0 })).toThrow(ValidationError);
      expect(() => useCase.validateInput({ year: 2026, month: 13 })).toThrow(ValidationError);
    });

    it('should accept valid year and month', () => {
      expect(() => useCase.validateInput({ year: 2026, month: 1 })).not.toThrow();
      expect(() => useCase.validateInput({ year: 2026, month: 12 })).not.toThrow();
    });
  });

  describe('execute', () => {
    it('should return zero counts when no pending orders in the month', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([
        makeOrder('2026-02-15', '111'),
      ]);

      const result = await useCase.execute({ year: 2026, month: 1 });

      expect(result).toEqual({ year: 2026, month: 1, totalOrders: 0, processedOrders: 0, failedOrders: 0, results: [] });
    });

    it('should return zero counts when no unprocessed orders exist', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([]);

      const result = await useCase.execute({ year: 2026, month: 1 });

      expect(result.totalOrders).toBe(0);
      expect(result.processedOrders).toBe(0);
    });

    it('should filter orders to the requested month only', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([
        makeOrder('2026-01-10', '111'),
        makeOrder('2026-02-05', '222'),
        makeOrder('2026-01-20', '333'),
      ]);

      const createSpy = jest.spyOn(useCase.createInvoiceUseCase, 'execute').mockResolvedValue({
        orderNumber: '111', success: true, cae: 'CAE123', error: null,
      });

      await useCase.execute({ year: 2026, month: 1 });

      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('should sort orders by orderDate ascending before processing', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([
        makeOrder('2026-01-20', '333'),
        makeOrder('2026-01-05', '111'),
        makeOrder('2026-01-15', '222'),
      ]);

      const processedOrder = [];
      jest.spyOn(useCase.createInvoiceUseCase, 'execute').mockImplementation(async ({ orderNumber }) => {
        processedOrder.push(orderNumber);
        return { orderNumber, success: true, cae: 'CAE', error: null };
      });

      await useCase.execute({ year: 2026, month: 1 });

      expect(processedOrder).toEqual(['111', '222', '333']);
    });

    it('should pass skipAgeCheck: true to CreateInvoice', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([makeOrder('2026-01-10', '111')]);

      const createSpy = jest.spyOn(useCase.createInvoiceUseCase, 'execute').mockResolvedValue({
        orderNumber: '111', success: true, cae: 'CAE123', error: null,
      });

      await useCase.execute({ year: 2026, month: 1 });

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ skipAgeCheck: true }));
    });

    it('should count successful and failed orders correctly', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([
        makeOrder('2026-01-10', '111'),
        makeOrder('2026-01-15', '222'),
        makeOrder('2026-01-20', '333'),
      ]);

      jest.spyOn(useCase.createInvoiceUseCase, 'execute')
        .mockResolvedValueOnce({ orderNumber: '111', success: true, cae: 'CAE1', error: null })
        .mockResolvedValueOnce({ orderNumber: '222', success: false, cae: null, error: 'AFIP error' })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await useCase.execute({ year: 2026, month: 1 });

      expect(result.totalOrders).toBe(3);
      expect(result.processedOrders).toBe(1);
      expect(result.failedOrders).toBe(2);
      expect(result.results).toHaveLength(3);
    });

    it('should handle thrown errors from CreateInvoice without aborting remaining orders', async () => {
      orderRepository.findUnprocessed.mockResolvedValue([
        makeOrder('2026-01-10', '111'),
        makeOrder('2026-01-20', '222'),
      ]);

      jest.spyOn(useCase.createInvoiceUseCase, 'execute')
        .mockRejectedValueOnce(new Error('AFIP down'))
        .mockResolvedValueOnce({ orderNumber: '222', success: true, cae: 'CAE2', error: null });

      const result = await useCase.execute({ year: 2026, month: 1 });

      expect(result.processedOrders).toBe(1);
      expect(result.failedOrders).toBe(1);
      expect(result.results[0]).toMatchObject({ orderNumber: '111', success: false, error: 'AFIP down' });
      expect(result.results[1]).toMatchObject({ orderNumber: '222', success: true });
    });
  });
});
