# Browser bundles for the sign-in and wallet pages (web/ builds into ../public).
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json web/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY web/signin.tsx web/wallet.tsx web/fund.ts ./
RUN npm run build

# Tribe web app + Telegram bot. Node 22.5+ for the built-in node:sqlite.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm install --no-save tsx
COPY src ./src
COPY contracts ./contracts
COPY tsconfig.json ./
COPY --from=web /app/public ./public
ENV PORT=8787 DB_PATH=/data/tribe.db
EXPOSE 8787
# With DEMO=true, seed the demo data on first boot.
CMD ["sh", "-c", "if [ \"$DEMO\" = true ] && [ ! -f \"$DB_PATH\" ]; then npx tsx src/seed.ts; fi; exec npx tsx src/index.ts"]
