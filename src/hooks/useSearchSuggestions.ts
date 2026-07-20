import { useState, useRef, useCallback, useEffect } from 'react';
import { Keyboard } from 'react-native';

export function useSearchSuggestions(urlInput: string, isInputFocused: boolean, onNavigate: (url: string) => void, setUrlInput: (url: string) => void) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((query: string) => {
    if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Skip fetching suggestions if input looks like a full URL
    if (/^https?:\/\//i.test(query)) {
      setSuggestions([]);
      return;
    }

    suggestionsTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`
        );
        const text = await response.text();
        const parsed = JSON.parse(text);
        // Google returns: [query, [suggestions], ...]  
        if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
          setSuggestions(parsed[1].slice(0, 6));
        }
      } catch (e) {
        // Silently fail - suggestions are not critical
      }
    }, 250); // 250ms debounce
  }, []);

  const handleSelectSuggestion = (suggestion: string) => {
    setSuggestions([]);
    setUrlInput(suggestion);
    onNavigate(suggestion);
    Keyboard.dismiss();
  };

  // Fetch suggestions when urlInput changes while focused
  useEffect(() => {
    if (isInputFocused) {
      fetchSuggestions(urlInput);
    } else {
      setSuggestions([]);
    }
  }, [urlInput, isInputFocused, fetchSuggestions]);

  return {
    suggestions,
    handleSelectSuggestion,
  };
}
