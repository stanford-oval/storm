# STORM UI Developer Quickstart Guide

Get up and running with STORM UI development in minutes. This guide provides a streamlined path to set up your development environment and start contributing to the project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Setup](#quick-setup)
3. [Development Environment](#development-environment)
4. [Project Structure](#project-structure)
5. [Key Technologies](#key-technologies)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Contributing](#contributing)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: 18.0+ (LTS recommended)
- **npm**: 9.0+ or **yarn**: 1.22+
- **Git**: Latest version
- **VS Code** (recommended) or your preferred editor

### Development Tools

```bash
# Install Node.js via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

### Optional but Recommended

- **Docker Desktop**: For local backend services
- **Postman** or **Insomnia**: For API testing
- **React Developer Tools**: Browser extension

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/stanford-oval/storm.git
cd storm/frontend/storm-ui
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using yarn
yarn install
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

**Required Environment Variables:**

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# App Configuration
NEXT_PUBLIC_APP_NAME="STORM UI"
NEXT_PUBLIC_VERSION="1.0.0"

# Development
NEXT_PUBLIC_DEBUG=true
NEXT_TELEMETRY_DISABLED=1
```

### 4. Start Development Server

```bash
npm run dev
# or
yarn dev
```

🎉 **Success!** Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Environment

### VS Code Setup

**Recommended Extensions:**

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "github.copilot"
  ]
}
```

**VS Code Settings (`.vscode/settings.json`):**

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### Backend Services (Optional)

If you need local backend services:

```bash
# Navigate to project root
cd ../..

# Start backend services with Docker
docker-compose -f docker-compose.dev.yml up -d

# Or manually start individual services
# PostgreSQL
docker run --name storm-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15

# Redis
docker run --name storm-redis -p 6379:6379 -d redis:alpine
```

## Project Structure

```
storm/frontend/storm-ui/
├── app/                          # Next.js 13+ App Router
│   ├── (auth)/                  # Authentication routes
│   ├── dashboard/               # Dashboard pages
│   ├── projects/                # Project management
│   ├── settings/                # User settings
│   └── globals.css              # Global styles
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── ui/                 # Base UI components (shadcn/ui)
│   │   ├── storm/              # STORM-specific components
│   │   └── visualization/       # Data visualization components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utility libraries
│   ├── services/                # API service layer
│   ├── stores/                  # State management (Zustand)
│   ├── types/                   # TypeScript type definitions
│   └── utils/                   # Helper functions
├── public/                      # Static assets
├── docs/                        # Component documentation
└── tests/                       # Test files
    ├── __tests__/              # Unit tests
    ├── e2e/                    # End-to-end tests
    └── __mocks__/              # Test mocks
```

### Key Directories Explained

- **`app/`**: Next.js App Router pages and layouts
- **`src/components/`**: All React components organized by purpose
- **`src/services/`**: API interaction layer with type-safe methods
- **`src/stores/`**: Zustand stores for state management
- **`src/types/`**: TypeScript interfaces and types
- **`src/hooks/`**: Custom React hooks for reusable logic

## Key Technologies

### Core Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Data Visualization**: [D3.js](https://d3js.org/) + [Recharts](https://recharts.org/)

### Development Tools

- **Testing**: [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) + [Playwright](https://playwright.dev/)
- **Linting**: [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)
- **API Mocking**: [MSW](https://mswjs.io/)
- **Storybook**: [Component development](https://storybook.js.org/)

### Animation & UX

- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Rich Text**: [TipTap](https://tiptap.dev/)

## Development Workflow

### 1. Creating a New Component

```bash
# Generate component with CLI (if available)
npm run generate:component MyComponent

# Or manually create
mkdir src/components/MyComponent
touch src/components/MyComponent/index.tsx
touch src/components/MyComponent/MyComponent.stories.tsx
touch src/components/MyComponent/MyComponent.test.tsx
```

**Component Template:**

```typescript
// src/components/MyComponent/index.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export const MyComponent = ({ className, children }: MyComponentProps) => {
  return (
    <div className={cn('default-styles', className)}>
      {children}
    </div>
  );
};

export default MyComponent;
```

### 2. Adding New API Service

```typescript
// src/services/myService.ts
import { BaseApiService } from './base';
import { ApiResponse, MyType } from '@/types';

export class MyService extends BaseApiService {
  private readonly basePath = '/v1/my-resource';

  async getItems(): Promise<ApiResponse<MyType[]>> {
    return this.get<MyType[]>(this.basePath);
  }

  async createItem(data: CreateMyTypeRequest): Promise<ApiResponse<MyType>> {
    return this.post<MyType>(this.basePath, data);
  }
}

export const myService = new MyService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
```

### 3. Creating State Store

```typescript
// src/stores/myStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface MyState {
  items: MyType[];
  isLoading: boolean;
  error: string | null;
  fetchItems: () => Promise<void>;
  addItem: (item: MyType) => void;
}

export const useMyStore = create<MyState>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        isLoading: false,
        error: null,

        fetchItems: async () => {
          set({ isLoading: true });
          try {
            const response = await myService.getItems();
            set({ items: response.data, isLoading: false });
          } catch (error) {
            set({ error: error.message, isLoading: false });
          }
        },

        addItem: item => {
          set(state => ({
            items: [...state.items, item],
          }));
        },
      }),
      {
        name: 'my-store',
        partialize: state => ({ items: state.items }),
      }
    ),
    {
      name: 'my-store',
    }
  )
);
```

### 4. Creating Pages

```typescript
// app/my-page/page.tsx
'use client';

import React from 'react';
import { MyComponent } from '@/components/MyComponent';
import { useMyStore } from '@/stores/myStore';

export default function MyPage() {
  const { items, fetchItems, isLoading } = useMyStore();

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Page</h1>
      <MyComponent>
        {items.map((item) => (
          <div key={item.id}>{item.name}</div>
        ))}
      </MyComponent>
    </div>
  );
}
```

## Testing

### Running Tests

```bash
# Unit tests
npm run test
npm run test:watch
npm run test:coverage

# E2E tests
npm run test:e2e
npm run test:e2e:ui

# Integration tests
npm run test:integration

# Storybook tests
npm run test:storybook
```

### Writing Tests

**Component Test Example:**

```typescript
// src/components/MyComponent/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './index';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent>Test content</MyComponent>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();

    render(<MyComponent onClick={handleClick}>Click me</MyComponent>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Service Test Example:**

```typescript
// src/services/__tests__/myService.test.ts
import { myService } from '../myService';
import { server } from '../../mocks/server';
import { rest } from 'msw';

describe('MyService', () => {
  it('fetches items successfully', async () => {
    const mockItems = [{ id: '1', name: 'Test Item' }];

    server.use(
      rest.get('/api/v1/my-resource', (req, res, ctx) => {
        return res(ctx.json({ success: true, data: mockItems }));
      })
    );

    const response = await myService.getItems();
    expect(response.success).toBe(true);
    expect(response.data).toEqual(mockItems);
  });
});
```

## Contributing

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push branch
git push -u origin feature/my-new-feature

# 4. Create PR via GitHub
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat: add new user authentication
fix: resolve pipeline progress bug
docs: update API documentation
style: format code with prettier
refactor: simplify state management
test: add component unit tests
chore: update dependencies
```

### Code Style Guidelines

**TypeScript:**

```typescript
// Use explicit types
interface User {
  id: string;
  name: string;
  email: string;
}

// Use const assertions
const STATUSES = ['draft', 'published'] as const;
type Status = (typeof STATUSES)[number];

// Use optional chaining
const userName = user?.profile?.name ?? 'Anonymous';
```

**React Components:**

```typescript
// Use function declarations
export function MyComponent({ prop1, prop2 }: Props) {
  // Hooks first
  const [state, setState] = useState('');
  const { data } = useQuery();

  // Event handlers
  const handleClick = useCallback(() => {
    // Handler logic
  }, []);

  // Early returns
  if (!data) return <Loading />;

  // Render
  return (
    <div className="container">
      <Button onClick={handleClick}>Click me</Button>
    </div>
  );
}
```

**CSS/Tailwind:**

```typescript
// Use cn() utility for conditional classes
const buttonClasses = cn(
  'px-4 py-2 rounded font-medium',
  'hover:bg-gray-100 transition-colors',
  isActive && 'bg-blue-500 text-white',
  className
);

// Group related classes
<div className={cn(
  // Layout
  'flex items-center justify-between p-4',
  // Styling
  'bg-white border border-gray-200 rounded-lg shadow-sm',
  // Interactive
  'hover:shadow-md transition-shadow cursor-pointer'
)} />
```

## Common Tasks

### Adding a New UI Component

1. **Create component structure:**

```bash
mkdir src/components/ui/NewComponent
cd src/components/ui/NewComponent
```

2. **Component files:**

```typescript
// index.tsx - Main component
// NewComponent.stories.tsx - Storybook stories
// NewComponent.test.tsx - Unit tests
```

3. **Update exports:**

```typescript
// src/components/ui/index.ts
export { NewComponent } from './NewComponent';
```

### Adding API Integration

1. **Define types:**

```typescript
// src/types/api.ts
export interface NewResource {
  id: string;
  name: string;
  createdAt: Date;
}
```

2. **Create service:**

```typescript
// src/services/newResource.ts
export class NewResourceService extends BaseApiService {
  // Service methods
}
```

3. **Add to service index:**

```typescript
// src/services/index.ts
export { newResourceService } from './newResource';
```

4. **Create store (if needed):**

```typescript
// src/stores/newResourceStore.ts
export const useNewResourceStore = create<NewResourceState>()(...);
```

### Adding New Page

1. **Create page file:**

```typescript
// app/new-page/page.tsx
export default function NewPage() {
  return <div>New Page</div>;
}
```

2. **Add navigation (if needed):**

```typescript
// src/components/Navigation.tsx
const navItems = [
  // ... existing items
  { href: '/new-page', label: 'New Page' },
];
```

3. **Add to sitemap/metadata:**

```typescript
// app/sitemap.ts or app/layout.tsx
// Update as needed
```

### Debugging Common Issues

**TypeScript Errors:**

```bash
# Check types
npm run type-check

# Restart TypeScript server in VS Code
Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

**Build Errors:**

```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Check for missing dependencies
npm ls
```

**Style Issues:**

```bash
# Rebuild Tailwind
npm run dev

# Check Tailwind config
npx tailwindcss --help
```

## Troubleshooting

### Common Issues

**1. Port Already in Use:**

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

**2. Module Not Found:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check import paths
# Use absolute imports with @/ alias
```

**3. Environment Variables Not Working:**

```bash
# Ensure .env.local exists and has correct format
# Restart dev server after changes
# Use NEXT_PUBLIC_ prefix for client-side variables
```

**4. API Connection Issues:**

```bash
# Check backend is running
curl http://localhost:8000/health

# Verify CORS settings
# Check network tab in browser dev tools
```

**5. TypeScript Compilation Errors:**

```bash
# Update TypeScript
npm install typescript@latest

# Check tsconfig.json
npx tsc --showConfig

# Clear TypeScript cache
rm -rf .next/types
```

### Performance Issues

**1. Slow Development Server:**

```bash
# Check for large files in public/
# Exclude unnecessary files in .gitignore
# Use fewer/smaller images
```

**2. Large Bundle Size:**

```bash
# Analyze bundle
npm run analyze

# Use dynamic imports
const Component = dynamic(() => import('./Component'));

# Optimize images
# Use next/image component
```

### Getting Help

**Development Resources:**

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

**Community:**

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
- Discord/Slack: Real-time chat with other developers

**Internal:**

- Code reviews: Get feedback from team members
- Architecture decisions: Discuss major changes
- Documentation: Keep docs updated with changes

---

## Next Steps

Once you have the basics working:

1. **Explore the codebase**: Read through existing components and services
2. **Run the test suite**: Understand how testing works in this project
3. **Check out Storybook**: See component documentation and examples
4. **Read the architecture docs**: Understand system design decisions
5. **Join team discussions**: Participate in planning and code reviews

Happy coding! 🚀

---

_This quickstart guide is regularly updated. If you find any issues or have suggestions for improvement, please open an issue or submit a PR._

_Last updated: September 2025_
