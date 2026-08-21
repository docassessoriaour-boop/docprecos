import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type InternalUserAdminProps = {
  onClose: () => void;
};

export default function InternalUserAdmin({ onClose }: InternalUserAdminProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage(null);
    setIsError(false);

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: email.trim().toLowerCase(), password },
    });

    setLoading(false);
    if (error || !data?.user) {
      setIsError(true);
      setMessage(data?.error || error?.message || 'Não foi possível criar o usuário.');
      return;
    }

    setMessage(`Usuário ${data.user.email} criado com sucesso.`);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="admin-user-title">
        <button type="button" className="btn-icon admin-modal-close" title="Fechar" onClick={onClose}><X size={18} /></button>
        <div className="auth-logo"><UserPlus size={28} /></div>
        <p className="auth-eyebrow">Uso interno</p>
        <h2 id="admin-user-title">Criar novo usuário</h2>
        <p className="auth-description">Cadastre uma conta autorizada para acessar o Radar de Preços.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="internal-user-email">E-mail do usuário</label>
          <input id="internal-user-email" className="input-glow" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="internal-user-password">Senha temporária</label>
          <div className="admin-password-field">
            <input id="internal-user-password" className="input-glow" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button type="button" className="btn-icon" title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
          <small className="admin-password-hint">Use pelo menos 8 caracteres.</small>
          {message && <div className={`auth-message ${isError ? 'error' : 'success'}`} role="status">{message}</div>}
          <button className="btn-primary auth-submit" type="submit" disabled={loading}><UserPlus size={18} />{loading ? 'Criando...' : 'Criar usuário'}</button>
        </form>
      </section>
    </div>
  );
}
