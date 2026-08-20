import { parse } from 'csv-parse/sync';
import { BadRequestError } from '../utils/errors';

export interface CsvParseResult {
  totalRows: number;
  validEmails: number;
  duplicates: number;
  uniqueEmails: number;
  emails: string[];
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export class CsvService {
  /**
   * Parse CSV/Text file buffer and extract valid unique email addresses
   */
  public parseLeadsCsv(fileBuffer: Buffer): CsvParseResult {
    const content = fileBuffer.toString('utf-8').trim();
    if (!content) {
      throw new BadRequestError('Uploaded CSV file is empty');
    }

    let records: string[][];
    try {
      records = parse(content, {
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (error) {
      throw new BadRequestError('Malformed CSV format: unable to parse lines');
    }

    if (!records || records.length === 0) {
      throw new BadRequestError('No records found in CSV file');
    }

    let totalRows = records.length;
    let validEmailsCount = 0;
    let duplicatesCount = 0;

    const seenEmails = new Set<string>();
    const uniqueEmailsList: string[] = [];

    // Optional header check: if first row looks like a header (e.g. "email", "name", "contact"), skip row in count or inspect
    let startIndex = 0;
    const firstRowValues = records[0].map((c) => c.toLowerCase());
    if (
      firstRowValues.some((val) => val === 'email' || val === 'e-mail' || val === 'email address')
    ) {
      totalRows -= 1;
      startIndex = 1;
    }

    for (let i = startIndex; i < records.length; i++) {
      const row = records[i];
      let rowHasValidEmail = false;

      for (const cell of row) {
        const trimmed = cell.trim();
        if (EMAIL_REGEX.test(trimmed)) {
          rowHasValidEmail = true;
          validEmailsCount++;
          const lower = trimmed.toLowerCase();

          if (seenEmails.has(lower)) {
            duplicatesCount++;
          } else {
            seenEmails.add(lower);
            uniqueEmailsList.push(trimmed);
          }
          break; // Found primary email for this row
        }
      }

      // If no cell matched strict regex, check if row contains an email substring
      if (!rowHasValidEmail) {
        const rowText = row.join(' ');
        const matches = rowText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (matches) {
          for (const match of matches) {
            validEmailsCount++;
            const lower = match.toLowerCase();
            if (seenEmails.has(lower)) {
              duplicatesCount++;
            } else {
              seenEmails.add(lower);
              uniqueEmailsList.push(match);
            }
          }
        }
      }
    }

    return {
      totalRows,
      validEmails: validEmailsCount,
      duplicates: duplicatesCount,
      uniqueEmails: uniqueEmailsList.length,
      emails: uniqueEmailsList,
    };
  }
}

export const csvService = new CsvService();
