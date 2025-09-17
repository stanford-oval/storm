# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

STORM is a LLM-powered knowledge curation system that generates Wikipedia-like articles from scratch. It has two main components:
- **STORM**: Automated article generation through simulated conversations and multi-perspective research
- **Co-STORM**: Human-AI collaborative knowledge curation with interactive discourse

## Development Setup

### Install from source
```bash
git clone https://github.com/stanford-oval/storm.git
cd storm
conda create -n storm python=3.11
conda activate storm
pip install -r requirements.txt
```

### Install package
```bash
pip install knowledge-storm
```

## Key Commands

### Code Formatting
```bash
# Format code with black (required before committing)
black knowledge_storm/

# Install pre-commit hooks for automatic formatting
pip install pre-commit
pre-commit install
```

### Running Examples

#### STORM with GPT models
```bash
python examples/storm_examples/run_storm_wiki_gpt.py \
    --output-dir $OUTPUT_DIR \
    --retriever bing \
    --do-research \
    --do-generate-outline \
    --do-generate-article \
    --do-polish-article
```

#### Co-STORM with GPT models
```bash
python examples/costorm_examples/run_costorm_gpt.py \
    --output-dir $OUTPUT_DIR \
    --retriever bing
```

#### Running the demo UI
```bash
cd frontend/demo_light
pip install -r requirements.txt
# Copy secrets.toml to .streamlit/ directory first
streamlit run storm.py
```

### Package Building
```bash
python setup.py sdist bdist_wheel
```

## Architecture Overview

The codebase follows a modular architecture with clear separation of concerns:

### Core Components (`knowledge_storm/`)

1. **Interface Layer** (`interface.py`): Defines abstract interfaces for all major components (LM, RM, KnowledgeCurationModule, etc.)

2. **Language Model Integration** (`lm.py`): 
   - Supports models via litellm (OpenAI, Anthropic, Azure, etc.)
   - Different models can be used for different pipeline stages (conversation simulation, outline generation, article writing)

3. **Retrieval Module** (`rm.py`):
   - Multiple search engine integrations (You.com, Bing, DuckDuckGo, Tavily, etc.)
   - VectorRM for grounding on custom corpus using Qdrant

4. **STORM Engine** (`storm_wiki/engine.py`):
   - `STORMWikiRunner`: Main orchestrator for the STORM pipeline
   - Four-stage pipeline: Research → Outline Generation → Article Generation → Polish

5. **Co-STORM Engine** (`collaborative_storm/engine.py`):
   - `CoStormRunner`: Manages human-AI collaborative discourse
   - Dynamic mind map maintenance for shared conceptual space
   - Turn policy management through `DiscourseManager`

### Pipeline Stages

**STORM Pipeline:**
1. **Knowledge Curation**: Simulated multi-perspective conversations grounded in search results
2. **Outline Generation**: Hierarchical organization of collected information  
3. **Article Generation**: Section-by-section writing with citations
4. **Article Polishing**: Adding summaries and removing duplicates

**Co-STORM Pipeline:**
1. **Warm Start**: Initial knowledge space building
2. **Interactive Discourse**: Turn-based conversation with LLM experts and moderator
3. **Knowledge Base Management**: Dynamic information organization
4. **Report Generation**: Final article synthesis from discourse

## API Keys Configuration

Create a `secrets.toml` file in the root directory:
```toml
# Language model configurations
OPENAI_API_KEY="your_key"
OPENAI_API_TYPE="openai"  # or "azure"
AZURE_API_BASE="your_base_url"  # if using Azure
AZURE_API_VERSION="your_version"  # if using Azure

# Retriever configurations  
BING_SEARCH_API_KEY="your_key"
YDC_API_KEY="your_key"  # You.com
SERPER_API_KEY="your_key"
BRAVE_API_KEY="your_key"
TAVILY_API_KEY="your_key"

# Vector DB (if using VectorRM)
QDRANT_API_KEY="your_key"  # for online Qdrant
```

## Contributing Guidelines

- Code formatting: Use black formatter (automatically applied via pre-commit hooks)
- Currently accepting PRs for:
  - New language model support in `knowledge_storm/lm.py`
  - New retrieval/search engine support in `knowledge_storm/rm.py`  
  - Demo enhancements in `frontend/demo_light`
- Not accepting general refactoring PRs at this time
- Include example scripts for new integrations following existing patterns in `examples/`

## Current Implementation Status (Updated: 2025-09-09)

### ✅ Completed Components
- **Frontend (Next.js 14)**: Full React UI with App Router
- **Backend (FastAPI)**: Complete REST API server  
- **File-Based Storage**: Project management without database
- **STORM Integration**: Working pipeline execution
- **Real-time Progress**: WebSocket updates for pipeline status
- **UI Components**: Complete shadcn/ui component library
- **State Management**: Zustand stores for all features

### Architecture Decision: File-Based Storage (No Database)
The project will use a file-based storage system instead of a database for simplicity and portability:
- Projects stored as markdown files with frontmatter metadata
- Configuration and progress in JSON files
- Project index maintained in a single JSON file
- Compatible with existing STORM file outputs

### MVP Objective (2-3 Weeks)
Create a functional web UI that replaces demo_light with core features:
1. Project management (create, list, delete)
2. Pipeline configuration and execution
3. Real-time progress tracking
4. Article display and export
5. Research visibility

### Core Features to Implement

#### 1. STORM Article Generation Interface
- **Project Management**: Create, save, and manage multiple article generation projects
- **Configuration Panel**: 
  - Select and configure LM models for each pipeline stage
  - Choose and configure retrieval sources (Bing, You.com, DuckDuckGo, etc.)
  - Set parameters for research depth and article length
- **Pipeline Control**:
  - Visual pipeline progress tracker
  - Option to run full pipeline or individual stages
  - Pause/resume capability for long-running processes
- **Research View**:
  - Display simulated conversations between perspectives
  - Show retrieved sources and citations
  - Allow manual source addition/removal
- **Outline Editor**:
  - Interactive outline modification before article generation
  - Drag-and-drop section reorganization
  - Add/remove/edit sections
- **Article Editor**:
  - Rich text editing with citation management
  - Side-by-side source view
  - Export options (Markdown, HTML, PDF)

#### 2. Co-STORM Collaborative Interface
- **Session Management**: Create and manage collaborative sessions
- **Interactive Discourse Panel**:
  - Real-time conversation with AI experts
  - Expert persona selection and customization
  - Turn-based interaction with visual indicators
- **Mind Map Visualization**:
  - Interactive graph visualization of knowledge space
  - Node expansion/collapse for concept exploration
  - Real-time updates during discourse
- **Question Suggestions**: Context-aware question recommendations
- **Information Inspector**: Detailed view of collected information with sources
- **Collaborative Tools**:
  - Note-taking sidebar
  - Bookmark important exchanges
  - Export conversation history

#### 3. Shared Components
- **API Key Management**:
  - Secure storage and validation of API keys
  - Per-session key override capability
  - Usage tracking and cost estimation
- **Custom Corpus Integration**:
  - Upload and manage document collections
  - Configure VectorRM for custom retrieval
  - Corpus statistics and search testing
- **Output Management**:
  - Browse generated articles and reports
  - Version control for articles
  - Batch operations for multiple articles
- **Analytics Dashboard**:
  - Token usage and cost tracking
  - Generation time metrics
  - Quality metrics (if available)

### Technical Architecture

#### Frontend Stack (Implemented ✅)
- **Framework**: React/Next.js 14
- **UI Library**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Visualization**: D3.js for mind maps, Recharts for analytics
- **Editor**: TipTap for rich text editing

#### Backend Architecture (To Implement)
- **API Framework**: FastAPI for async operations
- **Storage**: File-based system (markdown + JSON)
- **WebSocket**: For real-time updates (Phase 2)
- **No Database**: All persistence via files
- **Background Tasks**: Simple async without Celery (MVP)

#### File Storage Structure
```
storm-projects/
├── projects.json                    # Project index
└── projects/
    └── [project-id]/
        ├── project.md               # Article with frontmatter
        ├── config.json              # Pipeline configuration
        ├── progress.json            # Progress tracking
        ├── research/
        │   ├── conversations.md    # Research conversations
        │   └── sources.json        # Retrieved sources
        └── exports/
            ├── article.html         # Exported formats
            └── article.pdf

```

#### API Design (Simplified for MVP)
```python
# Core endpoints structure
/api/
  /projects/              # List projects (read JSON index)
  /projects/create        # Create new project (create markdown file)
  /projects/{id}          # Get project (read markdown file)
  /projects/{id}/delete   # Delete project (remove files)
  /projects/{id}/run      # Start pipeline
  /projects/{id}/progress # Get progress (read JSON file)
  /projects/{id}/export   # Export article
  /health                 # Health check
```

### Implementation Phases

#### Phase 1: MVP Backend (Week 1)
- Create FastAPI server with file-based storage
- Implement project file operations (create/read/update/delete markdown files)
- Integrate STORM runner
- Add progress tracking via JSON file updates
- Create export endpoints

#### Phase 2: MVP Frontend (Week 2)
- Create Next.js app directory structure
- Build project dashboard page
- Implement pipeline configuration UI
- Add progress monitoring
- Create article display view

#### Phase 3: MVP Integration (Week 3)
- Connect frontend to backend
- Test end-to-end pipeline
- Add error handling
- Polish UI/UX
- Create deployment guide

#### Phase 4: Advanced Features (Weeks 4-6)
- Co-STORM collaborative features
- WebSocket for real-time updates
- Mind map visualization
- Analytics dashboard
- Batch processing

#### Phase 5: Production Ready (Weeks 7-8)
- Performance optimization
- Comprehensive testing
- Documentation
- CI/CD setup
- Monitoring and logging

### Development Guidelines

- **Code Organization**: Follow existing patterns in `frontend/` directory
- **API Consistency**: RESTful design with clear resource boundaries
- **Error Handling**: Comprehensive error messages and recovery options
- **Testing**: Unit tests for API, integration tests for workflows
- **Documentation**: OpenAPI/Swagger for API, user guide for UI
- **Security**: Implement rate limiting, input validation, secure key storage
- **Accessibility**: WCAG 2.1 AA compliance for all interfaces

### Migration Strategy

1. Maintain backward compatibility with existing CLI tools
2. Gradual feature migration from demo_light
3. Use existing STORM file outputs directly
4. No database migration needed (file-based)

## Implementation Tracking

### Completed Components ✅
- UI component library (buttons, cards, forms)
- STORM-specific components (ProjectCard, PipelineProgress, etc.)
- Visualization components (MindMap, charts)
- State management setup (Zustand)
- Service layer (API clients)
- TypeScript types and interfaces
- Testing infrastructure

### To Be Implemented 🚧

#### Backend (Week 1)
- [ ] FastAPI server setup
- [ ] File-based project service
- [ ] STORM runner integration
- [ ] Progress tracking system
- [ ] Export functionality

#### Frontend (Week 2)
- [ ] Next.js app directory
- [ ] Project dashboard page
- [ ] Pipeline configuration page
- [ ] Article display page
- [ ] Progress monitoring UI

#### Integration (Week 3)
- [ ] API connection
- [ ] Error handling
- [ ] Testing
- [ ] Documentation

### Project Structure

#### Backend (`/backend/`)
```bash
backend/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── routers/
│   ├── projects.py        # Project CRUD endpoints
│   ├── pipeline.py        # Pipeline execution endpoints
│   ├── settings.py        # API key configuration endpoints
│   └── docs.py           # Documentation endpoints
├── services/
│   ├── file_service.py    # File-based project storage
│   └── storm_runner.py    # STORM pipeline integration
└── storm-projects/        # Project data storage
    ├── projects.json      # Project index
    └── projects/          # Individual project directories
```

#### Frontend (`/frontend/storm-ui/`)
```bash
frontend/storm-ui/
├── app/                   # Next.js App Router
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Home (redirects to /projects)
│   ├── projects/
│   │   ├── page.tsx       # Projects dashboard with pagination
│   │   ├── new/page.tsx   # Create new project
│   │   └── [id]/
│   │       ├── page.tsx   # Project detail view
│   │       └── article/page.tsx  # Full article view
│   ├── analytics/page.tsx # Usage analytics
│   ├── activity/page.tsx  # Recent activity log
│   ├── knowledge-base/    # Knowledge base browser
│   ├── settings/page.tsx  # Configuration settings
│   └── help/page.tsx      # Help documentation
├── src/
│   ├── components/
│   │   ├── storm/         # STORM-specific components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── layout/       # Layout components
│   │   └── visualization/ # Charts and graphs
│   ├── services/         # API service layer
│   ├── store/           # Zustand state management
│   ├── hooks/           # Custom React hooks
│   └── types/           # TypeScript definitions
└── public/              # Static assets
```

## Code Quality Issues & Improvements Needed

### High Priority Issues
1. **Excessive ESLint Disables**: 651 eslint-disable comments indicate widespread linting issues
2. **Type Safety**: Multiple uses of `any` type in TypeScript files (18+ instances)
3. **Console Logs**: Production console.log statements in 10+ files need removal
4. **Missing Error Boundaries**: No React error boundaries for graceful error handling
5. **No Loading States**: Several async operations lack proper loading indicators

### Medium Priority Improvements
1. **API Error Handling**: Inconsistent error handling patterns across services
2. **WebSocket Reconnection**: No automatic reconnection logic for WebSocket
3. **Form Validation**: Limited client-side validation in project creation forms
4. **Accessibility**: Missing ARIA labels and keyboard navigation in some components
5. **Performance**: No memoization in expensive computations (project lists, analytics)

### Low Priority Enhancements
1. **Code Documentation**: Missing JSDoc comments for complex functions
2. **Test Coverage**: Limited test files, no integration tests
3. **Bundle Size**: Large dependencies could be code-split or lazy-loaded
4. **SEO**: Missing meta tags and Open Graph data
5. **PWA Support**: No service worker or offline capabilities

### Technical Debt
1. **Duplicate Code**: Similar fetch patterns repeated across components
2. **Magic Numbers**: Hard-coded values for pagination, timeouts, etc.
3. **Inconsistent Naming**: Mix of camelCase and snake_case in API responses
4. **Unused Imports**: Several files have unused imports
5. **Dead Code**: Commented-out code blocks should be removed

## Running the Application

### Backend Server
```bash
cd backend
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8000
```

### Frontend Development
```bash
cd frontend/storm-ui
npm install
npm run dev  # Runs on http://localhost:3000
```

### Environment Variables
Create `.env.local` in `frontend/storm-ui/`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Available Scripts
```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run test         # Run tests
npm run storybook    # Component documentation

# Backend
python main.py       # Start FastAPI server
python test_api.py   # Run API tests
```

## Important Notes

- The system uses dspy for implementing modular components
- Different LM models can be mixed for cost/quality optimization (e.g., GPT-3.5 for conversation, GPT-4 for article generation)
- Output is structured in subdirectories under the specified output directory with JSON logs and text articles
- Version consistency required between `setup.py` and `knowledge_storm/__init__.py`
- React StrictMode causes "user aborted request" messages in development (normal behavior)