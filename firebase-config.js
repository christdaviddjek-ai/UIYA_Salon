// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCG4hTAO8kTFqxkrvpzmZMBx8acJ6rkwh8",
  authDomain: "uiyasalon.firebaseapp.com",
  projectId: "uiyasalon",
  storageBucket: "uiyasalon.firebasestorage.app",
  messagingSenderId: "230318999340",
  appId: "1:230318999340:web:8a582ad8352470af58ce89"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);