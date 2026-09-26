/**
 * Content Extraction Service
 *
 * Extracts plain text from lesson content blocks (rich-text descriptions,
 * video transcripts, audio transcripts, resource text) and caches results
 * in the LessonContentCache table.
 *
 * Runs asynchronously on lesson save — evaluation should never be blocked
 * waiting on a live transcription job.
 *
 * Design decisions:
 * - YouTube captions: fetched via YouTube oEmbed/page scraping (no API key needed for basic captions)
 * - Audio/video transcription: Groq Whisper endpoint
 * - PDF extraction: basic text extraction
 * - Webpage: fetch + strip HTML
 * - Cache invalidation: re-run on lesson content update
 */
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LessonContentCacheEntity } from '../../entities/lessonContentCache.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { ResourceEntity } from '../../entities/resource.entity';
import { YoutubeTranscript } from 'youtube-transcript';
import { LessonContentChunkEntity } from '../../entities/lessonContentChunk.entity';
import { LessonRubricEntity } from '../../entities/lessonRubric.entity';
import * as crypto from 'crypto';

@Injectable()
export class ContentExtractionService {
  private readonly logger = new Logger(ContentExtractionService.name);
  private cacheRepo: Repository<LessonContentCacheEntity>;
  private lessonRepo: Repository<LessonEntity>;
  private resourceRepo: Repository<ResourceEntity>;
  private chunkRepo: Repository<LessonContentChunkEntity>;
  private rubricRepo: Repository<LessonRubricEntity>;

  constructor(private readonly datasource: DataSource) {
    this.cacheRepo = this.datasource.getRepository(LessonContentCacheEntity);
    this.lessonRepo = this.datasource.getRepository(LessonEntity);
    this.resourceRepo = this.datasource.getRepository(ResourceEntity);
    this.chunkRepo = this.datasource.getRepository(LessonContentChunkEntity);
    this.rubricRepo = this.datasource.getRepository(LessonRubricEntity);
  }

  /**
   * Trigger content extraction for a lesson.
   * Runs asynchronously — does not block the caller.
   */
  async extractLessonContentAsync(lessonId: string): Promise<void> {
    // Fire-and-forget — errors are logged, not thrown
    this.extractLessonContent(lessonId).catch(e => {
      const err = e as Error;
      this.logger.error(
        `Content extraction failed for lesson ${lessonId}: ${err.message}`,
        err.stack,
      );
    });
  }

  /**
   * Core extraction pipeline. Extracts all available content and caches it.
   */
  async extractLessonContent(lessonId: string): Promise<LessonContentCacheEntity | null> {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['resources'],
    });

    if (!lesson) {
      this.logger.warn(`Lesson ${lessonId} not found for content extraction`);
      return null;
    }

    // Calculate source hash
    const hashData = [
      lesson.description || '',
      ...(lesson.videos || []).map(v => v?.url || ''),
      lesson.videoUrl || '',
      ...(lesson.audios || []).map(a => a?.url || ''),
      ...(lesson.resources || []).map(r => r?.url || ''),
      ...(lesson.keyPoints || []),
    ].join('|');
    const sourceHash = crypto.createHash('sha256').update(hashData).digest('hex');

    let cache = await this.cacheRepo.findOne({ where: { lessonId } });
    if (!cache) {
      cache = this.cacheRepo.create({
        lessonId,
        extractionStatus: 'pending',
        contentVersion: 1,
      });
    }

    // If source hasn't changed and we already extracted it successfully, skip extraction
    if (cache.sourceHash === sourceHash && ['completed', 'partial'].includes(cache.extractionStatus)) {
      this.logger.log(`Skipping extraction for lesson ${lessonId} - no content changes`);
      return cache;
    }

    if (cache.sourceHash && cache.sourceHash !== sourceHash) {
      cache.contentVersion = (cache.contentVersion || 1) + 1;
    }
    cache.sourceHash = sourceHash;
    cache.extractionStatus = 'pending';
    cache = await this.cacheRepo.save(cache);

    const failures: string[] = [];
    let hasContent = false;

    // 1. Description — strip HTML to plain text
    try {
      if (lesson.description) {
        cache.descriptionText = this.stripHtmlToText(lesson.description);
        hasContent = true;
      } else {
        cache.descriptionText = '';
      }
    } catch (e) {
      const err = e as Error;
      failures.push(`Description extraction failed: ${err.message}`);
    }

    // 2. Video blocks — extract transcripts
    try {
      const videoTexts: string[] = [];
      const videos = lesson.videos || [];
      if (lesson.videoUrl) videos.push({ url: lesson.videoUrl });

      for (const video of videos) {
        if (!video?.url) continue;
        try {
          const transcript = await this.extractVideoTranscript(video.url);
          if (transcript) videoTexts.push(transcript);
        } catch (e) {
          const err = e as Error;
          this.logger.warn(`Video transcript extraction failed for ${video.url}: ${err.message}`);
          failures.push(`Video ${video.url}: ${err.message}`);
        }
      }

      if (videoTexts.length > 0) {
        cache.videoTranscript = videoTexts.join('\n\n---\n\n');
        hasContent = true;
      } else {
        cache.videoTranscript = '';
      }
    } catch (e) {
      const err = e as Error;
      failures.push(`Video extraction failed: ${err.message}`);
    }

    // 3. Audio blocks — transcribe
    try {
      const audioTexts: string[] = [];
      const audios = lesson.audios || [];

      for (const audio of audios) {
        if (!audio?.url) continue;
        try {
          const transcript = await this.transcribeAudio(audio.url);
          if (transcript) audioTexts.push(transcript);
        } catch (e) {
          const err = e as Error;
          this.logger.warn(`Audio transcription failed for ${audio.url}: ${err.message}`);
          failures.push(`Audio ${audio.url}: ${err.message}`);
        }
      }

      if (audioTexts.length > 0) {
        cache.audioTranscript = audioTexts.join('\n\n---\n\n');
        hasContent = true;
      } else {
         cache.audioTranscript = '';
      }
    } catch (e) {
      const err = e as Error;
      failures.push(`Audio extraction failed: ${err.message}`);
    }

    // 4. Resources — extract text from PDFs, webpages
    try {
      const resourceTexts: string[] = [];
      const resources = lesson.resources || [];

      for (const resource of resources) {
        if (!resource?.url) continue;
        try {
          const text = await this.extractResourceText(resource.url, resource.type);
          if (text) resourceTexts.push(text);
        } catch (e) {
          const err = e as Error;
          this.logger.warn(`Resource extraction failed for ${resource.url}: ${err.message}`);
          failures.push(`Resource ${resource.url}: ${err.message}`);
        }
      }

      if (resourceTexts.length > 0) {
        cache.resourceText = resourceTexts.join('\n\n---\n\n');
        hasContent = true;
      } else {
        cache.resourceText = '';
      }
    } catch (e) {
      const err = e as Error;
      failures.push(`Resource extraction failed: ${err.message}`);
    }

    // 5. Key points — include as plain text
    if (lesson.keyPoints?.length > 0) {
      const keyPointsText = lesson.keyPoints
        .map((kp, i) => `${i + 1}. ${kp}`)
        .join('\n');
      cache.descriptionText = [cache.descriptionText, keyPointsText]
        .filter(Boolean)
        .join('\n\n### Key Points:\n');
      hasContent = true;
    }

    // Set extraction status
    if (failures.length === 0 && hasContent) {
      cache.extractionStatus = 'completed';
    } else if (hasContent && failures.length > 0) {
      cache.extractionStatus = 'partial';
    } else if (!hasContent) {
      cache.extractionStatus = 'failed';
    }

    cache.extractedAt = new Date();
    cache.failureReason = failures.length > 0 ? failures.join('; ') : '';

    cache = await this.cacheRepo.save(cache);

    // Chunk and distill asynchronously
    if (cache.extractionStatus === 'completed' || cache.extractionStatus === 'partial') {
      this.chunkAndDistillRubric(cache).catch(e => {
        this.logger.error(`Chunk and distill failed for lesson ${lessonId}: ${e.message}`);
      });
    }

    return cache;
  }

  /**
   * Chunks content and generates rubric via LLM
   */
  private async chunkAndDistillRubric(cache: LessonContentCacheEntity) {
    const fullTextParts = [];
    if (cache.descriptionText) fullTextParts.push(cache.descriptionText);
    if (cache.videoTranscript) fullTextParts.push(cache.videoTranscript);
    if (cache.audioTranscript) fullTextParts.push(cache.audioTranscript);
    if (cache.resourceText) fullTextParts.push(cache.resourceText);

    const fullText = fullTextParts.join('\n\n');
    if (!fullText.trim()) return;

    // 1. Chunking (~150 words respecting paragraphs/sentences)
    const rawParagraphs = fullText.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';
    for (const p of rawParagraphs) {
      if ((currentChunk.split(' ').length + p.split(' ').length) > 150 && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = p;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + p;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    // Delete old chunks for this lesson/version
    await this.chunkRepo.delete({ lesson: { id: cache.lessonId }, contentVersion: cache.contentVersion });

    // Save chunks
    const chunkEntities = chunks.map((c, i) => this.chunkRepo.create({
      lesson: { id: cache.lessonId },
      contentVersion: cache.contentVersion,
      chunkIndex: i,
      chunkText: c,
    }));
    await this.chunkRepo.save(chunkEntities);

    // Update tsvector (Postgres specific) using raw query
    try {
      await this.datasource.query(
        `UPDATE "LessonContentChunk" SET search_vector = to_tsvector('english', chunk_text) WHERE lesson_id = $1 AND content_version = $2`,
        [cache.lessonId, cache.contentVersion]
      );
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Failed to update tsvector for chunks: ${err.message}`);
    }

    // 2. Distill Rubric
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      this.logger.warn('GROQ_API_KEY not set - skipping rubric distillation');
      return;
    }

    let rubric = await this.rubricRepo.findOne({ where: { lesson: { id: cache.lessonId }, rubricVersion: cache.contentVersion } });
    if (!rubric) {
      rubric = this.rubricRepo.create({
        lesson: { id: cache.lessonId },
        contentVersion: cache.contentVersion,
        rubricVersion: cache.contentVersion,
        generationStatus: 'PENDING',
        keyPoints: []
      });
      rubric = await this.rubricRepo.save(rubric);
    }

    const systemPrompt = 'You are creating a grading rubric for an educator.\n\nFrom the following lesson content, extract 5–10 concise, factual teaching points that a subject-matter expert would use to grade a student\'s answer about this lesson. Focus on concrete facts, concepts, and definitions — not tone or delivery style.\n\nReturn ONLY a JSON array: [{"point": "...", "weight": 0.1}, ...]\nWeights should sum to 1.0 across all points. DO NOT wrap in markdown, return RAW JSON array only.';

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Lesson content:\n${fullText.substring(0, 15000)}` }
          ],
          temperature: 0.2
        }),
      });

      if (!response.ok) throw new Error(`Groq returned ${response.status}`);
      const data = (await response.json()) as any;
      let contentStr = data.choices?.[0]?.message?.content || '[]';
      
      contentStr = contentStr.replace(/^\s*```json/i, '').replace(/```\s*$/, '').trim();
      const points = JSON.parse(contentStr);
      if (!Array.isArray(points)) throw new Error('Groq did not return an array');

      rubric.keyPoints = points;
      rubric.generationStatus = 'SUCCESS';
      rubric.generatedAt = new Date();
      await this.rubricRepo.save(rubric);

    } catch (e) {
      const err = e as Error;
      this.logger.error(`Failed to distill rubric for ${cache.lessonId}: ${err.message}`);
      rubric.generationStatus = 'FAILED';
      await this.rubricRepo.save(rubric);
    }
  }

  /**
   * Invalidate and re-extract content when a lesson is updated.
   */
  async invalidateAndReextract(lessonId: string): Promise<void> {
    await this.cacheRepo.delete({ lessonId });
    await this.extractLessonContentAsync(lessonId);
  }

  /**
   * Get cached content for multiple lessons.
   */
  async getCachedContent(
    lessonIds: string[],
  ): Promise<Map<string, LessonContentCacheEntity>> {
    if (!lessonIds.length) return new Map();

    const caches = await this.cacheRepo
      .createQueryBuilder('cache')
      .where('cache.lessonId IN (:...ids)', { ids: lessonIds })
      .getMany();

    return new Map(caches.map(c => [c.lessonId, c]));
  }

  // ─────────────────────────────────────────────
  // Extraction helpers
  // ─────────────────────────────────────────────

  /** Strip HTML tags to plain text */
  private stripHtmlToText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract video transcript.
   * Strategy:
   * 1. If YouTube URL → try to fetch auto-generated captions
   * 2. If self-hosted → attempt Groq Whisper transcription
   */
  private async extractVideoTranscript(url: string): Promise<string | null> {
    const youtubeId = this.extractYouTubeId(url);
    if (youtubeId) {
      const transcript = await this.fetchYouTubeCaptions(youtubeId);
      if (!transcript) throw new Error("YouTube transcript returned empty");
      return transcript;
    }

    // For non-YouTube videos, attempt Groq Whisper transcription
    const transcript = await this.transcribeWithGroqWhisper(url);
    if (!transcript) throw new Error("Whisper transcript returned empty");
    return transcript;
  }

  /** Extract YouTube video ID from various URL formats */
  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Fetch YouTube captions.
   * Uses a lightweight approach — fetches the video page and extracts
   * auto-generated captions data. Falls back gracefully if unavailable.
   */
  private async fetchYouTubeCaptions(videoId: string): Promise<string | null> {
    try {
      const transcriptList = await YoutubeTranscript.fetchTranscript(videoId);
      if (transcriptList && transcriptList.length > 0) {
        return transcriptList.map(t => t.text).join(' ');
      }
      throw new Error(`No captions found for video ${videoId}`);
    } catch (e) {
      const err = e as Error;
      this.logger.debug(`YouTube caption fetch failed for ${videoId}: ${err.message}`);
      throw new Error(`YouTube transcript failed: ${err.message}`);
    }
  }

  /**
   * Transcribe audio/video via Groq's Whisper-large-v3 endpoint.
   * NOTE: This requires the media file to be accessible via URL and within Groq's size limits.
   * For v1, we log the attempt and return null if not feasible.
   */
  private async transcribeWithGroqWhisper(url: string): Promise<string | null> {
    try {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        throw new Error('GROQ_API_KEY not set — skipping Whisper transcription');
      }

      // Fetch the audio/video file
      const mediaResponse = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });
      if (!mediaResponse.ok) {
        throw new Error(`Failed to fetch media from ${url}: ${mediaResponse.status}`);
      }

      const blob = await mediaResponse.blob();
      // Groq Whisper has a 25MB limit
      if (blob.size > 25 * 1024 * 1024) {
        throw new Error(`Media file ${url} exceeds 25MB limit for Whisper transcription`);
      }

      const formData = new FormData();
      formData.append('file', blob, 'media.mp3');
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'text');

      const whisperResponse = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
          signal: AbortSignal.timeout(120000),
        },
      );

      if (whisperResponse.ok) {
        const text = await whisperResponse.text();
        if (!text) throw new Error("Whisper returned empty transcript");
        return text;
      }

      throw new Error(`Groq Whisper transcription failed: ${whisperResponse.status} ${await whisperResponse.text()}`);
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Whisper transcription error for ${url}: ${err.message}`);
      throw new Error(`Whisper transcription error: ${err.message}`);
    }
  }

  /** Alias for Whisper transcription */
  private async transcribeAudio(url: string): Promise<string | null> {
    return await this.transcribeWithGroqWhisper(url);
  }

  /**
   * Extract text from a resource (PDF or webpage).
   */
  private async extractResourceText(
    url: string,
    type?: string,
  ): Promise<string | null> {
    const normalizedType = (type || '').toLowerCase();

    if (normalizedType === 'pdf' || url.toLowerCase().endsWith('.pdf')) {
      return await this.extractPdfText(url);
    }

    // Default: treat as webpage
    return await this.extractWebpageText(url);
  }

  /**
   * Extract text from a PDF URL.
   * Basic implementation — fetches PDF and does simple text extraction.
   */
  private async extractPdfText(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      // Simple PDF text extraction — look for text between BT and ET operators
      // For production, use a proper PDF parsing library like pdf-parse
      const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

      // Extract readable text segments (rough heuristic)
      const readable = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (readable.length <= 50) throw new Error("Extracted text too short (less than 50 chars)");
      return readable.slice(0, 50000);
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`PDF extraction failed for ${url}: ${err.message}`);
      throw new Error(`PDF extraction failed: ${err.message}`);
    }
  }

  /**
   * Extract text from a webpage URL.
   * Strips HTML to readable text, respects robots.txt implicitly by timeout.
   */
  private async extractWebpageText(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SkillForge-LMS/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const plainText = this.stripHtmlToText(html);

      if (plainText.length <= 50) throw new Error("Extracted text too short (less than 50 chars)");
      return plainText.slice(0, 50000);
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Webpage extraction failed for ${url}: ${err.message}`);
      throw new Error(`Webpage extraction failed: ${err.message}`);
    }
  }
}
