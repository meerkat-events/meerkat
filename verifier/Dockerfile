# Use Node 22 slim as the base image
FROM node:24-slim

# Set working directory
WORKDIR /app

ENV PORT=3000

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "start"]
