import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, googleProvider, testFirestoreConnection } from "../services/firebase";
import {
  createUserProfile,
  DEFAULT_NOTIFICATION_PREFS,
  deleteAllUserData,
  subscribeUserProfile,
} from "../services/firestoreService";
import type { UserProfile } from "../types";
import { useTheme } from "./ThemeContext";

export interface RegistrationPayload {
  fullName: string;
  email: string;
  password: string;
  college: string;
  degree: string;
  branch: string;
  semester: string;
  academicYear: string;
}

export interface OnboardingPayload {
  fullName: string;
  college: string;
  degree: string;
  branch: string;
  semester: string;
  academicYear: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  pendingProfileSetup: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (payload: RegistrationPayload) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendResetPasswordEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  completeOnboardingProfile: (payload: OnboardingPayload) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (currentPassword?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PENDING_REG_KEY = "slm_pending_academic_profile";

export function formatAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || "";
  const msg = error instanceof Error ? error.message : String(error);
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password. Please check your credentials and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completing authentication.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). You can enable it there or use Google Sign-In right away.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/requires-recent-login":
      return "For security, please re-authenticate before performing this sensitive action.";
    default:
      return msg || "Authentication request failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadedOnce, setProfileLoadedOnce] = useState(false);
  const [, setVerificationTick] = useState(0);
  const { setThemePreference } = useTheme();

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setProfileLoading(false);
        setProfileLoadedOnce(false);
      } else {
        setProfileLoading(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserProfile(
      user.uid,
      async (docProfile) => {
        if (!docProfile && user.emailVerified) {
          const cached = localStorage.getItem(PENDING_REG_KEY);
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as OnboardingPayload;
              await createUserProfile({
                userId: user.uid,
                fullName: parsed.fullName || user.displayName || "Student",
                email: user.email || "",
                college: parsed.college || "",
                degree: parsed.degree || "",
                branch: parsed.branch || "",
                semester: parsed.semester || "",
                academicYear: parsed.academicYear || "",
                profileImage: user.photoURL || "",
                themePreference: "light",
                notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
              });
              localStorage.removeItem(PENDING_REG_KEY);
              return;
            } catch {
              localStorage.removeItem(PENDING_REG_KEY);
            }
          }
        }
        setProfile(docProfile);
        if (docProfile?.themePreference) {
          setThemePreference(docProfile.themePreference);
        }
        setProfileLoading(false);
        setProfileLoadedOnce(true);
      },
      () => {
        setProfileLoading(false);
        setProfileLoadedOnce(true);
      }
    );
    return () => unsub();
  }, [user, setThemePreference]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const registerWithEmail = async (payload: RegistrationPayload) => {
    const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    await updateProfile(cred.user, { displayName: payload.fullName });
    localStorage.setItem(
      PENDING_REG_KEY,
      JSON.stringify({
        fullName: payload.fullName,
        college: payload.college,
        degree: payload.degree,
        branch: payload.branch,
        semester: payload.semester,
        academicYear: payload.academicYear,
      })
    );
    await sendEmailVerification(cred.user);
    if (cred.user.emailVerified) {
      await createUserProfile({
        userId: cred.user.uid,
        fullName: payload.fullName,
        email: payload.email,
        college: payload.college,
        degree: payload.degree,
        branch: payload.branch,
        semester: payload.semester,
        academicYear: payload.academicYear,
        profileImage: "",
        themePreference: "light",
        notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      });
      localStorage.removeItem(PENDING_REG_KEY);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const sendResetPasswordEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error("No active user session.");
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed);
    setVerificationTick((t) => t + 1);
    if (refreshed?.emailVerified) {
      const cached = localStorage.getItem(PENDING_REG_KEY);
      if (cached && !profile) {
        const parsed = JSON.parse(cached) as OnboardingPayload;
        await createUserProfile({
          userId: refreshed.uid,
          fullName: parsed.fullName || refreshed.displayName || "Student",
          email: refreshed.email || "",
          college: parsed.college || "",
          degree: parsed.degree || "",
          branch: parsed.branch || "",
          semester: parsed.semester || "",
          academicYear: parsed.academicYear || "",
          profileImage: refreshed.photoURL || "",
          themePreference: "light",
          notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
        });
        localStorage.removeItem(PENDING_REG_KEY);
      }
      return true;
    }
    return false;
  };

  const completeOnboardingProfile = async (payload: OnboardingPayload) => {
    if (!auth.currentUser) throw new Error("Not signed in.");
    await createUserProfile({
      userId: auth.currentUser.uid,
      fullName: payload.fullName || auth.currentUser.displayName || "Student",
      email: auth.currentUser.email || "",
      college: payload.college,
      degree: payload.degree,
      branch: payload.branch,
      semester: payload.semester,
      academicYear: payload.academicYear,
      profileImage: auth.currentUser.photoURL || "",
      themePreference: "light",
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    });
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("No authenticated email account found.");
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const deleteAccount = async (currentPassword?: string) => {
    if (!auth.currentUser) throw new Error("No active session.");
    const current = auth.currentUser;
    const isPasswordUser = current.providerData.some((p) => p.providerId === "password");
    if (isPasswordUser && current.email) {
      if (!currentPassword) {
        throw new Error("Please enter your current password to confirm account deletion.");
      }
      const cred = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, cred);
    } else {
      await reauthenticateWithPopup(current, googleProvider);
    }
    await deleteAllUserData(current.uid);
    await deleteUser(current);
  };

  const pendingProfileSetup = Boolean(
    authReady && user && user.emailVerified && profileLoadedOnce && !profile
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        profileLoading,
        pendingProfileSetup,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendResetPasswordEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        completeOnboardingProfile,
        changePassword,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
