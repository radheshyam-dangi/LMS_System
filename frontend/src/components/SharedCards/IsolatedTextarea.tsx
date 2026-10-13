import React, { useState, useEffect, useCallback, useRef } from 'react';

interface IsolatedTextareaProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const IsolatedTextarea: React.FC<IsolatedTextareaProps> = React.memo(({
  id,
  name,
  value,
  onChange,
  placeholder,
  rows = 5,
  required = false,
  maxLength = 10000,
  className = '',
  style,
}) => {
  const [localVal, setLocalVal] = useState(value || '');

  // Sync external changes (e.g. initial load or reset)
  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  // Directly propagate change without debounce for immediate feedback
  const propagateChange = useCallback((newVal: string) => {
    onChange(newVal);
  }, [onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let text = e.target.value;
    if (maxLength && text.length > maxLength) {
      text = text.slice(0, maxLength);
    }
    setLocalVal(text);
    propagateChange(text);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Prevent default paste behavior and stop propagation to avoid form submission
    e.stopPropagation();
    e.preventDefault();
    const pastedText = e.clipboardData?.getData('text/plain') || '';
    if (!pastedText) return;

    const textarea = e.currentTarget;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;

    const before = localVal.substring(0, start);
    const after = localVal.substring(end);
    let combined = before + pastedText + after;

    if (maxLength && combined.length > maxLength) {
      combined = combined.slice(0, maxLength);
    }

    setLocalVal(combined);
    propagateChange(combined);

    // Reposition cursor after paste
    requestAnimationFrame(() => {
      const newCursor = Math.min(start + pastedText.length, combined.length);
      textarea.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent accidental form submission when pressing Enter in textarea
    if (e.key === 'Enter' && !e.shiftKey) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const charCount = localVal.length;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        value={localVal}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        style={{
          width: '100%',
          fontFamily: 'inherit',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
      />
      {maxLength && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: '11px',
            color: charCount >= maxLength ? '#ef4444' : '#94a3b8',
            marginTop: '4px',
            userSelect: 'none',
          }}
        >
          {charCount.toLocaleString()} / {maxLength.toLocaleString()} characters
        </div>
      )}
    </div>
  );
});

IsolatedTextarea.displayName = 'IsolatedTextarea';
