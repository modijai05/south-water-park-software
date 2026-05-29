import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  IdTokenResult
} from 'firebase/auth';

// Your web app's Firebase configuration
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
const auth = getAuth(app);

// Authentication functions
export const firebaseAuthService = {
  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      
      // Send ID token to backend for verification and JWT generation
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://south-water-park-backend.onrender.com/api'}/firebase-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error('Backend authentication failed');
      }

      const data = await response.json();
      
      // Store JWT token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      return data;
    } catch (error) {
      console.error('Firebase sign-in error:', error);
      throw error;
    }
  },

  // Sign up with email and password
  signUp: async (email: string, password: string, username: string, fullName?: string, role?: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://south-water-park-backend.onrender.com/api'}/firebase-auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username, fullName, role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      
      // Store JWT token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      return data;
    } catch (error) {
      console.error('Firebase sign-up error:', error);
      throw error;
    }
  },

  // Sign out
  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    } catch (error) {
      console.error('Firebase sign-out error:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: (): FirebaseUser | null => {
    return auth.currentUser;
  },

  // Get ID token
  getIdToken: async (forceRefresh = false): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
      const idTokenResult = await user.getIdToken(forceRefresh);
      return idTokenResult;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  // Reset password
  resetPassword: async (email: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://south-water-park-backend.onrender.com/api'}/firebase-auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Password reset failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Firebase password reset error:', error);
      throw error;
    }
  },
};

export { auth, app };
