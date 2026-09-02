const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const fs = require('fs');

async function testFirebase() {
  console.log('--- Testing Firebase Admin SDK Initialization ---');
  const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
  console.log('Checking serviceAccountPath:', serviceAccountPath);
  console.log('File exists:', fs.existsSync(serviceAccountPath));

  let app;
  if (getApps().length > 0) {
    app = getApp();
    console.log('Firebase App already initialized:', app.name, 'ProjectId:', app.options.projectId || 'N/A');
  } else if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || 'shopulse-a954e'
    });
    console.log('✅ Firebase initialized with service-account.json! Project ID:', serviceAccount.project_id);
  }

  if (!app) {
    console.error('❌ Firebase App failed to initialize.');
    return;
  }

  const messaging = getMessaging(app);
  console.log('✅ Messaging instance acquired successfully for Project:', app.options.projectId || 'shopulse-a954e');
}

testFirebase();
