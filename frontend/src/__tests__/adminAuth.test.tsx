import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeEmail, isAdminEmail, ADMIN_EMAILS } from '../hooks/useAdminAuth';

// ---------------------------------------------------------------------------
// Pure helper tests (no React / Firebase mocking needed)
// ---------------------------------------------------------------------------

describe('useAdminAuth — pure helpers', () => {
  describe('ADMIN_EMAILS', () => {
    it('contains oantiza@gmail.com', () => {
      expect(ADMIN_EMAILS).toContain('oantiza@gmail.com');
    });

    it('is a non-empty array', () => {
      expect(Array.isArray(ADMIN_EMAILS)).toBe(true);
      expect(ADMIN_EMAILS.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
      expect(normalizeEmail('  OanTIZA@Gmail.COM  ')).toBe('oantiza@gmail.com');
    });

    it('returns empty string for null', () => {
      expect(normalizeEmail(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(normalizeEmail(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(normalizeEmail('')).toBe('');
    });

    it('handles already normalized email', () => {
      expect(normalizeEmail('test@example.com')).toBe('test@example.com');
    });
  });

  describe('isAdminEmail', () => {
    it('returns true for exact admin email', () => {
      expect(isAdminEmail('oantiza@gmail.com')).toBe(true);
    });

    it('returns true case-insensitively (all caps)', () => {
      expect(isAdminEmail('OANTIZA@GMAIL.COM')).toBe(true);
    });

    it('returns true case-insensitively (mixed case)', () => {
      expect(isAdminEmail('Oantiza@Gmail.Com')).toBe(true);
    });

    it('returns true with surrounding whitespace', () => {
      expect(isAdminEmail('  oantiza@gmail.com  ')).toBe(true);
    });

    it('returns false for non-admin email', () => {
      expect(isAdminEmail('user@example.com')).toBe(false);
    });

    it('returns false for similar but different email', () => {
      expect(isAdminEmail('oantiza@hotmail.com')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isAdminEmail(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAdminEmail(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isAdminEmail('')).toBe(false);
    });

    it('returns false for number coerced to string', () => {
      expect(isAdminEmail(42 as any)).toBe(false);
    });
  });
});
