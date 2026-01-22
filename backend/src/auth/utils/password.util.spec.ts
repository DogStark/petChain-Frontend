import { IsStrongPasswordConstraint } from './password.util';
import { PasswordUtil } from './password.util';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('PasswordUtil', () => {
  describe('hashPassword', () => {
    it('should hash a password with default rounds', async () => {
      const mockHash = '$2b$12$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      const result = await PasswordUtil.hashPassword('password123');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(result).toBe(mockHash);
    });

    it('should hash a password with custom rounds', async () => {
      const mockHash = '$2b$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      const result = await PasswordUtil.hashPassword('password123', 10);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(result).toBe(mockHash);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await PasswordUtil.comparePassword('password123', '$2b$12$hashed');

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2b$12$hashed');
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await PasswordUtil.comparePassword('wrongpassword', '$2b$12$hashed');

      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', '$2b$12$hashed');
      expect(result).toBe(false);
    });
  });
});

describe('IsStrongPasswordConstraint', () => {
  let constraint: IsStrongPasswordConstraint;

  beforeEach(() => {
    constraint = new IsStrongPasswordConstraint();
  });

  describe('validate', () => {
    it('should return false for null password', () => {
      expect(constraint.validate(null as any, {} as any)).toBe(false);
    });

    it('should return false for empty password', () => {
      expect(constraint.validate('', {} as any)).toBe(false);
    });

    it('should return false for password shorter than 8 characters', () => {
      expect(constraint.validate('Short1!', {} as any)).toBe(false); // 7 chars - less than 8
      expect(constraint.validate('Short!', {} as any)).toBe(false); // 6 chars - less than 8
      expect(constraint.validate('Shor1!', {} as any)).toBe(false); // 6 chars - less than 8
    });

    it('should return false for password without uppercase letter', () => {
      expect(constraint.validate('password123!', {} as any)).toBe(false);
    });

    it('should return false for password without lowercase letter', () => {
      expect(constraint.validate('PASSWORD123!', {} as any)).toBe(false);
    });

    it('should return false for password without number', () => {
      expect(constraint.validate('Password!', {} as any)).toBe(false);
    });

    it('should return false for password without special character', () => {
      expect(constraint.validate('Password123', {} as any)).toBe(false);
    });

    it('should return true for valid password', () => {
      expect(constraint.validate('Password123!', {} as any)).toBe(true);
      expect(constraint.validate('MyP@ssw0rd', {} as any)).toBe(true);
      expect(constraint.validate('Test1234#', {} as any)).toBe(true);
    });
  });

  describe('defaultMessage', () => {
    it('should return appropriate error message', () => {
      const message = constraint.defaultMessage({} as any);
      expect(message).toContain('8 characters');
      expect(message).toContain('uppercase');
      expect(message).toContain('lowercase');
      expect(message).toContain('numbers');
      expect(message).toContain('special characters');
    });
  });
});
