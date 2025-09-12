/**
 * Basic setup test to ensure testing infrastructure is working
 */

describe('Test Environment Setup', () => {
  it('should have a working test environment', () => {
    expect(true).toBe(true);
  });

  it('should handle basic math operations', () => {
    expect(1 + 1).toBe(2);
    expect(10 - 5).toBe(5);
    expect(3 * 4).toBe(12);
    expect(15 / 3).toBe(5);
  });

  it('should handle string operations', () => {
    const str = 'STORM UI';
    expect(str).toBeDefined();
    expect(str.length).toBe(8);
    expect(str.toLowerCase()).toBe('storm ui');
    expect(str.includes('STORM')).toBe(true);
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr[0]).toBe(1);
    expect(arr[arr.length - 1]).toBe(5);
    expect(arr.includes(3)).toBe(true);
  });

  it('should handle objects', () => {
    const obj = {
      name: 'STORM',
      type: 'Knowledge Curation',
      version: '1.0.0',
    };
    expect(obj).toBeDefined();
    expect(obj.name).toBe('STORM');
    expect(obj).toHaveProperty('type');
    expect(Object.keys(obj)).toHaveLength(3);
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    expect(result).toBe('success');
  });

  it('should handle errors', () => {
    const throwError = () => {
      throw new Error('Test error');
    };
    expect(throwError).toThrow('Test error');
  });
});
