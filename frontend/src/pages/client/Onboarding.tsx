import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ScanLine, ClipboardList, Wrench } from 'lucide-react';

const SLIDES = [
  { title: 'Bienvenue sur MaintainX Pro', text: 'Signalez vos pannes en quelques clics et suivez leur résolution en temps réel.', icon: '👋' },
  { title: 'Vos équipements', text: 'Consultez l\'état de santé de chaque machine de votre entreprise.', icon: Wrench },
  { title: 'Déclarer une panne', text: 'Scannez un QR code ou sélectionnez un équipement pour créer une demande.', icon: ScanLine },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  async function finish() {
    await api.auth.onboardingDone();
    await refreshUser();
    navigate('/portal', { replace: true });
  }

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="card max-w-md w-full text-center py-10">
        <div className="text-4xl mb-4">{typeof slide.icon === 'string' ? slide.icon : <slide.icon className="w-12 h-12 mx-auto text-brand-600" />}</div>
        <h2 className="text-xl font-semibold text-ink mb-2">{slide.title}</h2>
        <p className="text-sm text-ink-soft mb-8">{slide.text}</p>
        <div className="flex gap-2 justify-center mb-6">
          {SLIDES.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-brand-500' : 'bg-line'}`} />
          ))}
        </div>
        {isLast ? (
          <button onClick={finish} className="btn-primary w-full">C'est compris, démarrer</button>
        ) : (
          <button onClick={() => setStep(s => s + 1)} className="btn-primary w-full">Suivant</button>
        )}
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn-ghost btn-sm mt-3">Retour</button>}
      </div>
      <p className="text-xs text-ink-faint mt-4">Bonjour {user?.name?.split(' ')[0]} — première connexion</p>
    </div>
  );
}
