// Server-side HTML sanitization shim.
// DOMPurify requires a DOM — on Node.js we use a pattern-based strip.
// This handles user-provided HTML from the GrapesJS editor.

export const DOMPurify = {
  sanitize: (html: string): string => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\son\w+\s*=[^\s>]*/gi, '')
      .replace(/javascript\s*:/gi, 'data:')
      .replace(/vbscript\s*:/gi, 'data:')
      .slice(0, 500_000);
  },
};
