# STORM UI - Modern Web Interface for STORM

⚠️ **Current Status**: Component library ready, application structure in development

This project aims to create a comprehensive web-based UI for STORM that replaces the current Streamlit demo with a modern React/Next.js application. Currently, the component library is complete, but the application structure and backend need to be implemented.

## 🎯 Implementation Roadmap

### Phase 1: MVP Implementation (2-3 weeks)

- [ ] Backend API setup (FastAPI with file-based storage)
- [ ] Next.js application structure
- [ ] Core STORM pipeline integration
- [ ] Basic project management
- [ ] Article generation and display

### Phase 2: Advanced Features (3-4 weeks)

- [ ] Co-STORM collaborative features
- [ ] Interactive mind map
- [ ] Analytics dashboard
- [ ] Export functionality
- [ ] Batch processing

## 🏗️ Current Project Structure

### What's Already Built ✅

```
src/
├── components/          # React components (READY)
│   ├── ui/             # Base UI components (shadcn/ui)
│   ├── storm/          # STORM-specific components
│   ├── analytics/      # Analytics dashboard components
│   ├── visualization/  # Mind map and visualizations
│   └── ux/            # Advanced UX components
├── services/           # API service clients (READY)
├── store/             # State management (Zustand) (READY)
├── hooks/             # React hooks (READY)
├── types/             # TypeScript definitions (READY)
└── utils/             # Utilities and animations (READY)
```

### What Needs to Be Built 🚧

```
app/                    # Next.js app directory (TO BUILD)
├── layout.tsx         # Root layout
├── page.tsx           # Home/dashboard
├── projects/          # Project management
├── pipeline/          # Pipeline execution
└── api/               # API routes

backend/               # FastAPI backend (TO BUILD)
├── main.py           # FastAPI application
├── services/         # Business logic
│   └── file_service.py  # File-based storage
├── routers/          # API endpoints
└── storm_integration/ # STORM runner integration

storm-projects/        # File-based storage (TO CREATE)
├── projects.json     # Project index
└── projects/         # Individual projects
    └── [project-id]/
        ├── project.md      # Article content
        ├── config.json     # Pipeline config
        ├── progress.json   # Progress tracking
        └── research/       # Research data
```

## 📋 Complete Implementation Guide

### Step 1: Backend Setup (File-Based, No Database)

#### 1.1 Create Backend Structure

```bash
cd ../../  # Go to storm root
mkdir backend
cd backend

# Create FastAPI backend
pip install fastapi uvicorn python-frontmatter pydantic
```

#### 1.2 Create `backend/main.py`

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import projects, pipeline
import os

app = FastAPI(title="STORM UI API")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api/projects")
app.include_router(pipeline.router, prefix="/api/pipeline")

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
```

#### 1.3 Create File Service (`backend/services/file_service.py`)

```python
import os
import json
import frontmatter
from pathlib import Path
from datetime import datetime
from typing import List, Optional

class FileProjectService:
    def __init__(self, base_path: str = "./storm-projects"):
        self.base_path = Path(base_path)
        self.projects_dir = self.base_path / "projects"
        self.index_file = self.base_path / "projects.json"
        self._ensure_directories()

    def create_project(self, title: str, topic: str) -> dict:
        # Implementation as shown in previous examples
        pass

    def list_projects(self) -> List[dict]:
        # Read from index file
        pass

    def update_article(self, project_id: str, content: str):
        # Update markdown file
        pass
```

#### 1.4 Run Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Step 2: Next.js Application Setup

#### 2.1 Create App Directory Structure

```bash
cd frontend/storm-ui
mkdir -p app/{projects,api}

# Create root layout
touch app/layout.tsx
touch app/page.tsx
touch app/globals.css
```

#### 2.2 Create `app/layout.tsx`

```tsx
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

#### 2.3 Create `app/page.tsx` (Projects Dashboard)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { ProjectCard } from '@/components/storm';
import { Button } from '@/components/ui';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/projects')
      .then(res => res.json())
      .then(setProjects);
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1>STORM Projects</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
```

### Step 3: STORM Integration

#### 3.1 Create STORM Runner Service (`backend/services/storm_runner.py`)

```python
from knowledge_storm import STORMWikiRunner, STORMWikiLMConfigs
import asyncio
import json

class StormRunnerService:
    def __init__(self, file_service):
        self.file_service = file_service

    async def run_pipeline(self, project_id: str, config: dict):
        # Initialize STORM runner
        lm_configs = STORMWikiLMConfigs()

        # Configure based on user settings
        engine_args = {
            'output_dir': f'./storm-projects/projects/{project_id}',
            'max_conv_turn': config.get('max_conv_turn', 3),
            'max_perspective': config.get('max_perspective', 4),
        }

        runner = STORMWikiRunner(engine_args, lm_configs)

        # Update progress periodically
        await self._update_progress(project_id, 'research', 0)

        # Run pipeline stages
        runner.run(
            topic=config['topic'],
            do_research=True,
            do_generate_outline=True,
            do_generate_article=True,
            do_polish_article=True
        )

        # Save results
        await self._save_results(project_id, runner)
```

### Step 4: Run the Complete System

```bash
# Terminal 1: Run backend
cd backend
uvicorn main:app --reload

# Terminal 2: Run frontend
cd frontend/storm-ui
npm run dev
```

## 🚀 Getting Started (Current State)

### For Component Development Only

```bash
# Install dependencies
npm install

# Run Storybook to view components
npm run storybook

# Run tests
npm test
```

### Prerequisites

- Node.js 18+
- Python 3.11+ (for backend)
- React 18+
- Next.js 14+

## 📦 Components

### Core STORM Components

#### ProjectCard

Display STORM projects with status, progress, and actions.

```tsx
import { ProjectCard } from '@/components/storm';

const project = {
  id: 'project-1',
  title: 'Climate Change Impact',
  topic: 'Environmental Science',
  status: 'researching',
  // ... other project properties
};

<ProjectCard
  project={project}
  onSelect={project => console.log('Selected:', project)}
  onDelete={id => console.log('Delete:', id)}
  onDuplicate={project => console.log('Duplicate:', project)}
/>;
```

#### PipelineProgress

Track and display STORM pipeline execution progress.

```tsx
import { PipelineProgress } from '@/components/storm';

const progress = {
  stage: 'research',
  stageProgress: 45,
  overallProgress: 25,
  startTime: new Date(),
  currentTask: 'Conducting research...',
};

<PipelineProgress
  progress={progress}
  showDetails={true}
  onCancel={() => console.log('Cancelled')}
/>;
```

#### ConfigurationPanel

Configure LLM models, retrievers, and pipeline settings.

```tsx
import { ConfigurationPanel } from '@/components/storm';

const config = {
  llm: {
    model: 'gpt-4o',
    provider: 'openai',
    temperature: 0.7,
  },
  retriever: {
    type: 'bing',
    maxResults: 10,
  },
  pipeline: {
    doResearch: true,
    doGenerateOutline: true,
    doGenerateArticle: true,
    doPolishArticle: true,
  },
};

<ConfigurationPanel
  config={config}
  onChange={newConfig => setConfig(newConfig)}
  onSave={() => console.log('Saved')}
  onCancel={() => console.log('Cancelled')}
/>;
```

#### ArticleEditor

Rich text editor for STORM-generated articles with citation support.

```tsx
import { ArticleEditor } from '@/components/storm';

const article = {
  title: 'Article Title',
  content: '<h1>Article Content</h1><p>Body text...</p>',
  sections: [...],
  citations: [...],
  wordCount: 1500,
  lastModified: new Date(),
};

<ArticleEditor
  article={article}
  onChange={(updatedArticle) => setArticle(updatedArticle)}
  onSave={() => console.log('Article saved')}
  showOutline={true}
/>
```

#### OutlineEditor

Drag-and-drop hierarchical outline editor.

```tsx
import { OutlineEditor } from '@/components/storm';

const outline = {
  id: 'outline-1',
  sections: [
    {
      id: 'section-1',
      title: 'Introduction',
      level: 1,
      order: 1,
      isExpanded: true,
    },
    // ... more sections
  ],
  lastModified: new Date(),
};

<OutlineEditor
  outline={outline}
  onChange={updatedOutline => setOutline(updatedOutline)}
  onSave={() => console.log('Outline saved')}
  readOnly={false}
/>;
```

#### ResearchView

Display research conversations and sources with filtering.

```tsx
import { ResearchView } from '@/components/storm';

const research = {
  conversations: [...],
  sources: [...],
  perspectives: ['Academic', 'Industry Expert'],
  totalQueries: 25,
  lastUpdated: new Date(),
};

<ResearchView
  research={research}
  onSourceSelect={(source) => console.log('Source:', source)}
  onConversationSelect={(conv) => console.log('Conversation:', conv)}
  showFilters={true}
/>
```

### Base UI Components

Built on top of shadcn/ui and Radix UI primitives:

- `Button` - Various button styles and sizes
- `Card` - Container component with header, content, footer
- `Input` - Form input with validation support
- `Select` - Dropdown selection component
- `Progress` - Progress bar with animations
- `Badge` - Status indicators and labels
- `Tabs` - Tabbed interface component
- `Accordion` - Collapsible content sections
- And many more...

## 🎨 Styling

This library uses:

- **Tailwind CSS** for utility-first styling
- **CSS Variables** for theme customization
- **Dark/Light mode** support
- **Custom STORM theme colors**

### Theme Customization

```css
:root {
  --storm-blue: #0066cc;
  --storm-blue-light: #4d94ff;
  --storm-blue-dark: #004499;
  --storm-orange: #ff6b35;
}
```

## 🧪 Testing

Comprehensive test suite with:

- **Jest** for test runner
- **React Testing Library** for component testing
- **TypeScript** support in tests
- **Coverage reporting**

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run type-check
```

### Writing Tests

```tsx
import { render, screen, fireEvent } from '@/test/utils';
import { ProjectCard } from '../ProjectCard';
import { createMockStormProject } from '@/test/utils';

describe('ProjectCard', () => {
  it('renders project information', () => {
    const project = createMockStormProject();
    render(<ProjectCard project={project} onSelect={jest.fn()} />);

    expect(screen.getByText(project.title)).toBeInTheDocument();
  });
});
```

## 📝 TypeScript Support

Full TypeScript support with:

- **Strict type checking**
- **Interface definitions** for all STORM data structures
- **Generic components** where appropriate
- **Type-safe props** and callbacks

### Key Types

```typescript
import type {
  StormProject,
  PipelineProgress,
  StormConfig,
  ArticleOutline,
  ResearchData,
} from '@/types';
```

## 🚀 Production Deployment

### Building for Production

```bash
# Build the components
npm run build

# Lint the code
npm run lint

# Type check
npm run type-check
```

### Integration

To use these components in your Next.js application:

1. Copy the `src/components` directory to your project
2. Install required dependencies from `package.json`
3. Configure Tailwind CSS with the provided config
4. Import and use components as needed

```tsx
import { ProjectCard, PipelineProgress } from '@/components/storm';
```

## 📚 API Reference

### Component Props

All components are fully documented with TypeScript interfaces. See the individual component files for detailed prop definitions and usage examples.

### Utility Functions

Located in `src/lib/utils.ts`:

- `cn()` - Conditional class name utility
- `formatDate()` - Date formatting
- `formatRelativeTime()` - Relative time formatting
- `getProjectStatusColor()` - Status color mapping
- `estimateReadingTime()` - Reading time calculation

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new components
3. Update TypeScript types as needed
4. Ensure accessibility compliance
5. Test with both light and dark themes

## 🎯 MVP Features (When Complete)

### Core Functionality

- ✅ **Project Management**: Create, view, delete projects with file-based storage
- ✅ **Pipeline Configuration**: Configure LLM models and retrievers through UI
- ✅ **Pipeline Execution**: Run STORM pipeline with real-time progress tracking
- ✅ **Article Display**: View generated articles with citations and export options
- ✅ **Research Visibility**: View conversations and sources from research phase

### File-Based Storage Structure

```
storm-projects/
├── projects.json              # Project index
└── projects/
    └── [project-id]/
        ├── project.md         # Article content with frontmatter
        ├── config.json        # Pipeline configuration
        ├── progress.json      # Real-time progress updates
        └── research/
            ├── conversations.md  # Research conversations
            └── sources.json      # Retrieved sources
```

### Why File-Based?

- **No database required**: Simpler deployment and maintenance
- **Version control friendly**: All content in markdown/JSON
- **Portable**: Easy backup and migration
- **Human readable**: Direct file access for debugging
- **Existing STORM compatibility**: Works with current file outputs

## 📊 Implementation Status

| Component         | Status         | Notes                    |
| ----------------- | -------------- | ------------------------ |
| UI Components     | ✅ Complete    | All components ready     |
| State Management  | ✅ Complete    | Zustand store configured |
| Service Layer     | ✅ Complete    | API clients ready        |
| Backend API       | ❌ Not Started | FastAPI server needed    |
| Next.js Pages     | ❌ Not Started | App directory needed     |
| STORM Integration | ❌ Not Started | Runner service needed    |
| File Storage      | ❌ Not Started | File service needed      |

## 🔧 Development Workflow

1. **Backend Development**

   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

2. **Frontend Development**

   ```bash
   cd frontend/storm-ui
   npm install
   npm run dev
   ```

3. **Testing**

   ```bash
   # Frontend tests
   npm test

   # Backend tests
   pytest
   ```

## 📄 License

This component library is part of the STORM project. Please refer to the main project license for usage terms.

## 🔗 Related

- [STORM Main Repository](https://github.com/stanford-oval/storm)
- [Current Working UI (Streamlit)](../demo_light)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
