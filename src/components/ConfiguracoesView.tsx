import React, { useState } from 'react';
import type { ProfessionalSettings } from '../types/database';

interface ConfiguracoesViewProps {
  settings: ProfessionalSettings;
  onSaveSettings: (settings: ProfessionalSettings) => void;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  // Config state
  const [nomeNegocio, setNomeNegocio] = useState(settings.nomeNegocio);
  const [nomeProfissional, setNomeProfissional] = useState(settings.nomeProfissional);
  const [telefone, setTelefone] = useState(settings.telefone);
  const [workStartHour, setWorkStartHour] = useState(settings.workStartHour || '08:00');
  const [workEndHour, setWorkEndHour] = useState(settings.workEndHour || '20:00');

  // Dashboard Preferences state
  const [prefs, setPrefs] = useState({ ...settings.dashboardPreferences });

  // Custom Payment Methods state
  const [customMethods, setCustomMethods] = useState<string[]>(settings.customPaymentMethods || []);
  const [newMethod, setNewMethod] = useState('');

  // Fale Conosco state
  const [faleConoscoMsg, setFaleConoscoMsg] = useState('');

  const handleTogglePref = (key: keyof ProfessionalSettings['dashboardPreferences']) => {
    const updated = {
      ...prefs,
      [key]: !prefs[key]
    };
    setPrefs(updated);
    onSaveSettings({
      nomeNegocio,
      nomeProfissional,
      telefone,
      customPaymentMethods: customMethods,
      dashboardPreferences: updated,
      workStartHour,
      workEndHour
    });
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (workStartHour >= workEndHour) {
      alert('O horário de início deve ser anterior ao horário de término do trabalho.');
      return;
    }
    onSaveSettings({
      nomeNegocio,
      nomeProfissional,
      telefone,
      customPaymentMethods: customMethods,
      dashboardPreferences: prefs,
      workStartHour,
      workEndHour
    });
    alert('Configurações salvas com sucesso! ✨');
  };

  const handleAddMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethod.trim()) return;
    const trimmed = newMethod.trim();
    if (customMethods.includes(trimmed)) {
      alert('Esta forma de pagamento já existe.');
      return;
    }
    const updated = [...customMethods, trimmed];
    setCustomMethods(updated);
    setNewMethod('');
    onSaveSettings({
      nomeNegocio,
      nomeProfissional,
      telefone,
      customPaymentMethods: updated,
      dashboardPreferences: prefs,
      workStartHour,
      workEndHour
    });
  };

  const handleRemoveMethod = (method: string) => {
    if (!confirm(`Remover "${method}" das formas de pagamento?`)) return;
    const updated = customMethods.filter(m => m !== method);
    setCustomMethods(updated);
    onSaveSettings({
      nomeNegocio,
      nomeProfissional,
      telefone,
      customPaymentMethods: updated,
      dashboardPreferences: prefs,
      workStartHour,
      workEndHour
    });
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faleConoscoMsg.trim()) return;
    const email = 'suporte@nailartpro.com';
    const subject = encodeURIComponent(`NailArt Pro - Suporte de ${nomeProfissional || 'Gestor'}`);
    const body = encodeURIComponent(faleConoscoMsg.trim());
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    setFaleConoscoMsg('');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      
      {/* 1. PROFESSIONAL INFORMATION FORM */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-text border-b border-border pb-3 flex items-center gap-2">
          <span>⚙️</span> Configurações do Profissional
        </h3>
        
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Nome do Negócio / Salão</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
              placeholder="Ex: NailArt Pro Estudio"
              value={nomeNegocio}
              onChange={(e) => setNomeNegocio(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Nome da Profissional (Como deseja ser chamada)</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                placeholder="Ex: Clara Manicure"
                value={nomeProfissional}
                onChange={(e) => setNomeProfissional(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Telefone WhatsApp (com DDD - Apenas números)</label>
              <input
                type="tel"
                className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                placeholder="Ex: 11988887777"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                required
              />
              <span className="text-[10px] text-text-muted">Utilizado nos envios de relatórios e cobranças automáticas.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Horário de Início do Trabalho</label>
              <input
                type="time"
                className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                value={workStartHour}
                onChange={(e) => setWorkStartHour(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Horário de Término do Trabalho</label>
              <input
                type="time"
                className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                value={workEndHour}
                onChange={(e) => setWorkEndHour(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="btn btn-primary font-bold px-6 py-2.5 bg-gradient-to-r from-primary to-primary-hover text-white text-xs rounded shadow-md"
            >
              Salvar Informações
            </button>
          </div>
        </form>
      </div>

      {/* 2. DASHBOARD CUSTOMIZATION TOGGLES */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-text border-b border-border pb-3 flex items-center gap-2">
            <span>🎨</span> Personalizar Painel (Dashboard)
          </h3>
          <p className="text-xs text-text-muted mt-1">Marque quais blocos você quer exibir ou ocultar no seu painel principal.</p>
        </div>

        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-xs font-bold text-text block">Indicadores do Dia</span>
              <span className="text-[10px] text-text-muted">Faturamento de hoje, contagem de atendimentos e total mensal.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={prefs.showDailyMetrics}
                onChange={() => handleTogglePref('showDailyMetrics')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-primary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-lt"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-xs font-bold text-text block">Indicadores Financeiros</span>
              <span className="text-[10px] text-text-muted">Visualização do total acumulado "Pagar Depois" (fiados).</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={prefs.showFinancialMetrics}
                onChange={() => handleTogglePref('showFinancialMetrics')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-primary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-lt"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-xs font-bold text-text block">Gráficos Analíticos</span>
              <span className="text-[10px] text-text-muted">Faturamento semanal, mix de serviços e frequência de retorno de clientes.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={prefs.showCharts}
                onChange={() => handleTogglePref('showCharts')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-primary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-lt"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-xs font-bold text-text block">Insights e Alertas Urgentes</span>
              <span className="text-[10px] text-text-muted">Avisos de aniversariantes, estoque crítico e alertas de clientes sumidas (churn).</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={prefs.showAlerts}
                onChange={() => handleTogglePref('showAlerts')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-primary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-lt"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 3. CUSTOM PAYMENT METHODS SECTION */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-text border-b border-border pb-3 flex items-center gap-2">
            <span>💳</span> Formas de Pagamento Personalizadas
          </h3>
          <p className="text-xs text-text-muted mt-1">Adicione novas opções de recebimento que fazem parte do seu negócio.</p>
        </div>

        <form onSubmit={handleAddMethod} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-xs font-medium"
            placeholder="Ex: PicPay, Vale Presente, Parceria"
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary font-bold px-4 py-2 bg-gradient-to-r from-primary to-primary-hover text-white text-xs shadow-md"
          >
            + Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2">
          {customMethods.length === 0 ? (
            <span className="text-xs text-text-muted italic">Nenhuma forma de pagamento personalizada cadastrada.</span>
          ) : (
            customMethods.map(m => (
              <span
                key={m}
                className="px-2.5 py-1 bg-surface border border-border rounded-md text-xs font-bold text-text flex items-center gap-2"
              >
                {m}
                <button
                  type="button"
                  onClick={() => handleRemoveMethod(m)}
                  className="text-text-muted hover:text-danger text-[10px] font-bold"
                  title="Excluir"
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* 4. FALE CONOSCO */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-text border-b border-border pb-3 flex items-center gap-2">
            <span>💬</span> Fale Conosco
          </h3>
          <p className="text-xs text-text-muted mt-1">Envie dúvidas, sugestões ou solicitações para a nossa equipe de suporte.</p>
        </div>

        <form onSubmit={handleSendEmail} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Mensagem</label>
            <textarea
              className="w-full h-28 px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-xs font-semibold resize-none"
              placeholder="Escreva sua dúvida, solicitação ou sugestão aqui..."
              value={faleConoscoMsg}
              onChange={(e) => setFaleConoscoMsg(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary font-bold px-6 py-2.5 bg-gradient-to-r from-primary to-primary-hover text-white text-xs rounded shadow-md"
          >
            Enviar Mensagem
          </button>
        </form>
      </div>

    </div>
  );
};
