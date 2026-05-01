// ─── API Response wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  plan: 'free' | 'pro' | 'team';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Express.Request {
  user: JwtPayload;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  selectedCode?: string;
  filePath?: string;
  conversationId?: string;
  stream?: boolean;
}

export interface ChatResponse {
  reply: string;
  conversationId: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// ─── Explain Code ─────────────────────────────────────────────────────────────

export interface ExplainCodeRequest {
  code: string;
  language?: string;
  filePath?: string;
  detail?: 'brief' | 'full';
}

export interface ExplainCodeResponse {
  explanation: string;
  language: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// ─── Fix Code ─────────────────────────────────────────────────────────────────

export interface FixCodeRequest {
  code: string;
  error?: string;
  language?: string;
  filePath?: string;
  instructions?: string;
}

export interface FixCodeResponse {
  fixedCode: string;
  explanation: string;
  changes: string[];
  language: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// ─── Generate Code ────────────────────────────────────────────────────────────

export type GenerateTarget =
  | 'component'
  | 'route'
  | 'function'
  | 'test'
  | 'type'
  | 'utility';

export interface GenerateCodeRequest {
  prompt: string;
  target: GenerateTarget;
  language?: string;
  framework?: string;
  context?: string;
  filePath?: string;
}

export interface GenerateCodeResponse {
  code: string;
  explanation: string;
  filename?: string;
  language: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// ─── AI Service ───────────────────────────────────────────────────────────────

export interface AIRequestOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// ─── Validation errors ────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}
