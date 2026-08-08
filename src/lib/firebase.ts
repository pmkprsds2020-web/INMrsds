import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAi_84Rxw8oYUrXdrJu7avlm7vnkEqZt9c",
  authDomain: "mutu-rumahsakit.firebaseapp.com",
  databaseURL: "https://mutu-rumahsakit-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mutu-rumahsakit",
  storageBucket: "mutu-rumahsakit.firebasestorage.app",
  messagingSenderId: "132381266935",
  appId: "1:132381266935:web:73ccd06beca20c62b6d4f2",
  measurementId: "G-GV64JZST9W"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
