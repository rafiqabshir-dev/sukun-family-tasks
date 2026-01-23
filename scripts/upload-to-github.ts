/**
 * Script to upload Sukun codebase to GitHub via API
 * Uses Replit's GitHub connector for authentication
 */

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// Files/folders to exclude
const EXCLUDE = new Set([
  'node_modules',
  '.git',
  '.cache',
  '.expo',
  'dist',
  '.replit',
  'replit.nix',
  '.upm',
  '.config',
  'generated-icon.png',
  'package-lock.json',
  '.breakpoints',
  '.env',
  '.env.local',
  '.local',
  'attached_assets',
  'tmp',
  'scripts'  // Exclude helper scripts
]);

// Binary file extensions that should be base64 encoded
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.mp3', '.wav', '.ogg', '.ttf', '.otf', '.woff', '.woff2']);

function shouldInclude(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return !parts.some(part => EXCLUDE.has(part));
}

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (!shouldInclude(fullPath)) return;
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function main() {
  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  const owner = user.login;
  const repo = 'sukun-family-tasks';
  const basePath = '/home/runner/workspace';
  
  // First, create initial commit with README to initialize the repo
  console.log('\nInitializing repository with README...');
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from(fs.readFileSync(path.join(basePath, 'README.md'), 'utf-8')).toString('base64')
    });
    console.log('README.md created');
  } catch (err: any) {
    if (err.status === 422) {
      console.log('README.md already exists, continuing...');
    } else {
      throw err;
    }
  }
  
  // Get the latest commit SHA
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main'
  });
  const latestCommitSha = refData.object.sha;
  
  // Get the tree SHA from the latest commit
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commitData.tree.sha;
  
  console.log('\nCollecting files...');
  const allFiles = getAllFiles(basePath);
  console.log(`Found ${allFiles.length} files to upload`);
  
  // Create blobs for all files
  console.log('\nCreating file blobs...');
  const tree: Array<{path: string; mode: '100644'; type: 'blob'; sha: string}> = [];
  
  let uploaded = 0;
  let failed = 0;
  
  for (const filePath of allFiles) {
    const relativePath = path.relative(basePath, filePath);
    
    // Skip README since we already uploaded it
    if (relativePath === 'README.md') continue;
    
    const isBinary = isBinaryFile(filePath);
    
    try {
      let content: string;
      let encoding: 'utf-8' | 'base64';
      
      if (isBinary) {
        content = fs.readFileSync(filePath).toString('base64');
        encoding = 'base64';
      } else {
        content = fs.readFileSync(filePath, 'utf-8');
        encoding = 'utf-8';
      }
      
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content,
        encoding
      });
      
      tree.push({
        path: relativePath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      });
      
      uploaded++;
      if (uploaded % 20 === 0) {
        console.log(`  Uploaded ${uploaded} files...`);
      }
    } catch (err: any) {
      console.error(`  ! Failed: ${relativePath}: ${err.message?.substring(0, 50)}`);
      failed++;
    }
  }
  
  console.log(`\nUploaded ${uploaded} files, ${failed} failed`);
  
  if (tree.length === 0) {
    console.log('No files to commit');
    return;
  }
  
  console.log('\nCreating tree...');
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree
  });
  
  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Add Sukun Family Tasks App codebase\n\nA React Native app that gamifies household responsibilities for children aged 5-12.\n\nFeatures:\n- Task management with approval workflows\n- Star-based rewards system\n- Family Wheel game\n- Today dashboard with weather, prayer times, nearby parks\n- Push notifications\n- Multi-user support (guardians and participants)',
    tree: treeData.sha,
    parents: [latestCommitSha]
  });
  
  console.log('Updating main branch...');
  await octokit.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: commit.sha
  });
  
  console.log(`\n========================================`);
  console.log(`SUCCESS! Code pushed to GitHub!`);
  console.log(`Repository: https://github.com/${owner}/${repo}`);
  console.log(`========================================`);
}

main().catch(console.error);
