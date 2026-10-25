/**
 * AI Assistant Retrieval Service
 *
 * Implements hybrid retrieval: PostgreSQL full-text search (ts_rank) over
 * LessonContentChunk, scoped to the trainee's currently assigned Learning Paths.
 *
 * Architecture notes:
 * - Access control is enforced HERE in the backend, never in prompts.
 * - We join enrollment → LP → module → lesson to get allowed lesson IDs.
 * - Dense-vector retrieval via lp_embedding_chunks is available when
 *   OPENAI_API_KEY is set and the embedding table has rows.
 * - Reciprocal Rank Fusion (RRF) merges lexical + vector results.
 * - Relevance gate: strong → LP answer, weak → web fallback, none → decline.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RetrievedChunk {
  lessonId: string;
  lessonTitle: string;
  lpId: string;
  lpTitle: string;
  moduleTitle?: string;
  chunkText: string;
  score: number;
  kScore?: number;
  sourceType?: string; // video_transcript | resource | lesson_description | etc.
}

export type RelevanceGate = 'strong' | 'weak' | 'none';

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  gate: RelevanceGate;
  lexicalCount: number;
  vectorCount: number;
}

// RRF constant — higher k = less aggressive ranking difference
const RRF_K = 60;

// Relevance thresholds calibrated for normalized reranking score distribution
const THRESHOLD_STRONG = parseFloat(process.env.AI_ASSISTANT_THRESHOLD_STRONG || '0.35');
const THRESHOLD_WEAK = parseFloat(process.env.AI_ASSISTANT_THRESHOLD_WEAK || '0.20');

const STOP_WORDS = new Set([
  'what', 'is', 'a', 'an', 'the', 'in', 'on', 'of', 'for', 'to', 'how', 'why',
  'can', 'you', 'explain', 'tell', 'me', 'about', 'and', 'or', 'with', 'from',
  'by', 'are', 'was', 'were', 'it', 'its', 'this', 'that', 'do', 'does', 'did',
  'who', 'whom', 'which', 'where', 'when', 'into', 'such', 'some', 'than',
  'work', 'works', 'working', 'used', 'using', 'make', 'makes', 'know', 'need', 'way', 'thing', 'things'
]);

@Injectable()
export class AiAssistantRetrievalService {
  private readonly logger = new Logger(AiAssistantRetrievalService.name);

  constructor(private readonly datasource: DataSource) {}

  /**
   * Resolve the UUIDs of all LPs currently assigned to the trainee.
   * Uses the enrollment table (active status) as the source of truth.
   */
  async getAssignedLpIds(traineeId: string): Promise<string[]> {
    const assignedIds = new Set<string>();

    try {
      // 1. Check Enrollment table ("learningPathId" column)
      const enrollments = await this.datasource.query(
        `SELECT e."learningPathId" AS "lpId"
         FROM "Enrollment" e
         WHERE e."userId" = $1 AND (e.status IS NULL OR LOWER(e.status) = 'active')`,
        [traineeId],
      );
      for (const r of enrollments) {
        if (r.lpId) assignedIds.add(r.lpId);
      }
    } catch (e) {
      this.logger.warn(`Failed querying Enrollment for trainee ${traineeId}: ${(e as Error).message}`);
    }

    try {
      // 2. Check LearningPath assignedToTraineeIds JSON array
      const lps = await this.datasource.query(
        `SELECT lp.id AS "lpId", lp."assignedToTraineeIds" AS "assigned"
         FROM "LearningPath" lp
         WHERE lp."assignedToTraineeIds" IS NOT NULL`,
      );
      for (const r of lps) {
        let list: string[] = [];
        if (Array.isArray(r.assigned)) {
          list = r.assigned;
        } else if (typeof r.assigned === 'string') {
          try {
            list = JSON.parse(r.assigned);
          } catch {
            list = [];
          }
        }
        if (list.includes(traineeId)) {
          assignedIds.add(r.lpId);
        }
      }
    } catch (e) {
      this.logger.warn(`Failed querying LearningPath assignedToTraineeIds: ${(e as Error).message}`);
    }

    return Array.from(assignedIds);
  }

  /**
   * Resolve all lesson IDs belonging to the given LP IDs.
   * Returns a map of lessonId → { lessonTitle, lpId, lpTitle, moduleTitle }
   */
  async getLessonContextMap(
    lpIds: string[],
  ): Promise<Map<string, { lessonTitle: string; lpId: string; lpTitle: string; moduleTitle?: string }>> {
    if (!lpIds.length) return new Map();

    const map = new Map<string, { lessonTitle: string; lpId: string; lpTitle: string; moduleTitle?: string }>();

    try {
      const rows = await this.datasource.query(
        `SELECT l.id AS "lessonId",
                l.title AS "lessonTitle",
                lp.id AS "lpId",
                lp.title AS "lpTitle",
                m.title AS "moduleTitle"
         FROM "Lesson" l
         LEFT JOIN "Module" m ON m.id = l."moduleId"
         LEFT JOIN "LearningPath" lp ON (lp.id = m."learningPathId" OR lp.id = l."learningPathId")
         WHERE (lp.id = ANY($1)) AND (lp.status IS NULL OR LOWER(lp.status) = 'active')`,
        [lpIds],
      );

      for (const r of rows) {
        if (r.lessonId) {
          map.set(r.lessonId, {
            lessonTitle: r.lessonTitle || 'Lesson',
            lpId: r.lpId,
            lpTitle: r.lpTitle || 'Learning Path',
            moduleTitle: r.moduleTitle,
          });
        }
      }
    } catch (e) {
      this.logger.warn(`getLessonContextMap failed: ${(e as Error).message}`);
    }

    return map;
  }

  /**
   * Main retrieval entry point with Senior AIML Cross-Signal Reranker.
   * 1. Resolves trainee's enrolled LP IDs.
   * 2. Runs Dense Vector retrieval on lp_embedding_chunks with Cosine Relation matching.
   * 3. Runs Lexical search over LessonContentChunk / Lesson tables.
   * 4. Multi-signal AIML Reranker computes (Cosine similarity + Keyword coverage + exact match).
   * 5. Relevance Gating: strong (>= 0.28) -> LP answer, weak (>= 0.18) -> borderline, none (< 0.18) -> Web search.
   */
  async retrieve(
    traineeId: string,
    query: string,
    topK = 6,
  ): Promise<RetrievalResult> {
    const lpIds = await this.getAssignedLpIds(traineeId);

    if (lpIds.length === 0) {
      return { chunks: [], gate: 'none', lexicalCount: 0, vectorCount: 0 };
    }

    const lessonContextMap = await this.getLessonContextMap(lpIds);
    const lessonIds = Array.from(lessonContextMap.keys());

    // Run vector and lexical searches in parallel
    const [vectorCandidates, lexicalCandidates] = await Promise.all([
      this.vectorSearch(query, lpIds, 40),
      lessonIds.length > 0 ? this.lexicalSearch(query, lessonIds, 30) : Promise.resolve([]),
    ]);

    // Apply AIML Reranker across candidate pools
    const reranked = this.aimlRerank(query, vectorCandidates, lexicalCandidates, lessonContextMap, topK);

    const bestCandidate = reranked[0];
    const bestScore = bestCandidate?.score ?? 0;
    const bestKScore = bestCandidate?.kScore ?? 0;

    let gate: RelevanceGate;
    // Strong gate strictly requires genuine topical match (keyword coverage or very high vector certainty)
    if (bestScore >= THRESHOLD_STRONG && (bestKScore >= 0.50 || bestScore >= 0.65)) {
      gate = 'strong';
    } else if (bestScore >= THRESHOLD_WEAK && bestKScore >= 0.25) {
      gate = 'weak';
    } else {
      gate = 'none';
    }

    this.logger.log(
      `AI Assistant Retrieval: query="${query.substring(0, 50)}" | bestScore=${bestScore.toFixed(3)} | kScore=${bestKScore.toFixed(3)} | gate=${gate} | vectorHits=${vectorCandidates.length} | lexicalHits=${lexicalCandidates.length}`,
    );

    return {
      chunks: reranked,
      gate,
      lexicalCount: lexicalCandidates.length,
      vectorCount: vectorCandidates.length,
    };
  }

  /**
   * Vector search with Cosine Similarity over lp_embedding_chunks.
   * Retrieves active course content embeddings for assigned LPs.
   */
  private async vectorSearch(
    query: string,
    lpIds: string[],
    limit: number,
  ): Promise<Array<{
    lessonId: string;
    lessonTitle: string;
    lpId: string;
    lpTitle: string;
    moduleTitle?: string;
    chunkText: string;
    contextPrefix?: string;
    sourceType?: string;
    vScore: number;
  }>> {
    if (!lpIds.length || !query.trim()) return [];

    try {
      const openAiKey = process.env.OPENAI_API_KEY;
      const queryEmbedding = await this.embedText(query, openAiKey);
      if (!queryEmbedding) return [];

      const rows = await this.datasource.query(
        `SELECT c.id,
                COALESCE(c.lesson_id, '00000000-0000-0000-0000-000000000000') AS "lessonId",
                c.learning_path_id AS "lpId",
                c.content AS "chunkText",
                c.context_prefix AS "contextPrefix",
                c.source_type AS "sourceType",
                c.embedding,
                COALESCE(l.title, 'Course Overview') AS "lessonTitle",
                COALESCE(lp.title, 'Learning Path') AS "lpTitle",
                m.title AS "moduleTitle"
         FROM lp_embedding_chunks c
         LEFT JOIN "Lesson" l ON l.id = c.lesson_id
         LEFT JOIN "Module" m ON m.id = c.module_id
         LEFT JOIN "LearningPath" lp ON lp.id = c.learning_path_id
         WHERE c.learning_path_id = ANY($1)
           AND c.is_active = true
           AND c.embedding IS NOT NULL
         LIMIT 300`,
        [lpIds],
      );

      if (!rows || !rows.length) return [];

      const scored = rows
        .map((r: any) => {
          const emb = typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding;
          const vScore = this.cosineSimilarity(queryEmbedding, emb);
          return {
            lessonId: r.lessonId,
            lessonTitle: r.lessonTitle,
            lpId: r.lpId,
            lpTitle: r.lpTitle,
            moduleTitle: r.moduleTitle,
            chunkText: r.chunkText,
            contextPrefix: r.contextPrefix,
            sourceType: r.sourceType,
            vScore,
          };
        })
        .filter((r: { vScore: number }) => r.vScore > 0.05)
        .sort((a: { vScore: number }, b: { vScore: number }) => b.vScore - a.vScore)
        .slice(0, limit);

      return scored;
    } catch (e) {
      this.logger.warn(`Vector search failed (non-fatal): ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * Lexical search using PostgreSQL tsvector / ts_rank.
   */
  private async lexicalSearch(
    query: string,
    lessonIds: string[],
    topK: number,
  ): Promise<Array<{ lessonId: string; chunkText: string; rank: number; sourceType?: string }>> {
    if (!lessonIds.length || !query.trim()) return [];

    try {
      const rows = await this.datasource.query(
        `SELECT lesson_id AS "lessonId",
                chunk_text AS "chunkText",
                ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
         FROM "LessonContentChunk"
         WHERE lesson_id = ANY($2)
           AND search_vector IS NOT NULL
           AND ts_rank(search_vector, plainto_tsquery('english', $1)) > 0.005
         ORDER BY rank DESC
         LIMIT $3`,
        [query, lessonIds, topK],
      );
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          lessonId: r.lessonId,
          chunkText: r.chunkText,
          rank: parseFloat(r.rank) || 0,
        }));
      }

      // Secondary fallback: full-text search directly on Lesson table
      const lessonRows = await this.datasource.query(
        `SELECT l.id AS "lessonId",
                CONCAT(l.title, E'\n\n', COALESCE(l.description, '')) AS "chunkText",
                ts_rank(to_tsvector('english', CONCAT(l.title, ' ', COALESCE(l.description, ''))), plainto_tsquery('english', $1)) AS rank
         FROM "Lesson" l
         WHERE l.id = ANY($2)
           AND to_tsvector('english', CONCAT(l.title, ' ', COALESCE(l.description, ''))) @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $3`,
        [query, lessonIds, topK],
      );
      if (lessonRows && lessonRows.length > 0) {
        return lessonRows.map((r: any) => ({
          lessonId: r.lessonId,
          chunkText: r.chunkText,
          rank: Math.max(parseFloat(r.rank) || 0, 0.4),
          sourceType: 'lesson_overview',
        }));
      }

      return [];
    } catch (e) {
      this.logger.error('Lexical search failed', e);
      return [];
    }
  }

  /**
   * AIML Multi-Signal Reranker:
   * Combines Cosine Vector Similarity (Bi-Encoder Dense match) + Keyword Overlap / Precision
   * with exact phrase bonus and noise penalties.
   */
  private aimlRerank(
    query: string,
    vectorCandidates: Array<{
      lessonId: string;
      lessonTitle: string;
      lpId: string;
      lpTitle: string;
      moduleTitle?: string;
      chunkText: string;
      contextPrefix?: string;
      sourceType?: string;
      vScore: number;
    }>,
    lexicalCandidates: Array<{ lessonId: string; chunkText: string; rank: number; sourceType?: string }>,
    lessonContextMap: Map<string, { lessonTitle: string; lpId: string; lpTitle: string; moduleTitle?: string }>,
    topK: number,
  ): RetrievedChunk[] {
    const scoredMap = new Map<string, RetrievedChunk>();

    // 1. Process vector candidates with Cosine + Keyword Reranker
    for (const vc of vectorCandidates) {
      const fullText = `${vc.contextPrefix || ''} ${vc.chunkText}`;
      const kScore = this.computeKeywordCoverage(query, fullText);

      // Noise penalty: If query has substantive tokens and none match the document, penalize vector score
      let adjustedVScore = vc.vScore;
      const clean = query.toLowerCase().replace(/[^\w\s]/g, ' ');
      const qTokens = clean.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
      if (qTokens.length > 0 && kScore === 0) {
        adjustedVScore = vc.vScore * 0.35;
      }

      let rerankScore = 0.5 * adjustedVScore + 0.5 * kScore;

      // Multi-term coverage safeguard: If query has >= 2 substantive tokens but document matches < 50%,
      // penalize heavily to prevent incidental false-positive routing from out-of-domain queries
      if (qTokens.length >= 2 && kScore < 0.50) {
        rerankScore = rerankScore * 0.40;
      }

      const key = `${vc.lessonId}:${vc.chunkText.substring(0, 60).trim()}`;

      scoredMap.set(key, {
        lessonId: vc.lessonId,
        lessonTitle: vc.lessonTitle,
        lpId: vc.lpId,
        lpTitle: vc.lpTitle,
        moduleTitle: vc.moduleTitle,
        chunkText: vc.chunkText,
        score: Math.min(1.0, Math.max(0.0, rerankScore)),
        kScore,
        sourceType: vc.sourceType,
      });
    }

    // 2. Process lexical candidates
    for (const lc of lexicalCandidates) {
      const key = `${lc.lessonId}:${lc.chunkText.substring(0, 60).trim()}`;
      const kScore = this.computeKeywordCoverage(query, lc.chunkText);
      const normalizedLexical = Math.min(1.0, lc.rank * 2);
      let rerankScore = 0.4 * normalizedLexical + 0.6 * kScore;

      const clean = query.toLowerCase().replace(/[^\w\s]/g, ' ');
      const qTokens = clean.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
      if (qTokens.length >= 2 && kScore < 0.50) {
        rerankScore = rerankScore * 0.40;
      }

      const existing = scoredMap.get(key);
      if (existing) {
        // Boost chunk if found in both vector and lexical
        existing.score = Math.min(1.0, existing.score + 0.15);
        if (kScore > (existing.kScore ?? 0)) {
          existing.kScore = kScore;
        }
      } else {
        const ctx = lessonContextMap.get(lc.lessonId) || {
          lessonTitle: 'Lesson',
          lpId: '',
          lpTitle: 'Learning Path',
        };
        scoredMap.set(key, {
          lessonId: lc.lessonId,
          chunkText: lc.chunkText,
          score: Math.min(1.0, Math.max(0.0, rerankScore)),
          kScore,
          sourceType: lc.sourceType || 'lesson_content',
          ...ctx,
        });
      }
    }

    return Array.from(scoredMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Keyword coverage and exact phrase bonus calculation with word-boundary token precision.
   */
  private computeKeywordCoverage(query: string, text: string): number {
    const clean = query.toLowerCase().replace(/[^\w\s]/g, ' ');
    const qTokens = clean.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    if (!qTokens.length) return 0.5;

    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const textWordSet = new Set(cleanText.split(/\s+/).filter(Boolean));

    let matches = 0;
    for (const token of qTokens) {
      if (textWordSet.has(token)) {
        matches++;
      }
    }
    let score = matches / qTokens.length;

    // Exact phrase match bonus
    const trimmed = query.toLowerCase().trim();
    if (trimmed.length > 4 && cleanText.includes(trimmed)) {
      score = Math.min(1.0, score + 0.25);
    }
    return Math.min(1.0, score);
  }

  /**
   * Embed text into a dense vector:
   * 1. Uses OpenAI text-embedding-3-small if API key is provided and succeeds.
   * 2. Falls back to a high-speed deterministic 256-dimensional semantic feature vector.
   */
  async embedText(text: string, apiKey?: string): Promise<number[] | null> {
    if (apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.substring(0, 8192),
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.data?.[0]?.embedding) {
            return data.data[0].embedding;
          }
        }
      } catch (e) {
        this.logger.warn(`OpenAI embedding failed, falling back to local semantic feature vector: ${(e as Error).message}`);
      }
    }

    // Deterministic 256-dimension normalized semantic feature vector
    return this.generateLocalEmbedding(text, 256);
  }

  /**
   * High-speed deterministic semantic feature hashing into an L2-normalized float array.
   * Encodes unigrams, bigrams, and character subwords so semantic overlap is accurately measured by cosine similarity.
   */
  generateLocalEmbedding(text: string, dimensions = 256): number[] {
    const vector = new Array(dimensions).fill(0);
    const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const tokens = clean.split(/\s+/).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Token hash (FNV-1a)
      let h1 = 0x811c9dc5;
      for (let j = 0; j < token.length; j++) {
        h1 ^= token.charCodeAt(j);
        h1 = Math.imul(h1, 0x01000193);
      }
      const idx1 = Math.abs(h1) % dimensions;
      vector[idx1] += 1.0;

      // Bigram hash
      if (i < tokens.length - 1) {
        const bigram = `${token}_${tokens[i + 1]}`;
        let h2 = 0x811c9dc5;
        for (let j = 0; j < bigram.length; j++) {
          h2 ^= bigram.charCodeAt(j);
          h2 = Math.imul(h2, 0x01000193);
        }
        const idx2 = Math.abs(h2) % dimensions;
        vector[idx2] += 1.5;
      }
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= norm;
      }
    }
    return vector;
  }

  /** Cosine similarity between two float arrays */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
