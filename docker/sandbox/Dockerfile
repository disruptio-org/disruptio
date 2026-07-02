FROM node:20-alpine

# Install standard workspace debugging utilities
RUN apk add --no-cache git curl postgresql-client bash sqlite

# Set up non-root user for security isolation
RUN addgroup -S agentgroup && adduser -S agentuser -G agentgroup
WORKDIR /workspace
RUN chown -R agentuser:agentgroup /workspace

USER agentuser

# Pre-cache dependencies to optimize speed
COPY --chown=agentuser:agentgroup package*.json ./
RUN npm ci --quiet

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["tail", "-f", "/dev/null"]
