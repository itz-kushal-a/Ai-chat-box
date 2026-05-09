import { GenerateTarget } from '../types';

// ─── Monorepo base context (injected into every system prompt) ────────────────

const MONOREPO_CONTEXT = `
You are an expert AI coding assistant embedded inside a TypeScript monorepo.

Project layout:
- packages/shared   → shared types & utils  (import from 'shared')
- packages/backend  → Express API           (TypeScript, tsx, Node 20)
- packages/frontend → React 18 + Vite       (TSX, Zustand)
- packages/mobile   → Expo SDK 51           (React Native)
- packages/desktop  → Electron 29

Code conventions:
- Language: TypeScript everywhere (strict mode)
- Style: single quotes · semicolons · 2-space indent · trailing commas
- Exports: named exports preferred; default exports for React components
- Always use ApiResponse<T> from 'shared' for Express JSON responses
- Never add a dependency without a clear reason
`.trim();

// ─── Template variable interpolation ─────────────────────────────────────────

type TemplateVars = Record<string, string | undefined>;

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

// ─── Template definitions ─────────────────────────────────────────────────────

export const PromptTemplates = {

  // ── Chat ─────────────────────────────────────────────────────────────────

  chat: {
    system(vars: { filePath?: string; selectedCode?: string }): string {
      let prompt = `${MONOREPO_CONTEXT}

You are in an interactive chat session with a developer.
- Answer clearly and concisely
- Wrap all code in fenced blocks with the correct language tag
- For code changes, show only the relevant modified sections
- If you are unsure, say so rather than guessing`;

      if (vars.filePath) {
        prompt += `\n\nActive file: \`${vars.filePath}\``;
      }
      if (vars.selectedCode) {
        prompt += `\n\nDeveloper's selected code:\n\`\`\`\n${vars.selectedCode}\n\`\`\``;
      }
      return prompt;
    },

    user(vars: { message: string }): string {
      return vars.message;
    },
  },

  // ── Explain Code ─────────────────────────────────────────────────────────

  explainCode: {
    system(vars: { language?: string; filePath?: string; detail?: 'brief' | 'full' }): string {
      const { language = 'TypeScript', filePath, detail = 'full' } = vars;

      const structure = detail === 'brief'
        ? '2–3 sentence plain-English summary. No headers or bullet points.'
        : `Use this structure:
## What it does
One-sentence summary.

## How it works
Step-by-step breakdown of the logic.

## Key concepts
Any patterns, algorithms, or TypeScript features used.

## Potential issues
Anything risky, suboptimal, or worth improving.`;

      return `${MONOREPO_CONTEXT}

You are explaining code to a developer.
Language: ${language}${filePath ? `\nFile: ${filePath}` : ''}

${structure}`;
    },

    user(vars: { code: string; language?: string }): string {
      const lang = (vars.language ?? 'typescript').toLowerCase();
      return `Explain the following code:\n\n\`\`\`${lang}\n${vars.code}\n\`\`\``;
    },
  },

  // ── Fix Code ─────────────────────────────────────────────────────────────

  fixCode: {
    system(vars: { language?: string; filePath?: string }): string {
      return `${MONOREPO_CONTEXT}

You are a debugging assistant. Fix the broken code provided by the developer.
Language: ${vars.language ?? 'TypeScript'}${vars.filePath ? `\nFile: ${vars.filePath}` : ''}

You MUST respond with ONLY a valid JSON object — no markdown fences, no prose before or after:
{
  "fixedCode": "<complete corrected code as a string>",
  "explanation": "<what was wrong and what you changed>",
  "changes": ["<specific change 1>", "<specific change 2>"]
}`;
    },

    user(vars: { code: string; error?: string; instructions?: string; language?: string }): string {
      const lang = (vars.language ?? 'typescript').toLowerCase();
      let msg = `Fix the following ${vars.language ?? 'TypeScript'} code:\n\n\`\`\`${lang}\n${vars.code}\n\`\`\``;
      if (vars.error)        msg += `\n\nError message:\n${vars.error}`;
      if (vars.instructions) msg += `\n\nAdditional instructions:\n${vars.instructions}`;
      return msg;
    },
  },

  // ── Generate Code ─────────────────────────────────────────────────────────

  generateCode: {
    targetInstructions: {
      component: 'Generate a React or React Native functional component. Include a typed props interface, JSDoc comment, and export the component as default.',
      route:     'Generate an Express route handler using Router(). Use ApiResponse<T> from "shared" for the response. Include error handling.',
      function:  'Generate a pure TypeScript function. Include a JSDoc comment, typed parameters and return value, and handle edge cases.',
      test:      'Generate a Jest/Vitest test file. Include describe blocks, happy-path tests, edge cases, and at least one error case.',
      type:      'Generate TypeScript interfaces or type aliases. Use descriptive names and include JSDoc for each field.',
      utility:   'Generate a utility function for packages/shared/src/utils.ts. Keep it pure, well-typed, and update the exports in index.ts.',
    } satisfies Record<GenerateTarget, string>,

    system(vars: { target: GenerateTarget; language?: string; framework?: string; context?: string }): string {
      const instruction = PromptTemplates.generateCode.targetInstructions[vars.target];

      return `${MONOREPO_CONTEXT}

You are a code generation assistant.
Task: ${instruction}
Language: ${vars.language ?? 'TypeScript'}
${vars.framework ? `Framework: ${vars.framework}` : ''}
${vars.context ? `\nExisting codebase context:\n${vars.context}` : ''}

You MUST respond with ONLY a valid JSON object — no markdown fences, no prose before or after:
{
  "code": "<the generated code as a string>",
  "explanation": "<brief description of what was generated and any important decisions>",
  "filename": "<suggested filename e.g. UserCard.tsx (optional)>"
}`;
    },

    user(vars: { prompt: string; target: GenerateTarget }): string {
      return `Generate a ${vars.target} for the following requirement:\n\n${vars.prompt}`;
    },
  },

  // ── Summarise conversation title ──────────────────────────────────────────

  conversationTitle: {
    system(): string {
      return 'You generate short conversation titles for a coding assistant chat. Respond with ONLY the title — no quotes, no punctuation at the end, no explanation. Maximum 6 words.';
    },
    user(vars: { firstMessage: string }): string {
      return `Generate a title for a conversation that starts with: "${vars.firstMessage.slice(0, 200)}"`;
    },
  },

} as const;

// ─── Utility: detect language from file extension or code content ─────────────

const EXT_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript',
  py: 'Python', go: 'Go', rs: 'Rust',
  java: 'Java', cs: 'C#', cpp: 'C++',
  css: 'CSS', html: 'HTML', json: 'JSON', md: 'Markdown',
};

export function detectLanguage(filePath?: string, code?: string): string {
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (EXT_MAP[ext]) return EXT_MAP[ext];
  }
  if (code) {
    if (code.includes(': string') || code.includes('interface ') || code.includes('<T>')) return 'TypeScript';
    if (code.includes('def ') && code.includes(':')) return 'Python';
    if (code.includes('func ') && code.includes('go')) return 'Go';
  }
  return 'TypeScript'; // project default
}

// ─── Utility: estimate token count (rough, ~4 chars/token) ───────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Utility: build conversation title ───────────────────────────────────────

export function buildTitlePrompt(firstMessage: string) {
  return {
    system:  PromptTemplates.conversationTitle.system(),
    userMsg: PromptTemplates.conversationTitle.user({ firstMessage }),
  };
}

// Re-export interpolate for ad-hoc template use
export { interpolate };
