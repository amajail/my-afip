const UseCase = require('../../../../src/application/use-cases/UseCase');

describe('UseCase (Base Class)', () => {
  class TestUseCase extends UseCase {
    async execute(input) {
      this.validateInput(input);
      return { success: true, input };
    }
  }

  class UnimplementedUseCase extends UseCase {
    // Doesn't override execute()
  }

  describe('execute', () => {
    it('should throw error if not implemented', async () => {
      const useCase = new UnimplementedUseCase();

      await expect(useCase.execute({})).rejects.toThrow(
        'execute() must be implemented by UnimplementedUseCase'
      );
    });

    it('should work when properly implemented', async () => {
      const useCase = new TestUseCase();
      const result = await useCase.execute({ test: 'data' });

      expect(result).toEqual({
        success: true,
        input: { test: 'data' }
      });
    });
  });

  describe('validateInput', () => {
    it('should throw ValidationError for null input', () => {
      const useCase = new TestUseCase();

      expect(() => useCase.validateInput(null)).toThrow('Input cannot be null or undefined');
    });

    it('should throw ValidationError for undefined input', () => {
      const useCase = new TestUseCase();

      expect(() => useCase.validateInput(undefined)).toThrow('Input cannot be null or undefined');
    });

    it('should accept valid input', () => {
      const useCase = new TestUseCase();

      expect(() => useCase.validateInput({})).not.toThrow();
      expect(() => useCase.validateInput({ test: 'data' })).not.toThrow();
    });
  });
});
