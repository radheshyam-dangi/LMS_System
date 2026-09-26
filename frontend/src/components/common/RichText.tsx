import React, { useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface RichTextProps {
  content?: string | Record<string, any> | null;
  emptyStateText?: string;
  className?: string;
}

export function RichText({
  content,
  emptyStateText = 'No description yet',
  className = '',
}: RichTextProps) {
  // Determine if content is truly empty
  const isEmpty = useMemo(() => {
    if (!content) return true;
    if (typeof content === 'string') {
      const stripped = content.replace(/<[^>]*>?/gm, '').trim();
      return stripped.length === 0;
    }
    // For Tiptap JSON
    if (typeof content === 'object' && content.content) {
      if (content.content.length === 0) return true;
      if (content.content.length === 1 && content.content[0].type === 'paragraph' && !content.content[0].content) {
        return true;
      }
    }
    return false;
  }, [content]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: isEmpty ? undefined : content,
    editable: false,
  }, [content]); // Re-initialize if content changes

  if (isEmpty) {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{emptyStateText}</span>;
  }

  return (
    <div className={`rich-text-container ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}
