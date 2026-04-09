#!/usr/bin/env node

/**
 * MANUAL DEPLOYMENT SCRIPT
 * Use this if Netlify auto-deploy fails
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 MANUAL DEPLOYMENT SCRIPT');
console.log('='.repeat(50));

try {
  // Step 1: Ensure we're on main branch
  console.log('📋 Step 1: Checking current branch...');
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  console.log(`Current branch: ${branch}`);
  
  if (branch !== 'main') {
    console.log('❌ Please switch to main branch first');
    process.exit(1);
  }

  // Step 2: Check if dist folder exists
  console.log('\n📦 Step 2: Checking build output...');
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    console.log('✅ Build folder exists');
    const files = fs.readdirSync(distPath);
    console.log(`Files in dist: ${files.length}`);
  } else {
    console.log('❌ Build folder not found. Running build...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  // Step 3: Git status
  console.log('\n📊 Step 3: Git status...');
  execSync('git status', { stdio: 'inherit' });

  // Step 4: Push latest changes
  console.log('\n📤 Step 4: Pushing latest changes...');
  execSync('git push origin main', { stdio: 'inherit' });

  console.log('\n✅ MANUAL DEPLOYMENT COMPLETED');
  console.log('\nNext steps:');
  console.log('1. Go to Netlify dashboard');
  console.log('2. Trigger deploy manually');
  console.log('3. Or drag-drop dist folder to Netlify');

} catch (error) {
  console.error('❌ DEPLOYMENT FAILED:', error.message);
  process.exit(1);
}
