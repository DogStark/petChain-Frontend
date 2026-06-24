# Use a tiny image with Node.js installed
FROM node:20-alpine

WORKDIR /app

# Install curl so the Docker healthcheck can actually run
RUN apk add --no-cache curl

# Create a tiny server script directly in the Dockerfile
RUN echo 'const http = require("http"); \
const server = http.createServer((req, res) => { \
  if (req.url === "/health") { \
    res.writeHead(200, { "Content-Type": "application/json" }); \
    res.end(JSON.stringify({ status: "ok", service: "petchain-backend-skeleton" })); \
  } else { \
    res.writeHead(200, { "Content-Type": "text/plain" }); \
    res.end("PetChain Backend Skeleton Online"); \
  } \
}); \
server.listen(3001, () => { \
  console.log("Skeleton server running on port 3001"); \
});' > server.js

# Expose the correct port for the Frontend and Compose to find
EXPOSE 3001

# The Healthcheck Docker Compose is waiting for
HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
