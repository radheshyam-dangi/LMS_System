import { Logger } from '@nestjs/common';

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

const logger = new Logger('TrainerWebSearchHelper');

/**
 * Resilient multi-tier external web search helper:
 * 1. Tavily Search (if TAVILY_API_KEY configured)
 * 2. Brave Search (if BRAVE_API_KEY configured)
 * 3. Educational Open Web Search (Wikipedia REST API) fallback
 */
export async function executeWebSearch(
  query: string,
  topic: 'general' | 'documentation' | 'youtube' = 'general',
): Promise<WebSearchResult[]> {
  const searchQuery = topic === 'youtube' ? `${query} youtube tutorial` : query;

  // 1. Tavily Search
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: searchQuery.substring(0, 400),
          search_depth: 'basic',
          max_results: 5,
          include_answer: false,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.results && data.results.length > 0) {
          return data.results.map((r: any) => ({
            title: r.title || 'Web Result',
            url: r.url || '',
            content: r.content || '',
          }));
        }
      }
    } catch (e) {
      logger.warn(`Tavily search failed: ${(e as Error).message}`);
    }
  }

  // 2. Brave Search
  if (process.env.BRAVE_API_KEY) {
    try {
      const params = new URLSearchParams({ q: searchQuery.substring(0, 400), count: '5' });
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.web?.results && data.web.results.length > 0) {
          return data.web.results.map((r: any) => ({
            title: r.title || 'Web Result',
            url: r.url || '',
            content: r.description || '',
          }));
        }
      }
    } catch (e) {
      logger.warn(`Brave search failed: ${(e as Error).message}`);
    }
  }

  // 3. Fallback: Educational Open Web Search via Wikipedia API
  try {
    const cleaned = query
      .replace(/^(who\s+won|how\s+does|how\s+do|what\s+is|what\s+are|tell\s+me\s+about|explain|can\s+you\s+explain|describe)\s+/i, '')
      .replace(/[?.,!]+$/, '')
      .trim();

    if (cleaned.length >= 2) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        cleaned,
      )}&limit=3&namespace=0&format=json`;

      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'SkillForge-LMS-AI/1.0 (educational research bot)' },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const titles: string[] = data[1] || [];
        const snippets: string[] = data[2] || [];
        const urls: string[] = data[3] || [];

        const results: WebSearchResult[] = [];
        for (let i = 0; i < titles.length; i++) {
          if (titles[i] && urls[i]) {
            results.push({
              title: titles[i],
              url: urls[i],
              content: snippets[i] || `Wikipedia documentation reference for ${titles[i]}`,
            });
          }
        }
        if (results.length > 0) return results;
      }
    }
  } catch (e) {
    logger.warn(`Public web fallback failed: ${(e as Error).message}`);
  }

  return [];
}

