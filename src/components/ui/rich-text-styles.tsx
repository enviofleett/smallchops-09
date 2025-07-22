
import React from 'react';

export const RichTextStyles = () => {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        .rich-text-editor .ProseMirror {
          outline: none;
          min-height: 80px;
        }
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .rich-text-editor .ProseMirror h1 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        .rich-text-editor .ProseMirror h2 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        .rich-text-editor .ProseMirror h3 {
          font-size: 1.125em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        .rich-text-editor .ProseMirror ul, .rich-text-editor .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .rich-text-editor .ProseMirror li {
          margin: 0.25em 0;
        }
        .rich-text-editor .ProseMirror strong {
          font-weight: 600;
        }
        .rich-text-editor .ProseMirror em {
          font-style: italic;
        }
      `
    }} />
  );
};
