/**
 * InvoiceResult Entity Tests
 */

const InvoiceResult = require('../../../../src/domain/entities/InvoiceResult');
const CAE = require('../../../../src/domain/value-objects/CAE');
const { ValidationError } = require('../../../../src/shared/errors');

describe('InvoiceResult Entity', () => {
  describe('constructor', () => {
    test('should create successful InvoiceResult', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        caeExpiration: '2025-01-31',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };

      const result = new InvoiceResult(data);

      expect(result.success).toBe(true);
      expect(result.cae).toBeInstanceOf(CAE);
      expect(result.cae.value).toBe('12345678901234');
      expect(result.voucherNumber).toBe(100);
      expect(result.invoiceDate).toBe('2025-01-15');
      expect(result.errorMessage).toBeNull();
    });

    test('should create failed InvoiceResult', () => {
      const data = {
        success: false,
        errorMessage: 'AFIP Error',
        errors: ['Error 1', 'Error 2']
      };

      const result = new InvoiceResult(data);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('AFIP Error');
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
      expect(result.cae).toBeNull();
    });

    test('should throw ValidationError if successful result missing CAE', () => {
      const data = {
        success: true,
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };

      expect(() => new InvoiceResult(data)).toThrow(ValidationError);
    });

    test('should throw ValidationError if successful result missing voucher number', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        invoiceDate: '2025-01-15'
      };

      expect(() => new InvoiceResult(data)).toThrow(ValidationError);
    });

    test('should throw ValidationError if failed result missing error', () => {
      const data = {
        success: false
      };

      expect(() => new InvoiceResult(data)).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);

      const oldSuccess = result.success;
      result._success = false; // Attempt to mutate
      expect(result.success).toBe(oldSuccess); // Should remain unchanged
    });
  });

  describe('isSuccessful', () => {
    test('should return true for successful result', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);

      expect(result.isSuccessful()).toBe(true);
    });

    test('should return false for failed result', () => {
      const data = {
        success: false,
        errorMessage: 'Error'
      };
      const result = new InvoiceResult(data);

      expect(result.isSuccessful()).toBe(false);
    });
  });

  describe('isFailed', () => {
    test('should return true for failed result', () => {
      const data = {
        success: false,
        errorMessage: 'Error'
      };
      const result = new InvoiceResult(data);

      expect(result.isFailed()).toBe(true);
    });
  });

  describe('isCAEExpired', () => {
    test('should return false for non-expired CAE', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const data = {
        success: true,
        cae: '12345678901234',
        caeExpiration: futureDate.toISOString().split('T')[0],
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);

      expect(result.isCAEExpired()).toBe(false);
    });

    test('should return true for expired CAE', () => {
      const pastDate = '2020-01-01';
      const data = {
        success: true,
        cae: '12345678901234',
        caeExpiration: pastDate,
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);

      expect(result.isCAEExpired()).toBe(true);
    });

    test('should return false when no CAE', () => {
      const data = {
        success: false,
        errorMessage: 'Error'
      };
      const result = new InvoiceResult(data);

      expect(result.isCAEExpired()).toBe(false);
    });
  });

  describe('hasObservations', () => {
    test('should return true when observations exist', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15',
        observations: ['Obs 1', 'Obs 2']
      };
      const result = new InvoiceResult(data);

      expect(result.hasObservations()).toBe(true);
      expect(result.observations).toEqual(['Obs 1', 'Obs 2']);
    });

    test('should return false when no observations', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);

      expect(result.hasObservations()).toBe(false);
    });
  });

  describe('getAllErrors', () => {
    test('should return error message', () => {
      const data = {
        success: false,
        errorMessage: 'Main error'
      };
      const result = new InvoiceResult(data);

      expect(result.getAllErrors()).toBe('Main error');
    });

    test('should return joined errors', () => {
      const data = {
        success: false,
        errors: ['Error 1', 'Error 2', 'Error 3']
      };
      const result = new InvoiceResult(data);

      expect(result.getAllErrors()).toBe('Error 1; Error 2; Error 3');
    });
  });

  describe('getMessage', () => {
    test('should return success message with details', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);

      const message = result.getMessage();
      expect(message).toContain('Invoice created successfully');
      expect(message).toContain('12345-67890-1234'); // formatted CAE
      expect(message).toContain('100');
    });

    test('should return failure message with errors', () => {
      const data = {
        success: false,
        errorMessage: 'AFIP Error'
      };
      const result = new InvoiceResult(data);

      const message = result.getMessage();
      expect(message).toContain('Invoice creation failed');
      expect(message).toContain('AFIP Error');
    });
  });

  describe('toJSON', () => {
    test('should convert successful result to JSON', () => {
      const data = {
        success: true,
        cae: '12345678901234',
        caeExpiration: '2025-01-31',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };
      const result = new InvoiceResult(data);
      const json = result.toJSON();

      expect(json.success).toBe(true);
      expect(json.cae).toBe('12345678901234');
      expect(json.voucherNumber).toBe(100);
    });

    test('should convert failed result to JSON', () => {
      const data = {
        success: false,
        errorMessage: 'Error',
        errors: ['Error 1']
      };
      const result = new InvoiceResult(data);
      const json = result.toJSON();

      expect(json.success).toBe(false);
      expect(json.errorMessage).toBe('Error');
      expect(json.errors).toEqual(['Error 1']);
    });
  });

  describe('fromJSON', () => {
    test('should create InvoiceResult from JSON', () => {
      const json = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      };

      const result = InvoiceResult.fromJSON(json);

      expect(result).toBeInstanceOf(InvoiceResult);
      expect(result.success).toBe(true);
    });
  });

  describe('success factory method', () => {
    test('should create successful result', () => {
      const result = InvoiceResult.success({
        cae: '12345678901234',
        caeExpiration: '2025-01-31',
        voucherNumber: 100,
        invoiceDate: '2025-01-15'
      });

      expect(result.isSuccessful()).toBe(true);
      expect(result.cae.value).toBe('12345678901234');
      expect(result.voucherNumber).toBe(100);
    });

    test('should create successful result with observations', () => {
      const result = InvoiceResult.success({
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2025-01-15',
        observations: ['Note 1']
      });

      expect(result.hasObservations()).toBe(true);
      expect(result.observations).toEqual(['Note 1']);
    });
  });

  describe('failure factory method', () => {
    test('should create failed result from string', () => {
      const result = InvoiceResult.failure('Error message');

      expect(result.isFailed()).toBe(true);
      expect(result.errorMessage).toBe('Error message');
    });

    test('should create failed result from array', () => {
      const result = InvoiceResult.failure(['Error 1', 'Error 2']);

      expect(result.isFailed()).toBe(true);
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
      expect(result.getAllErrors()).toBe('Error 1; Error 2');
    });

    test('should include metadata', () => {
      const metadata = { code: '123' };
      const result = InvoiceResult.failure('Error', metadata);

      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('fromAFIPResponse', () => {
    test('should create successful result from AFIP response', () => {
      const afipResponse = {
        CAE: '12345678901234',
        CAEFchVto: '2025-01-31', // YYYY-MM-DD format
        CbteNro: 100,
        CbteFch: '2025-01-15',
        PtoVta: 1,
        CbteTipo: 11,
        Resultado: 'A'
      };

      const result = InvoiceResult.fromAFIPResponse(afipResponse);

      expect(result.isSuccessful()).toBe(true);
      expect(result.cae.value).toBe('12345678901234');
      expect(result.voucherNumber).toBe(100);
    });

    test('should create failed result from AFIP error response', () => {
      const afipResponse = {
        Resultado: 'R',
        Errors: [
          { Code: '101', Msg: 'Error 1' },
          { Code: '102', Msg: 'Error 2' }
        ]
      };

      const result = InvoiceResult.fromAFIPResponse(afipResponse);

      expect(result.isFailed()).toBe(true);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain('101');
      expect(result.errors[0]).toContain('Error 1');
    });

    test('should handle AFIP response with Err field', () => {
      const afipResponse = {
        Resultado: 'R',
        Err: { Msg: 'Connection error' }
      };

      const result = InvoiceResult.fromAFIPResponse(afipResponse);

      expect(result.isFailed()).toBe(true);
      expect(result.getAllErrors()).toContain('Connection error');
    });

    test('should handle unknown AFIP error', () => {
      const afipResponse = {
        Resultado: 'R'
      };

      const result = InvoiceResult.fromAFIPResponse(afipResponse);

      expect(result.isFailed()).toBe(true);
      expect(result.getAllErrors()).toContain('Unknown AFIP error');
    });

    test('should include observations from AFIP', () => {
      const afipResponse = {
        CAE: '12345678901234',
        CbteNro: 100,
        CbteFch: '20250115',
        Observaciones: ['Obs 1', 'Obs 2']
      };

      const result = InvoiceResult.fromAFIPResponse(afipResponse);

      expect(result.hasObservations()).toBe(true);
      expect(result.observations).toEqual(['Obs 1', 'Obs 2']);
    });
  });
});
