import { useState } from 'react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext';
import { api } from '../services/api';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await api.auth.updateMe({ name, phone });
    await refreshUser();
    setMsg('Profil mis à jour');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setMsg('Les mots de passe ne correspondent pas');
    await api.auth.changePassword(pw.current, pw.next);
    setPw({ current: '', next: '', confirm: '' });
    setMsg('Mot de passe modifié');
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-xl font-bold text-white">
          {user.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
        </div>
        <div>
          <p className="font-semibold text-ink">{user.name}</p>
          <p className="text-sm text-ink-soft">{user.email}</p>
          <span className="badge border bg-brand-50 text-brand-700 border-brand-200 mt-1">{ROLE_LABELS[user.role]}</span>
        </div>
      </div>

      {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">{msg}</p>}

      <div className="card space-y-3">
        <h3 className="font-semibold text-ink">Apparence</h3>
        <p className="text-sm text-ink-soft">Choisissez le mode clair, sombre ou suivez les réglages système.</p>
        <ThemeToggle />
      </div>

      <form onSubmit={saveProfile} className="card space-y-3">
        <h3 className="font-semibold text-ink">Informations</h3>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Nom" />
        <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone" />
        <button type="submit" className="btn-primary">Enregistrer</button>
      </form>

      <form onSubmit={changePassword} className="card space-y-3">
        <h3 className="font-semibold text-ink">Mot de passe</h3>
        <input className="input" type="password" placeholder="Mot de passe actuel" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
        <input className="input" type="password" placeholder="Nouveau" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
        <input className="input" type="password" placeholder="Confirmation" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} />
        <button type="submit" className="btn-secondary">Changer le mot de passe</button>
      </form>

      <button onClick={logout} className="btn-ghost text-red-600"><LogOut className="w-4 h-4" /> Déconnexion</button>
    </div>
  );
}
