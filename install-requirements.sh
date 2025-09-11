#!/bin/bash
# Installation script for STORM + Backend with proper dependency resolution

echo "STORM Installation Script"
echo "========================="
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "Error: Python 3.11+ is required (found $python_version)"
    exit 1
fi

echo "Python version check passed: $python_version"
echo ""

# Function to install requirements
install_requirements() {
    local req_file=$1
    local desc=$2
    
    echo "Installing $desc..."
    echo "File: $req_file"
    echo "-------------------"
    
    if pip install -r "$req_file"; then
        echo "✓ $desc installed successfully"
    else
        echo "✗ Error installing $desc"
        return 1
    fi
    echo ""
}

# Option 1: Unified installation (recommended for new environments)
unified_install() {
    echo "Performing unified installation..."
    echo ""
    
    # Upgrade pip first
    pip install --upgrade pip
    
    # Install unified requirements
    install_requirements "requirements-unified.txt" "STORM + Backend (Unified)"
}

# Option 2: Separate installation (for existing environments)
separate_install() {
    echo "Performing separate installation..."
    echo ""
    
    # Upgrade pip first
    pip install --upgrade pip
    
    # Install STORM core first
    install_requirements "requirements-storm.txt" "STORM Core"
    
    # Then install backend
    cd backend
    install_requirements "requirements-backend.txt" "Backend"
    cd ..
}

# Option 3: Development installation (editable mode)
dev_install() {
    echo "Performing development installation..."
    echo ""
    
    # Upgrade pip first
    pip install --upgrade pip
    
    # Install STORM in editable mode
    pip install -e .
    
    # Install backend requirements
    cd backend
    install_requirements "requirements-backend.txt" "Backend"
    cd ..
    
    # Install development tools
    pip install pre-commit
    pre-commit install
}

# Main menu
echo "Select installation method:"
echo "1) Unified (Recommended for new environments)"
echo "2) Separate (For existing environments)"
echo "3) Development (Editable mode with dev tools)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        unified_install
        ;;
    2)
        separate_install
        ;;
    3)
        dev_install
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Set up your API keys in secrets.toml or .env"
echo "2. Test STORM: python examples/storm_examples/run_storm_wiki_gpt.py"
echo "3. Start backend: cd backend && python main.py"
echo "4. Start frontend: cd frontend/storm-ui && npm install && npm run dev"