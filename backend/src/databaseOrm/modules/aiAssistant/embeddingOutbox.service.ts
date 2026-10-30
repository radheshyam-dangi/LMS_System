/**
 * Embedding Outbox Service
 *
 * Polls the embedding_outbox table and triggers embedding jobs
 * for Learning Paths / Lessons that have changed.
 *
 * Supports both:
 * 1. Immediate asynchronous execution on LP/Lesson save
 * 2. Background polling cron (every 30s) as a resilient catch-up worker
 * 3. On-demand full reindex across all active Learning Paths
 *
 * Vector storage architecture:
 * - Uses TypeORM Repositories to safely load all entity content (eliminating column naming issues)
 * - Chunks text into ~150-300 word segments with overlap
 * - Generates dense vectors: uses OpenAI (if OPENAI_API_KEY is present) or
 *   SkillForge's high-speed 256-dim deterministic semantic feature vector
 * - Stores chunks and dense vector float arrays directly into PostgreSQL `lp_embedding_chunks`
 * - Synchronizes `LessonContentChunk` with PostgreSQL `tsvector` for hybrid retrieval
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';
import { EmbeddingOutboxEntity } from '../../entities/embeddingOutbox.entity';
import { LpEmbeddingChunkEntity } from '../../entities/lpEmbeddingChunk.entity';
import { LessonContentChunkEntity } from '../../entities/lessonContentChunk.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { LessonContentCacheEntity } from '../../entities/lessonContentCache.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { AiAssistantRetrievalService } from './aiAssistantRetrieval.service';
import * as crypto from 'crypto';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;
const CHUNK_TOKEN_SIZE = 300; // ~200-350 words target
const CHUNK_OVERLAP = 40;     // words of overlap

@Injectable()
export class EmbeddingOutboxService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingOutboxService.name);
  private outboxRepo: Repository<EmbeddingOutboxEntity>;
  private chunkRepo: Repository<LpEmbeddingChunkEntity>;
  private lpRepo: Repository<LearningPathEntity>;
  private moduleRepo: Repository<ModuleEntity>;
  private lessonRepo: Repository<LessonEntity>;
  private cacheRepo: Repository<LessonContentCacheEntity>;
  private resourceRepo: Repository<ResourceEntity>;
  private isProcessing = false;

  constructor(
    private readonly datasource: DataSource,
    private readonly retrieval: AiAssistantRetrievalService,
  ) {
    this.outboxRepo = this.datasource.getRepository(EmbeddingOutboxEntity);
    this.chunkRepo = this.datasource.getRepository(LpEmbeddingChunkEntity);
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
    this.moduleRepo = this.datasource.getRepository(ModuleEntity);
    this.lessonRepo = this.datasource.getRepository(LessonEntity);
    this.cacheRepo = this.datasource.getRepository(LessonContentCacheEntity);
    this.resourceRepo = this.datasource.getRepository(ResourceEntity);
  }

  /**
   * On startup, check if any chunks exist. If table is empty but LPs exist,
   * trigger a non-blocking initial indexing in the background.
   */
  async onModuleInit(): Promise<void> {
    setTimeout(() => {
      this.checkAndAutoIndex().catch((err) => {
        this.logger.warn(`Auto-index check failed: ${(err as Error).message}`);
      });
    }, 5000);
  }

  private async checkAndAutoIndex(): Promise<void> {
    try {
      const chunkCountResult = await this.datasource.query(
        `SELECT COUNT(*) AS cnt FROM lp_embedding_chunks WHERE is_active = true`,
      );
      const chunkCount = parseInt(chunkCountResult[0]?.cnt || '0', 10);

      if (chunkCount === 0) {
        this.logger.log('lp_embedding_chunks is empty. Initiating background reindex of active Learning Paths...');
        await this.reindexAllLps();
      }
    } catch (e) {
      this.logger.warn(`checkAndAutoIndex warning: ${(e as Error).message}`);
    }
  }

  /**
   * Enqueue an event for a saved LP or Lesson.
   * Called from LpAuthoringService after the transaction commits.
   */
  async enqueue(eventType: string, entityId: string): Promise<void> {
    try {
      const entry = this.outboxRepo.create({ eventType, entityId });
      await this.outboxRepo.save(entry);
      this.logger.log(`Enqueued embedding job: ${eventType} for ${entityId}`);
    } catch (e) {
      this.logger.error(
        `Failed to enqueue embedding job for ${eventType}:${entityId}: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Process an LP or Lesson event immediately in the background without waiting for the cron.
   */
  async processEntityImmediate(eventType: string, entityId: string): Promise<void> {
    const openAiKey = process.env.OPENAI_API_KEY || '';
    if (eventType === 'lp_saved') {
      await this.embedLearningPath(entityId, openAiKey);
    } else if (eventType === 'lesson_saved') {
      await this.embedLesson(entityId, openAiKey);
    } else if (eventType === 'lesson_deleted' || eventType === 'lp_deleted') {
      await this.deactivateChunks(entityId, eventType);
    }

    // Mark pending outbox entries as processed
    try {
      await this.datasource.query(
        `UPDATE embedding_outbox SET processed_at = now(), last_error = null, dead_lettered = false
         WHERE event_type = $1 AND entity_id = $2 AND processed_at IS NULL`,
        [eventType, entityId],
      );
    } catch {
      // non-fatal
    }
  }

  /**
   * Reindex all active Learning Paths into lp_embedding_chunks.
   */
  async reindexAllLps(): Promise<number> {
    const openAiKey = process.env.OPENAI_API_KEY || '';
    const lps = await this.lpRepo.find({
      where: [{ status: 'Active' }, { status: 'active' }],
      select: ['id', 'title'],
    });

    // Reset any dead-lettered entries so retry works cleanly
    try {
      await this.datasource.query(
        `UPDATE embedding_outbox SET dead_lettered = false, attempts = 0 WHERE dead_lettered = true`,
      );
    } catch {
      // non-fatal
    }

    this.logger.log(`Reindexing ${lps.length} active Learning Paths into vector table...`);
    let count = 0;
    for (const lp of lps) {
      try {
        await this.embedLearningPath(lp.id, openAiKey);
        count++;
      } catch (err) {
        this.logger.error(`Reindex failed for LP ${lp.id} (${lp.title}): ${(err as Error).message}`);
      }
    }
    this.logger.log(`Reindex completed: ${count}/${lps.length} Learning Paths successfully processed.`);
    return count;
  }

  /** Poll every 30 seconds for pending outbox events */
  @Cron('*/30 * * * * *')
  async processOutbox(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const openAiKey = process.env.OPENAI_API_KEY || '';
      const events = await this.outboxRepo.find({
        where: { processedAt: null as any, deadLettered: false },
        order: { createdAt: 'ASC' },
        take: BATCH_SIZE,
      });

      for (const event of events) {
        await this.processEvent(event, openAiKey);
      }
    } catch (e) {
      this.logger.error(`Outbox polling failed: ${(e as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: EmbeddingOutboxEntity, openAiKey: string): Promise<void> {
    try {
      event.attempts += 1;

      if (event.eventType === 'lp_saved') {
        await this.embedLearningPath(event.entityId, openAiKey);
      } else if (event.eventType === 'lesson_saved') {
        await this.embedLesson(event.entityId, openAiKey);
      } else if (event.eventType === 'lesson_deleted' || event.eventType === 'lp_deleted') {
        await this.deactivateChunks(event.entityId, event.eventType);
      }

      event.processedAt = new Date();
      event.lastError = null;
      await this.outboxRepo.save(event);
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`Embedding job ${event.id} failed (attempt ${event.attempts}): ${msg}`);
      event.lastError = msg;

      if (event.attempts >= MAX_ATTEMPTS) {
        event.deadLettered = true;
        this.logger.error(
          `Embedding job ${event.id} dead-lettered after ${MAX_ATTEMPTS} attempts: ${msg}`,
        );
      }
      await this.outboxRepo.save(event);
    }
  }

  private async embedLearningPath(lpId: string, openAiKey: string): Promise<void> {
    // 1. Load LP metadata via TypeORM repository
    const lp = await this.lpRepo.findOne({ where: { id: lpId } });
    if (!lp) return;

    // Embed LP-level description and skill tags
    const lpOverviewParts: string[] = [];
    if (lp.description?.trim()) lpOverviewParts.push(lp.description.trim());
    if (Array.isArray(lp.skillsTags) && lp.skillsTags.length > 0) {
      lpOverviewParts.push(`Key Skills & Topics: ${lp.skillsTags.join(', ')}`);
    }

    if (lpOverviewParts.length > 0) {
      await this.embedAndUpsertChunks({
        lpId,
        lessonId: null,
        moduleId: null,
        sourceType: 'lp_description',
        sourceKey: `lp:${lpId}:description`,
        text: lpOverviewParts.join('\n\n'),
        contextPrefix: `Learning Path: ${lp.title}`,
        openAiKey,
      });
    }

    // 2. Load Modules under LP via TypeORM repository
    const modules = await this.moduleRepo.find({
      where: { learningPath: { id: lpId } },
    });

    for (const mod of modules) {
      const modParts: string[] = [];
      if (mod.description?.trim()) modParts.push(mod.description.trim());
      if (Array.isArray(mod.objectives) && mod.objectives.length > 0) {
        modParts.push(`Objectives:\n- ${mod.objectives.join('\n- ')}`);
      }
      if (Array.isArray(mod.outcomes) && mod.outcomes.length > 0) {
        modParts.push(`Outcomes:\n- ${mod.outcomes.join('\n- ')}`);
      }

      if (modParts.length > 0) {
        await this.embedAndUpsertChunks({
          lpId,
          lessonId: null,
          moduleId: mod.id,
          sourceType: 'module_overview',
          sourceKey: `module:${mod.id}:overview`,
          text: modParts.join('\n\n'),
          contextPrefix: `Learning Path: ${lp.title} > Module: ${mod.title}`,
          openAiKey,
        });
      }
    }

    // 3. Load all lessons belonging to this LP via TypeORM repository
    const lessons = await this.lessonRepo.find({
      where: [
        { learningPath: { id: lpId } },
        { module: { learningPath: { id: lpId } } },
      ],
      select: ['id'],
    });

    for (const r of lessons) {
      await this.embedLesson(r.id, openAiKey, lpId);
    }
  }

  private async embedLesson(lessonId: string, openAiKey: string, lpIdHint?: string): Promise<void> {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['module', 'module.learningPath', 'learningPath', 'resources'],
    });
    if (!lesson) return;

    const lpId = lpIdHint || lesson.learningPath?.id || lesson.module?.learningPath?.id;
    if (!lpId) return;

    const lpTitle = lesson.learningPath?.title || lesson.module?.learningPath?.title || 'Learning Path';
    const moduleTitle = lesson.module?.title || 'General';
    const prefix = `LP: ${lpTitle} > Module: ${moduleTitle} > Lesson: ${lesson.title}`;
    const version = lesson.contentVersion || 1;

    // Check LessonContentCache for transcripts
    const cache = await this.cacheRepo.findOne({
      where: { lesson: { id: lessonId } },
    });

    const sources: Array<{ type: string; text: string }> = [];

    // 1. Description (rich cached description or raw lesson description)
    const desc = (cache?.descriptionText || lesson.description || '').trim();
    if (desc) {
      sources.push({ type: 'lesson_description', text: desc });
    }

    // 2. Key takeaways / key points
    if (Array.isArray(lesson.keyPoints) && lesson.keyPoints.length > 0) {
      sources.push({ type: 'key_point', text: `Key Takeaways:\n- ${lesson.keyPoints.join('\n- ')}` });
    }

    // 3. Video transcript
    if (cache?.videoTranscript?.trim()) {
      sources.push({ type: 'video_transcript', text: cache.videoTranscript.trim() });
    }

    // 4. Resource text
    if (cache?.resourceText?.trim()) {
      sources.push({ type: 'resource', text: cache.resourceText.trim() });
    }

    // 5. Attached resources
    if (Array.isArray(lesson.resources) && lesson.resources.length > 0) {
      const resList = lesson.resources
        .filter((r) => r.url)
        .map((r) => `${r.title || r.url} (${r.type || 'Resource'}): ${r.url}`)
        .join('\n');
      if (resList) {
        sources.push({ type: 'resource_links', text: `Lesson Resources:\n${resList}` });
      }
    }

    // Fallback if no text exists yet
    if (sources.length === 0 && lesson.title) {
      sources.push({ type: 'lesson_title', text: `Lesson Overview: ${lesson.title}` });
    }

    for (const source of sources) {
      await this.embedAndUpsertChunks({
        lpId,
        lessonId,
        moduleId: lesson.module?.id || null,
        sourceType: source.type,
        sourceKey: `lesson:${lessonId}:${source.type}`,
        text: source.text,
        contextPrefix: prefix,
        contentVersion: version,
        openAiKey,
      });
    }
  }

  private async embedAndUpsertChunks(opts: {
    lpId: string;
    lessonId: string | null;
    moduleId: string | null;
    sourceType: string;
    sourceKey: string;
    text: string;
    contextPrefix: string;
    contentVersion?: number;
    openAiKey: string;
  }): Promise<void> {
    const chunks = this.chunkText(opts.text, CHUNK_TOKEN_SIZE, CHUNK_OVERLAP);
    if (!chunks.length) return;

    const version = opts.contentVersion || 1;

    // Delete older version chunks for this source to prevent ghost/duplicate records
    await this.datasource.query(
      `DELETE FROM lp_embedding_chunks
       WHERE source_key = $1 AND content_version != $2`,
      [opts.sourceKey, version],
    );

    const chunkRepo = this.datasource.getRepository(LessonContentChunkEntity);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const hash = crypto.createHash('sha256').update(chunk).digest('hex');

      // Check if this chunk already exists with same hash AND the target embedding model
      const targetModel = process.env.NOMIC_API_KEY
        ? (process.env.NOMIC_EMBEDDING_MODEL || 'nomic-ai/nomic-embed-text-v1.5')
        : 'skillforge-feature-hash-v1';

      const existing = await this.datasource.query(
        `SELECT id, embedding_model FROM lp_embedding_chunks WHERE source_key = $1 AND chunk_index = $2 AND content_hash = $3 AND is_active = true`,
        [opts.sourceKey, i, hash],
      );
      if (existing.length > 0 && existing[0].embedding_model === targetModel) continue;

      // Embed the chunk with context prefix prepended
      const textToEmbed = `${opts.contextPrefix}\n\n${chunk}`.substring(0, 8192);
      const meta = await this.retrieval.embedWithMetadata(textToEmbed, 'document');
      const embedding = meta.embedding;
      const modelName = meta.model;

      // 1. Upsert into lp_embedding_chunks (Vector DB table)
      await this.datasource.query(
        `INSERT INTO lp_embedding_chunks
           (learning_path_id, module_id, lesson_id, source_type, source_key, chunk_index,
            content, context_prefix, content_hash, content_version, embedding, embedding_model, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, now(), now())
         ON CONFLICT (source_key, chunk_index)
         DO UPDATE SET
           content = EXCLUDED.content,
           content_hash = EXCLUDED.content_hash,
           content_version = EXCLUDED.content_version,
           embedding = EXCLUDED.embedding,
           embedding_model = EXCLUDED.embedding_model,
           is_active = true,
           updated_at = now()`,
        [
          opts.lpId,
          opts.moduleId,
          opts.lessonId,
          opts.sourceType,
          opts.sourceKey,
          i,
          chunk,
          opts.contextPrefix,
          hash,
          version,
          embedding ? JSON.stringify(embedding) : null,
          modelName,
        ],
      );

      // 2. Also synchronize to LessonContentChunk with tsvector if it belongs to a lesson
      if (opts.lessonId) {
        try {
          const lcc = chunkRepo.create({
            lesson: { id: opts.lessonId } as any,
            contentVersion: version,
            chunkIndex: i,
            chunkText: `${opts.contextPrefix}: ${chunk}`,
          });
          await chunkRepo.save(lcc);
          await this.datasource.query(
            `UPDATE "LessonContentChunk" SET search_vector = to_tsvector('english', chunk_text) WHERE id = $1`,
            [lcc.id],
          );
        } catch {
          // non-fatal
        }
      }
    }
  }

  private async deactivateChunks(entityId: string, eventType: string): Promise<void> {
    if (eventType === 'lesson_deleted') {
      await this.datasource.query(
        `DELETE FROM lp_embedding_chunks WHERE lesson_id = $1`,
        [entityId],
      );
    } else if (eventType === 'module_deleted') {
      await this.datasource.query(
        `DELETE FROM lp_embedding_chunks WHERE module_id = $1`,
        [entityId],
      );
    } else {
      await this.datasource.query(
        `DELETE FROM lp_embedding_chunks WHERE learning_path_id = $1`,
        [entityId],
      );
    }
  }

  /**
   * Split text into overlapping word-based chunks.
   * Respects paragraph breaks where possible.
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    if (!text || !text.trim()) return [];
    const paragraphs = text.split(/\n\n+/);
    const words: string[] = [];

    for (const para of paragraphs) {
      const tokens = para.split(/\s+/).filter(Boolean);
      for (let t = 0; t < tokens.length; t++) {
        words.push(tokens[t]);
      }
    }

    if (words.length <= chunkSize) {
      return [words.join(' ')];
    }

    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start += chunkSize - overlap;
      if (start >= words.length) break;
    }

    return chunks.filter(Boolean);
  }
}
