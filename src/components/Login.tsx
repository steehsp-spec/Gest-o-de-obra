import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, currentUser, error: authError, loading: authLoading } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="text-white text-xl animate-pulse font-bold">A&R <span className="text-[#F97316]">Engenharia</span></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0E14] relative overflow-hidden">
      {/* Fundo com imagem desfocada */}
      <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/construction/1920/1080?blur=10')] bg-cover bg-center opacity-20"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[#161B22]/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">A&R <span className="text-[#F97316]">Engenharia</span></h1>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-lg text-center">
              {authError}
            </div>
          )}
          <div>
            <input 
              type="email" 
              placeholder="E-mail" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#F97316]"
              disabled={loading}
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Senha" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#F97316]"
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-400">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-white/10 bg-[#0B0E14]" />
              Lembrar de mim
            </label>
            <a href="#" className="hover:text-[#F97316]">Esqueceu a senha?</a>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        
        <p className="text-center text-gray-500 text-xs mt-8">© 2024 A&R Engenharia</p>
      </div>
    </div>
  );
}
