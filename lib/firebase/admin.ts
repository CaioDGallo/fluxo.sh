import * as admin from 'firebase-admin';

function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    // Return a dummy app during build time when env vars aren't set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }
}

export const firebaseAdmin = getFirebaseAdmin();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const messaging = firebaseAdmin?.messaging ? firebaseAdmin.messaging() : null as any;
