import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LockKeyhole, LogIn } from 'lucide-react';
import App from '../App';
import InternalUserAdmin from './InternalUserAdmin';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const translateAuthError = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (normalized.includes('user already registered')) return 'Este e-mail já está cadastrado.';
  if (normalized.includes('password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  return message;
};

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showUserAdmin, setShowUserAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage(null);
    setIsError(false);

    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);
    if (result.error) {
      setIsError(true);
      setMessage(translateAuthError(result.error.message));
      return;
    }

  };

  if (checkingSession) {
    return <div className="auth-screen"><div className="auth-loading">Verificando acesso...</div></div>;
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-screen">
        <div className="auth-card glass-panel">
          <LockKeyhole size={36} />
          <h1>Configuração necessária</h1>
          <p>Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para habilitar o acesso.</p>
        </div>
      </div>
    );
  }

  if (session) {
    const userEmail = session.user.email ?? 'Usuário';
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
      .split(',')
      .map((value: string) => value.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(userEmail.toLowerCase());

    return (
      <>
        <App userEmail={userEmail} isAdmin={isAdmin} onOpenUserAdmin={() => setShowUserAdmin(true)} onSignOut={() => supabase!.auth.signOut()} />
        {isAdmin && showUserAdmin && <InternalUserAdmin onClose={() => setShowUserAdmin(false)} />}
      </>
    );
  }

  return (
    <div className="auth-screen">
      <main className="auth-card glass-panel">
        <div className="auth-logo"><LockKeyhole size={30} /></div>
        <p className="auth-eyebrow">Radar de Preços</p>
        <h1>Acesse sua conta</h1>
        <p className="auth-description">Acesso restrito a usuários internos autorizados.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">E-mail</label>
          <input id="auth-email" className="input-glow" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="auth-password">Senha</label>
          <input id="auth-password" className="input-glow" type="password" autoComplete="current-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {message && <div className={`auth-message ${isError ? 'error' : 'success'}`} role="status">{message}</div>}
          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
}
