/**
 * GenerateMonthlyReport Use Case Tests
 *
 * Tests for the GenerateMonthlyReport use case
 */

const GenerateMonthlyReport = require('../../../../../src/application/use-cases/reports/GenerateMonthlyReport');
const Order = require('../../../../../src/domain/entities/Order');

describe('GenerateMonthlyReport Use Case', () => {
  let mockOrderRepository;
  let useCase;

  beforeEach(() => {
    mockOrderRepository = {
      findByDateRange: jest.fn()
    };
    useCase = new GenerateMonthlyReport(mockOrderRepository);
  });

  describe('execute', () => {
    it('should generate report for current month by default', async () => {
      const mockOrders = [
        new Order({
          orderNumber: 'ORD-001',
          amount: 0.001,
          price: 100000,
          totalPrice: 100,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0],
          processedAt: new Date(),
          success: true,
          cae: '12345678901234',
          voucherNumber: 1
        })
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await useCase.execute();

      expect(result).toHaveProperty('year');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('orders');
      expect(result.stats.totalOrders).toBe(1);
      expect(result.orders[0]).toHaveProperty('voucherNumber', 1);
    });

    it('should include voucherNumber in formatted order details', async () => {
      const mockOrders = [
        new Order({
          orderNumber: 'ORD-002',
          amount: 0.002,
          price: 100000,
          totalPrice: 200,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0],
          processedAt: new Date(),
          success: true,
          voucherNumber: 42
        })
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await useCase.execute();

      expect(result.orders[0]).toHaveProperty('voucherNumber', 42);
    });

    it('should handle orders without voucher number', async () => {
      const mockOrders = [
        new Order({
          orderNumber: 'ORD-003',
          amount: 0.001,
          price: 100000,
          totalPrice: 100,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0]
        })
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await useCase.execute();

      expect(result.orders[0]).toHaveProperty('voucherNumber', null);
    });

    it('should handle empty orders array', async () => {
      mockOrderRepository.findByDateRange.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.stats.totalOrders).toBe(0);
      expect(result.orders).toEqual([]);
    });

    it('should accept custom year and month', async () => {
      mockOrderRepository.findByDateRange.mockResolvedValue([]);

      const result = await useCase.execute({ year: 2024, month: 6 });

      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
    });

    it('should calculate statistics correctly', async () => {
      const mockOrders = [
        new Order({
          orderNumber: 'ORD-004',
          amount: 0.001,
          price: 100000,
          totalPrice: 100,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0],
          processedAt: new Date(),
          success: true
        }),
        new Order({
          orderNumber: 'ORD-005',
          amount: 0.002,
          price: 100000,
          totalPrice: 200,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0],
          processedAt: new Date(),
          success: false
        }),
        new Order({
          orderNumber: 'ORD-006',
          amount: 0.001,
          price: 100000,
          totalPrice: 100,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0]
        })
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await useCase.execute();

      expect(result.stats.totalOrders).toBe(3);
      expect(result.stats.successfulInvoices).toBe(1);
      expect(result.stats.failedInvoices).toBe(1);
      expect(result.stats.pendingOrders).toBe(1);
      expect(result.stats.totalAmount).toBe(400);
    });
  });

  describe('validation', () => {
    it('should validate year parameter', async () => {
      await expect(useCase.execute({ year: 1999 })).rejects.toThrow('year must be a number between 2000 and 2100');
    });

    it('should validate month parameter', async () => {
      await expect(useCase.execute({ month: 13 })).rejects.toThrow('month must be a number between 1 and 12');
    });

    it('should validate month lower bound', async () => {
      await expect(useCase.execute({ month: 0 })).rejects.toThrow('month must be a number between 1 and 12');
    });
  });
});
