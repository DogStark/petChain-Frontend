export interface SearchResult<T = any> {
  results: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTime: number;
  filters?: Record<string, any>;
}

export interface AutocompleteResult {
  suggestions: string[];
  popular: string[];
}

export interface PopularQuery {
  query: string;
  count: number;
  lastSearched: Date;
}
