// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAqMQWa2RzNuQhg9Z280qNrqDsGJ5aTuDE",
  authDomain: "thesouthticketmanagement.firebaseapp.com",
  projectId: "thesouthticketmanagement",
  storageBucket: "thesouthticketmanagement.firebasestorage.app",
  messagingSenderId: "682803068902",
  appId: "1:682803068902:web:99691d9a7413cfe88e6027",
  measurementId: "G-J8SQ4Z4XTJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { app, analytics };
export default app;
