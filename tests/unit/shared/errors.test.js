const {
  AppError,
  DomainError,
  ValidationError,
  InfrastructureError,
  NotFoundError
} = require('../../../src/shared/errors');

describe('Shared Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AppError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.metadata).toEqual({});
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Test error', 404);

      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom operational flag', () => {
      const error = new AppError('Test error', 500, false);

      expect(error.isOperational).toBe(false);
    });

    it('should create error with metadata', () => {
      const metadata = { userId: 123, action: 'create' };
      const error = new AppError('Test error', 500, true, metadata);

      expect(error.metadata).toEqual(metadata);
    });

    it('should convert error to JSON', () => {
      const error = new AppError('Test error', 400, true, { field: 'email' });
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'AppError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('statusCode', 400);
      expect(json).toHaveProperty('isOperational', true);
      expect(json).toHaveProperty('metadata', { field: 'email' });
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });

    it('should convert error to user-friendly format', () => {
      const error = new AppError('Test error', 400);
      const userFriendly = error.toUserFriendly();

      expect(userFriendly).toHaveProperty('error', 'AppError');
      expect(userFriendly).toHaveProperty('message', 'Test error');
      expect(userFriendly).toHaveProperty('statusCode', 400);
      expect(userFriendly).toHaveProperty('timestamp');
      expect(userFriendly).not.toHaveProperty('stack');
    });

    it('should maintain proper stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toContain('AppError');
      expect(error.stack).toContain('Test error');
    });
  });

  describe('DomainError', () => {
    it('should create domain error with 422 status code', () => {
      const error = new DomainError('Business rule violated');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(DomainError);
      expect(error.name).toBe('DomainError');
      expect(error.message).toBe('Business rule violated');
      expect(error.statusCode).toBe(422);
      expect(error.isOperational).toBe(true);
    });

    it('should create domain error with metadata', () => {
      const metadata = { entity: 'Order', rule: 'mustBeProcessable' };
      const error = new DomainError('Order cannot be processed', metadata);

      expect(error.metadata).toEqual(metadata);
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new DomainError('Test domain error');
      }).toThrow(DomainError);

      expect(() => {
        throw new DomainError('Test domain error');
      }).toThrow('Test domain error');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status code', () => {
      const error = new ValidationError('Validation failed');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.validationErrors).toEqual([]);
    });

    it('should create validation error with validation errors array', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Age must be positive' }
      ];
      const error = new ValidationError('Validation failed', validationErrors);

      expect(error.validationErrors).toEqual(validationErrors);
      expect(error.metadata.validationErrors).toEqual(validationErrors);
    });

    it('should create validation error from field errors', () => {
      const fieldErrors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' }
      ];
      const error = ValidationError.fromFieldErrors(fieldErrors);

      expect(error.message).toBe('Validation failed for 2 field(s)');
      expect(error.validationErrors).toEqual(fieldErrors);
    });

    it('should create validation error for single field', () => {
      const error = ValidationError.forField('email', 'Invalid email format');

      expect(error.message).toBe('Validation failed for field: email');
      expect(error.validationErrors).toEqual([
        { field: 'email', message: 'Invalid email format' }
      ]);
    });
  });

  describe('InfrastructureError', () => {
    it('should create infrastructure error with 503 status code', () => {
      const error = new InfrastructureError('Database connection failed');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(InfrastructureError);
      expect(error.name).toBe('InfrastructureError');
      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(true);
    });

    it('should create infrastructure error with metadata', () => {
      const metadata = { service: 'AFIP', endpoint: '/api/invoices' };
      const error = new InfrastructureError('API call failed', metadata);

      expect(error.metadata).toMatchObject(metadata);
    });

    it('should wrap original error', () => {
      const originalError = new Error('Connection timeout');
      originalError.code = 'ETIMEDOUT';
      const error = new InfrastructureError(
        'Failed to connect to AFIP',
        {},
        originalError
      );

      expect(error.originalError).toBe(originalError);
      expect(error.metadata.originalError).toEqual({
        message: 'Connection timeout',
        name: 'Error',
        code: 'ETIMEDOUT'
      });
    });

    it('should create database infrastructure error', () => {
      const originalError = new Error('SQLITE_ERROR');
      const error = InfrastructureError.database(
        'Failed to query database',
        originalError
      );

      expect(error.message).toBe('Failed to query database');
      expect(error.metadata.subsystem).toBe('database');
      expect(error.originalError).toBe(originalError);
    });

    it('should create external API infrastructure error', () => {
      const originalError = new Error('API timeout');
      const error = InfrastructureError.externalApi(
        'AFIP',
        'Failed to create invoice',
        originalError
      );

      expect(error.message).toBe('Failed to create invoice');
      expect(error.metadata.subsystem).toBe('external-api');
      expect(error.metadata.serviceName).toBe('AFIP');
      expect(error.originalError).toBe(originalError);
    });

    it('should create file system infrastructure error', () => {
      const originalError = new Error('ENOENT');
      const error = InfrastructureError.fileSystem(
        'File not found',
        originalError
      );

      expect(error.message).toBe('File not found');
      expect(error.metadata.subsystem).toBe('file-system');
      expect(error.originalError).toBe(originalError);
    });

    it('should handle null original error', () => {
      const error = new InfrastructureError('Service unavailable', {}, null);

      expect(error.originalError).toBeNull();
      expect(error.metadata.originalError).toBeNull();
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status code', () => {
      const error = new NotFoundError('User', '123');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('User not found: 123');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
      expect(error.resourceType).toBe('User');
      expect(error.identifier).toBe('123');
    });

    it('should create not found error with metadata', () => {
      const metadata = { searchedIn: 'database', timestamp: Date.now() };
      const error = new NotFoundError('Order', 'ORD123', metadata);

      expect(error.metadata).toMatchObject(metadata);
      expect(error.metadata.resourceType).toBe('Order');
      expect(error.metadata.identifier).toBe('ORD123');
    });

    it('should create order not found error', () => {
      const error = NotFoundError.order('12345678901234567890');

      expect(error.message).toBe('Order not found: 12345678901234567890');
      expect(error.resourceType).toBe('Order');
      expect(error.identifier).toBe('12345678901234567890');
    });

    it('should create invoice not found error', () => {
      const error = NotFoundError.invoice('75398279001644');

      expect(error.message).toBe('Invoice not found: 75398279001644');
      expect(error.resourceType).toBe('Invoice');
      expect(error.identifier).toBe('75398279001644');
    });

    it('should create generic resource not found error', () => {
      const error = NotFoundError.resource('Customer', 'CUST999');

      expect(error.message).toBe('Customer not found: CUST999');
      expect(error.resourceType).toBe('Customer');
      expect(error.identifier).toBe('CUST999');
    });

    it('should handle numeric identifier', () => {
      const error = new NotFoundError('Product', 42);

      expect(error.message).toBe('Product not found: 42');
      expect(error.identifier).toBe(42);
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain instanceof relationships', () => {
      const domainError = new DomainError('Test');
      const validationError = new ValidationError('Test');
      const infraError = new InfrastructureError('Test');
      const notFoundError = new NotFoundError('Test', '1');

      expect(domainError).toBeInstanceOf(Error);
      expect(domainError).toBeInstanceOf(AppError);
      expect(domainError).toBeInstanceOf(DomainError);

      expect(validationError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(AppError);
      expect(validationError).toBeInstanceOf(ValidationError);

      expect(infraError).toBeInstanceOf(Error);
      expect(infraError).toBeInstanceOf(AppError);
      expect(infraError).toBeInstanceOf(InfrastructureError);

      expect(notFoundError).toBeInstanceOf(Error);
      expect(notFoundError).toBeInstanceOf(AppError);
      expect(notFoundError).toBeInstanceOf(NotFoundError);
    });

    it('should be catchable as Error', () => {
      expect(() => {
        throw new DomainError('Test');
      }).toThrow(Error);
    });

    it('should be catchable as AppError', () => {
      expect(() => {
        throw new ValidationError('Test');
      }).toThrow(AppError);
    });
  });

  describe('Error metadata and context', () => {
    it('should preserve metadata through error chain', () => {
      const metadata = {
        userId: '123',
        action: 'createInvoice',
        timestamp: Date.now()
      };
      const error = new DomainError('Test', metadata);

      expect(error.metadata).toEqual(metadata);
      expect(error.toJSON().metadata).toEqual(metadata);
    });

    it('should not expose sensitive data in user-friendly format', () => {
      const metadata = {
        internalId: 'secret-123',
        apiKey: 'sensitive-key'
      };
      const error = new AppError('Test', 500, true, metadata);
      const userFriendly = error.toUserFriendly();

      expect(userFriendly).not.toHaveProperty('metadata');
      expect(userFriendly).not.toHaveProperty('stack');
    });
  });
});
