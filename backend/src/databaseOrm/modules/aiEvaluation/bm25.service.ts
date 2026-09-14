/**
 * BM25 (Okapi BM25) In-Memory Ranking Service
 *
 * Provides deterministic, lexical text-ranking without embeddings or external services.
 * Used as a fallback when combined lesson content exceeds the Groq model's token budget.
 *
 * Design decision: No external library needed — BM25 is a well-understood formula
 * (tf-idf with length normalization) that can be implemented in ~100 lines.
 */
import { Injectable } from '@nestjs/common';

interface BM25Document {
  id: string;
  text: string;
}

interface ScoredChunk {
  id: string;
  text: string;
  score: number;
}

@Injectable()
export class Bm25Service {
  // BM25 parameters (standard defaults)
  private readonly k1 = 1.5;
  private readonly b = 0.75;

  /**
   * Rank text chunks by BM25 relevance to a query.
   * Returns chunks sorted by score (descending).
   */
  rank(documents: BM25Document[], query: string): ScoredChunk[] {
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0 || documents.length === 0) {
      return documents.map(d => ({ ...d, score: 0 }));
    }

    // Build corpus-level statistics
    const N = documents.length;
    const tokenizedDocs = documents.map(d => ({
      ...d,
      tokens: this.tokenize(d.text),
    }));

    const avgDl =
      tokenizedDocs.reduce((sum, d) => sum + d.tokens.length, 0) / N;

    // Document frequency for each query term
    const df = new Map<string, number>();
    for (const term of queryTerms) {
      let count = 0;
      for (const doc of tokenizedDocs) {
        if (doc.tokens.includes(term)) count++;
      }
      df.set(term, count);
    }

    // Score each document
    const scored: ScoredChunk[] = tokenizedDocs.map(doc => {
      let score = 0;
      const dl = doc.tokens.length;

      // Build term frequency map for this document
      const tf = new Map<string, number>();
      for (const token of doc.tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      for (const term of queryTerms) {
        const termDf = df.get(term) || 0;
        const termTf = tf.get(term) || 0;

        if (termDf === 0 || termTf === 0) continue;

        // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
        const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);

        // TF component with length normalization
        const tfNorm =
          (termTf * (this.k1 + 1)) /
          (termTf + this.k1 * (1 - this.b + this.b * (dl / avgDl)));

        score += idf * tfNorm;
      }

      return { id: doc.id, text: doc.text, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Select top-K chunks from a ranked list until the token budget is filled.
   * Uses a greedy approach: take highest-scoring chunks first.
   */
  selectWithinBudget(
    rankedChunks: ScoredChunk[],
    tokenBudget: number,
  ): string {
    const selected: string[] = [];
    let currentTokens = 0;

    for (const chunk of rankedChunks) {
      const chunkTokens = this.estimateTokens(chunk.text);
      if (currentTokens + chunkTokens > tokenBudget) {
        // Try to fit remaining budget with partial text
        if (selected.length === 0) {
          // At least include a truncated version of the best chunk
          const truncated = chunk.text.slice(0, tokenBudget * 4); // ~4 chars per token
          selected.push(truncated);
        }
        break;
      }
      selected.push(chunk.text);
      currentTokens += chunkTokens;
    }

    return selected.join('\n\n');
  }

  /**
   * Split text into paragraph-level chunks for ranking.
   */
  splitIntoChunks(text: string, maxChunkSize = 500): BM25Document[] {
    const paragraphs = text.split(/\n{2,}/);
    const chunks: BM25Document[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (currentChunk.length + trimmed.length > maxChunkSize * 4) {
        if (currentChunk) {
          chunks.push({ id: `chunk_${chunkIndex++}`, text: currentChunk });
          currentChunk = '';
        }
        // If single paragraph exceeds chunk size, split further
        if (trimmed.length > maxChunkSize * 4) {
          const sentences = trimmed.split(/(?<=[.!?])\s+/);
          let sentenceChunk = '';
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length > maxChunkSize * 4) {
              chunks.push({ id: `chunk_${chunkIndex++}`, text: sentenceChunk });
              sentenceChunk = sentence;
            } else {
              sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            }
          }
          if (sentenceChunk) currentChunk = sentenceChunk;
        } else {
          currentChunk = trimmed;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }

    if (currentChunk) {
      chunks.push({ id: `chunk_${chunkIndex++}`, text: currentChunk });
    }

    return chunks;
  }

  /** Simple whitespace tokenizer with lowercasing and stopword removal */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !this.STOP_WORDS.has(t));
  }

  /** Rough token count estimation (~1 token per 4 characters for English) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'its', 'this', 'that', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'shall', 'can', 'not', 'no', 'nor', 'so', 'too', 'very', 'just',
    'than', 'then', 'also', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'only', 'own', 'same', 'into', 'over',
    'after', 'before', 'between', 'under', 'about', 'out', 'up',
  ]);
}
