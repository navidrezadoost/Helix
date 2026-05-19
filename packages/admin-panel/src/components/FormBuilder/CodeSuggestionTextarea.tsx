import { useMemo, useRef, useState, type FC } from 'react';
import { Braces, Sparkles } from 'lucide-react';

interface CodeSuggestionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

const TOKEN_PATTERN = /[A-Za-z0-9_.]+$/;

export const CodeSuggestionTextarea: FC<CodeSuggestionTextareaProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  rows = 3,
  className = 'fb-textarea',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectionStart = textareaRef.current?.selectionStart ?? value.length;
  const beforeCursor = value.slice(0, selectionStart);
  const tokenMatch = beforeCursor.match(TOKEN_PATTERN);
  const activeToken = tokenMatch?.[0] ?? '';

  const filteredSuggestions = useMemo(() => {
    const normalizedToken = activeToken.trim().toLowerCase();
    const uniqueSuggestions = Array.from(new Set(suggestions));

    if (!normalizedToken) {
      return uniqueSuggestions.slice(0, 8);
    }

    return uniqueSuggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(normalizedToken))
      .slice(0, 8);
  }, [activeToken, suggestions]);

  const showSuggestions = isFocused && filteredSuggestions.length > 0;

  const applySuggestion = (suggestion: string) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursor);
    const textAfterCursor = value.slice(cursor);
    const token = textBeforeCursor.match(TOKEN_PATTERN);
    const replaceStart = token ? cursor - token[0].length : cursor;
    const nextValue = `${value.slice(0, replaceStart)}${suggestion}${textAfterCursor}`;

    onChange(nextValue);
    setActiveIndex(0);

    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      const nextCursor = replaceStart + suggestion.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="fb-code-editor">
      <div className="fb-code-input-wrap">
        <textarea
          ref={textareaRef}
          className={className}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(0);
          }}
          onClick={() => setActiveIndex(0)}
          onKeyDown={(event) => {
            if (!showSuggestions) {
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % filteredSuggestions.length);
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
            }

            if ((event.key === 'Enter' || event.key === 'Tab') && filteredSuggestions[activeIndex]) {
              event.preventDefault();
              applySuggestion(filteredSuggestions[activeIndex]);
            }

            if (event.key === 'Escape') {
              setIsFocused(false);
            }
          }}
        />

        {showSuggestions ? (
          <div className="fb-code-suggestions" role="listbox">
            <div className="fb-code-suggestions-header">
              <span>
                <Sparkles className="w-3.5 h-3.5" /> Suggestions
              </span>
              <span>
                <Braces className="w-3.5 h-3.5" /> {activeToken || 'inputs'}
              </span>
            </div>
            <div className="fb-code-suggestions-list">
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  className={`fb-code-suggestion-item ${index === activeIndex ? 'active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
