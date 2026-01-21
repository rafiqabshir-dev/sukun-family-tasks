// This file is a placeholder to satisfy the old workflow configuration.
// The actual app is started via Expo.
// Run: npx expo start --web --port 5000

import { spawn } from 'child_process';

console.log('Starting Expo app...');

const expo = spawn('npx', ['expo', 'start', '--tunnel', '--port', '5000'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  cwd: process.cwd(),
  env: { ...process.env, EXPO_NO_REDIRECT: '1' }
});

// Auto-select "Proceed anonymously" when login prompt appears
// Send down arrow + enter to select the second option
let promptCount = 0;
const respondToPrompt = () => {
  if (expo.stdin && !expo.stdin.destroyed) {
    // Down arrow to select "Proceed anonymously", then Enter
    expo.stdin.write('\x1B[B\n');
    promptCount++;
    console.log(`[Server] Auto-selected anonymous mode (attempt ${promptCount})`);
  }
};

// Respond to prompts periodically for the first 30 seconds
const promptInterval = setInterval(respondToPrompt, 2000);
setTimeout(() => clearInterval(promptInterval), 30000);

expo.on('error', (err) => {
  console.error('Failed to start Expo:', err);
  clearInterval(promptInterval);
  process.exit(1);
});

expo.on('close', (code) => {
  clearInterval(promptInterval);
  process.exit(code || 0);
});
