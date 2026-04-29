# UI/UX Design Specification
## AI Coding Assistant — Phase 2

**Version:** 1.0  
**Date:** April 29, 2026

---

## 1. Design Principles

- **Density-first:** Developers want information, not whitespace
- **Dark by default:** Easy on the eyes during long coding sessions
- **Keyboard-driven:** Every action reachable without a mouse
- **Monorepo-aware:** File explorer reflects workspace structure

---

## 2. Layout Overview

The app is a three-panel layout on desktop, collapsible to two panels, and single-panel on mobile.

```
┌─────────────────────────────────────────────────────────┐
│  TopBar: Logo | Breadcrumb | Actions | User Avatar       │
├──────────┬──────────────────────────┬────────────────────┤
│          │                          │                    │
│  File    │    Code Editor           │   AI Chat          │
│ Explorer │    (Monaco)              │   Panel            │
│  Panel   │                          │                    │
│  250px   │    flex-grow             │   360px            │
│          │                          │                    │
├──────────┴──────────────────────────┴────────────────────┤
│  StatusBar: Branch | Errors | Warnings | AI Status       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Component Structure

### 3.1 AppShell
```
AppShell
├── TopBar
│   ├── Logo
│   ├── Breadcrumb
│   ├── CommandPalette (Ctrl+K)
│   └── UserMenu
├── MainLayout (flex row)
│   ├── FileExplorer (collapsible, 250px)
│   ├── EditorPanel (flex-grow)
│   │   ├── TabBar
│   │   ├── MonacoEditor
│   │   └── EditorToolbar
│   └── ChatPanel (collapsible, 360px)
│       ├── ChatHeader
│       ├── MessageList
│       ├── ContextBar (attached file/selection)
│       └── ChatInput
└── StatusBar
```

---

## 4. File Explorer Panel

**Width:** 250px (collapsible to 0)  
**Toggle:** Ctrl+B

### Layout
```
┌─────────────────────┐
│ 🗂 MY-MONOREPO   ⚙  │  ← workspace name + settings
├─────────────────────┤
│ 🔍 Search files...  │  ← fuzzy search
├─────────────────────┤
│ ▾ packages          │
│   ▾ shared          │
│     ▾ src           │
│       index.ts      │
│       utils.ts      │
│       types.ts      │
│   ▾ backend         │
│     ▾ src           │
│       index.ts      │
│       ▾ routes      │
│         api.ts  ●   │  ← ● = unsaved changes
│   ▸ frontend        │  ← collapsed
│   ▸ mobile          │
│   ▸ desktop         │
└─────────────────────┘
```

### Components
- `FileTree` — recursive tree renderer
- `FileTreeNode` — single file or folder row
- `FileSearch` — fuzzy search input with keyboard navigation
- `FileContextMenu` — right-click: New File, Rename, Delete, Copy Path

### Behaviour
- Active file highlighted
- Unsaved files show a dot indicator
- Folders remember collapsed/expanded state in localStorage
- Right-click opens context menu

---

## 5. Code Editor Panel

**Technology:** Monaco Editor (same as VS Code)

### Layout
```
┌───────────────────────────────────────────┐
│ [api.ts ×] [index.ts] [App.tsx]           │  ← TabBar
├───────────────────────────────────────────┤
│  1  import { Router } from 'express';     │
│  2  import { capitalize } from 'shared';  │
│  3                                        │
│  4  const router = Router();              │
│  5                                        │
│  6  router.get('/hello', (_req, res) => { │
│  7    const response = {                  │
│  ...                                     │
├───────────────────────────────────────────┤
│ [Ask AI] [Explain] [Fix] [Generate Tests] │  ← EditorToolbar
└───────────────────────────────────────────┘
```

### Components
- `TabBar` — open file tabs, drag to reorder, middle-click to close
- `MonacoEditor` — full Monaco instance with TypeScript language server
- `EditorToolbar` — context-sensitive AI action buttons
  - **Ask AI** — send selected code to chat with a question
  - **Explain** — explain selected block
  - **Fix** — fix errors in selection
  - **Generate Tests** — scaffold tests for selected function

### Behaviour
- Clicking a file in the explorer opens it in a new tab
- Unsaved changes show `●` in the tab
- Ctrl+S saves the file
- Selecting text shows a floating mini-toolbar with AI actions

---

## 6. AI Chat Panel

**Width:** 360px (collapsible, toggle: Ctrl+J)

### Layout
```
┌───────────────────────────────┐
│ 🤖 AI Assistant        🗑 ⚙  │  ← header + clear + settings
├───────────────────────────────┤
│                               │
│  ┌─────────────────────────┐  │
│  │ How can I help?         │  │  ← AI message bubble
│  └─────────────────────────┘  │
│                               │
│              ┌─────────────┐  │
│              │ Add a GET   │  │  ← User message bubble
│              │ /users route│  │
│              └─────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │ Here's the route:       │  │
│  │ ```ts                   │  │
│  │ router.get('/users'...  │  │  ← AI code block with copy
│  │ ```                     │  │
│  │ [Copy] [Insert to File] │  │
│  └─────────────────────────┘  │
│                               │
├───────────────────────────────┤
│ 📎 api.ts:6-14 (selection) × │  ← ContextBar (attached code)
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │ Ask anything...           │ │  ← ChatInput
│ └───────────────────────────┘ │
│ [Attach] [Clear ctx]   [Send] │
└───────────────────────────────┘
```

### Components
- `ChatHeader` — title, clear history, settings
- `MessageList` — scrollable list of messages
  - `UserMessage` — right-aligned bubble
  - `AIMessage` — left-aligned with avatar
  - `CodeBlock` — syntax-highlighted with Copy and Insert to File buttons
  - `TypingIndicator` — animated dots while AI responds
- `ContextBar` — shows attached file selection, can be dismissed
- `ChatInput` — multiline textarea, Enter to send, Shift+Enter for newline
- `AttachButton` — attach current file or selection as context

### Behaviour
- Code blocks in AI responses have a one-click **Insert to File** that places code at cursor position in editor
- Selecting code in the editor auto-populates ContextBar
- Chat history persists per session in localStorage
- Clear button wipes history with a confirmation dialog

---

## 7. Top Bar

```
┌─────────────────────────────────────────────────────────┐
│ ⬡ CodeAI   packages/backend/src/routes/api.ts   🔍 ⚙ 👤│
└─────────────────────────────────────────────────────────┘
```

### Components
- `Logo` — app name/icon, click to go to home/dashboard
- `Breadcrumb` — reflects currently open file path, each segment clickable
- `CommandPalette` — Ctrl+K opens a Spotlight-style search for files, commands, and AI actions
- `UserMenu` — avatar dropdown: account, settings, sign out

---

## 8. Status Bar

```
┌─────────────────────────────────────────────────────────┐
│ ⎇ main   ✖ 0   ⚠ 2   TypeScript 5.9   🤖 AI Ready     │
└─────────────────────────────────────────────────────────┘
```

### Components
- `GitBranch` — current branch name, click to switch
- `ErrorCount` — red ✖ with count, click to open Problems panel
- `WarningCount` — yellow ⚠ with count
- `LanguageIndicator` — detected language of active file
- `AIStatus` — shows AI Ready / Thinking / Error

---

## 9. Mobile UI

**Breakpoint:** < 768px  
**Layout:** Single panel with bottom tab navigation

```
┌─────────────────────┐
│ ⬡ CodeAI       👤  │  ← TopBar (simplified)
├─────────────────────┤
│                     │
│   [Active Panel]    │  ← only one panel shown at a time
│                     │
│                     │
│                     │
├─────────────────────┤
│  📁    </> 　 🤖   │  ← BottomTabBar
│ Files  Code   Chat  │
└─────────────────────┘
```

### Mobile-specific Components
- `BottomTabBar` — three tabs: Files, Editor, Chat
- `MobileFileDrawer` — slides up from bottom instead of sidebar
- `MobileChatSheet` — full-screen chat with swipe-down to dismiss
- `FloatingAIButton` — visible in Editor tab, taps open chat sheet

### Mobile Behaviour
- Swipe left/right to switch between Editor and Chat panels
- File tree opens as a bottom sheet modal
- Code blocks scroll horizontally
- Keyboard-aware layout: panels resize when soft keyboard appears

---

## 10. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Open Command Palette |
| Ctrl+B | Toggle File Explorer |
| Ctrl+J | Toggle Chat Panel |
| Ctrl+S | Save current file |
| Ctrl+Enter | Send chat message |
| Ctrl+Shift+E | Explain selected code |
| Ctrl+Shift+F | Fix selected code |
| Ctrl+Shift+T | Generate tests for selection |
| Escape | Close modals / clear selection |

---

## 11. Theme & Design Tokens

```ts
// colors
--color-bg-primary:     #0d1117   // editor background
--color-bg-secondary:   #161b22   // sidebar / panels
--color-bg-tertiary:    #21262d   // input fields / cards
--color-border:         #30363d   // borders
--color-accent:         #58a6ff   // links, active states
--color-accent-green:   #3fb950   // success, AI ready
--color-accent-yellow:  #d29922   // warnings
--color-accent-red:     #f85149   // errors
--color-text-primary:   #e6edf3   // main text
--color-text-secondary: #8b949e   // muted text

// typography
--font-ui:    'Geist', sans-serif       // UI labels and text
--font-code:  'Geist Mono', monospace   // editor and code blocks

// spacing scale: 4px base
--space-1: 4px  --space-2: 8px  --space-3: 12px
--space-4: 16px --space-6: 24px --space-8: 32px
```

---

*Design tokens and component specs are ready for Phase 2 implementation.*