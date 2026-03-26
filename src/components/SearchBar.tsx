import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../utils/debounce';

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
  searchType?: 'pets' | 'vets' | 'medical-records' | 'emergency-services' | 'global';
}

export interface SearchFilters {
  breed?: string;
  minAge?: number;
  maxAge?: number;
  location?: string;
  specialty?: string;
  condition?: string;
  treatment?: string;
  serviceType?: string;
  is24Hours?: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export default function SearchBar({
  onSearch,
  placeholder = 'Search pets, vets, medical records...',
  showFilters = true,
  searchType = 'global',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popularQueries, setPopularQueries] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch popular queries on mount
  useEffect(() => {
    fetchPopularQueries();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPopularQueries = async () => {
    try {
      const response = await fetch('/api/v1/search/popular?limit=5');
      const data = await response.json();
      setPopularQueries(data.map((item: any) => item.query));
    } catch (error) {
      console.error('Failed to fetch popular queries:', error);
    }
  };

  const fetchSuggestions = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/search/autocomplete?query=${encodeURIComponent(searchQuery)}&type=${searchType}`
      );
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  // Debounced autocomplete
  const debouncedFetchSuggestions = useCallback(
    debounce((searchQuery: string) => {
      fetchSuggestions(searchQuery);
    }, 300),
    [searchType]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);
    debouncedFetchSuggestions(value);
  };

  const handleSearch = () => {
    setShowSuggestions(false);
    onSearch(query, filters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion, filters);
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);
  };

  const applyFilters = () => {
    setShowFilterPanel(false);
    onSearch(query, filters);
  };

  const clearFilters = () => {
    setFilters({});
    onSearch(query, {});
  };

  const getGeolocation = () => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const updatedFilters = {
            ...filters,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            radius: filters.radius || 10,
          };
          setFilters(updatedFilters);
          setIsLoading(false);
          onSearch(query, updatedFilters);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLoading(false);
          alert('Unable to get your location. Please enable location services.');
        }
      );
    } else {
      setIsLoading(false);
      alert('Geolocation is not supported by your browser.');
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-3xl mx-auto">
      {/* Search Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pl-12 pr-4 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          {/* Suggestions Dropdown */}
          {showSuggestions && (suggestions.length > 0 || popularQueries.length > 0) && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs text-gray-500 px-2 py-1 font-semibold">Suggestions</div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {popularQueries.length > 0 && (
                <div className="p-2 border-t">
                  <div className="text-xs text-gray-500 px-2 py-1 font-semibold">Popular Searches</div>
                  {popularQueries.map((popular, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(popular)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {popular}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Search
        </button>

        {showFilters && (
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        )}

        <button
          onClick={getGeolocation}
          disabled={isLoading}
          className="px-4 py-3 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 transition-colors shadow-sm disabled:opacity-50"
          title="Use my location"
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="absolute z-10 w-full mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-3">Advanced Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Common Filters */}
            {(searchType === 'pets' || searchType === 'global') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                  <input
                    type="text"
                    value={filters.breed || ''}
                    onChange={(e) => handleFilterChange('breed', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minAge || ''}
                      onChange={(e) => handleFilterChange('minAge', parseInt(e.target.value))}
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxAge || ''}
                      onChange={(e) => handleFilterChange('maxAge', parseInt(e.target.value))}
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {(searchType === 'vets' || searchType === 'global') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input
                  type="text"
                  value={filters.specialty || ''}
                  onChange={(e) => handleFilterChange('specialty', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {(searchType === 'medical-records' || searchType === 'global') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <input
                    type="text"
                    value={filters.condition || ''}
                    onChange={(e) => handleFilterChange('condition', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
                  <input
                    type="text"
                    value={filters.treatment || ''}
                    onChange={(e) => handleFilterChange('treatment', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {(searchType === 'emergency-services' || searchType === 'global') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                  <input
                    type="text"
                    value={filters.serviceType || ''}
                    onChange={(e) => handleFilterChange('serviceType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is24Hours"
                    checked={filters.is24Hours || false}
                    onChange={(e) => handleFilterChange('is24Hours', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is24Hours" className="ml-2 text-sm font-medium text-gray-700">
                    24/7 Only
                  </label>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={filters.location || ''}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                placeholder="City, State"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {filters.latitude && filters.longitude && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Radius (km)</label>
                <input
                  type="number"
                  value={filters.radius || 10}
                  onChange={(e) => handleFilterChange('radius', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={filters.sortBy || 'relevance'}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="relevance">Relevance</option>
                <option value="date">Date</option>
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
