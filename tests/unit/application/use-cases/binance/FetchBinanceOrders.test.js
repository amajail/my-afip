const FetchBinanceOrders = require('../../../../../src/application/use-cases/binance/FetchBinanceOrders');
const Order = require('../../../../../src/domain/entities/Order');

describe('FetchBinanceOrders Use Case', () => {
  let useCase;
  let mockBinanceGateway;
  let mockOrderRepository;

  beforeEach(() => {
    // Mock Binance Gateway
    mockBinanceGateway = {
      fetchOrders: jest.fn()
    };

    // Mock Order Repository
    mockOrderRepository = {
      findByOrderNumber: jest.fn(),
      saveMany: jest.fn()
    };

    useCase = new FetchBinanceOrders(mockBinanceGateway, mockOrderRepository);
  });

  describe('execute', () => {
    it('should fetch and save new orders successfully', async () => {
      // Arrange
      const mockBinanceOrders = [
        {
          orderNumber: 'BN123',
          amount: 0.001,
          price: 10000,
          totalPrice: 10,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0]
        },
        {
          orderNumber: 'BN456',
          amount: 0.002,
          price: 10000,
          totalPrice: 20,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0]
        }
      ];

      mockBinanceGateway.fetchOrders.mockResolvedValue(mockBinanceOrders);
      mockOrderRepository.findByOrderNumber.mockResolvedValue(null); // No existing orders
      mockOrderRepository.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute({ days: 7, tradeType: 'SELL' });

      // Assert
      expect(result).toEqual({
        totalOrders: 2,
        newOrders: 2,
        existingOrders: 0
      });

      expect(mockBinanceGateway.fetchOrders).toHaveBeenCalledWith(7, 'SELL');
      expect(mockOrderRepository.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Order),
          expect.any(Order)
        ])
      );
    });

    it('should filter out existing orders', async () => {
      // Arrange
      const mockBinanceOrders = [
        {
          orderNumber: 'BN123',
          amount: 0.001,
          price: 10000,
          totalPrice: 10,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0]
        },
        {
          orderNumber: 'BN456',
          amount: 0.002,
          price: 10000,
          totalPrice: 20,
          asset: 'BTC',
          fiat: 'ARS',
          tradeType: 'SELL',
          createTime: Date.now(),
          orderDate: new Date().toISOString().split('T')[0]
        }
      ];

      mockBinanceGateway.fetchOrders.mockResolvedValue(mockBinanceOrders);

      // First order exists, second doesn't
      mockOrderRepository.findByOrderNumber
        .mockResolvedValueOnce(new Order(mockBinanceOrders[0])) // BN123 exists
        .mockResolvedValueOnce(null); // BN456 doesn't exist

      mockOrderRepository.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute({ days: 7, tradeType: 'SELL' });

      // Assert
      expect(result).toEqual({
        totalOrders: 2,
        newOrders: 1,
        existingOrders: 1
      });

      expect(mockOrderRepository.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            orderNumber: expect.objectContaining({ value: 'BN456' })
          })
        ])
      );
    });

    it('should handle empty result from Binance', async () => {
      // Arrange
      mockBinanceGateway.fetchOrders.mockResolvedValue([]);

      // Act
      const result = await useCase.execute({ days: 7 });

      // Assert
      expect(result).toEqual({
        totalOrders: 0,
        newOrders: 0,
        existingOrders: 0
      });

      expect(mockOrderRepository.saveMany).not.toHaveBeenCalled();
    });

    it('should use default parameters when not provided', async () => {
      // Arrange
      mockBinanceGateway.fetchOrders.mockResolvedValue([]);

      // Act
      await useCase.execute();

      // Assert
      expect(mockBinanceGateway.fetchOrders).toHaveBeenCalledWith(7, 'SELL');
    });

    it('should validate days parameter', async () => {
      // Assert
      await expect(useCase.execute({ days: -1 })).rejects.toThrow('days must be a number between 1 and 90');
      await expect(useCase.execute({ days: 100 })).rejects.toThrow('days must be a number between 1 and 90');
    });

    it('should validate tradeType parameter', async () => {
      // Assert
      await expect(useCase.execute({ tradeType: 'INVALID' })).rejects.toThrow('tradeType must be one of: SELL, BUY');
    });
  });
});
