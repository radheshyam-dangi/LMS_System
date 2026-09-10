import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Clock } from 'lucide-react';
import { searchService, type SearchResultItem } from '../../services/searchService';

interface GlobalSearchBarProps {
  activeRole: string;
}

const RECENT_SEARCHES_KEY = 'skillforge_recent_searches';

export function GlobalSearchBar({ activeRole }: GlobalSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMac, setIsMac] = useState(false);

  const accessToken = localStorage.getItem('skillforge_access_token');
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Detect OS for keyboard hint
    const platform = window.navigator?.platform || '';
    setIsMac(platform.toLowerCase().includes('mac'));
  }, []);

  // Global Cmd+K / Ctrl+K Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          setQuery('');
          inputRef.current.focus();
          setIsOpen(true);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
    if (!debouncedQuery || debouncedQuery.trim().length < 1) {
      setResults([]);
      setIsLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let isMounted = true;
    setIsLoading(true);

    const fetchSearch = async () => {
      if (!accessToken) return;
      try {
        const res = await searchService.globalSearch(debouncedQuery, accessToken, activeRole);
        if (isMounted && !abortController.signal.aborted) {
          setResults(res.results);
          setIsLoading(false);
          setSelectedIndex(-1); // reset selection
        }
      } catch (error: any) {
        if (isMounted && !abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchSearch();
    return () => { 
      isMounted = false; 
      abortController.abort();
    };
  }, [debouncedQuery, accessToken, activeRole]);

  const displayResults = debouncedQuery.trim().length < 1 ? [] : results;

  // Grouped results for rendering
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResultItem[]> = {};
    displayResults.forEach((r) => {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    });
    return groups;
  }, [displayResults]);

  const flatResults = useMemo(() => {
    const flat: SearchResultItem[] = [];
    Object.values(groupedResults).forEach(group => flat.push(...group));
    return flat;
  }, [groupedResults]);

  const [dropdownPos, setDropdownPos] = useState({ top: 'calc(100% + 8px)', bottom: 'auto' });

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < 400 && spaceAbove > spaceBelow) {
        setDropdownPos({ top: 'auto', bottom: 'calc(100% + 8px)' });
      } else {
        setDropdownPos({ top: 'calc(100% + 8px)', bottom: 'auto' });
      }
    }
  }, [isOpen, displayResults.length]);

  // Keyboard navigation within dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
      }
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
    inputRef.current?.blur();
    
    // Navigate directly
    navigate(result.url);
  };

  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim() || debouncedQuery.trim().length < 1) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} style={{ padding: '0 2px', borderRadius: '2px', backgroundColor: 'rgba(79, 70, 229, 0.15)', color: '#4f46e5' }}>
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const shortcutText = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <div className="search-field" ref={containerRef} style={{ position: 'relative' }}>
      <span className="search-icon"><Search size={18} /></span>
      <input
        ref={inputRef}
        placeholder="Search anything..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleInputKeyDown}
        style={{ 
          width: '100%',
          outline: 'none',
          transition: 'box-shadow 0.2s',
          ...(isOpen ? { boxShadow: '0 0 0 2px rgba(79, 70, 229, 0.4)' } : {})
        }}
      />
      {!isOpen && (
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: 12, color: '#64748b', border: '1px solid #e2e8f0' }}>
            {shortcutText}
          </kbd>
        </div>
      )}

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: dropdownPos.top,
            bottom: dropdownPos.bottom,
            left: 0,
            width: '400px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
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
          ) : flatResults.length === 0 && debouncedQuery.trim().length >= 1 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              No results for "{query}"
            </div>
          ) : flatResults.length === 0 && debouncedQuery.trim().length < 1 ? (
             <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              <Search size={20} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
              Type to start searching...
             </div>
          ) : (
            <>
              {Object.entries(groupedResults).map(([groupName, items]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{ padding: '4px 16px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {debouncedQuery.trim().length < 1 && <Clock size={12} />}
                    {debouncedQuery.trim().length < 1 ? 'Recent ' + groupName : groupName}
                  </div>
                  {items.map((item) => {
                    const globalIndex = flatResults.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // prevent blur
                          e.currentTarget.style.transform = 'scale(0.98)';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          handleSelectResult(item);
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(79, 70, 229, 0.08)' : '#fff',
                          borderLeft: isSelected ? '3px solid #4f46e5' : '3px solid transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          transition: 'transform 0.1s ease, background 0.1s ease',
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
