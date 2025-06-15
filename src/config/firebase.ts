
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, FirestoreSettings, doc, getDoc } from 'firebase/firestore'; // Added doc and getDoc

// import { getDatabase } from 'firebase/database'; // For Realtime Database if needed

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID; // Optional

// Perform a pre-check for the essential Firebase configuration values.
if (!apiKey) {
  throw new Error(
    "Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing. " +
    "Please ensure it is correctly set in your .env.local file in the project root. " +
    "This file should contain lines like:\n" +
    "NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key_here\n" +
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain.firebaseapp.com\n" +
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id\n" +
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket.appspot.com\n" +
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id\n" +
    "NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id\n" +
    "After adding/correcting it, you MUST restart your development server."
  );
}
if (!authDomain) {
    throw new Error("Firebase Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) is missing. Check .env.local and restart server.");
}
if (!projectId) {
    throw new Error("Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is missing. Check .env.local and restart server.");
}
// Add checks for other essential variables if needed, e.g., appId

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
  measurementId: measurementId,
};

let appInstance: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;

try {
  appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(appInstance);
  dbInstance = getFirestore(appInstance);

  // Configure Firestore settings for offline persistence
  // Using cache settings for indexedDB persistence
  const firestoreSettings: FirestoreSettings = {
    cache: 'indexeddb', // 'indexeddb' for web persistence
    // host: 'YOUR_EMULATOR_HOST', // Uncomment and set if using emulator
    // ssl: true, // Set to false if using emulator without SSL
  };

  // Note: As of firebase@9.x and later, enabling persistence is handled
  // by setting the cache in FirestoreSettings.
  // The `enableIndexedDbPersistence` function is deprecated.

  // Attempt to apply settings, which implicitly enables persistence
  // This needs to happen before any data operations
  // It's an async operation, but calling it is sufficient to initiate.
  dbInstance.settings = firestoreSettings;

  // Log a message indicating the intention to enable persistence.
  // Actual success or failure may be logged by the SDK itself depending on browser/environment.
  console.log("Attempting to enable Firestore offline persistence using IndexedDB via settings...");

  // Optional: You can still listen for persistence errors if needed,
  // but the primary way to configure is via settings.
  // This line was causing the error. Corrected to v9 syntax.
  // The original path was collection 'dummy' and document 'dummy'.
  getDoc(doc(dbInstance, 'dummy', 'dummy')).catch((err: any) => {
      // Error handling for initial operation to trigger persistence setup
      // You might want to log this error or handle it if persistence setup fails.
      // console.warn("Dummy doc read for persistence setup failed (this might be expected if doc/collection doesn't exist or due to permissions):", err.message);
    });

} catch (error: any) {
  console.error("Firebase initialization failed. Raw error:", error);
  let detailedMessage = "An unexpected error occurred during Firebase initialization.";

  if (error.code) { // Firebase errors usually have a 'code' property
    switch (error.code) {
      case 'auth/invalid-api-key':
        detailedMessage =
          "Firebase: Error (auth/invalid-api-key). " +
          "This means the API key (NEXT_PUBLIC_FIREBASE_API_KEY in .env.local) is incorrect, malformed, or not authorized for this Firebase project. " +
          "1. Verify the key in your Firebase project settings (Project settings > General > Your apps > SDK setup and configuration). " +
          "2. Ensure it's correctly copied to .env.local. " +
          "3. Restart your development server after changes to .env.local.";
        break;
      case 'app/invalid-app-id':
         detailedMessage =
          "Firebase: Error (app/invalid-app-id). " +
          "The App ID (NEXT_PUBLIC_FIREBASE_APP_ID in .env.local) is incorrect or malformed. " +
          "Verify it in your Firebase project settings and .env.local, then restart the server.";
        break;
      // You can add more specific Firebase error codes here
      default:
        detailedMessage = `Firebase error code: ${error.code}. Message: ${error.message}. Please check your Firebase setup and .env.local file.`;
    }
  } else if (error.message && typeof error.message === 'string') {
    // Fallback for generic errors, though Firebase usually provides a code
    detailedMessage = error.message;
  }

  throw new Error(`Firebase Initialization Error: ${detailedMessage}`);
}

export { appInstance as app, authInstance as auth, dbInstance as db };

// Create a .env.local file in the root of your project with your Firebase config:
// NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
// NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
// NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id (optional)
