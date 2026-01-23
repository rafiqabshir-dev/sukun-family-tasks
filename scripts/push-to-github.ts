/**
 * Script to create a GitHub repository and push the Sukun codebase
 * Uses Replit's GitHub connector for authentication
 */

import { Octokit } from '@octokit/rest';

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
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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

async function main() {
  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();
  
  // Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  const repoName = 'sukun-family-tasks';
  
  // Check if repo exists
  try {
    await octokit.repos.get({
      owner: user.login,
      repo: repoName
    });
    console.log(`Repository ${repoName} already exists`);
  } catch (error: any) {
    if (error.status === 404) {
      // Create the repository
      console.log(`Creating repository: ${repoName}...`);
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'Sukun - Family Tasks Made Simple. A React Native app that gamifies household responsibilities for children.',
        private: false,
        auto_init: false
      });
      console.log(`Repository created: https://github.com/${user.login}/${repoName}`);
    } else {
      throw error;
    }
  }
  
  // Output the remote URL for git
  console.log(`\nGitHub remote URL: https://github.com/${user.login}/${repoName}.git`);
  console.log(`\nTo push, run:`);
  console.log(`git remote add origin https://github.com/${user.login}/${repoName}.git`);
  console.log(`git push -u origin main`);
  
  // Return the info for further processing
  return {
    username: user.login,
    repoName,
    repoUrl: `https://github.com/${user.login}/${repoName}`
  };
}

main().catch(console.error);
