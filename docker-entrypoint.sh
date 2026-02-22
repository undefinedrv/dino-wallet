#!/bin/sh
set -e

echo "⏳ Running migrations..."
# In production, we run the compiled JS migrations using the regular node command
node ./node_modules/typeorm/cli.js migration:run -d dist/config/database.js

echo "✅ Migrations complete."

echo "🚀 Starting server..."
exec node dist/app.js
