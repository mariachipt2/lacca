import React, { useState } from 'react';
import type { Client, Service, Appointment, Transaction, ProfessionalSettings } from '../types/database';
import { InlineCompleteForm } from './InlineCompleteForm';

interface DashboardProps {
  userName: string;
  userRole: 'admin' | 'client';
  onLogout: () => void;
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  stock: { id: string; nome: string; qtd: number; min: number }[];
  transactions: Transaction[];
  settings: ProfessionalSettings;
  onAddAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => void;
  onCancelAppointment: (id: string) => void;
  onCompleteAppointment: (id: string, splits: { method: string; value: number }[]) => void;
}

// ============================================================================
// SUB-COMPONENT: DAILY METRICS (INDICADORES DO DIA)
// ============================================================================
const DailyMetricsBlock: React.FC<{
  appointments: Appointment[];
  transactions: Transaction[];
  todayISO: string;
}> = ({ appointments, transactions, todayISO }) => {
  // 1. Faturamento de Hoje (excludes Pagar Depois / fiado / sem pagamento)
  const faturamentoHojeReal = transactions
    .filter(t => t.data === todayISO && t.tipo === 'Receita' && t.paymentMethod && t.paymentMethod !== 'Pagar Depois')
    .reduce((sum, t) => sum + t.valor, 0);

  // 2. Atendimentos de Hoje (Ex: 3 de 8 concluídos)
  const todayApts = appointments.filter(a => a.data === todayISO && a.status !== 'Cancelado');
  const totalToday = todayApts.length;
  const completedToday = todayApts.filter(a => a.status === 'Concluído').length;

  // 3. Dinheiro em Caixa / Recebido no Mês (Incomes this month excluding Pagar Depois - Expenses this month)
  const currentMonthISO = todayISO.slice(0, 7); // YYYY-MM
  const monthIncomes = transactions
    .filter(t => t.data.startsWith(currentMonthISO) && t.tipo === 'Receita' && t.paymentMethod && t.paymentMethod !== 'Pagar Depois')
    .reduce((sum, t) => sum + t.valor, 0);
  const monthExpenses = transactions
    .filter(t => t.data.startsWith(currentMonthISO) && t.tipo === 'Despesa')
    .reduce((sum, t) => sum + t.valor, 0);
  const dinheiroEmCaixa = monthIncomes - monthExpenses;

  function fmtMoney(val: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Card 1 */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between shadow-sm hover:border-border-hover transition-all">
        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Faturamento de Hoje</span>
          <h3 className="text-2xl font-extrabold text-success mt-1">{fmtMoney(faturamentoHojeReal)}</h3>
          <span className="text-[10px] text-text-muted block mt-1">Efetivamente recebido (Exclui Fiado)</span>
        </div>
        <span className="text-2xl">💰</span>
      </div>

      {/* Card 2 */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between shadow-sm hover:border-border-hover transition-all">
        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Atendimentos de Hoje</span>
          <h3 className="text-2xl font-extrabold text-primary mt-1">
            {completedToday} de {totalToday}
          </h3>
          <span className="text-[10px] text-text-muted block mt-1">Procedimentos concluídos</span>
        </div>
        <span className="text-2xl">💅</span>
      </div>

      {/* Card 3 */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between shadow-sm hover:border-border-hover transition-all">
        <div>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Dinheiro em Caixa (Mês)</span>
          <h3 className={`text-2xl font-extrabold mt-1 ${dinheiroEmCaixa >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmtMoney(dinheiroEmCaixa)}
          </h3>
          <span className="text-[10px] text-text-muted block mt-1">Entradas reais menos despesas</span>
        </div>
        <span className="text-2xl">🏦</span>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: FINANCIAL METRICS (INDICADORES FINANCEIROS)
// ============================================================================
const FinancialMetricsBlock: React.FC<{
  transactions: Transaction[];
}> = ({ transactions }) => {
  // Total "Pagar Depois" (fiado em aberto acumulado / sem pagamento)
  const totalFiadoAcumulado = transactions
    .filter(t => t.tipo === 'Receita' && (t.paymentMethod === 'Pagar Depois' || !t.paymentMethod))
    .reduce((sum, t) => sum + t.valor, 0);

  function fmtMoney(val: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }

  return (
    <div className="bg-warning-lt/5 border border-warning/15 rounded-lg p-5 flex items-center justify-between shadow-sm hover:border-warning/30 transition-all">
      <div>
        <span className="text-[10px] font-bold text-warning uppercase tracking-wider block">Total Pendente "Pagar Depois"</span>
        <h3 className="text-2xl font-extrabold text-warning mt-1">{fmtMoney(totalFiadoAcumulado)}</h3>
        <span className="text-[10px] text-text-muted block mt-0.5">Saldo pendente acumulado (Fiados a receber)</span>
      </div>
      <span className="text-2xl">💸</span>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: CHARTS (GRÁFICOS ANALÍTICOS)
// ============================================================================
const ChartsBlock: React.FC<{
  appointments: Appointment[];
  transactions: Transaction[];
  services: Service[];
  clients: Client[];
  todayISO: string;
}> = ({ appointments, transactions, services, clients, todayISO }) => {
  // 1. Line Chart: Evolução Semanal (this week vs last week daily)
  const getWeekDatesRevenues = (offsetDays: number): number[] => {
    const dates: string[] = [];
    const base = new Date(todayISO + 'T12:00:00');
    const dayOfWeek = base.getDay(); // 0 is Sun, 1 is Mon
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() + daysToMonday - offsetDays);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    return dates.map(date => {
      return transactions
        .filter(t => t.data === date && t.tipo === 'Receita')
        .reduce((sum, t) => sum + t.valor, 0);
    });
  };

  const thisWeekRevenues = getWeekDatesRevenues(0);
  const lastWeekRevenues = getWeekDatesRevenues(7);

  const maxVal = Math.max(...thisWeekRevenues, ...lastWeekRevenues, 100);
  
  // Calculate points for lines in SVG
  const weekDaysShort = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const svgWidth = 500;
  const svgHeight = 150;
  const paddingX = 40;
  const paddingY = 20;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;

  const getSvgPoints = (revs: number[]): string => {
    return revs
      .map((val, idx) => {
        const x = paddingX + (idx / 6) * graphWidth;
        const y = svgHeight - paddingY - (val / maxVal) * graphHeight;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const thisWeekPoints = getSvgPoints(thisWeekRevenues);
  const lastWeekPoints = getSvgPoints(lastWeekRevenues);

  // 2. Doughnut Chart: Mix de Serviços
  const completedApts = appointments.filter(a => a.status === 'Concluído');
  const serviceCountMap: Record<string, number> = {};
  completedApts.forEach(apt => {
    const srv = services.find(s => s.id === apt.serviceId);
    const name = srv ? srv.nome : 'Outros';
    serviceCountMap[name] = (serviceCountMap[name] || 0) + 1;
  });

  const mixData = Object.entries(serviceCountMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const totalServices = mixData.reduce((sum, item) => sum + item.count, 0) || 1;
  
  // SVG Doughnut constants
  const colors = ['#e76f51', '#f4a261', '#2a9d8f', '#9b5de5'];
  let accumulatedPercent = 0;

  // 3. Bar Chart: Frequência de Retorno (Ativas, Em Risco, Inativas)
  const clientLastVisitMap: Record<string, string> = {};
  appointments
    .filter(a => a.status === 'Concluído')
    .forEach(a => {
      if (!clientLastVisitMap[a.clientId] || a.data > clientLastVisitMap[a.clientId]) {
        clientLastVisitMap[a.clientId] = a.data;
      }
    });

  const todayDateObj = new Date(todayISO);
  let ativas = 0; // visited <= 30 days
  let emRisco = 0; // 30 < visited <= 60 days
  let inativas = 0; // visited > 60 days (or never)

  clients.forEach(c => {
    const lastVisit = clientLastVisitMap[c.id];
    if (!lastVisit) {
      inativas++;
    } else {
      const visitDate = new Date(lastVisit);
      const diffTime = Math.abs(todayDateObj.getTime() - visitDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        ativas++;
      } else if (diffDays <= 60) {
        emRisco++;
      } else {
        inativas++;
      }
    }
  });

  const totalClientsCount = clients.length || 1;
  const barMax = Math.max(ativas, emRisco, inativas, 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* 1. EVOLUÇÃO SEMANAL */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">📈 1. Evolução Semanal</h4>
          <p className="text-[10px] text-text-muted mb-4">Faturamento diário comparado com a semana anterior.</p>
        </div>
        
        <div className="w-full">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
            {/* Grid background lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
              const y = paddingY + p * graphHeight;
              return (
                <line
                  key={i}
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="0.5"
                  strokeDasharray="2"
                />
              );
            })}
            
            {/* Last Week Line */}
            <polyline
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="2"
              strokeDasharray="4"
              opacity="0.6"
              points={lastWeekPoints}
            />

            {/* This Week Line */}
            <polyline
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              points={thisWeekPoints}
            />

            {/* Labels segments */}
            {weekDaysShort.map((day, idx) => {
              const x = paddingX + (idx / 6) * graphWidth;
              return (
                <text
                  key={idx}
                  x={x}
                  y={svgHeight - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-muted)"
                  fontWeight="bold"
                >
                  {day}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="flex justify-center gap-4 mt-3 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-primary inline-block"></span>
            <span className="text-text">Esta Semana</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-text-muted border-t border-dashed inline-block"></span>
            <span className="text-text-muted">Semana Anterior</span>
          </div>
        </div>
      </div>

      {/* 2. MIX DE SERVIÇOS */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">🍩 2. Mix de Serviços</h4>
          <p className="text-[10px] text-text-muted mb-4">Proporção dos tipos de procedimentos concluídos.</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Doughnut SVG */}
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--color-surface)" strokeWidth="5" />
              {mixData.map((item, idx) => {
                const percent = (item.count / totalServices) * 100;
                const offset = 100 - accumulatedPercent;
                accumulatedPercent += percent;

                return (
                  <circle
                    key={item.name}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke={colors[idx % colors.length]}
                    strokeWidth="5"
                    strokeDasharray={`${percent} ${100 - percent}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-extrabold text-text">{completedApts.length}</span>
              <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Feitos</span>
            </div>
          </div>

          {/* Legends list */}
          <div className="flex-1 space-y-1.5 text-[10px] font-medium min-w-0">
            {mixData.length === 0 ? (
              <p className="text-text-muted italic text-center">Sem dados de serviços.</p>
            ) : (
              mixData.map((item, idx) => {
                const pct = ((item.count / totalServices) * 100).toFixed(0);
                return (
                  <div key={item.name} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                    <span className="text-text font-bold truncate flex-1">{item.name}</span>
                    <span className="text-text-muted font-bold whitespace-nowrap">{pct}%</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. FREQUÊNCIA DE RETORNO */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">📊 3. Retorno de Clientes</h4>
          <p className="text-[10px] text-text-muted mb-4">Engajamento e frequência de visita das clientes.</p>
        </div>

        <div className="space-y-3.5">
          {/* Bar 1: Ativas */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-success">🟢 Ativas (&le; 30 dias)</span>
              <span className="text-text">{ativas} ({((ativas / totalClientsCount) * 100).toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden border border-border">
              <div className="h-full bg-success rounded-full" style={{ width: `${(ativas / barMax) * 100}%` }}></div>
            </div>
          </div>

          {/* Bar 2: Em Risco */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-warning">🟡 Em Risco (30-60 dias)</span>
              <span className="text-text">{emRisco} ({((emRisco / totalClientsCount) * 100).toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden border border-border">
              <div className="h-full bg-warning rounded-full" style={{ width: `${(emRisco / barMax) * 100}%` }}></div>
            </div>
          </div>

          {/* Bar 3: Inativas */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-danger">🔴 Inativas (&gt; 60 dias)</span>
              <span className="text-text">{inativas} ({((inativas / totalClientsCount) * 100).toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden border border-border">
              <div className="h-full bg-danger rounded-full" style={{ width: `${(inativas / barMax) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: ALERTS AND INSIGHTS (INSIGHTS/ALERTAS)
// ============================================================================
const AlertsBlock: React.FC<{
  appointments: Appointment[];
  clients: Client[];
  stock: { id: string; nome: string; qtd: number; min: number }[];
  todayISO: string;
  settings: ProfessionalSettings;
}> = ({ appointments, clients, stock, todayISO, settings }) => {
  // 1. Clientes Sumidas Churn (>= 30 days)
  const clientLastVisitMap: Record<string, string> = {};
  appointments
    .filter(a => a.status === 'Concluído')
    .forEach(a => {
      if (!clientLastVisitMap[a.clientId] || a.data > clientLastVisitMap[a.clientId]) {
        clientLastVisitMap[a.clientId] = a.data;
      }
    });

  const todayDateObj = new Date(todayISO);
  const churnClients = clients.filter(c => {
    const lastVisit = clientLastVisitMap[c.id];
    if (!lastVisit) return true; // never visited count as churn
    const visitDate = new Date(lastVisit);
    const diffTime = Math.abs(todayDateObj.getTime() - visitDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 30;
  });

  const handleRescueAll = () => {
    if (churnClients.length === 0) return;
    const listNames = churnClients.slice(0, 5).map(c => c.nome).join(', ');
    alert(`Mensagem de resgate da ${settings.nomeProfissional || 'Profissional'} enviada para: ${listNames}...`);
  };

  // 2. Aniversariantes do dia
  const todayApts = appointments.filter(a => a.data === todayISO && a.status === 'Agendado');
  const todaysBirthdayClients = todayApts
    .map(a => clients.find(c => c.id === a.clientId))
    .filter((c): c is Client => {
      if (!c || !c.dataNascimento) return false;
      // Compare MM-DD
      return c.dataNascimento.slice(5, 10) === todayISO.slice(5, 10);
    });

  // 3. Estoque Crítico
  const lowStockItems = stock.filter(item => item.qtd <= item.min);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border pb-2">🚨 Alertas e Insights Urgentes</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Churn Alarm */}
        <div className="bg-danger-lt/5 border border-danger/20 p-4 rounded-lg flex flex-col justify-between gap-3 shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-danger uppercase tracking-wider block">Clientes Sumidas (Churn)</span>
            <h4 className="text-xl font-extrabold text-danger mt-1">{churnClients.length} em risco</h4>
            <p className="text-[10px] text-text-muted mt-1">Clientes inativas ou sem atendimentos nos últimos 30 dias.</p>
          </div>
          <button
            onClick={handleRescueAll}
            className="w-full py-1.5 bg-danger text-white text-[10px] font-bold rounded shadow hover:opacity-90 transition-all text-center"
          >
            📱 Campanha de Resgate WhatsApp
          </button>
        </div>

        {/* Birthday Alert */}
        <div className="bg-card border border-border p-4 rounded-lg flex flex-col justify-between gap-3 shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Aniversariantes Agendadas Hoje</span>
            {todaysBirthdayClients.length === 0 ? (
              <p className="text-xs text-text-muted mt-4 italic text-center">Nenhum aniversário de cliente agendado para hoje.</p>
            ) : (
              <div className="space-y-1.5 mt-2 animate-pulse">
                {todaysBirthdayClients.map(c => (
                  <div key={c.id} className="text-xs font-bold text-primary flex items-center gap-1.5">
                    🎂 <span>Parabéns, <strong>{c.nome}</strong>! 🎉</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {todaysBirthdayClients.length > 0 && (
            <div className="text-[9px] text-text-muted border-t border-border pt-2">
              Que tal oferecer um desconto de aniversário no fechamento? 🎁
            </div>
          )}
        </div>

        {/* Critical Stock */}
        {lowStockItems.length > 0 ? (
          <div className="bg-danger-lt/5 border border-danger/30 p-4 rounded-lg flex flex-col justify-between gap-2 shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-danger uppercase tracking-wider block">Estoque Crítico</span>
              <h4 className="text-xl font-extrabold text-danger mt-1">{lowStockItems.length} itens baixos</h4>
              <p className="text-[10px] text-text-muted mt-1 truncate">
                Repor: {lowStockItems.map(i => i.nome).join(', ')}
              </p>
            </div>
            <div className="text-[9px] text-danger/80 font-bold uppercase tracking-wider">
              ⚠️ Insumos necessitam de reposição urgente!
            </div>
          </div>
        ) : (
          <div className="bg-success-lt/5 border border-success/15 p-4 rounded-lg flex flex-col justify-between gap-2 shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-success uppercase tracking-wider block">Estoque Geral</span>
              <h4 className="text-xl font-extrabold text-success mt-1">OK</h4>
              <p className="text-[10px] text-text-muted mt-1">Todos os insumos estão acima do estoque de alerta.</p>
            </div>
            <div className="text-[9px] text-success/80 font-bold uppercase tracking-wider">
              ✓ Nenhuma reposição pendente
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT: DASHBOARD
// ============================================================================
export const Dashboard: React.FC<DashboardProps> = ({
  userName,
  appointments,
  clients,
  services,
  stock,
  transactions,
  settings,
  onAddAppointment,
  onCancelAppointment,
  onCompleteAppointment
}) => {
  const [showModal, setShowModal] = useState(false);
  const [completingAptId, setCompletingAptId] = useState<string | null>(null);

  // Form State
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [time, setTime] = useState('10:00');
  const [price, setPrice] = useState('');

  const todayISO = new Date().toISOString().slice(0, 10);
  const todayApts = appointments.filter(a => a.data === todayISO && a.status !== 'Cancelado');

  const handleServiceChange = (srvId: string) => {
    setSelectedService(srvId);
    const srv = services.find(s => s.id === srvId);
    if (srv) setPrice(srv.preco.toString());
  };

  const handleAddAppointmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !selectedService || !price) return;

    onAddAppointment({
      clientId: selectedClient,
      serviceId: selectedService,
      data: todayISO,
      hora: time,
      valor: parseFloat(price) || 0,
      status: 'Agendado'
    });

    setShowModal(false);
    setSelectedClient('');
    setSelectedService('');
    setTime('10:00');
    setPrice('');
  };

  const handleSendReminder = (aptId: string) => {
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;
    const client = clients.find(c => c.id === apt.clientId);
    const service = services.find(s => s.id === apt.serviceId);
    if (!client) return;

    // Use professional name/business name in the message
    const bizSuffix = settings.nomeNegocio ? ` &mdash; *${settings.nomeNegocio}*` : '';
    const profPrefix = settings.nomeProfissional ? `Olá, aqui é a *${settings.nomeProfissional}*! ✨\n` : 'Olá! ✨\n';

    const text = `${profPrefix}Passando para confirmar seu horário hoje às *${apt.hora}* para o serviço de *${service ? service.nome : 'unhas'}*.\nConfirma?${bizSuffix} 💅`;
    const cleanPhone = client.celular.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  // Safe checks for dashboard block customization
  const prefs = settings?.dashboardPreferences || {
    showDailyMetrics: true,
    showFinancialMetrics: true,
    showCharts: true,
    showAlerts: true,
  };

  return (
    <div className="space-y-6">
      
      {/* WELCOME */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text">Olá, {settings.nomeProfissional || userName}!</h2>
          <p className="text-xs text-text-muted mt-1">
            Gestão do negócio de estética no painel: <strong className="text-primary font-bold">{settings.nomeNegocio || 'NailArt Pro'}</strong>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-sm px-6 py-2.5 bg-gradient-to-r from-primary to-primary-hover font-bold text-white shadow-md hover:opacity-90 rounded-md text-xs whitespace-nowrap self-start sm:self-auto"
        >
          + Novo Agendamento
        </button>
      </div>

      {/* BLOCK 1: DAILY METRICS */}
      {prefs.showDailyMetrics && (
        <DailyMetricsBlock
          appointments={appointments}
          transactions={transactions}
          todayISO={todayISO}
        />
      )}

      {/* BLOCK 2: FINANCIAL METRICS */}
      {prefs.showFinancialMetrics && (
        <FinancialMetricsBlock
          transactions={transactions}
        />
      )}

      {/* BLOCK 3: CHARTS */}
      {prefs.showCharts && (
        <ChartsBlock
          appointments={appointments}
          transactions={transactions}
          services={services}
          clients={clients}
          todayISO={todayISO}
        />
      )}

      {/* TODAY'S SCHEDULE LIST CARD */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex justify-between items-center bg-surface">
          <h3 className="text-sm font-bold text-text">Fila de Atendimentos de Hoje</h3>
          <span className="text-[11px] font-bold text-text-muted">Data: {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="divide-y divide-border">
          {todayApts.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <span className="text-3xl block mb-2 opacity-50">✨</span>
              <p className="text-xs">Nenhum agendamento ativo cadastrado para hoje.</p>
            </div>
          ) : (
            todayApts
              .sort((a, b) => a.hora.localeCompare(b.hora))
              .map(apt => {
                const client = clients.find(c => c.id === apt.clientId);
                const service = services.find(s => s.id === apt.serviceId);
                const isPending = apt.status === 'Agendado';

                return (
                  <div key={apt.id} className="p-4 flex flex-col hover:bg-surface-active/50 transition-all gap-2 border-b border-border/40 last:border-b-0">
                    <div className="flex items-center justify-between gap-4">
                      {/* TIME & SERVICE */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="text-base font-extrabold text-primary min-w-[50px]">{apt.hora}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text truncate">{client ? client.nome : 'Bloqueio / Horário Ocupado'}</p>
                          <p className="text-xs text-text-muted truncate mt-0.5">
                            💅 {service ? service.nome : 'Compromisso'} &bull; {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(apt.valor)}
                          </p>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          apt.status === 'Concluído' ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'
                        }`}>
                          {apt.status}
                        </span>
                        
                        {isPending && completingAptId !== apt.id && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <button
                              onClick={() => handleSendReminder(apt.id)}
                              className="p-1.5 bg-surface border border-border hover:border-border-hover text-text-muted hover:text-text rounded-md text-xs"
                              title="Enviar Lembrete por WhatsApp"
                            >
                              📱 <span className="hidden sm:inline">Lembrar</span>
                            </button>
                            <button
                              onClick={() => setCompletingAptId(apt.id)}
                              className="p-1.5 bg-success/10 border border-success/20 hover:bg-success/25 text-success rounded-md text-xs font-bold"
                              title="Confirmar Conclusão"
                            >
                              ✓ <span className="hidden sm:inline">Concluir</span>
                            </button>
                            <button
                              onClick={() => onCancelAppointment(apt.id)}
                              className="p-1.5 bg-danger/10 border border-danger/20 hover:bg-danger/25 text-danger rounded-md text-xs font-bold"
                              title="Cancelar Horário"
                            >
                              ✕ <span className="hidden sm:inline">Cancelar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {completingAptId === apt.id && (
                      <InlineCompleteForm
                        appointmentId={apt.id}
                        valorTotal={apt.valor}
                        customPaymentMethods={settings.customPaymentMethods}
                        onComplete={(id: string, splits: { method: string; value: number }[]) => {
                          onCompleteAppointment(id, splits);
                          setCompletingAptId(null);
                        }}
                        onCancel={() => setCompletingAptId(null)}
                      />
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* BLOCK 4: ALERTS AND INSIGHTS */}
      {prefs.showAlerts && (
        <AlertsBlock
          appointments={appointments}
          clients={clients}
          stock={stock}
          todayISO={todayISO}
          settings={settings}
        />
      )}

      {/* QUICK APPOINTMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface">
              <h3 className="text-sm font-bold text-text">Agendar para Hoje</h3>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>

            <form onSubmit={handleAddAppointmentSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Cliente</label>
                  <select
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium cursor-pointer"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Serviço</label>
                  <select
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium cursor-pointer"
                    value={selectedService}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Horário</label>
                    <input
                      type="time"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm rounded-md font-bold text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm rounded-md font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover">Salvar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
