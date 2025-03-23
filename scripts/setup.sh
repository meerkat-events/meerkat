#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting Meerkat setup...${NC}"

# Start Docker Compose services
echo -e "${YELLOW}📦 Starting Docker Compose services...${NC}"
docker compose up -d

# Copy environment files
echo -e "${YELLOW}🔧 Setting up environment files...${NC}"
cp api/.env.example api/.env
cp db/.env.example db/.env

# Install UI dependencies
echo -e "${YELLOW}📱 Installing UI dependencies...${NC}"
cd ui
npm install
cd ..

# Install Verifier dependencies
echo -e "${YELLOW}🔍 Installing Verifier dependencies...${NC}"
cd verifier
npm install
cd ..

# Install DB dependencies and run migrations
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
cd db
npm install
npm run migrate
cd ..

# Seed the database
echo -e "${YELLOW}🌱 Seeding database...${NC}"
cd db
./scripts/seed.sh
cd ..

# Setup local domains
echo -e "${YELLOW}🌐 Setting up local domains...${NC}"

# Check if running as root for this part
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Need root privileges to update /etc/hosts.${NC}"
  echo -e "${YELLOW}Please enter your password when prompted:${NC}"
  
  # Re-run this part of the script with sudo
  sudo bash -c "
    # Add entries to /etc/hosts if they don't exist
    grep -q \"meerkat.local\" /etc/hosts || echo \"127.0.0.1 meerkat.local\" >> /etc/hosts
    grep -q \"verifier.meerkat.local\" /etc/hosts || echo \"127.0.0.1 verifier.meerkat.local\" >> /etc/hosts
    
    # Flush DNS cache on macOS
    echo \"Flushing DNS cache...\"
    dscacheutil -flushcache
    killall -HUP mDNSResponder
  "
else
  # Already running as root
  # Add entries to /etc/hosts if they don't exist
  grep -q "meerkat.local" /etc/hosts || echo "127.0.0.1 meerkat.local" >> /etc/hosts
  grep -q "verifier.meerkat.local" /etc/hosts || echo "127.0.0.1 verifier.meerkat.local" >> /etc/hosts
  
  # Flush DNS cache on macOS
  echo "Flushing DNS cache..."
  dscacheutil -flushcache
  killall -HUP mDNSResponder
fi

echo -e "${GREEN}✅ Local domain entries added to /etc/hosts${NC}"
echo -e "${GREEN}✅ DNS cache flushed${NC}"

# Trigger certificate generation by accessing the domains
echo -e "${YELLOW}🔒 Triggering certificate generation...${NC}"
echo -e "${YELLOW}Accessing https://meerkat.local to generate certificates...${NC}"
curl -k https://meerkat.local > /dev/null 2>&1 || true
echo -e "${YELLOW}Accessing https://verifier.meerkat.local to generate certificates...${NC}"
curl -k https://verifier.meerkat.local > /dev/null 2>&1 || true

# Give Caddy a moment to generate the certificates
echo -e "${YELLOW}Waiting for certificates to be generated...${NC}"
sleep 3

# Trust Caddy certificate
echo -e "${YELLOW}🔒 Setting up Caddy certificate trust...${NC}"

# Check if running as root for this part
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Need root privileges to update system keychain.${NC}"
  echo -e "${YELLOW}Please enter your password when prompted:${NC}"
  
  # Create a temporary script to run with sudo
  TEMP_SCRIPT=$(mktemp)
  cat > "$TEMP_SCRIPT" << 'EOF'
#!/bin/bash
# Create a temporary directory
TEMP_DIR=$(mktemp -d)
CERT_PATH="$TEMP_DIR/caddy_root.crt"

# Extract the root certificate from Caddy's data volume
docker cp $(docker compose ps -q caddy):/data/caddy/pki/authorities/local/root.crt "$CERT_PATH" 2>/dev/null

if [ ! -f "$CERT_PATH" ]; then
  echo "Failed to extract the certificate. Certificates may not have been generated yet."
  echo "Try manually accessing https://meerkat.local in your browser."
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Add the certificate to the System keychain and trust it
security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_PATH"

# Clean up
rm -rf "$TEMP_DIR"
EOF
  
  chmod +x "$TEMP_SCRIPT"
  sudo "$TEMP_SCRIPT"
  rm "$TEMP_SCRIPT"
else
  # Already running as root
  # Create a temporary directory
  TEMP_DIR=$(mktemp -d)
  CERT_PATH="$TEMP_DIR/caddy_root.crt"
  
  # Extract the root certificate from Caddy's data volume
  docker cp $(docker compose ps -q caddy):/data/caddy/pki/authorities/local/root.crt "$CERT_PATH" 2>/dev/null
  
  if [ ! -f "$CERT_PATH" ]; then
    echo -e "${RED}Failed to extract the certificate. Certificates may not have been generated yet.${NC}"
    echo -e "${YELLOW}Try manually accessing https://meerkat.local in your browser.${NC}"
    rm -rf "$TEMP_DIR"
  else
    # Add the certificate to the System keychain and trust it
    security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_PATH"
    
    # Clean up
    rm -rf "$TEMP_DIR"
  fi
fi

echo -e "${GREEN}✅ Caddy's root certificate has been added to your System Keychain${NC}"
echo -e "${GREEN}✅ You should now be able to access your local domains without certificate warnings${NC}"

echo -e "\n${GREEN}✅ Setup complete! Your Meerkat environment is ready.${NC}"
echo -e "${GREEN}You can now access:${NC}"
echo -e "  • ${GREEN}https://meerkat.local${NC} (API)"
echo -e "  • ${GREEN}https://verifier.meerkat.local${NC} (Verifier)"
echo -e "\n${YELLOW}Note: You may need to restart your browsers for the certificate changes to take effect${NC}"
