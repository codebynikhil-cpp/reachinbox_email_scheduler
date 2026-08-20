import { describe, it, expect } from 'vitest';
import { csvService } from '../src/services/csv.service';
import { BadRequestError } from '../src/utils/errors';

describe('CsvService', () => {
  it('should parse a clean CSV with headers and extract unique emails', () => {
    const csvContent = `Name,Email,Company
John Doe,john@example.com,Acme
Jane Smith,jane@example.com,Beta Corp
Bob,bob@example.com,Delta`;

    const result = csvService.parseLeadsCsv(Buffer.from(csvContent));
    expect(result.totalRows).toBe(3);
    expect(result.validEmails).toBe(3);
    expect(result.duplicates).toBe(0);
    expect(result.uniqueEmails).toBe(3);
    expect(result.emails).toEqual([
      'john@example.com',
      'jane@example.com',
      'bob@example.com',
    ]);
  });

  it('should detect duplicates (case-insensitive) and return unique list', () => {
    const csvContent = `email
alice@example.com
ALICE@example.com
Bob@domain.com
alice@example.com`;

    const result = csvService.parseLeadsCsv(Buffer.from(csvContent));
    expect(result.totalRows).toBe(4);
    expect(result.validEmails).toBe(4);
    expect(result.duplicates).toBe(2);
    expect(result.uniqueEmails).toBe(2);
    expect(result.emails).toEqual(['alice@example.com', 'Bob@domain.com']);
  });

  it('should filter out invalid emails and keep only valid addresses', () => {
    const csvContent = `Email,Phone
valid1@company.com,12345
invalid-email-address,55555
another.valid+tag@domain.co.uk,99999
@notanemail.com,00000`;

    const result = csvService.parseLeadsCsv(Buffer.from(csvContent));
    expect(result.validEmails).toBe(2);
    expect(result.uniqueEmails).toBe(2);
    expect(result.emails).toContain('valid1@company.com');
    expect(result.emails).toContain('another.valid+tag@domain.co.uk');
  });

  it('should throw BadRequestError for empty file', () => {
    expect(() => {
      csvService.parseLeadsCsv(Buffer.from('   '));
    }).toThrow(BadRequestError);
  });
});
