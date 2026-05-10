import { callGroqJSON, type GroqMessage } from '@/lib/groq';

export type VideoBriefOutput = {
  script_30s: string;
  hook: string;
  broll_ideas: string[];
  spark_ad_notes: string;
};

export async function runVideoBriefAgent(input: {
  idea: string;
  tiktok_hook: string;
  tiktok_overlay: string;
  brand?: string;
}): Promise<VideoBriefOutput> {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content:
        'You are a TikTok paid ads strategist. Reply with strict JSON only. Keys: script_30s (spoken script ~30s), hook (on-screen hook), broll_ideas (array of 4 strings), spark_ad_notes (Spark Ads setup checklist as one paragraph).',
    },
    {
      role: 'user',
      content: `Product/idea:\n${input.idea}\n\nTikTok hook:\n${input.tiktok_hook}\nOverlay:\n${input.tiktok_overlay}\nBrand: ${input.brand ?? '—'}`,
    },
  ];
  return callGroqJSON<VideoBriefOutput>(messages, { max_tokens: 1800, temperature: 0.55 });
}
