// Force Render deployment by updating a deployment-specific file
const fs = require('fs');

// Create a deployment trigger file with timestamp
const deploymentInfo = {
  timestamp: new Date().toISOString(),
  version: '2.1',
  fixes: [
    'MongoDB route ordering fixed',
    'sync-all endpoint moved before /:id',
    'enhanced error handling',
    'health check endpoint improved'
  ],
  status: 'READY_FOR_DEPLOYMENT'
};

// Write deployment info file
fs.writeFileSync('./deployment-trigger.json', JSON.stringify(deploymentInfo, null, 2));

console.log('🚀 Render deployment trigger created:');
console.log('📋 Version:', deploymentInfo.version);
console.log('🕐 Timestamp:', deploymentInfo.timestamp);
console.log('🔧 Fixes included:', deploymentInfo.fixes.length);
console.log('✅ Ready for Render deployment');
