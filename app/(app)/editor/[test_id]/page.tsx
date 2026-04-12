'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function EditorPage({
  params,
}: {
  params: Promise<{ test_id: string }>;
}) {
  const { test_id } = use(params);
  const router = useRouter();
  const editorRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [lpUrl, setLpUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initEditor() {
      // Dynamic import to avoid SSR issues
      const grapesjs = (await import('grapesjs')).default;
      await import('grapesjs/dist/css/grapes.min.css');

      if (cancelled || !containerRef.current) return;

      const editor = grapesjs.init({
        container: containerRef.current,
        height: 'calc(100vh - 64px)',
        width: '100%',
        storageManager: false,
        plugins: [],
        canvas: {
          styles: [
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
          ],
        },
        panels: { defaults: [] },
        deviceManager: {
          devices: [
            { name: 'Desktop', width: '' },
            { name: 'Mobile', width: '375px', widthMedia: '480px' },
          ],
        },
      });

      editorRef.current = editor;

      // Try to load existing LP data
      try {
        const res = await fetch(`/api/tests/${test_id}/metrics`);
        if (res.ok) {
          const data = await res.json();
          if (data.test?.lp_json) {
            editor.loadProjectData(data.test.lp_json);
          } else {
            // Default template
            editor.setComponents(`
              <div style="max-width:800px;margin:0 auto;padding:40px 20px;font-family:Inter,sans-serif;color:#FAFAFA;">
                <h1 style="font-size:2.5rem;font-weight:700;margin-bottom:1rem;">Your Headline Here</h1>
                <p style="font-size:1.25rem;color:#A1A1A1;margin-bottom:2rem;">
                  Describe your value proposition. Make it compelling.
                </p>
                <a href="#signup" style="display:inline-block;padding:14px 32px;background:#FAFAFA;color:#0A0A0A;border-radius:8px;text-decoration:none;font-weight:600;">
                  Get Started
                </a>
              </div>
            `);
            editor.setStyle(`
              body { background: #0A0A0A; min-height: 100vh; }
            `);
          }
          if (data.test?.lp_url) {
            setLpUrl(data.test.lp_url);
          }
        }
      } catch (err) {
        console.error('Failed to load LP data:', err);
      }

      setLoaded(true);
    }

    initEditor();
    return () => { cancelled = true; };
  }, [test_id]);

  const handleSave = async () => {
    const editor = editorRef.current as {
      getProjectData: () => Record<string, unknown>;
      getHtml: () => string;
      getCss: () => string;
    } | null;
    if (!editor) return;

    setSaving(true);
    try {
      const gjsData = editor.getProjectData();
      const html = editor.getHtml();
      const css = editor.getCss();

      // Inline CSS into HTML for the deploy
      const fullBody = `<style>${css}</style>${html}`;

      const res = await fetch('/api/lp/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id,
          gjsData,
          html: fullBody,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) setLpUrl(data.url);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A]">
      {/* Toolbar */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[#262626] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm">LP Editor</span>
          <Badge variant="outline" className="text-xs font-mono">{test_id.slice(0, 8)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {lpUrl && (
            <Button variant="outline" size="sm" onClick={() => window.open(lpUrl, '_blank')}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Preview
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !loaded}>
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            {saving ? 'Deploying…' : 'Save & Deploy'}
          </Button>
        </div>
      </div>

      {/* Editor canvas */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
