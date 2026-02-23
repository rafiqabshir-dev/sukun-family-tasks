#!/bin/sh
set -e

# Install Node.js via Homebrew (not available by default in Xcode Cloud)
brew install node

# Install Node.js dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install CocoaPods dependencies (with retry for transient CDN failures)
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"

MAX_RETRIES=3
RETRY=0
until pod install --repo-update || [ "$RETRY" -ge "$MAX_RETRIES" ]; do
  RETRY=$((RETRY + 1))
  echo "pod install failed (attempt $RETRY/$MAX_RETRIES), retrying in 10s..."
  sleep 10
done

if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
  echo "pod install failed after $MAX_RETRIES attempts"
  exit 1
fi
