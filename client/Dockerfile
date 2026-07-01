# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# ---------- Production Stage ----------
FROM nginx:alpine

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R appuser:appgroup /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
CMD wget --spider http://localhost/ || exit 1


CMD ["nginx", "-g", "daemon off;"]
