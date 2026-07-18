# AI Interview Prep 🎯

[![English](https://img.shields.io/badge/🌐-English-blue)](./README.md)
[![简体中文](https://img.shields.io/badge/🌐-简体中文-red)](./README_CN.md)

An intelligent interview preparation platform powered by RAG (Retrieval-Augmented Generation), focused on AI application development interview practice, AI-powered Q&A, and resume optimization. Built with TF-IDF semantic retrieval + LLM generation.

## ✨ Features

### 🏠 Full-Page Scroll Homepage
- Five-section full-page scroll: Hero → AI Assistant → Resume Optimization → Question Bank → About
- WebGL dynamic thread background animation
- Typewriter effect showcasing AI conversation capabilities

### 🤖 AI Assistant
- **RAG architecture**: TF-IDF semantic retrieval + MiMo LLM generation
- Streaming (SSE) conversation with real-time token-by-token output
- Automatic knowledge base retrieval for accurate, cited answers
- Pre-built suggested questions for quick onboarding

### 📝 Resume Optimization
- Upload resume (PDF / Word / Markdown / TXT / image) + Job Description (JD)
- AI analyzes the JD and optimizes resume wording to highlight matching skills
- Streaming output with real-time preview
- One-click export to Word document (.docx)

### 📚 Question Bank
- **Practice Mode**: Filter by category / difficulty, auto-timer, score summary on submission
- **My Questions**: Personal question CRUD + search + filter + pagination
- **Data Import**: Bulk import questions via Excel / CSV
- Questions support category tags and difficulty levels (Easy / Medium / Hard)

### 🔐 Authentication
- Email registration / login
- GitHub OAuth one-click login
- JWT Token authentication + admin roles

### 🛡️ Admin Dashboard
- User management (search, view details, delete)
- User statistics (email sign-up vs GitHub login)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS 3 + GSAP animations |
| **Routing** | React Router v7 |
| **State** | Zustand 5 |
| **Icons** | Lucide React |
| **File Processing** | PDF.js / Mammoth / XLSX / docx |
| **Animation** | OGL (WebGL) / GSAP |
| **Backend** | Node.js + Express |
| **Vector Retrieval** | TF-IDF (in-memory mode) |
| **LLM** | MiMo API |
| **Auth** | JWT + bcrypt + GitHub OAuth |

## 📁 Project Structure

```
├── src/                          # Frontend source
│   ├── components/               # Shared components
│   │   ├── Header.tsx            # Top navigation (login / user info)
│   │   ├── Footer.tsx            # Footer
│   │   ├── Sidebar.tsx           # Sidebar
│   │   ├── PillNav.tsx           # Pill-style navigation
│   │   ├── Threads.tsx           # WebGL thread background
│   │   ├── TypewriterChat.tsx    # Typewriter effect
│   │   ├── ChatMessage.tsx       # Chat message bubble
│   │   ├── QuestionCard.tsx      # Question card
│   │   ├── MagicBento.tsx        # Bento layout cards
│   │   ├── ScrollReveal.tsx      # Scroll-triggered reveal
│   │   ├── ClickSpark.tsx        # Click particle effects
│   │   ├── ErrorBoundary.tsx     # Global error boundary
│   │   └── ...
│   ├── pages/                    # Pages
│   │   ├── Home.tsx              # Home (full-page scroll)
│   │   ├── ChatPage.tsx          # AI assistant chat
│   │   ├── ResumePage.tsx        # Resume optimization
│   │   ├── PracticePage.tsx      # Practice mode
│   │   ├── MyQuestionsPage.tsx   # My question bank
│   │   ├── ImportPage.tsx        # Question import
│   │   ├── QuestionDetail.tsx    # Question detail
│   │   ├── AuthPage.tsx          # Login / Register
│   │   ├── AuthCallback.tsx      # OAuth callback
│   │   ├── AdminLoginPage.tsx    # Admin login
│   │   └── AdminDashboard.tsx    # Admin dashboard
│   ├── lib/                      # API clients
│   │   ├── api.ts                # General API
│   │   ├── authApi.ts            # Auth API
│   │   ├── chatApi.ts            # Chat API
│   │   ├── resumeApi.ts          # Resume optimization API
│   │   └── adminApi.ts           # Admin API
│   ├── store/                    # Zustand state management
│   ├── hooks/                    # Custom hooks
│   ├── types/                    # TypeScript type definitions
│   └── constants/                # Configuration constants
├── backend/                      # Backend source
│   ├── server.js                 # Express entry point
│   ├── auth/                     # Auth module
│   │   ├── index.js              # Auth routes
│   │   ├── middleware.js         # JWT middleware
│   │   ├── users.js              # User data management
│   │   └── admin.js              # Admin verification
│   ├── rag/                      # RAG core module
│   │   ├── vectorstore.js        # TF-IDF vector store
│   │   ├── retriever.js          # Semantic retriever
│   │   └── generator.js          # LLM generator
│   ├── scripts/                  # Data import scripts
│   └── data/                     # Knowledge base data
├── public/                       # Static assets
└── dist/                         # Build output
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18
- **npm** >= 9

### 1. Clone the Repository

```bash
git clone https://github.com/Wan-1230/AI-resume-study.git
cd AI-resume-study
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Configure Backend Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your configuration:

```env
# MiMo LLM API
MIMO_API_KEY=your_mimo_api_key
MIMO_API_BASE=https://api.mimo.com/v1

# Vector store data directory
CHROMA_DB_PATH=./chroma_db

# Server port
PORT=3001

# GitHub OAuth (create an OAuth App in GitHub Developer Settings)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# JWT
JWT_SECRET=your_jwt_secret_key_for_token_signing
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS and OAuth callback)
FRONTEND_URL=http://localhost:5173

# Admin account
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
```

### 5. Prepare Knowledge Base Data

```bash
cd backend
node scripts/ingest.js    # Import knowledge base documents into vector store
cd ..
```

### 6. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
npm run dev
```

Open **http://localhost:5173** to use the application.

## 📦 Build & Deploy

### Frontend Build

```bash
npm run build       # Build to dist/
npm run preview     # Preview the build
```

### Deployment Options

| Component | Recommended Platform | Cost |
|-----------|---------------------|------|
| Frontend | Vercel / Cloudflare Pages | Free |
| Backend | Railway | Free tier ($5/month credit) |

See [DEPLOY_CN.md](./DEPLOY_CN.md) for detailed deployment instructions (in Chinese).

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | TypeScript check + production build |
| `npm run check` | TypeScript type check only |
| `npm run lint` | ESLint code linting |
| `npm run preview` | Preview production build |

## 📄 License

MIT License
