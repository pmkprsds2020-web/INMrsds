'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  unitId: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string, unitId: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmReset: (code: string, newPassword: string) => Promise<void>;
  verifyResetCode: (code: string) => Promise<string>;
  loginWithGoogle: () => Promise<void>;
  setUnitId: (unitId: string) => Promise<void>;
  sendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

// Firestore collection for user profiles
const USERS_COLLECTION = 'users';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unitId, setUnitIdState] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch user's unit assignment from Firestore
        try {
          const userDoc = await getDoc(doc(db, USERS_COLLECTION, user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUnitIdState(data.unitId || null);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setUnitIdState(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Fetch unit after login
    try {
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, cred.user.uid));
      if (userDoc.exists()) {
        setUnitIdState(userDoc.data().unitId || null);
      }
    } catch (err) {
      console.error('Error fetching user profile after login:', err);
    }
  };

  const signup = async (email: string, password: string, displayName: string, selectedUnitId: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    // Send email verification
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.error('Error sending email verification:', err);
    }
    // Store user profile with unit assignment in Firestore
    await setDoc(doc(db, USERS_COLLECTION, cred.user.uid), {
      email,
      displayName,
      unitId: selectedUnitId,
      role: 'user',
      emailVerified: false,
      createdAt: serverTimestamp(),
    });
    setUnitIdState(selectedUnitId);
  };

  const logout = async () => {
    await signOut(auth);
    setUnitIdState(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const confirmReset = async (code: string, newPassword: string) => {
    await confirmPasswordReset(auth, code, newPassword);
  };

  const verifyResetCode = async (code: string) => {
    return await verifyPasswordResetCode(auth, code);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    // Check if user profile exists, if not create one
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, cred.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, USERS_COLLECTION, cred.user.uid), {
        email: cred.user.email,
        displayName: cred.user.displayName,
        unitId: null,
        role: 'user',
        createdAt: serverTimestamp(),
      });
    } else {
      setUnitIdState(userDoc.data().unitId || null);
    }
  };

  const setUnitId = async (id: string) => {
    setUnitIdState(id);
    if (user?.uid) {
      try {
        await updateDoc(doc(db, USERS_COLLECTION, user.uid), { unitId: id });
      } catch (err) {
        console.error('Failed to persist unit change:', err);
      }
    }
  };

  const sendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    } else {
      throw new Error('Tidak ada pengguna yang login');
    }
   };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      unitId,
      login,
      signup,
      logout,
      resetPassword,
      confirmReset,
      verifyResetCode,
      loginWithGoogle,
      setUnitId,
      sendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
