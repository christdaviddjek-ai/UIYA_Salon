// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ⚠️ SÉCURITÉ: Stockez les clés Firebase dans les variables d'environnement
// Ne jamais les exposer directement en production!
// Utilisez un fichier .env ou un service backend pour les clés sensibles

// Charger depuis les variables d'environnement (recommandé)
const env = typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCG4hTAO8kTFqxkrvpzmZMBx8acJ6rkwh8",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "uiyasalon.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "uiyasalon",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "uiyasalon.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "230318999340",
  appId: env.VITE_FIREBASE_APP_ID || "1:230318999340:web:8a582ad8352470af58ce89"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);