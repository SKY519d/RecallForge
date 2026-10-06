import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { BookOpen, LogIn } from 'lucide-react';
import { loadAccountAppData, loadAppData, loadLegacyAppData, hasLegacyAppData, removeLegacyAppData, saveAccountAppData, createEmptyAppData } from '../../core/storage/localStorage';
import { loadCloudWorkspace, saveCloudWorkspace } from '../../core/auth/cloudWorkspace';
import { supabase, supabaseConfigured, supabaseConfigurationError } from '../../core/auth/supabase';
import { useAppStore } from '../../store/appStore';

interface AccountContextValue {
  user: User | null;
  signOut: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue>({
  user: null,
  signOut: async () => { throw new Error('No account is signed in.'); },
});

export function useAccount() {
  return useContext(AccountContext);
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [recoveryRequired, setRecoveryRequired] = useState(() => window.location.hash.includes('type=recovery'));
  const [retry, setRetry] = useState(0);
  const clearWorkspace = useAppStore((state) => state.clearWorkspace);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setLocalWorkspace = useAppStore((state) => state.setLocalWorkspace);
  const setLocalCacheError = useAppStore((state) => state.setLocalCacheError);
  const activeWorkspaceUserId = useAppStore((state) => state.userId);
  const localOnly = useAppStore((state) => state.localOnly);
  const authenticatedUserId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setRecoveryRequired(window.location.hash.includes('type=recovery'));
      setAuthReady(true);
      setAuthError('');
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(`Could not check your sign-in status: ${error.message}`);
      else setSession(data.session);
      setAuthReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : 'Could not check your sign-in status.');
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setWorkspaceReady(false);
    setWorkspaceError('');
    clearWorkspace();
    if (!authReady) {
      return () => { active = false; };
    }
    if (!supabaseConfigured) {
      try {
        setWorkspaceError('');
        setLocalWorkspace(loadAppData());
        setWorkspaceReady(true);
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : 'Saved browser data could not be loaded.');
        setWorkspaceReady(true);
      }
      return () => { active = false; };
    }
    if (!session || !authenticatedUserId) {
      setWorkspaceReady(authReady);
      return () => { active = false; };
    }

    const userId = authenticatedUserId;
    void (async () => {
      try {
        const remoteData = await loadCloudWorkspace(userId);
        if (!active) return;
        let workspace = remoteData;
        let migratingLegacyData = false;
        if (!workspace) {
          workspace = loadAccountAppData(userId);
          if (!workspace && hasLegacyAppData() && window.confirm(
            `This browser has older study data that is not tied to an account. Import it into ${session.user.email ?? 'this account'} and remove the old shared browser copy? Choose Cancel to keep this account empty.`,
          )) {
            workspace = loadLegacyAppData();
            migratingLegacyData = true;
          }
          workspace ??= createEmptyAppData();
          await saveCloudWorkspace(userId, workspace);
          if (migratingLegacyData) removeLegacyAppData();
          if (!active) return;
        }
        let cacheWarning = '';
        try {
          saveAccountAppData(userId, workspace);
        } catch (error) {
          cacheWarning = error instanceof Error ? `Account data is synced online, but this browser could not save its local cache: ${error.message}` : 'Account data is synced online, but this browser could not save its local cache.';
        }
        setWorkspace(userId, workspace);
        if (cacheWarning) setLocalCacheError(cacheWarning);
        setWorkspaceReady(true);
      } catch (error) {
        if (!active) return;
        setWorkspaceError(error instanceof Error ? error.message : 'Your account workspace could not be loaded.');
        setWorkspaceReady(true);
      }
    })();
    return () => { active = false; };
  }, [authReady, authenticatedUserId, clearWorkspace, retry, setLocalCacheError, setLocalWorkspace, setWorkspace]);

  const signOut = async () => {
    if (!supabase) throw new Error('Account storage is not configured.');
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
  };

  if (!supabaseConfigured) {
    if (!workspaceReady || !localOnly) {
      return <AccountMessage
        title={workspaceError ? 'Local workspace unavailable' : 'Opening your study desk'}
        detail={workspaceError || 'Loading your saved browser data…'}
        action={workspaceError ? 'Retry loading' : undefined}
        onAction={workspaceError ? () => setRetry((value) => value + 1) : undefined}
      />;
    }
    return <AccountContext.Provider value={{ user: null, signOut }}>{children}</AccountContext.Provider>;
  }
  if (!supabase) {
    return <AccountSetupScreen />;
  }
  if (!authReady) {
    return <AccountMessage title="Checking account" detail="Connecting to your private study workspace…" />;
  }
  if (authError) {
    return <AccountMessage title="Account connection failed" detail={authError} action="Try again" onAction={() => window.location.reload()} />;
  }
  if (!session) {
    return <AuthScreen />;
  }
  if (recoveryRequired) {
    return <AuthScreen recovery onRecoveryComplete={() => {
      window.history.replaceState(null, '', window.location.pathname);
      setRecoveryRequired(false);
    }} />;
  }
  if (!workspaceReady || workspaceError || activeWorkspaceUserId !== authenticatedUserId) {
    return <AccountMessage
      title={workspaceError ? 'Workspace unavailable' : 'Opening your workspace'}
      detail={workspaceError || 'Loading your private study data…'}
      action={workspaceError ? 'Retry loading' : undefined}
      onAction={workspaceError ? () => setRetry((value) => value + 1) : undefined}
    />;
  }

  return <AccountContext.Provider value={{ user: session.user, signOut }}>{children}</AccountContext.Provider>;
}

function AuthScreen({ recovery = false, onRecoveryComplete }: { recovery?: boolean; onRecoveryComplete?: () => void }) {
  const [mode, setMode] = useState<'signIn' | 'create' | 'forgot'>(recovery ? 'signIn' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      if (!supabase) throw new Error('Account storage is not configured.');
      if (recovery) {
        if (password.length < 8) throw new Error('Use at least 8 characters for your new password.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw new Error(updateError.message);
        setMessage('Password updated. Opening your workspace…');
        onRecoveryComplete?.();
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (resetError) throw new Error(resetError.message);
        setMessage('If an account exists for that address, a password reset link is on its way.');
      } else if (mode === 'create') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw new Error(signUpError.message);
        if (!data.session) setMessage('Account created. Check your email to confirm your address, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error(signInError.message);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The account request failed.');
    } finally {
      setPending(false);
    }
  };

  const title = recovery ? 'Choose a new password' : mode === 'create' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Sign in';
  return (
    <main className="account-screen">
      <section className="account-panel">
        <div className="account-brand"><span className="account-mark"><BookOpen size={20} /></span><span>RecallForge<small>PRIVATE STUDY WORKSPACE</small></span></div>
        <h1>{title}</h1>
        <p>{recovery ? 'Set a new password to return to your study workspace.' : mode === 'create' ? 'Create an account to keep your study data private and available across devices.' : mode === 'forgot' ? 'Enter your account email and we will send a reset link.' : 'Sign in to open your private study workspace.'}</p>
        <form onSubmit={(event) => void submit(event)} className="account-form">
          {!recovery && <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
          {(recovery || mode !== 'forgot') && <label>{recovery ? 'New password' : 'Password'}<input type="password" autoComplete={recovery ? 'new-password' : mode === 'create' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
          {error && <div className="account-error" role="alert">{error}</div>}
          {message && <div className="account-message" role="status">{message}</div>}
          <button className="button primary account-submit" type="submit" disabled={pending}>
            <LogIn size={16} />{pending ? 'Please wait…' : recovery ? 'Update password' : mode === 'create' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
          </button>
        </form>
        {!recovery && (
          <div className="account-switch">
            {mode === 'signIn' && <button onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Forgot password?</button>}
            {mode !== 'signIn' && <button onClick={() => { setMode('signIn'); setError(''); setMessage(''); }}>Back to sign in</button>}
            {mode === 'signIn' && <span>New here? <button onClick={() => { setMode('create'); setError(''); setMessage(''); }}>Create an account</button></span>}
            {mode === 'create' && <span>Already have an account? <button onClick={() => { setMode('signIn'); setError(''); setMessage(''); }}>Sign in</button></span>}
          </div>
        )}
        <small className="account-privacy">Each account has its own private data. Your password is managed securely by Supabase Auth.</small>
      </section>
    </main>
  );
}

function AccountSetupScreen() {
  return <AccountMessage
    title="Account setup required"
    detail={supabaseConfigurationError || 'Add your Supabase project URL and public anon key to a local .env file, run the database schema in the Supabase SQL editor, then restart the site. See the README setup instructions.'}
  />;
}

function AccountMessage({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return (
    <main className="account-screen">
      <section className="account-panel account-status-panel">
        <div className="account-brand"><span className="account-mark"><BookOpen size={20} /></span><span>RecallForge<small>PRIVATE STUDY WORKSPACE</small></span></div>
        <h1>{title}</h1>
        <p role="status">{detail}</p>
        {action && <button className="button secondary" onClick={onAction}>{action}</button>}
      </section>
    </main>
  );
}
