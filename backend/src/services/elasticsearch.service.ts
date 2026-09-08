import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

export interface EmailIndexDocument {
  id: string;
  campaignId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  messageId?: string | null;
  error?: string | null;
  createdAt: string;
}

export class ElasticsearchService {
  private client: Client | null = null;
  private isConnected = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    try {
      this.client = new Client({
        node: env.ELASTICSEARCH_NODE,
        requestTimeout: 3000,
        maxRetries: 2,
      });
      void this.ensureIndex();
    } catch (err) {
      logger.warn('Elasticsearch client initialization failed. Falling back to DB queries.', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Ensure the emails index exists with proper mappings
   */
  public async ensureIndex(): Promise<void> {
    if (!this.client) return;

    try {
      const exists = await this.client.indices.exists({
        index: env.ELASTICSEARCH_INDEX,
      });

      if (!exists) {
        await this.client.indices.create({
          index: env.ELASTICSEARCH_INDEX,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              userId: { type: 'keyword' },
              recipient: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              subject: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              messageId: { type: 'keyword' },
              error: { type: 'text' },
              createdAt: { type: 'date' },
            },
          },
        });
        logger.info(`Elasticsearch index '${env.ELASTICSEARCH_INDEX}' created successfully`);
      }
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      logger.warn('Elasticsearch is currently unreachable; search operations will gracefully query database', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Index or bulk index newly created emails
   */
  public async indexEmails(documents: EmailIndexDocument[]): Promise<void> {
    if (!this.client || !this.isConnected || documents.length === 0) return;

    try {
      const operations = documents.flatMap((doc) => [
        { index: { _index: env.ELASTICSEARCH_INDEX, _id: doc.id } },
        doc,
      ]);

      const bulkResponse = await this.client.bulk({ refresh: true, operations });
      if (bulkResponse.errors) {
        logger.warn('Elasticsearch bulk indexing had errors');
      } else {
        logger.info(`Indexed ${documents.length} emails into Elasticsearch`);
      }
    } catch (err) {
      logger.warn('Elasticsearch indexing failed (non-critical)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Update status of an email in Elasticsearch index
   */
  public async updateEmailStatus(
    emailId: string,
    updates: {
      status: string;
      sentAt?: Date | null;
      messageId?: string | null;
      error?: string | null;
    }
  ): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      await this.client.update({
        index: env.ELASTICSEARCH_INDEX,
        id: emailId,
        doc: {
          status: updates.status,
          ...(updates.sentAt !== undefined ? { sentAt: updates.sentAt?.toISOString() } : {}),
          ...(updates.messageId !== undefined ? { messageId: updates.messageId } : {}),
          ...(updates.error !== undefined ? { error: updates.error } : {}),
        },
      });
    } catch (err) {
      logger.debug('Failed to update email status in Elasticsearch', {
        emailId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Search emails with full-text search across recipient, subject, and body
   * Falls back seamlessly to relational database if Elasticsearch is unavailable.
   */
  public async searchEmails(params: {
    userId: string;
    query: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, query, status, page = 1, limit = 10 } = params;
    const from = (page - 1) * limit;

    // Try Elasticsearch query first
    if (this.client && this.isConnected) {
      try {
        const mustClauses: any[] = [
          { term: { userId } },
        ];

        if (status) {
          mustClauses.push({ term: { status } });
        }

        if (query && query.trim()) {
          mustClauses.push({
            multi_match: {
              query: query.trim(),
              fields: ['recipient^3', 'subject^2', 'body'],
              fuzziness: 'AUTO',
            },
          });
        }

        const esResult = await this.client.search({
          index: env.ELASTICSEARCH_INDEX,
          from,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        });

        const total = typeof esResult.hits.total === 'number' 
          ? esResult.hits.total 
          : esResult.hits.total?.value || 0;

        const emails = esResult.hits.hits.map((hit: any) => ({
          ...hit._source,
          campaign: {
            subject: hit._source.subject,
          },
        }));

        return {
          source: 'elasticsearch',
          emails,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (err) {
        logger.warn('Elasticsearch search error; falling back to relational database', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Graceful Relational Database fallback
    const where: any = {
      campaign: { userId },
    };

    if (status) {
      where.status = status;
    }

    if (query && query.trim()) {
      where.OR = [
        { recipient: { contains: query.trim(), mode: 'insensitive' } },
        { campaign: { subject: { contains: query.trim(), mode: 'insensitive' } } },
        { campaign: { body: { contains: query.trim(), mode: 'insensitive' } } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        skip: from,
        take: limit,
        orderBy:
          status === 'SENT'
            ? [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
            : [{ createdAt: 'desc' }, { scheduledAt: 'desc' }],
        include: {
          campaign: {
            select: { subject: true },
          },
        },
      }),
    ]);

    return {
      source: 'database',
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const elasticsearchService = new ElasticsearchService();
