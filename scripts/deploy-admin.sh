#!/bin/sh
set -e

echo "🚀 Deploying Helix Admin Panel..."

if [ -f "packages/admin-panel/.env.production" ]; then
  set -a
  . packages/admin-panel/.env.production
  set +a
fi

echo "📦 Building admin panel..."
cd packages/admin-panel
npm install --no-audit --no-fund
npm run build

echo "🐳 Building Docker image..."
docker build -t helix/admin-panel:${VERSION:-latest} .

if [ -n "$DOCKER_REGISTRY" ]; then
  echo "📤 Pushing to registry..."
  docker tag helix/admin-panel:${VERSION:-latest} "$DOCKER_REGISTRY/helix/admin-panel:${VERSION:-latest}"
  docker push "$DOCKER_REGISTRY/helix/admin-panel:${VERSION:-latest}"
fi

if [ -n "$DEPLOY_HOST" ] && [ -n "$DOCKER_REGISTRY" ]; then
  echo "📡 Deploying to $DEPLOY_HOST..."
  ssh "$DEPLOY_USER@$DEPLOY_HOST" "
    cd /opt/helix &&
    docker pull $DOCKER_REGISTRY/helix/admin-panel:${VERSION:-latest} &&
    docker compose -f docker-compose.admin.yml up -d --force-recreate
  "
fi

echo "✅ Admin panel deployed successfully!"
