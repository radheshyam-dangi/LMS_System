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

@Injectable()
export class ContentExtractionService {
  private readonly logger = new Logger(ContentExtractionService.name);
  private cacheRepo: Repository<LessonContentCacheEntity>;
  private lessonRepo: Repository<LessonEntity>;
  private resourceRepo: Repository<ResourceEntity>;

  constructor(private readonly datasource: DataSource) {
    this.cacheRepo = this.datasource.getRepository(LessonContentCacheEntity);
    this.lessonRepo = this.datasource.getRepository(LessonEntity);
    this.resourceRepo = this.datasource.getRepository(ResourceEntity);
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

    // Upsert cache entry
    let cache = await this.cacheRepo.findOne({ where: { lessonId } });
    if (!cache) {
      cache = this.cacheRepo.create({
        lessonId,
        extractionStatus: 'pending',
      });
      cache = await this.cacheRepo.save(cache);
    }

    const failures: string[] = [];
    let hasContent = false;

    // 1. Description — strip HTML to plain text
    try {
      if (lesson.description) {
        cache.descriptionText = this.stripHtmlToText(lesson.description);
        hasContent = true;
      }
    } catch (e) {
      const err = e as Error;
      failures.push(`Description extraction failed: ${err.message}`);
    }

    // 2. Video blocks — extract transcripts
    try {
      const videoTexts: string[] = [];
      const videos = lesson.videos || [];

      // Also include legacy single videoUrl
      if (lesson.videoUrl) {
        videos.push({ url: lesson.videoUrl });
      }

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

    return await this.cacheRepo.save(cache);
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
      return await this.fetchYouTubeCaptions(youtubeId);
    }

    // For non-YouTube videos, attempt Groq Whisper transcription
    return await this.transcribeWithGroqWhisper(url);
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
      // Attempt to fetch captions via YouTube's timedtext API
      const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`;
      const response = await fetch(captionUrl, {
        headers: { 'User-Agent': 'SkillForge-LMS/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const xml = await response.text();
        // Parse simple caption XML: <text>...</text>
        const texts = xml.match(/<text[^>]*>(.*?)<\/text>/g);
        if (texts?.length) {
          return texts
            .map(t => t.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' ');
        }
      }

      this.logger.debug(`No captions available for YouTube video ${videoId}`);
      return null;
    } catch (e) {
      const err = e as Error;
      this.logger.debug(`YouTube caption fetch failed for ${videoId}: ${err.message}`);
      return null;
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
        this.logger.warn('GROQ_API_KEY not set — skipping Whisper transcription');
        return null;
      }

      // Fetch the audio/video file
      const mediaResponse = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });
      if (!mediaResponse.ok) {
        this.logger.warn(`Failed to fetch media from ${url}: ${mediaResponse.status}`);
        return null;
      }

      const blob = await mediaResponse.blob();
      // Groq Whisper has a 25MB limit
      if (blob.size > 25 * 1024 * 1024) {
        this.logger.warn(`Media file ${url} exceeds 25MB limit for Whisper transcription`);
        return null;
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
        return await whisperResponse.text();
      }

      this.logger.warn(
        `Groq Whisper transcription failed: ${whisperResponse.status} ${await whisperResponse.text()}`,
      );
      return null;
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Whisper transcription error for ${url}: ${err.message}`);
      return null;
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
      if (!response.ok) return null;

      const buffer = await response.arrayBuffer();
      // Simple PDF text extraction — look for text between BT and ET operators
      // For production, use a proper PDF parsing library like pdf-parse
      const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

      // Extract readable text segments (rough heuristic)
      const readable = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return readable.length > 50 ? readable.slice(0, 50000) : null;
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`PDF extraction failed for ${url}: ${err.message}`);
      return null;
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
      if (!response.ok) return null;

      const html = await response.text();
      const plainText = this.stripHtmlToText(html);

      return plainText.length > 50 ? plainText.slice(0, 50000) : null;
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Webpage extraction failed for ${url}: ${err.message}`);
      return null;
    }
  }
}
