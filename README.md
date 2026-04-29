# My Monorepo

A full-stack monorepo with backend, frontend, mobile, and desktop apps sharing a common package — built with TypeScript, npm workspaces, ESLint, and Prettier.

## 📦 Packages

| Package    | Tech                  | Port  |
|------------|-----------------------|-------|
| `shared`   | TypeScript library    | —     |
| `backend`  | Express + TypeScript  | 4000  |
| `frontend` | React + Vite          | 5173  |
| `mobile`   | Expo (React Native)   | —     |
| `desktop`  | Electron              | —     |

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
cp packages/mobile/.env.example packages/mobile/.env
cp packages/desktop/.env.example packages/desktop/.env
```

### 3. Build the shared package
```bash
npm run build:shared
```

### 4. Run apps in development
```bash
# Individual
npm run dev:backend
npm run dev:frontend
npm run dev:mobile
npm run dev:desktop

# Backend + Frontend together
npm run dev:all
```

### 5. Build for production
```bash
npm run build:all
```

## 🛠 Tools
```bash
npm run lint      # ESLint across all packages
npm run format    # Prettier across all packages
```

## 📁 Structure