import { GenerateTarget } from '../types';

// ─── Base system prompt ───────────────────────────────────────────────────────

const BASE_PROMPT = `You are an expert AI coding assistant embedded in a TypeScript monorepo project.
The monorepo uses npm workspaces and contains these packages:
- packages/shared   — shared TypeScript types and utilities (import from 'shared')
- packages/backend  — Express API server (TypeScript, tsx)
- packages/frontend — React + Vite web app (TSX)
- packages/mobile   — Expo React Native app
- packages/desktop  — Electron desktop app

Rules:
- Always write TypeScript, not JavaScript, unless asked otherwise
- Use types from the 'shared' package when relevant (User, ApiResponse<T>, etc.)
- Follow the existing code style: single quotes, semicolons, 2-space indent
- Prefer named exports over default exports for utilities
- Never suggest installing packages without explaining why`;

// ─── Chat system prompt ───────────────────────────────────────────────────────

export function buildChatSystemPrompt(options: {
  filePath?: string;
  selectedCode?: string;
}): string {
  const { filePath, selectedCode } = options;
  let prompt = `${BASE_PROMPT}

You are in a chat session with the developer. Answer clearly and concisely.
When providing code, wrap it in fenced code blocks with the correct language tag.
If asked to insert or modify code, show only the relevant changed sections.`;

  if (filePath) {
    prompt += `\n\nThe developer is currently working on: ${filePath}`;
  }

  if (selectedCode) {
    prompt += `\n\nThe developer has selected this code for context:\n\`\`\`\n${selectedCode}\n\`\`\``;
  }

  return prompt;
}

// ─── Explain system prompt ────────────────────────────────────────────────────

export function buildExplainSystemPrompt(options: {
  language?: string;
  filePath?: string;
  detail?: 'brief' | 'full';
}): string {
  const { language, filePath, detail = 'full' } = options;

  const detailInstructions = detail === 'brief'
    ? 'Give a 2-3 sentence plain-English summary. No bullet points.'
    : `Structure your explanation as:
1. **What it does** — one-sentence summary
2. **How it works** — step-by-step breakdown
3. **Key concepts** — any patterns, algorithms, or TypeScript features used
4. **Potential issues** — anything that looks risky or could be improved`;

  return `${BASE_PROMPT}

You are explaining code to a developer. Be accurate, educational, and concise.
${detailInstructions}
${language ? `The code is written in ${language}.` : ''}
${filePath ? `It comes from the file: ${filePath}` : ''}`;
}

// ─── Fix system prompt ────────────────────────────────────────────────────────

export function buildFixSystemPrompt(options: {
  language?: string;
  filePath?: string;
  errorMessage?: string;
}): string {
  const { language, filePath, errorMessage } = options;

  return `${BASE_PROMPT}

You are a debugging assistant. Your job is to fix broken code.
${errorMessage ? `The developer reports this error: "${errorMessage}"` : ''}
${language ? `The code is written in ${language}.` : ''}
${filePath ? `The file is: ${filePath}` : ''}

Respond ONLY with a JSON object in this exact format (no markdown wrapper):
{
  "fixedCode": "the complete corrected code",
  "explanation": "what was wrong and what you changed",
  "changes": ["change 1", "change 2"]
}`;
}

// ─── Generate system prompt ───────────────────────────────────────────────────

const TARGET_INSTRUCTIONS: Record<GenerateTarget, string> = {
  component: 'Generate a React or React Native component. Include props interface, proper typing, and JSDoc.',
  route:     'Generate an Express route handler. Use ApiResponse<T> from shared for the response type.',
  function:  'Generate a well-typed TypeScript function. Include JSDoc comment and edge case handling.',
  test:      'Generate a test file using Jest/Vitest. Include happy path, edge cases, and error cases.',
  type:      'Generate TypeScript interfaces or types. Use descriptive names, include JSDoc.',
  utility:   'Generate a utility function for the shared package. Keep it pure and well-typed.',
};

export function buildGenerateSystemPrompt(options: {
  target: GenerateTarget;
  language?: string;
  framework?: string;
  context?: string;
}): string {
  const { target, language, framework, context } = options;

  return `${BASE_PROMPT}

You are a code generation assistant.
Task: ${TARGET_INSTRUCTIONS[target]}
${language ? `Language: ${language}` : 'Language: TypeScript'}
${framework ? `Framework/library: ${framework}` : ''}
${context ? `Additional context from the codebase:\n${context}` : ''}

Respond ONLY with a JSON object in this exact format (no markdown wrapper):
{
  "code": "the generated code",
  "explanation": "brief description of what was generated",
  "filename": "suggested filename (optional)"
}`;
}

// ─── Token budget estimation (rough) ─────────────────────────────────────────

export function estimateTokens(text: string): number {
  // ~4 characters per token (rough estimate)
  return Math.ceil(text.length / 4);
}

export function detectLanguage(filePath?: string, code?: string): string {
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript',
      jsx: 'JavaScript', py: 'Python', go: 'Go', rs: 'Rust',
      java: 'Java', css: 'CSS', html: 'HTML', json: 'JSON', md: 'Markdown',
    };
    if (ext && map[ext]) return map[ext];
  }
  // Simple heuristic from code content
  if (code?.includes('interface ') || code?.includes(': string')) return 'TypeScript';
  if (code?.includes('def ') || code?.includes('import ')) return 'Python';
  return 'TypeScript'; // default for this project
}
