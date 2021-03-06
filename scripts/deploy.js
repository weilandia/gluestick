#!/usr/bin/env node

if (process.argv.length <= 2 || !/\d+\.\d+\.\d+.*/.test(process.argv[2])) {
  console.error('Invalid version specified.');
  process.exit(1);
}

const version = process.argv[2].replace('v', '');
const spawn = require('cross-spawn');
const exec = require('child_process').execSync;

const spawnWithErrorHandling = (...args) => {
  const results = spawn.sync(...args);
  if (results.error) {
    throw results.error;
  }
};

// Publish packages to npm registry
spawnWithErrorHandling('npm', [
  'run',
  'lerna',
  'publish',
  '--',
  '--skip-git',
  '--repo-version',
  version,
  '--yes',
  '--force-publish=*',
  ...process.argv.slice(3),
], { stdio: 'inherit' });

console.log('Pushing commit...');
exec('git checkout staging');
exec('git add .');
exec(`git commit -m v${version}`);
exec(`git push origin ${process.env.BRANCH}`);

// Create docker image and push to Docker Hub
require('./docker/create-base-image')(spawnWithErrorHandling);

console.log('Done!');
