import { buildAgentPrompt } from './prompts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  json?: boolean; // sets response_format: { type: 'json_object' }
}

// ── Core client ───────────────────────────────────────────────────────────

/**
 * Calls the Groq API and returns the parsed message content string.
 * Throws on API error or missing API key.
 */
export async function callGroq(
  messages: GroqMessage[],
  options: GroqOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    max_tokens = 1024,
    json = false,
  } = options;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned empty response');
  }

  return content;
}

/**
 * Parses a JSON response from Groq with a typed cast.
 * Throws a descriptive error if the response is not valid JSON.
 */
export async function callGroqJSON<T>(
  messages: GroqMessage[],
  options: Omit<GroqOptions, 'json'> = {}
): Promise<T> {
  const content = await callGroq(messages, { ...options, json: true });
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Groq returned non-JSON content: ${content.slice(0, 200)}`);
  }
}