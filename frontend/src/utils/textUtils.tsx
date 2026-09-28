import React from 'react';
import DOMPurify from 'dompurify';
/**
 * Sanitizes input text before saving to the DB.
 * Converts literal \n sequences into actual newline characters.
 */
export function sanitizeTextInput(raw: string | undefined | null): string {
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

/**
 * Renders multiline text safely, handling both literal \n strings
 * and actual newline characters.
 */
export function renderMultilineText(text: string | undefined | null) {
  if (!text) return null;
  return text.split(/\\n|\n/).map((line, i) => (
    <React.Fragment key={i}>
      {line}
      <br />
    </React.Fragment>
  ));
}

export function isTiptapContentEmpty(content: string | null | undefined): boolean {
  if (!content) return true;
  // Strip all HTML tags and whitespace; if nothing textual remains, it's empty
  const textOnly = content.replace(/<[^>]*>/g, '').trim();
  return textOnly.length === 0;
}

export function ModuleDescription({ description }: { description?: string }) {
  if (isTiptapContentEmpty(description)) {
    return <p className="description-empty" style={{ margin: 0, opacity: 0.9, fontSize: 15 }}>No description provided for this module yet.</p>;
  }
  const safeHtml = DOMPurify.sanitize(description!);
  return <div className="description-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
