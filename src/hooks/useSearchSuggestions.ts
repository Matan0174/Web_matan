import { useState, useRef, useCallback, useEffect } from 'react';
import { Keyboard } from 'react-native';

export function useSearchSuggestions(urlInput: string, isInputFocused: boolean, onNavigate: (url: string) => void, setUrlInput: (url: string) => void) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Identifies the newest request, so a slower earlier one cannot overwrite it. */
  const requestSeq = useRef(0);

  const fetchSuggestions = useCallback((query: string) => {
    if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);
    const requestId = ++requestSeq.current;

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
          `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&ie=UTF-8&oe=UTF-8`
        );
        const text = await response.text();
        const parsed = JSON.parse(text);
        if (requestId !== requestSeq.current) return;
        // Google returns: [query, [suggestions], ...]
        setSuggestions(
          Array.isArray(parsed) && Array.isArray(parsed[1]) ? parsed[1].slice(0, 6) : []
        );
      } catch (e) {
        // Silently fail - suggestions are not critical
        if (requestId === requestSeq.current) setSuggestions([]);
      }
    }, 250); // 250ms debounce
  }, []);

  useEffect(
    () => () => {
      if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);
    },
    []
  );

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
