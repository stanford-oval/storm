# STORM Installation Guide

Complete installation guide for STORM knowledge curation system with Next.js UI frontend.

## Table of Contents
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [API Keys Configuration](#api-keys-configuration)
- [Running the Application](#running-the-application)
- [Troubleshooting](#troubleshooting)
- [Docker Deployment](#docker-deployment)

## System Requirements

### Minimum Requirements
- **Python**: 3.11 or higher
- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher
- **RAM**: 8GB minimum (16GB recommended for large articles)
- **Storage**: 5GB free space (more for model caching)

### Operating System Support
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu 20.04+, Debian 11+)
- ✅ Windows 10/11 (with WSL2 recommended)

### Platform-Specific Requirements

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python 3.11+ via Homebrew
brew install python@3.11

# Install Node.js
brew install node
```

#### Windows
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [Python 3.11+](https://www.python.org/downloads/)
- Install [Node.js](https://nodejs.org/)
- Consider using [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install) for better compatibility

#### Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install Python 3.11
sudo apt install python3.11 python3.11-venv python3-pip

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs

# Install build essentials
sudo apt install build-essential libxml2-dev libxslt-dev
```

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/stanford-oval/storm.git
cd storm
```

### 2. Create Python Virtual Environment
```bash
# Create virtual environment
python3.11 -m venv storm-env

# Activate virtual environment
# On macOS/Linux:
source storm-env/bin/activate
# On Windows:
# storm-env\Scripts\activate
```

### 3. Run Automated Installation
```bash
# Make script executable (macOS/Linux)
chmod +x install-requirements.sh

# Run installation script
./install-requirements.sh

# Choose option 1 for new installation
```

### 4. Install Frontend Dependencies
```bash
cd frontend/storm-ui
npm install
```

### 5. Configure API Keys
Create `secrets.toml` in the root directory:
```toml
# Required: Choose at least one LLM provider
OPENAI_API_KEY = "sk-..."
# OR
ANTHROPIC_API_KEY = "sk-ant-..."

# Required: Choose at least one search provider
BING_SEARCH_API_KEY = "..."
# OR
YDC_API_KEY = "..."  # You.com
# OR
TAVILY_API_KEY = "..."
```

### 6. Start the Application
```bash
# Terminal 1: Start Backend
cd backend
python main.py

# Terminal 2: Start Frontend
cd frontend/storm-ui
npm run dev
```

Access the application at http://localhost:3000

## Detailed Installation

### Manual Python Dependencies Installation

#### Option 1: Unified Requirements (Recommended)
```bash
# Install all dependencies at once
pip install -r requirements-unified.txt
```

#### Option 2: Separate Installation
```bash
# Install STORM core
pip install -r requirements-storm.txt

# Install backend dependencies
cd backend
pip install -r requirements-backend.txt
cd ..
```

#### Option 3: Development Mode
```bash
# Install STORM in editable mode
pip install -e .

# Install backend requirements
cd backend
pip install -r requirements-backend.txt

# Install pre-commit hooks
pip install pre-commit
pre-commit install
```

### Frontend Setup

```bash
cd frontend/storm-ui

# Install dependencies
npm install

# Build for production
npm run build

# Run development server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## API Keys Configuration

### Required API Keys

You need at least one LLM provider and one search provider.

#### Language Model Providers

**OpenAI**
```toml
OPENAI_API_KEY = "sk-..."
OPENAI_API_TYPE = "openai"  # or "azure"
```

**Anthropic Claude**
```toml
ANTHROPIC_API_KEY = "sk-ant-..."
```

**Azure OpenAI**
```toml
AZURE_API_KEY = "..."
AZURE_API_BASE = "https://your-resource.openai.azure.com/"
AZURE_API_VERSION = "2024-02-15-preview"
```

#### Search Providers

**Bing Search**
```toml
BING_SEARCH_API_KEY = "..."
```

**You.com**
```toml
YDC_API_KEY = "..."
```

**Tavily**
```toml
TAVILY_API_KEY = "..."
```

**Brave Search**
```toml
BRAVE_API_KEY = "..."
```

### Environment Variables Alternative

Create `.env` file in the backend directory:
```bash
OPENAI_API_KEY=sk-...
BING_SEARCH_API_KEY=...
```

## Running the Application

### Development Mode

```bash
# Start all services with logging
# Backend (Terminal 1)
cd backend
python main.py --debug

# Frontend (Terminal 2)
cd frontend/storm-ui
npm run dev

# Optional: Start Storybook for component development (Terminal 3)
cd frontend/storm-ui
npm run storybook
```

### Production Mode

```bash
# Backend with production settings
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Frontend production build
cd frontend/storm-ui
npm run build
npm start
```

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start backend/main.py --name storm-backend --interpreter python3

# Start frontend
cd frontend/storm-ui
pm2 start npm --name storm-frontend -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

## Testing the Installation

### 1. Test Backend API
```bash
# Check if backend is running
curl http://localhost:8000/api/health

# Expected response:
# {"status":"healthy","version":"1.0.0"}
```

### 2. Test STORM Core
```bash
# Run example script
python examples/storm_examples/run_storm_wiki_gpt.py \
    --output-dir test_output \
    --retriever bing \
    --do-research \
    --do-generate-outline \
    --do-generate-article
```

### 3. Test Frontend
```bash
cd frontend/storm-ui
npm test
npm run test:e2e
```

## Troubleshooting

### Common Issues

#### 1. Dependency Conflicts
```bash
# Reset environment and reinstall
pip uninstall -y -r <(pip freeze)
pip install -r requirements-unified.txt
```

#### 2. Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### 3. Port Already in Use
```bash
# Kill processes on ports
# Backend (8000)
lsof -ti:8000 | xargs kill -9

# Frontend (3000)
lsof -ti:3000 | xargs kill -9
```

#### 4. Apple Silicon (M1/M2) Issues
```bash
# Install Rosetta 2
softwareupdate --install-rosetta

# Use x86_64 architecture for problematic packages
arch -x86_64 pip install <package_name>
```

#### 5. Windows WSL Issues
```powershell
# Restart WSL
wsl --shutdown
wsl
```

### Logging and Debugging

```bash
# Enable debug logging for backend
export LOG_LEVEL=DEBUG
python backend/main.py

# Frontend debugging
cd frontend/storm-ui
npm run dev -- --debug
```

## Docker Deployment

### Using Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./storm-projects:/app/storm-projects
    restart: unless-stopped

  frontend:
    build: ./frontend/storm-ui
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000/api
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  storm-projects:
```

### Build and Run
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Project Structure

```
storm/
├── knowledge_storm/        # Core STORM library
├── backend/               # FastAPI backend server
│   ├── main.py           # Application entry point
│   ├── routers/          # API endpoints
│   └── services/         # Business logic
├── frontend/
│   └── storm-ui/         # Next.js frontend
│       ├── app/          # App router pages
│       ├── src/          # Source code
│       │   ├── components/
│       │   ├── services/
│       │   └── store/
│       └── public/       # Static assets
├── examples/             # Example scripts
├── requirements-*.txt    # Python dependencies
└── secrets.toml         # API keys (create this)
```

## Next Steps

1. **Explore the UI**: Navigate to http://localhost:3000
2. **Create Your First Project**: Click "New Project" in the UI
3. **Configure Pipeline**: Select LLM and search providers
4. **Generate Articles**: Enter a topic and start generation
5. **View Analytics**: Monitor token usage and costs

## Support

- **Documentation**: [STORM Wiki](https://github.com/stanford-oval/storm/wiki)
- **Issues**: [GitHub Issues](https://github.com/stanford-oval/storm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/stanford-oval/storm/discussions)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.