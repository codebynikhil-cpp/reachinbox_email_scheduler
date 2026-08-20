import { Request, Response, NextFunction } from 'express';
import { csvService } from '../services/csv.service';
import { BadRequestError } from '../utils/errors';

export class UploadController {
  public async uploadLeads(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded. Please upload a CSV file with "file" field name.');
      }

      const result = csvService.parseLeadsCsv(req.file.buffer);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
