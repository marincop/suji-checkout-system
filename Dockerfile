# Use lightweight node base image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors first to optimize caching
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install dependencies for root, backend and frontend
RUN npm install
RUN npm install --prefix backend
RUN npm install --prefix frontend

# Copy all source files
COPY . .

# Build the frontend assets (generates frontend/dist)
RUN npm run build

# Prune dev dependencies for backend to reduce image size
WORKDIR /app/backend
RUN npm prune --production

# Final stage
FROM node:20-alpine

WORKDIR /app

# Copy production artifacts
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 5001

ENV PORT=5001
ENV NODE_ENV=production

# Start the Express server which serves the static React frontend
CMD ["npm", "run", "start"]
