import { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Hexagon, Eye, EyeOff, UserPlus, Shield, User, Key } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'technician' | 'admin'>('technician');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    if (password.length < 4) { setError('Le mot de passe doit faire au moins 4 caractères'); return; }
    setLoading(true);
    try {
      await register(name, email, password, role, role === 'admin' ? adminKey : undefined);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10"
      style={{ backgroundImage: 'url(/pictures/pexels-tkirkgoz-11765538.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="w-full max-w-md animate-scale-in relative">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-2xl shadow-brand-500/30 animate-float">
            <Hexagon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-main tracking-tight">Créer un compte</h1>
          <p className="text-muted mt-2">Rejoignez MaintainX Pro</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-sm font-medium animate-slide-up">
                {error}
              </div>
            )}

            <div>
              <label className="label">Je suis</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setRole('technician')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    role === 'technician'
                      ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
                      : 'border-slate-600/40 bg-slate-700/30 text-slate-400 hover:border-slate-500/50'
                  }`}>
                  <User className={`w-5 h-5 ${role === 'technician' ? 'text-brand-400' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <p className="text-sm font-semibold">Employé</p>
                    <p className="text-xs text-dim">Technicien</p>
                  </div>
                </button>
                <button type="button" onClick={() => setRole('admin')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    role === 'admin'
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-slate-600/40 bg-slate-700/30 text-slate-400 hover:border-slate-500/50'
                  }`}>
                  <Shield className={`w-5 h-5 ${role === 'admin' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <p className="text-sm font-semibold">Admin</p>
                    <p className="text-xs text-dim">Chef d'entreprise</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="label">Nom complet</label>
              <input type="text" className="input text-lg py-4" placeholder="Jean Dupont" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" className="input text-lg py-4" placeholder="jean@entreprise.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="input text-lg py-4 pr-12" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirmer le mot de passe</label>
              <input type="password" className="input text-lg py-4" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>

            {role === 'admin' && (
              <div className="animate-slide-up">
                <label className="label flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  Clé d'enregistrement admin
                </label>
                <input type="text" className="input text-lg py-4 border-amber-500/30 focus:border-amber-500/50 focus:ring-amber-500/20" placeholder="Entrez la clé secrète" value={adminKey} onChange={e => setAdminKey(e.target.value)} required />
                <p className="text-xs text-dim mt-2">Demandez la clé au propriétaire de la plateforme</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full text-lg py-4 shadow-xl shadow-brand-500/20">
              {loading ? (
                <span className="flex items-center gap-3"><span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Création...</span>
              ) : (
                <span className="flex items-center gap-3"><UserPlus className="w-5 h-5" /> {role === 'admin' ? 'Créer le compte admin' : 'Créer mon compte'}</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-card text-center">
            <Link to="/login" className="text-muted hover:text-brand-400 font-medium transition-colors text-sm">
              Déjà inscrit ? <span className="text-brand-400 font-semibold">Se connecter</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
