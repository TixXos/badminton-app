import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEWl6F0yhVI1nO_FQSlAsNEjPqq_eoYnM",
  authDomain: "badminton-app-699eb.firebaseapp.com",
  projectId: "badminton-app-699eb",
  storageBucket: "badminton-app-699eb.firebasestorage.app",
  messagingSenderId: "528941933594",
  appId: "1:528941933594:web:82c9f9c0b8babd2cf9dda3"
};

// 🔥 FIX IMPORTANT
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);