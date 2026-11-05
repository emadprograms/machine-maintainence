import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const DEMO_ACCOUNTS = [
  { email: 'admin@maintainx.com', label: 'Admin', role: 'Administrateur' },
  { email: 'sophie@maintainx.com', label: 'Sophie', role: 'Manager' },
  { email: 'thomas@maintainx.com', label: 'Thomas', role: 'Technicien' },
  { email: 'client@techcorp.com', label: 'Marie', role: 'Client' },
];

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('technician');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ name, email, password, role });
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Opération impossible');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  function quickFill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('demo1234');
    setError(null);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-canvas px-4 py-10 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle compact />
      </div>
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-10 h-96 w-96 rounded-full bg-accent-200/40 blur-3xl" />

      <div className="relative w-full max-w-sm animate-scale-in">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-apple-lg mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-ink tracking-tight">MaintainX Pro</h1>
          <p className="text-sm text-ink-faint mt-1">
            {isRegister ? 'Créez votre compte' : 'Connectez-vous à votre espace'}
          </p>
        </div>

        {/* Segmented control */}
        <div className="mb-5 flex rounded-full bg-surface-muted p-1 border border-line-soft">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-all ${
              !isRegister ? 'bg-surface text-ink shadow-apple-sm' : 'text-ink-faint hover:text-ink'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-all ${
              isRegister ? 'bg-surface text-ink shadow-apple-sm' : 'text-ink-faint hover:text-ink'
            }`}
          >
            Inscription
          </button>
        </div>

        <div className="card shadow-apple-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="label">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    className="input pl-10"
                    placeholder="Jean Dupont"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Adresse e-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="input pl-10"
                  placeholder="vous@maintainx.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={isRegister ? 6 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className="input pl-10 pr-10"
                  placeholder={isRegister ? '6 caractères minimum' : '••••••••'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
                  aria-label={showPw ? 'Masquer' : 'Afficher'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="label">Rôle</label>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="technician">Technicien</option>
                  <option value="manager">Manager</option>
                  <option value="client">Client</option>
                </select>
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-line-soft bg-surface-muted px-3 py-2 text-[11px] text-ink-soft leading-relaxed">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <span>
                    Inscription ouverte à tous. Les comptes <strong className="text-ink">Technicien</strong> et{' '}
                    <strong className="text-ink">Manager</strong> sont actifs immédiatement. Les comptes{' '}
                    <strong className="text-ink">Client</strong> nécessitent une validation administrateur.
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <>{isRegister ? 'Créer le compte' : 'Se connecter'} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>

        {/* Demo accounts (login only) */}
        {!isRegister && (
          <div className="mt-6 text-center">
            <p className="text-xs text-ink-faint mb-2">Comptes de démonstration · mot de passe <span className="font-medium text-ink-soft">demo1234</span></p>
            <div className="flex flex-wrap justify-center gap-2">
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => quickFill(a.email)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-muted hover:text-ink transition-colors shadow-apple-sm"
                >
                  {a.label} <span className="text-ink-faint">· {a.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-ink-faint">© 2026 MaintainX Pro · Smart Industrial Maintenance</p>
      </div>
    </div>
  );
}
