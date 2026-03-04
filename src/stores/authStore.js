import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      isLocked: false,
      lockPin: null,

      _initAuth: () => {
        onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            set({
              user: { uid: firebaseUser.uid, email: firebaseUser.email },
              loading: false,
            });
          } else {
            set({ user: null, loading: false, isLocked: false });
          }
        });
      },

      login: async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
      },

      logout: async () => {
        await signOut(auth);
        set({ user: null, isLocked: false });
      },

      lock: () => set({ isLocked: true }),

      unlock: () => set({ isLocked: false }),

      unlockWithPin: (pin) => {
        const { lockPin } = get();
        if (lockPin && pin === lockPin) {
          set({ isLocked: false });
          return true;
        }
        return false;
      },

      unlockWithPassword: async (password) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('No user session');
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
        set({ isLocked: false });
      },

      setLockPin: (pin) => set({ lockPin: pin }),
      clearLockPin: () => set({ lockPin: null }),
    }),
    {
      name: 'cbros-auth',
      partialize: (state) => ({ lockPin: state.lockPin }),
    }
  )
);
