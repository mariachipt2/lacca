import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<'admin' | 'client'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        if (!name) {
          alert('Por favor, informe seu nome.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              role: role,
            }
          }
        });

        if (error) throw error;
        alert('Cadastro realizado com sucesso! Você já pode entrar.');
        setIsRegister(false);
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao processar requisição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg select-none">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 shadow-lg hover:border-border-hover transition-all duration-300">
        
        {/* LOGO AREA */}
        <div className="text-center mb-8">
          <span className="text-4xl inline-block filter drop-shadow(0 2px 8px rgba(0,0,0,0.15))">✨</span>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent mt-2">
            NailArt Pro
          </h1>
          <p className="text-xs uppercase tracking-wider text-text-muted font-bold mt-1">
            Gestão & Estética
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex gap-2 p-1 bg-surface rounded-md border border-border mb-6">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-sm transition-all cursor-pointer ${
              !isRegister ? 'bg-active text-text' : 'text-text-muted hover:text-text'
            }`}
            onClick={() => {
              setIsRegister(false);
              setName('');
              setPassword('');
            }}
            disabled={loading}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-sm transition-all cursor-pointer ${
              isRegister ? 'bg-active text-text' : 'text-text-muted hover:text-text'
            }`}
            onClick={() => {
              setIsRegister(true);
              setPassword('');
            }}
            disabled={loading}
          >
            Cadastrar
          </button>
        </div>

        {/* LOGIN/REGISTER FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isRegister && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Nome Completo
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary focus:ring-2 focus:ring-primary-lt transition-all font-medium text-sm"
                placeholder="Ex: Ana Souza"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
              E-mail
            </label>
            <input
              type="email"
              className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary focus:ring-2 focus:ring-primary-lt transition-all font-medium text-sm"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Senha
            </label>
            <input
              type="password"
              className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary focus:ring-2 focus:ring-primary-lt transition-all font-medium text-sm"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* ROLE SELECTOR (RBAC) */}
          {isRegister && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Nível de Acesso (Perfil)
              </label>
              <select
                className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary cursor-pointer transition-all font-medium text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'client')}
                disabled={loading}
              >
                <option value="admin">Administrador (Profissional)</option>
                <option value="client">Cliente (Visualização)</option>
              </select>
              <p className="text-[10px] text-text-muted mt-1 leading-normal">
                {role === 'admin' 
                  ? 'Acesso completo ao painel de agenda, finanças, serviços e clientes.' 
                  : 'Acesso restrito. Vê apenas seus próprios agendamentos e horários livres.'}
              </p>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-primary to-primary-hover hover:opacity-90 text-white font-bold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all text-sm mt-2 cursor-pointer disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Processando...' : isRegister ? 'Criar Conta' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-xs text-text-muted">
            Autenticação segura via Supabase Auth.
          </p>
        </div>

      </div>
    </div>
  );
};
