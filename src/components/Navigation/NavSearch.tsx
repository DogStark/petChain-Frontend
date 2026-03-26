import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import NavIcon from './NavIcon';
import { debounce } from '@/utils/debounce';

interface NavSearchProps {
  onClose?: () => void;
  autoFocus?: boolean;
}

export default function NavSearch({ onClose, autoFocus }: NavSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setSuggestions([]); return; }
      try {
        const res = await fetch(`/api/v1/search/autocomplete?query=${encodeURIComponent(q)}&type=global`);
        const data = await res.json();
        setSuggestions(data.suggestions?.slice(0, 5) ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 300),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
    fetchSuggestions(e.target.value);
  };

  const submit = (q = query) => {
    if (!q.trim()) return;
    setOpen(false);
    onClose?.();
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { setOpen(false); onClose?.(); }
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
        <NavIcon name="search" className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
          placeholder="Search pets, vets, records…"
          aria-label="Search"
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none min-w-0"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="text-gray-400 hover:text-gray-600"
          >
            <NavIcon name="x" className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
        >
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                onClick={() => { setQuery(s); submit(s); }}
              >
                <NavIcon name="search" className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
