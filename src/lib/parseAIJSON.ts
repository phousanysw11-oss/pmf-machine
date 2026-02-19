export function parseAIJSON(text: string) {
  let cleaned = (text ?? '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|javascript)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse AI response:', text);
    return null;
  }
}

