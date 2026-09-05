import axios from 'axios';
import { API_BASE_URL } from '../api';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'user' | 'learning_path' | 'assignment';
  group: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResultItem[];
}

const getAuthHeaders = (token: string, role: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'x-active-role': role,
    'Content-Type': 'application/json',
  },
});

export const searchService = {
  globalSearch: async (query: string, token: string, role: string): Promise<SearchResponse> => {
    try {
      const response = await axios.get<SearchResponse>(
        `${API_BASE_URL}/search?q=${encodeURIComponent(query)}`,
        getAuthHeaders(token, role)
      );
      return response.data;
    } catch (error: any) {
      console.error('Search error:', error);
      return { results: [] };
    }
  },
};
