// This file is a placeholder to satisfy the old workflow configuration.
// The actual app is started via Expo.
// Run: npx expo start --web --port 5000

import { spawn } from 'child_process';

console.log('Starting Expo app...');

const expo = spawn('npx', ['expo', 'start', '--tunnel', '--port', '5000'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

expo.on('error', (err) => {
  console.error('Failed to start Expo:', err);
  process.exit(1);
});

expo.on('close', (code) => {
  process.exit(code || 0);
});
