# STORM Dependencies Update Summary

## Overview
Updated and resolved dependency conflicts between STORM core and backend, fixed npm vulnerabilities, and updated deprecated packages.

## Changes Made

### 1. Python Dependencies Resolution

#### Created Files:
- **`requirements-unified.txt`** - Single file with all dependencies for both STORM and backend
- **`requirements-storm.txt`** - Pinned versions for STORM core only  
- **`backend/requirements-backend.txt`** - Pinned versions for backend only
- **`install-requirements.sh`** - Automated installation script with 3 installation options

#### Key Dependency Resolutions:
- **typing-extensions**: Upgraded from 4.8.0 → 4.15.0 (satisfies torch, openai, alembic requirements)
- **pydantic**: Using 2.11.7 with pydantic-core 2.33.2 (satisfies langchain-qdrant)
- **httpx**: Using 0.28.1 (compatible with both litellm and backend)
- **python-dateutil**: Using 2.9.0.post0 (satisfies htmldate requirements)

### 2. NPM Vulnerabilities Fixed

#### Security Fixes:
- **Before**: 17 moderate severity vulnerabilities in Storybook dependencies
- **After**: 0 vulnerabilities

#### Package Updates:
```json
{
  "@storybook/*": "7.6.20 → 8.6.14",
  "eslint-plugin-storybook": "0.6.15 → 0.11.1",
  "msw": "2.10.5 → 2.11.2",
  "@typescript-eslint/*": "6.21.0 → 7.18.0"
}
```

### 3. Installation Guide
Created comprehensive `INSTALLATION.md` with:
- System requirements for macOS, Linux, and Windows
- Quick start guide
- Detailed installation instructions
- API keys configuration
- Docker deployment setup
- Troubleshooting section

## Installation Instructions

### Quick Setup (New Environment)
```bash
# Clone and setup
git clone https://github.com/stanford-oval/storm.git
cd storm

# Create Python environment
python3.11 -m venv storm-env
source storm-env/bin/activate  # On Windows: storm-env\Scripts\activate

# Run automated installation
chmod +x install-requirements.sh
./install-requirements.sh
# Choose option 1 for unified installation

# Install frontend
cd frontend/storm-ui
npm install

# Configure API keys
# Create secrets.toml in root directory with your API keys

# Start services
# Terminal 1: Backend
cd backend && python main.py

# Terminal 2: Frontend  
cd frontend/storm-ui && npm run dev
```

### Manual Installation
```bash
# Option 1: Unified (Recommended)
pip install -r requirements-unified.txt

# Option 2: Separate
pip install -r requirements-storm.txt
cd backend && pip install -r requirements-backend.txt
```

## Testing

### Verify Installation
```bash
# Test backend API
curl http://localhost:8000/api/health

# Test TypeScript compilation
cd frontend/storm-ui
npm run type-check

# Run linter
npm run lint

# Run tests
npm test
```

## Current Status
✅ All Python dependency conflicts resolved
✅ All npm vulnerabilities fixed (0 vulnerabilities)
✅ TypeScript compilation successful
✅ ESLint warnings only (no errors)
✅ Backend and frontend can be started successfully

## Remaining Tasks (Optional)
- Clean up ESLint warnings (mostly unused variables)
- Consider upgrading to ESLint v9 when Next.js adds full support
- Update remaining outdated packages when stable versions are available

## Platform Compatibility
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu 20.04+, Debian 11+)  
- ✅ Windows 10/11 (WSL2 recommended)

## Notes
- All dependencies are now pinned to specific versions for reproducibility
- The unified requirements file is recommended for new installations
- Separate requirements files are available for existing environments
- Development installation option includes pre-commit hooks and testing tools