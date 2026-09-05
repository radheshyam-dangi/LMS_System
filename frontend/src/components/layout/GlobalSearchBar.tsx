import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { searchService, type SearchResultItem } from '../../services/searchService';

interface GlobalSearchBarProps {
  activeRole: string;
}

export function GlobalSearchBar({ activeRole }: GlobalSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const accessToken = localStorage.getItem('skillforge_access_token');
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd+K / Ctrl+K Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          setIsOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchSearch = async () => {
      if (!accessToken) return;
      const res = await searchService.globalSearch(debouncedQuery, accessToken, activeRole);
      if (isMounted) {
        setResults(res.results);
        setIsLoading(false);
        setSelectedIndex(-1); // reset selection
      }
    };

    fetchSearch();
    return () => { isMounted = false; };
  }, [debouncedQuery, accessToken, activeRole]);

  // Grouped results for rendering
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResultItem[]> = {};
    results.forEach((r) => {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    });
    return groups;
  }, [results]);

  const flatResults = useMemo(() => {
    const flat: SearchResultItem[] = [];
    Object.values(groupedResults).forEach(group => flat.push(...group));
    return flat;
  }, [groupedResults]);

  // Keyboard navigation within dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
        handleSelectResult(flatResults[selectedIndex]);
      }
    }
  };

  const handleSelectResult = (result: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    setDebouncedQuery('');
    
    // Navigate
    navigate(result.url);
  };

  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} style={{ background: '#fef08a', color: '#854d0e', padding: '0 2px', borderRadius: '2px' }}>
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="search-field" ref={containerRef} style={{ position: 'relative' }}>
      <span className="search-icon"><Search size={18} /></span>
      <input
        ref={inputRef}
        placeholder="Search anything... ⌘K"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleInputKeyDown}
        style={{ width: '100%' }}
      />
      {!isOpen && (
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: 12, color: '#64748b', border: '1px solid #e2e8f0' }}>
            ⌘K
          </kbd>
        </div>
      )}

      {isOpen && query.length >= 2 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '400px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {isLoading && flatResults.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              <Loader2 className="animate-spin" style={{ margin: '0 auto 8px' }} size={24} />
              Searching...
            </div>
          ) : flatResults.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              No results for "{query}"
            </div>
          ) : (
            <>
              {Object.entries(groupedResults).map(([groupName, items]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{ padding: '4px 16px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {groupName}
                  </div>
                  {items.map((item) => {
                    const globalIndex = flatResults.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectResult(item)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          background: isSelected ? '#f8fafc' : '#fff',
                          borderLeft: isSelected ? '3px solid #4f46e5' : '3px solid transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a' }}>
                          {highlightMatch(item.title, debouncedQuery)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {highlightMatch(item.subtitle, debouncedQuery)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
