#!/bin/sh
set -e

echo "⏳ Running migrations..."
npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/config/database.ts
echo "✅ Migrations complete."

echo "🌱 Running seed..."
npx ts-node src/seed.ts
echo "✅ Seed complete."

echo "🚀 Starting server..."
exec node dist/app.js
