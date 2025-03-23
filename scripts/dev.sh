#!/bin/bash
set -e

echo "🚀 Starting Meerkat development environment with tmux..."

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux is not installed. Please install it with:"
    echo "   brew install tmux"
    exit 1
fi

# Make sure Docker services are running
echo "📦 Ensuring Docker services are running..."
docker compose up -d

# Session name
SESSION="meerkat-dev"

# Kill existing session if it exists
tmux kill-session -t $SESSION 2>/dev/null || true

# Create a new tmux session
tmux new-session -d -s $SESSION

# Rename the first window
tmux rename-window -t $SESSION:0 'Meerkat Dev'

# Split the window into three panes
tmux split-window -h -t $SESSION:0
tmux split-window -v -t $SESSION:0.1

# Start API in the first pane
tmux send-keys -t $SESSION:0.0 "cd $(pwd)/api && echo '🚀 Starting API Server...' && deno task dev" C-m

# Start UI in the second pane
tmux send-keys -t $SESSION:0.1 "cd $(pwd)/ui && echo '🚀 Starting UI Server...' && npm run dev" C-m

# Start Verifier in the third pane
tmux send-keys -t $SESSION:0.2 "cd $(pwd)/verifier && echo '🚀 Starting Verifier Server...' && npm run dev" C-m

# Attach to the session
tmux attach-session -t $SESSION

echo "✅ Development environment started in tmux!"
echo "🌐 Services are available at:"
echo "   - API: http://localhost:8000"
echo "   - Verifier: http://localhost:8001"
echo "   - UI: http://localhost:3000 (development server)"
echo ""
echo "📝 tmux keyboard shortcuts:"
echo "   - Ctrl+b d: Detach from session (keeps services running)"
echo "   - Ctrl+b arrow keys: Navigate between panes"
echo "   - Ctrl+b z: Zoom in/out of current pane"
echo "   - Ctrl+b &: Kill the session (stops all services)" 