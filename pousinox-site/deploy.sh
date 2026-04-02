#!/bin/bash
set -e

echo "Buildando..."
npm run build

echo "Publicando no GitHub Pages..."
cd dist

git init
git checkout -B gh-pages
git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')"
git push -f https://github.com/Mmota45/pousinox-institucional.git gh-pages

cd ..
echo "Deploy concluído!"
