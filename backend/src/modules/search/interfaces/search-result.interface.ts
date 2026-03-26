export interface FacetCount {
  value: string;
  count: number;
}

export interface SearchResult<T = any> {
  results: (T & { relevanceScore?: number; distance?: number })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTime: number;
  facets?: Record<string, FacetCount[]>;
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
