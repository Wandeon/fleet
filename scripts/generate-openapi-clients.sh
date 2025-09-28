#!/bin/bash
set -e

echo "🔄 Generating OpenAPI clients from single source..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Check if OpenAPI spec exists
if [ ! -f "apps/api/openapi.yaml" ]; then
    echo "❌ OpenAPI spec not found at apps/api/openapi.yaml"
    exit 1
fi

echo "📋 Validating OpenAPI specification..."
npx @apidevtools/swagger-parser validate apps/api/openapi.yaml

echo "🔄 Generating fetch client for UI..."
npm run openapi:generate

echo "🔄 Generating TypeScript types for UI..."
cd apps/ui
npm run generate:openapi
cd ../..

echo "✅ OpenAPI client generation complete"
echo ""
echo "Generated files:"
echo "  - apps/ui/src/lib/api/gen/**"
echo "  - apps/ui/src/lib/api/generated/**"
echo ""
echo "⚠️  Remember to commit all generated files!"