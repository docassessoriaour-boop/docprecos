import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import App from '../App';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup';

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
  const [mode, setMode] = useState<AuthMode>('login');
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

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });

    setLoading(false);
    if (result.error) {
      setIsError(true);
      setMessage(translateAuthError(result.error.message));
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Cadastro realizado. Verifique seu e-mail para confirmar a conta.');
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
    return <App userEmail={session.user.email ?? 'Usuário'} onSignOut={() => supabase!.auth.signOut()} />;
  }

  return (
    <div className="auth-screen">
      <main className="auth-card glass-panel">
        <div className="auth-logo"><LockKeyhole size={30} /></div>
        <p className="auth-eyebrow">Radar de Preços</p>
        <h1>{mode === 'login' ? 'Acesse sua conta' : 'Crie seu acesso'}</h1>
        <p className="auth-description">
          {mode === 'login' ? 'Entre com seu e-mail e senha para continuar.' : 'Cadastre um e-mail e uma senha segura.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">E-mail</label>
          <input id="auth-email" className="input-glow" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="auth-password">Senha</label>
          <input id="auth-password" className="input-glow" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {message && <div className={`auth-message ${isError ? 'error' : 'success'}`} role="status">{message}</div>}
          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(null); }}>
          {mode === 'login' ? 'Ainda não tem acesso? Cadastre-se' : 'Já possui cadastro? Entrar'}
        </button>
      </main>
    </div>
  );
}
