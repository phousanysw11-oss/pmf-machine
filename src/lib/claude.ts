/**
 * Server-side Claude API helper.
 * Use only on the server — keeps ANTHROPIC_API_KEY out of the client.
 */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

function getApiKey(): string {
  const raw = process.env.ANTHROPIC_API_KEY;
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) {
    throw new Error('Missing ANTHROPIC_API_KEY. Add it to .env.local');
  }
  return key;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let message = responseText || response.statusText;
    try {
      const errJson = JSON.parse(responseText) as { error?: { message?: string } };
      if (errJson?.error?.message) message = errJson.error.message;
    } catch {
      // use raw message
    }
    throw new Error(`Claude API error (${response.status}): ${message}`);
  }

  let data: { content?: Array<{ type?: string; text?: string }> };
  try {
    data = JSON.parse(responseText) as typeof data;
  } catch {
    throw new Error('Invalid JSON in Claude API response');
  }

  const textBlock = data.content?.find((block) => block.type === 'text');
  return textBlock?.text ?? '';
}
