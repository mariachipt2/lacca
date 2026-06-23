import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { validarPrecoServico } from './utils/validations';
import { Dashboard } from './components/Dashboard';
import { AgendaView } from './components/AgendaView';
import { ClientesView } from './components/ClientesView';
import { RelatoriosView } from './components/RelatoriosView';
import { ContasPagarView } from './components/ContasPagarView';
import { ConfiguracoesView } from './components/ConfiguracoesView';
import { LogsView } from './components/LogsView';
import { 
  lerConfiguracoesGestorDb, 
  salvarConfiguracoesGestorDb, 
  listarContasPagarDb, 
  salvarContaPagarDb, 
  excluirContaPagarDb 
} from './utils/storage';
import { supabase } from './utils/supabaseClient';
import type { Client, Service, Appointment, Transaction, Bill, ProfessionalSettings, AuditLog } from './types/database';

// Defaults
const DEFAULT_SERVICES: Service[] = [
  { id: 'srv_1', nome: 'Alongamento em Fibra de Vidro', preco: 160.00, duracao: 120 },
  { id: 'srv_2', nome: 'Manutenção de Alongamento', preco: 95.00, duracao: 90 },
  { id: 'srv_3', nome: 'Blindagem de Unha Natural', preco: 80.00, duracao: 60 },
  { id: 'srv_4', nome: 'Banho de Gel', preco: 100.00, duracao: 75 },
  { id: 'srv_5', nome: 'Esmaltação em Gel', preco: 60.00, duracao: 45 }
];

const DEFAULT_STOCK = [
  { id: 'stk_1', nome: 'Gel Construtor Pink Hard Vòlia (14g)', qtd: 4, min: 2 },
  { id: 'stk_2', nome: 'Prep Higienizador Beltrat (120ml)', qtd: 2, min: 1 },
  { id: 'stk_3', nome: 'Esmalte Gel Preto D&Z', qtd: 1, min: 2 },
  { id: 'stk_4', nome: 'Top Coat Matte Vòlia (9g)', qtd: 3, min: 1 },
  { id: 'stk_5', nome: 'Lixa Banana 100/180', qtd: 12, min: 5 }
];

// Mapper helpers between Database (snake_case) and Client types (camelCase)
const mapClientFromDb = (db: any): Client => ({
  id: db.id,
  nome: db.nome,
  celular: db.celular,
  dataNascimento: db.data_nascimento || undefined,
  formatoUnha: db.formato_unha || undefined,
  alergias: db.alergias || undefined,
  obsTecnicas: db.obs_tecnicas || undefined,
  fotosUnhas: db.fotos_unhas || [],
  createdAt: db.created_at,
});

const mapAppointmentFromDb = (db: any): Appointment => ({
  id: db.id,
  clientId: db.client_id,
  serviceId: db.service_id,
  data: db.data,
  hora: db.hora,
  valor: parseFloat(db.valor) || 0,
  status: db.status,
  paymentMethod: db.payment_method || undefined,
  obs: db.obs || undefined,
  createdAt: db.created_at,
});

const mapTransactionFromDb = (db: any): Transaction => ({
  id: db.id,
  data: db.data,
  tipo: db.tipo,
  descricao: db.descricao,
  valor: parseFloat(db.valor) || 0,
  appointmentId: db.appointment_id || undefined,
  paymentMethod: db.payment_method || undefined,
  createdAt: db.created_at,
});

export const App: React.FC = () => {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; role: 'admin' | 'client'; name: string } | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'clientes' | 'servicos' | 'estoque' | 'relatorios' | 'contas_pagar' | 'configuracoes' | 'logs'>('dashboard');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Settings & Bills state
  const [settings, setSettings] = useState<ProfessionalSettings>({
    nomeNegocio: 'NailArt Pro',
    nomeProfissional: 'Designer',
    telefone: '11988887777',
    customPaymentMethods: [],
    dashboardPreferences: {
      showDailyMetrics: true,
      showFinancialMetrics: true,
      showCharts: true,
      showAlerts: true,
    },
    workStartHour: '08:00',
    workEndHour: '20:00'
  });
  const [bills, setBills] = useState<Bill[]>([]);

  // Database States
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stock, setStock] = useState<{ id: string; nome: string; qtd: number; min: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');

  // Waitlist (Encaixe Rápido) State lifted to App.tsx
  const [waitlist, setWaitlist] = useState<{ id: string; nome: string; celular: string; obs: string; data: string }[]>(() => {
    const saved = localStorage.getItem('nail_waitlist');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao parsear waitlist do localStorage:', e);
      }
    }
    return [
      { id: 'wt_1', nome: 'Renata Frota', celular: '(11) 95555-4444', obs: 'Manutenção fim da tarde', data: new Date().toISOString().slice(0, 10) }
    ];
  });

  useEffect(() => {
    localStorage.setItem('nail_waitlist', JSON.stringify(waitlist));
  }, [waitlist]);

  // Modal forms states for inline lists
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [srvPriceError, setSrvPriceError] = useState<string | null>(null);
  const [srvName, setSrvName] = useState('');
  const [srvPrice, setSrvPrice] = useState('');
  const [srvDuration, setSrvDuration] = useState('60');

  const [showStockModal, setShowStockModal] = useState(false);
  const [editingStockItem, setEditingStockItem] = useState<{ id: string; nome: string; qtd: number; min: number } | null>(null);
  const [stockName, setStockName] = useState('');
  const [stockQtd, setStockQtd] = useState('5');
  const [stockMin, setStockMin] = useState('2');

  // Load database from Supabase
  const loadAllUserData = async (userId: string) => {
    try {
      // 1. Migrate localstorage data to Supabase if empty (first run)
      await migrateLocalStorageToSupabase(userId);

      // 2. Fetch professional settings
      const gestorSettings = await lerConfiguracoesGestorDb(userId);
      setSettings(gestorSettings);

      // 3. Fetch bills
      const billsList = await listarContasPagarDb(userId);
      setBills(billsList);

      // 4. Fetch clients
      const { data: clientsData, error: clientsErr } = await supabase
        .from('clients')
        .select('*');
      if (clientsErr) throw clientsErr;
      setClients((clientsData || []).map(mapClientFromDb));

      // 5. Fetch services
      const { data: servicesData, error: servicesErr } = await supabase
        .from('services')
        .select('*');
      if (servicesErr) throw servicesErr;
      
      if ((servicesData || []).length === 0) {
        const seedServices = DEFAULT_SERVICES.map(s => ({ ...s, user_id: userId, ativo: true }));
        await supabase.from('services').insert(seedServices);
        setServices(DEFAULT_SERVICES.map(s => ({ ...s, ativo: true })));
      } else {
        setServices((servicesData || []).map(s => ({
          id: s.id,
          nome: s.nome,
          preco: parseFloat(s.preco) || 0,
          duracao: s.duracao,
          ativo: s.ativo !== false
        })));
      }

      // 6. Fetch appointments
      const { data: appointmentsData, error: appointmentsErr } = await supabase
        .from('appointments')
        .select('*');
      if (appointmentsErr) throw appointmentsErr;
      setAppointments((appointmentsData || []).map(mapAppointmentFromDb));

      // 7. Fetch stock
      const { data: stockData, error: stockErr } = await supabase
        .from('stock')
        .select('*');
      if (stockErr) throw stockErr;
      
      if ((stockData || []).length === 0) {
        const seedStock = DEFAULT_STOCK.map(s => ({ ...s, user_id: userId }));
        await supabase.from('stock').insert(seedStock);
        setStock(DEFAULT_STOCK);
      } else {
        setStock((stockData || []).map(s => ({
          id: s.id,
          nome: s.nome,
          qtd: s.qtd,
          min: s.min
        })));
      }

      // 8. Fetch transactions
      const { data: transactionsData, error: transactionsErr } = await supabase
        .from('transactions')
        .select('*');
      if (transactionsErr) throw transactionsErr;
      setTransactions((transactionsData || []).map(mapTransactionFromDb));

      // 9. Fetch audit logs
      const { data: logsData, error: logsErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (!logsErr && logsData) {
        setLogs((logsData || []).map(l => ({
          id: l.id,
          userEmail: l.user_email,
          acao: l.acao,
          entidade: l.entidade,
          registroId: l.registro_id,
          detalhes: l.detalhes,
          valorAnterior: l.valor_anterior,
          valorNovo: l.valor_novo,
          createdAt: l.created_at
        })));
      }

    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  // LocalStorage migration logic helper
  const migrateLocalStorageToSupabase = async (userId: string) => {
    const savedDB = localStorage.getItem('nail_designer_db_react');
    if (!savedDB) return;

    try {
      const parsed = JSON.parse(savedDB);

      // Check if already migrated by checking services
      const { count: srvCount } = await supabase.from('services').select('*', { count: 'exact', head: true });
      if (srvCount === 0 && parsed.services?.length > 0) {
        await supabase.from('services').insert(parsed.services.map((s: any) => ({ ...s, user_id: userId })));
      }

      const { count: cliCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
      if (cliCount === 0 && parsed.clients?.length > 0) {
        await supabase.from('clients').insert(parsed.clients.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          celular: c.celular,
          data_nascimento: c.dataNascimento || null,
          formato_unha: c.formatoUnha || null,
          alergias: c.alergias || null,
          obs_tecnicas: c.obsTecnicas || null,
          fotos_unhas: c.fotosUnhas || [],
          user_id: userId
        })));
      }

      const { count: aptCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true });
      if (aptCount === 0 && parsed.appointments?.length > 0) {
        await supabase.from('appointments').insert(parsed.appointments.map((a: any) => ({
          id: a.id,
          client_id: a.clientId,
          service_id: a.serviceId,
          data: a.data,
          hora: a.hora,
          valor: a.valor,
          status: a.status,
          payment_method: a.paymentMethod || null,
          obs: a.obs || null,
          user_id: userId
        })));
      }

      const { count: stockCount } = await supabase.from('stock').select('*', { count: 'exact', head: true });
      if (stockCount === 0 && parsed.stock?.length > 0) {
        await supabase.from('stock').insert(parsed.stock.map((s: any) => ({
          id: s.id,
          nome: s.nome,
          qtd: s.qtd,
          min: s.min,
          user_id: userId
        })));
      }

      const { count: txnCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
      if (txnCount === 0 && parsed.transactions?.length > 0) {
        await supabase.from('transactions').insert(parsed.transactions.map((t: any) => ({
          id: t.id,
          data: t.data,
          tipo: t.tipo,
          descricao: t.descricao,
          valor: t.valor,
          appointment_id: t.appointmentId || null,
          payment_method: t.paymentMethod || null,
          user_id: userId
        })));
      }

      // Bills
      const { count: billCount } = await supabase.from('bills').select('*', { count: 'exact', head: true });
      const localBills = JSON.parse(localStorage.getItem('nail_bills_to_pay') || '[]');
      if (billCount === 0 && localBills.length > 0) {
        await supabase.from('bills').insert(localBills.map((b: any) => ({
          id: b.id,
          descricao: b.descricao,
          valor: b.valor,
          data_vencimento: b.dataVencimento,
          status: b.status,
          user_id: userId
        })));
      }

      // Settings
      const { count: settingsCount } = await supabase.from('professional_settings').select('*', { count: 'exact', head: true });
      const localSettings = localStorage.getItem('nail_professional_settings');
      if (settingsCount === 0 && localSettings) {
        const s = JSON.parse(localSettings);
        await supabase.from('professional_settings').insert({
          user_id: userId,
          nome_negocio: s.nomeNegocio,
          nome_profissional: s.nomeProfissional,
          telefone: s.telefone,
          custom_payment_methods: s.customPaymentMethods || [],
          show_daily_metrics: s.dashboardPreferences?.showDailyMetrics ?? true,
          show_financial_metrics: s.dashboardPreferences?.showFinancialMetrics ?? true,
          show_charts: s.dashboardPreferences?.showCharts ?? true,
          show_alerts: s.dashboardPreferences?.showAlerts ?? true,
          work_start_hour: s.workStartHour || '08:00',
          work_end_hour: s.workEndHour || '20:00'
        });
      }

      // Clean local storage migration target so we do it only once
      localStorage.removeItem('nail_designer_db_react');
      console.log('Migração de localStorage concluída com sucesso!');
    } catch (err) {
      console.error('Erro na migração de localStorage para Supabase:', err);
    }
  };

  useEffect(() => {
    // 1. Get current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        const email = session.user.email || '';
        const role = session.user.user_metadata?.role || 'admin';
        const name = session.user.user_metadata?.name || email.split('@')[0];
        setUser({ id: session.user.id, email, role, name });
        loadAllUserData(session.user.id);
      }
    });
    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setIsLoggedIn(true);
        const email = session.user.email || '';
        const role = session.user.user_metadata?.role || 'admin';
        const name = session.user.user_metadata?.name || email.split('@')[0];
        setUser({ id: session.user.id, email, role, name });
        await loadAllUserData(session.user.id);
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setClients([]);
        setServices([]);
        setAppointments([]);
        setStock([]);
        setTransactions([]);
        setBills([]);
      }
    });

    // 3. Theme check
    const savedTheme = localStorage.getItem('nail_theme') || 'dark';
    setTheme(savedTheme as any);
    document.documentElement.classList.toggle('light', savedTheme === 'light');

    // 4. Google Agenda check
    const isGoogleConnected = localStorage.getItem('nail_google_connected') === 'true';
    const savedGoogleEmail = localStorage.getItem('nail_google_email') || '';
    setGoogleConnected(isGoogleConnected);
    setGoogleEmail(savedGoogleEmail);

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('nail_session');
    setUser(null);
    setIsLoggedIn(false);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('nail_theme', nextTheme);
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  // ============================================================
  // DATABASE WRITERS / SETTERS
  // ============================================================

  // Appointments
  const handleAddAppointment = async (aptData: Omit<Appointment, 'id' | 'createdAt'>) => {
    const newApt: Appointment = {
      ...aptData,
      id: 'apt_' + Date.now(),
      createdAt: new Date().toISOString()
    };
    const nextApts = [...appointments, newApt];
    setAppointments(nextApts);

    let nextTxns = [...transactions];
    let newTxn: Transaction | null = null;
    if (aptData.status === 'Concluído') {
      const client = clients.find(c => c.id === aptData.clientId);
      const service = services.find(s => s.id === aptData.serviceId);
      newTxn = {
        id: 'txn_' + Date.now(),
        data: aptData.data,
        tipo: 'Receita',
        descricao: `Atendimento: ${client ? client.nome : 'Cliente'} (${service ? service.nome : 'Unhas'})`,
        valor: aptData.valor,
        paymentMethod: aptData.paymentMethod || 'Pix',
        appointmentId: newApt.id,
        createdAt: new Date().toISOString()
      };
      nextTxns.push(newTxn);
      setTransactions(nextTxns);
    }

    try {
      await supabase.from('appointments').insert({
        id: newApt.id,
        client_id: newApt.clientId,
        service_id: newApt.serviceId,
        data: newApt.data,
        hora: newApt.hora,
        valor: newApt.valor,
        status: newApt.status,
        payment_method: newApt.paymentMethod || null,
        obs: newApt.obs || null,
        created_at: newApt.createdAt,
        user_id: user?.id
      });

      if (newTxn) {
        await supabase.from('transactions').insert({
          id: newTxn.id,
          data: newTxn.data,
          tipo: newTxn.tipo,
          descricao: newTxn.descricao,
          valor: newTxn.valor,
          appointment_id: newTxn.appointmentId,
          payment_method: newTxn.paymentMethod || null,
          created_at: newTxn.createdAt,
          user_id: user?.id
        });
      }

      // Log appointment creation
      const client = clients.find(c => c.id === newApt.clientId);
      const service = services.find(s => s.id === newApt.serviceId);
      const clientName = client ? client.nome : 'Bloqueio';
      const serviceName = service ? service.nome : 'Compromisso';
      registrarLog('Criação', 'Agendamento', newApt.id, `Agendamento criado para ${clientName} - ${serviceName} em ${newApt.data} às ${newApt.hora}`, null, newApt);

    } catch (err) {
      console.error('Erro ao adicionar agendamento:', err);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    const nextApts = appointments.map(a => (a.id === id ? { ...a, status: 'Cancelado' as const } : a));
    const nextTxns = transactions.filter(t => t.appointmentId !== id);
    setAppointments(nextApts);
    setTransactions(nextTxns);

    try {
      const oldApt = appointments.find(a => a.id === id);
      await supabase.from('appointments').update({ status: 'Cancelado' }).eq('id', id);
      await supabase.from('transactions').delete().eq('appointment_id', id);
      if (oldApt) {
        const client = clients.find(c => c.id === oldApt.clientId);
        registrarLog('Edição', 'Agendamento', id, `Agendamento cancelado para ${client ? client.nome : 'Cliente'} em ${oldApt.data} às ${oldApt.hora}`, oldApt, { ...oldApt, status: 'Cancelado' });
      }
    } catch (err) {
      console.error('Erro ao cancelar agendamento:', err);
    }
  };

  const handleCompleteAppointment = async (
    id: string, 
    splits: { method: Appointment['paymentMethod']; value: number }[]
  ) => {
    const mainMethod = splits.find(s => s.method === 'Pagar Depois')?.method || splits[0]?.method || 'Pix';
    const nextApts = appointments.map(a => (a.id === id ? { ...a, status: 'Concluído' as const, paymentMethod: mainMethod } : a));
    let nextTxns = transactions.filter(t => t.appointmentId !== id);
    
    const apt = appointments.find(a => a.id === id);
    const txnsToAdd: any[] = [];
    if (apt) {
      const client = clients.find(c => c.id === apt.clientId);
      const service = services.find(s => s.id === apt.serviceId);
      
      splits.forEach((split, index) => {
        const newTxn = {
          id: `txn_${Date.now()}_${index}`,
          data: apt.data,
          tipo: 'Receita' as const,
          descricao: `Atendimento: ${client ? client.nome : 'Cliente'} (${service ? service.nome : 'Unhas'})${splits.length > 1 ? ` [Parte ${split.method}]` : ''}`,
          valor: split.value,
          paymentMethod: split.method,
          appointmentId: id,
          createdAt: new Date().toISOString()
        };
        nextTxns.push(newTxn);
        txnsToAdd.push({
          id: newTxn.id,
          data: newTxn.data,
          tipo: newTxn.tipo,
          descricao: newTxn.descricao,
          valor: newTxn.valor,
          appointment_id: id,
          payment_method: newTxn.paymentMethod || null,
          created_at: newTxn.createdAt,
          user_id: user?.id
        });
      });
    }
    
    setAppointments(nextApts);
    setTransactions(nextTxns);

    try {
      await supabase.from('appointments').update({ status: 'Concluído', payment_method: mainMethod }).eq('id', id);
      await supabase.from('transactions').delete().eq('appointment_id', id);
      if (txnsToAdd.length > 0) {
        await supabase.from('transactions').insert(txnsToAdd);
      }
      if (apt) {
        const client = clients.find(c => c.id === apt.clientId);
        registrarLog('Edição', 'Agendamento', id, `Agendamento concluído para ${client ? client.nome : 'Cliente'} em ${apt.data} às ${apt.hora} (Método: ${mainMethod})`, apt, { ...apt, status: 'Concluído', paymentMethod: mainMethod });
      }
    } catch (err) {
      console.error('Erro ao concluir agendamento:', err);
    }
  };

  const handleQuitDebts = async (
    clientId: string, 
    paymentMethod: string
  ) => {
    const clientAppointmentIds = appointments.filter(a => a.clientId === clientId).map(a => a.id);
    
    const nextApts = appointments.map(a => 
      (a.clientId === clientId && (a.paymentMethod === 'Pagar Depois' || !a.paymentMethod)) 
        ? { ...a, paymentMethod } 
        : a
    );
    
    const nextTxns = transactions.map(t => 
      (t.tipo === 'Receita' && (t.paymentMethod === 'Pagar Depois' || !t.paymentMethod) && t.appointmentId && clientAppointmentIds.includes(t.appointmentId))
        ? { ...t, paymentMethod }
        : t
    );
    
    setAppointments(nextApts);
    setTransactions(nextTxns);

    try {
      await supabase.from('appointments')
        .update({ payment_method: paymentMethod })
         .eq('client_id', clientId)
         .or('payment_method.eq.Pagar Depois,payment_method.is.null');

      await supabase.from('transactions')
        .update({ payment_method: paymentMethod })
         .eq('tipo', 'Receita')
         .in('appointment_id', clientAppointmentIds)
         .or('payment_method.eq.Pagar Depois,payment_method.is.null');

      const client = clients.find(c => c.id === clientId);
      registrarLog('Edição', 'Financeiro', clientId, `Quitação de débitos pendentes da cliente ${client ? client.nome : clientId} via ${paymentMethod}`, null, null);
    } catch (err) {
      console.error('Erro ao quitar débitos:', err);
    }
  };

  const handleSaveSettings = async (updated: ProfessionalSettings) => {
    setSettings(updated);
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data.session;
    if (session) {
      await salvarConfiguracoesGestorDb(updated, session.user.id);
    }
  };

  const handleSaveBill = async (bill: Bill) => {
    let isEdit = false;
    let oldBill: Bill | null = null;
    setBills(prev => {
      const index = prev.findIndex(b => b.id === bill.id);
      if (index >= 0) {
        isEdit = true;
        oldBill = prev[index];
        const next = [...prev];
        next[index] = bill;
        return next;
      }
      return [...prev, bill];
    });

    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data.session;
    if (session) {
      await salvarContaPagarDb(bill, session.user.id);
      if (isEdit && oldBill) {
        registrarLog('Edição', 'Contas', bill.id, `Conta a pagar '${bill.descricao}' atualizada para status ${bill.status} (Valor: R$ ${bill.valor.toFixed(2)}, Vencimento: ${bill.dataVencimento})`, oldBill, bill);
      } else {
        registrarLog('Criação', 'Contas', bill.id, `Conta a pagar '${bill.descricao}' criada com status ${bill.status} (Valor: R$ ${bill.valor.toFixed(2)}, Vencimento: ${bill.dataVencimento})`, null, bill);
      }
    }
  };

  const handleDeleteBill = async (id: string) => {
    const oldBill = bills.find(b => b.id === id);
    setBills(prev => prev.filter(b => b.id !== id));
    await excluirContaPagarDb(id);
    if (oldBill) {
      registrarLog('Exclusão', 'Contas', id, `Conta a pagar '${oldBill.descricao}' excluída`, oldBill, null);
    }
  };

  const handleUpdateAppointmentTime = async (id: string, hora: string) => {
    const nextApts = appointments.map(a => (a.id === id ? { ...a, hora } : a));
    setAppointments(nextApts);
    try {
      await supabase.from('appointments').update({ hora }).eq('id', id);
    } catch (err) {
      console.error('Erro ao atualizar hora:', err);
    }
  };

  const handleConnectGoogle = (email: string) => {
    setGoogleConnected(true);
    setGoogleEmail(email);
    localStorage.setItem('nail_google_connected', 'true');
    localStorage.setItem('nail_google_email', email);
  };

  const handleDisconnectGoogle = () => {
    setGoogleConnected(false);
    setGoogleEmail('');
    localStorage.removeItem('nail_google_connected');
    localStorage.removeItem('nail_google_email');
  };

  const registrarLog = async (
    acao: 'Criação' | 'Edição' | 'Exclusão',
    entidade: 'Cliente' | 'Agendamento' | 'Serviço' | 'Financeiro' | 'Estoque' | 'Contas',
    registroId: string,
    detalhes: string,
    valorAnterior?: any,
    valorNovo?: any
  ) => {
    const userEmail = user?.email || 'admin@lacca.com';
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          user_email: userEmail,
          acao,
          entidade,
          registro_id: registroId,
          detalhes,
          valor_anterior: valorAnterior || null,
          valor_novo: valorNovo || null
        })
        .select('*')
        .single();
      
      if (error) throw error;
      if (data) {
        setLogs(prev => [
          {
            id: data.id,
            userEmail: data.user_email,
            acao: data.acao,
            entidade: data.entidade,
            registroId: data.registro_id,
            detalhes: data.detalhes,
            valorAnterior: data.valor_anterior,
            valorNovo: data.valor_novo,
            createdAt: data.created_at
          },
          ...prev
        ]);
      }
    } catch (err) {
      console.error('Erro ao salvar log de auditoria no Supabase:', err);
      const fallbackLog: AuditLog = {
        id: 'log_' + Date.now(),
        userEmail,
        acao,
        entidade,
        registroId,
        detalhes,
        valorAnterior,
        valorNovo,
        createdAt: new Date().toISOString()
      };
      setLogs(prev => [fallbackLog, ...prev]);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Deseja excluir este agendamento?')) return;
    const oldApt = appointments.find(a => a.id === id);
    const nextApts = appointments.filter(a => a.id !== id);
    const nextTxns = transactions.filter(t => t.appointmentId !== id);
    setAppointments(nextApts);
    setTransactions(nextTxns);

    try {
      await supabase.from('appointments').delete().eq('id', id);
      await supabase.from('transactions').delete().eq('appointment_id', id);
      if (oldApt) {
        const client = clients.find(c => c.id === oldApt.clientId);
        const clientName = client ? client.nome : 'Bloqueio';
        registrarLog('Exclusão', 'Agendamento', id, `Agendamento excluído para ${clientName} em ${oldApt.data} às ${oldApt.hora}`, oldApt, null);
      }
    } catch (err) {
      console.error('Erro ao excluir agendamento:', err);
    }
  };

  // Clients
  const handleAddClient = async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
    const newClient: Client = {
      ...clientData,
      id: 'cli_' + Date.now(),
      fotosUnhas: [],
      createdAt: new Date().toISOString()
    };
    const nextClients = [...clients, newClient];
    setClients(nextClients);

    try {
      await supabase.from('clients').insert({
        id: newClient.id,
        nome: newClient.nome,
        celular: newClient.celular,
        data_nascimento: newClient.dataNascimento || null,
        formato_unha: newClient.formatoUnha || null,
        alergias: newClient.alergias || null,
        obs_tecnicas: newClient.obsTecnicas || null,
        fotos_unhas: newClient.fotosUnhas,
        user_id: user?.id
      });
      registrarLog('Criação', 'Cliente', newClient.id, `Cliente ${newClient.nome} cadastrado(a)`, null, newClient);
    } catch (err) {
      console.error('Erro ao cadastrar cliente:', err);
    }
    return newClient;
  };

  const handleEditClient = async (id: string, clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const oldClient = clients.find(c => c.id === id);
    const nextClients = clients.map(c => (c.id === id ? { ...c, ...clientData } : c));
    setClients(nextClients);

    try {
      await supabase.from('clients').update({
        nome: clientData.nome,
        celular: clientData.celular,
        data_nascimento: clientData.dataNascimento || null,
        formato_unha: clientData.formatoUnha || null,
        alergias: clientData.alergias || null,
        obs_tecnicas: clientData.obsTecnicas || null
      }).eq('id', id);
      if (oldClient) {
        registrarLog('Edição', 'Cliente', id, `Cliente ${clientData.nome} editado(a)`, oldClient, { ...oldClient, ...clientData });
      }
    } catch (err) {
      console.error('Erro ao editar cliente:', err);
    }
  };

  const handleDeleteClient = async (id: string) => {
    const oldClient = clients.find(c => c.id === id);
    const nextClients = clients.filter(c => c.id !== id);
    const nextApts = appointments.filter(a => a.clientId !== id);
    setClients(nextClients);
    setAppointments(nextApts);

    try {
      await supabase.from('clients').delete().eq('id', id);
      await supabase.from('appointments').delete().eq('client_id', id);
      if (oldClient) {
        registrarLog('Exclusão', 'Cliente', id, `Cliente ${oldClient.nome} excluído(a) e agendamentos relacionados removidos`, oldClient, null);
      }
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
    }
  };

  const handleUploadPhoto = async (clientId: string, photoBase64: string) => {
    let updatedPhotos: string[] = [];
    const nextClients = clients.map(c => {
      if (c.id === clientId) {
        updatedPhotos = [...(c.fotosUnhas || []), photoBase64];
        return { ...c, fotosUnhas: updatedPhotos };
      }
      return c;
    });
    setClients(nextClients);

    try {
      await supabase.from('clients').update({ fotos_unhas: updatedPhotos }).eq('id', clientId);
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
    }
  };

  const handleDeletePhoto = async (clientId: string, photoIndex: number) => {
    let updatedPhotos: string[] = [];
    const nextClients = clients.map(c => {
      if (c.id === clientId) {
        updatedPhotos = [...(c.fotosUnhas || [])];
        updatedPhotos.splice(photoIndex, 1);
        return { ...c, fotosUnhas: updatedPhotos };
      }
      return c;
    });
    setClients(nextClients);

    try {
      await supabase.from('clients').update({ fotos_unhas: updatedPhotos }).eq('id', clientId);
    } catch (err) {
      console.error('Erro ao deletar foto:', err);
    }
  };

  // Transactions
  const handleAddTransaction = async (txnData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTxn: Transaction = {
      ...txnData,
      id: 'txn_' + Date.now(),
      createdAt: new Date().toISOString()
    };
    const nextTxns = [...transactions, newTxn];
    setTransactions(nextTxns);

    try {
      await supabase.from('transactions').insert({
        id: newTxn.id,
        data: newTxn.data,
        tipo: newTxn.tipo,
        descricao: newTxn.descricao,
        valor: newTxn.valor,
        appointment_id: newTxn.appointmentId || null,
        payment_method: newTxn.paymentMethod || null,
        created_at: newTxn.createdAt,
        user_id: user?.id
      });
      registrarLog('Criação', 'Financeiro', newTxn.id, `Transação manual adicionada: ${newTxn.tipo} - ${newTxn.descricao} (R$ ${newTxn.valor.toFixed(2)})`, null, newTxn);
    } catch (err) {
      console.error('Erro ao adicionar transação:', err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const oldTxn = transactions.find(t => t.id === id);
    const nextTxns = transactions.filter(t => t.id !== id);
    setTransactions(nextTxns);

    try {
      await supabase.from('transactions').delete().eq('id', id);
      if (oldTxn) {
        registrarLog('Exclusão', 'Financeiro', id, `Transação manual excluída: ${oldTxn.tipo} - ${oldTxn.descricao} (R$ ${oldTxn.valor.toFixed(2)})`, oldTxn, null);
      }
    } catch (err) {
      console.error('Erro ao excluir transação:', err);
    }
  };

  // Services
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName || !srvPrice) return;

    const priceErr = validarPrecoServico(srvPrice);
    if (priceErr) {
      setSrvPriceError(priceErr);
      return;
    }
    setSrvPriceError(null);

    const price = parseFloat(srvPrice) || 0;
    const dur = parseInt(srvDuration) || 60;

    let targetService: Service;
    let nextServices = [...services];
    const isEdit = !!editingService;
    const oldService = editingService ? { ...editingService } : null;

    if (editingService) {
      targetService = { ...editingService, nome: srvName, preco: price, duracao: dur };
      nextServices = nextServices.map(s => (s.id === editingService.id ? targetService : s));
      setEditingService(null);
    } else {
      targetService = { id: 'srv_' + Date.now(), nome: srvName, preco: price, duracao: dur, ativo: true };
      nextServices.push(targetService);
    }
    setServices(nextServices);
    setShowServiceModal(false);
    setSrvName('');
    setSrvPrice('');

    try {
      await supabase.from('services').upsert({
        id: targetService.id,
        nome: targetService.nome,
        preco: targetService.preco,
        duracao: targetService.duracao,
        ativo: targetService.ativo !== false,
        user_id: user?.id
      });
      if (isEdit && oldService) {
        registrarLog('Edição', 'Serviço', targetService.id, `Serviço '${targetService.nome}' editado (Preço: R$ ${targetService.preco.toFixed(2)}, Duração: ${targetService.duracao} min)`, oldService, targetService);
      } else {
        registrarLog('Criação', 'Serviço', targetService.id, `Serviço '${targetService.nome}' criado (Preço: R$ ${targetService.preco.toFixed(2)}, Duração: ${targetService.duracao} min)`, null, targetService);
      }
    } catch (err) {
      console.error('Erro ao salvar serviço:', err);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Deseja excluir este serviço? O histórico de agendamentos antigos pode quebrar se o serviço for removido permanentemente. Prefira inativar.')) return;
    const oldService = services.find(s => s.id === id);
    const nextServices = services.filter(s => s.id !== id);
    setServices(nextServices);

    try {
      await supabase.from('services').delete().eq('id', id);
      if (oldService) {
        registrarLog('Exclusão', 'Serviço', id, `Serviço '${oldService.nome}' excluído permanentemente`, oldService, null);
      }
    } catch (err) {
      console.error('Erro ao excluir serviço:', err);
    }
  };

  const handleToggleServiceActive = async (id: string, ativo: boolean) => {
    const oldService = services.find(s => s.id === id);
    const nextServices = services.map(s => s.id === id ? { ...s, ativo } : s);
    setServices(nextServices);

    try {
      await supabase.from('services').update({ ativo }).eq('id', id);
      if (oldService) {
        registrarLog('Edição', 'Serviço', id, `Serviço '${oldService.nome}' ${ativo ? 'ativado' : 'inativado'}`, oldService, { ...oldService, ativo });
      }
    } catch (err) {
      console.error('Erro ao alternar status do serviço:', err);
    }
  };

  // Stock
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockName) return;
    const qtd = parseInt(stockQtd) || 0;
    const min = parseInt(stockMin) || 0;

    let targetItem: { id: string; nome: string; qtd: number; min: number };
    let nextStock = [...stock];
    const isEdit = !!editingStockItem;
    const oldItem = editingStockItem ? { ...editingStockItem } : null;

    if (editingStockItem) {
      targetItem = { ...editingStockItem, nome: stockName, qtd, min };
      nextStock = nextStock.map(s => (s.id === editingStockItem.id ? targetItem : s));
      setEditingStockItem(null);
    } else {
      targetItem = { id: 'stk_' + Date.now(), nome: stockName, qtd, min };
      nextStock.push(targetItem);
    }
    setStock(nextStock);
    setShowStockModal(false);
    setStockName('');

    try {
      await supabase.from('stock').upsert({
        id: targetItem.id,
        nome: targetItem.nome,
        qtd: targetItem.qtd,
        min: targetItem.min,
        user_id: user?.id
      });
      if (isEdit && oldItem) {
        registrarLog('Edição', 'Estoque', targetItem.id, `Item '${targetItem.nome}' editado no estoque (Qtd: ${targetItem.qtd}, Min: ${targetItem.min})`, oldItem, targetItem);
      } else {
        registrarLog('Criação', 'Estoque', targetItem.id, `Item '${targetItem.nome}' adicionado ao estoque (Qtd: ${targetItem.qtd}, Min: ${targetItem.min})`, null, targetItem);
      }
    } catch (err) {
      console.error('Erro ao salvar estoque:', err);
    }
  };

  const adjustStockQuantity = async (id: string, amount: number) => {
    let updatedItem: any = null;
    const oldItem = stock.find(s => s.id === id);
    const nextStock = stock.map(s => {
      if (s.id === id) {
        updatedItem = { ...s, qtd: Math.max(0, s.qtd + amount) };
        return updatedItem;
      }
      return s;
    });
    setStock(nextStock);

    if (updatedItem) {
      try {
        await supabase.from('stock').update({ qtd: updatedItem.qtd }).eq('id', id);
        if (oldItem) {
          registrarLog('Edição', 'Estoque', id, `Quantidade de '${updatedItem.nome}' ajustada de ${oldItem.qtd} para ${updatedItem.qtd} (${amount > 0 ? '+' : ''}${amount})`, oldItem, updatedItem);
        }
      } catch (err) {
        console.error('Erro ao ajustar quantidade:', err);
      }
    }
  };

  const handleDeleteStock = async (id: string) => {
    if (!confirm('Deseja excluir este produto do estoque?')) return;
    const oldItem = stock.find(s => s.id === id);
    const nextStock = stock.filter(s => s.id !== id);
    setStock(nextStock);

    try {
      await supabase.from('stock').delete().eq('id', id);
      if (oldItem) {
        registrarLog('Exclusão', 'Estoque', id, `Item '${oldItem.nome}' excluído do estoque`, oldItem, null);
      }
    } catch (err) {
      console.error('Erro ao excluir item:', err);
    }
  };

  // Backups
  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ clients, services, appointments, stock, transactions }, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `nailart-pro-backup-${new Date().toISOString().slice(0,10)}.json`);
    a.click();
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result as string);
        if (!imported.clients || !imported.services || !imported.appointments || !imported.stock || !imported.transactions) {
          alert('Backup inválido.');
          return;
        }
        if (!confirm('Deseja substituir todos os dados atuais pelo backup? Os dados serão enviados ao Supabase.')) return;
        
        const sessionRes = await supabase.auth.getSession();
        const session = sessionRes.data.session;
        if (!session) {
          alert('Você precisa estar logado para importar.');
          return;
        }
        const userId = session.user.id;

        // Clean tables and insert imported
        await supabase.from('services').delete().eq('user_id', userId);
        await supabase.from('services').insert(imported.services.map((s: any) => ({ ...s, user_id: userId })));
        
        await supabase.from('clients').delete().eq('user_id', userId);
        await supabase.from('clients').insert(imported.clients.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          celular: c.celular,
          data_nascimento: c.dataNascimento || null,
          formato_unha: c.formatoUnha || null,
          alergias: c.alergias || null,
          obs_tecnicas: c.obsTecnicas || null,
          fotos_unhas: c.fotosUnhas || [],
          user_id: userId
        })));

        await supabase.from('appointments').delete().eq('user_id', userId);
        await supabase.from('appointments').insert(imported.appointments.map((a: any) => ({
          id: a.id,
          client_id: a.clientId,
          service_id: a.serviceId,
          data: a.data,
          hora: a.hora,
          valor: a.valor,
          status: a.status,
          payment_method: a.paymentMethod || null,
          obs: a.obs || null,
          user_id: userId
        })));

        await supabase.from('stock').delete().eq('user_id', userId);
        await supabase.from('stock').insert(imported.stock.map((s: any) => ({
          id: s.id,
          nome: s.nome,
          qtd: s.qtd,
          min: s.min,
          user_id: userId
        })));

        await supabase.from('transactions').delete().eq('user_id', userId);
        await supabase.from('transactions').insert(imported.transactions.map((t: any) => ({
          id: t.id,
          data: t.data,
          tipo: t.tipo,
          descricao: t.descricao,
          valor: t.valor,
          appointment_id: t.appointmentId || null,
          payment_method: t.paymentMethod || null,
          user_id: userId
        })));

        await loadAllUserData(userId);
        alert('Backup importado com sucesso!');
      } catch (err) {
        alert('Erro ao importar JSON.');
      }
    };
    reader.readAsText(file);
  };

  if (!isLoggedIn) {
    return <Login />;
  }

  return (
    <div id="app" className="flex min-h-screen relative">
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className="hidden md:flex flex-col w-[240px] bg-surface border-r border-border p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 pb-5 border-b border-border mb-6">
          <span className="text-2xl bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">✨</span>
          <div>
            <h1 className="text-base font-extrabold text-text">NailArt Pro</h1>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Gestão & Design</p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>🏠</span> Início
          </button>
          <button
            onClick={() => setActiveTab('agenda')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'agenda' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>📅</span> Agenda
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'clientes' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>👥</span> Clientes
          </button>
          <button
            onClick={() => setActiveTab('servicos')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'servicos' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>💅</span> Serviços
          </button>
          <button
            onClick={() => setActiveTab('estoque')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'estoque' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>📦</span> Estoque
          </button>
          <button
            onClick={() => setActiveTab('relatorios')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'relatorios' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>📊</span> Relatórios
          </button>
          <button
            onClick={() => setActiveTab('contas_pagar')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'contas_pagar' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>💸</span> Contas a Pagar
          </button>
          <button
            onClick={() => setActiveTab('configuracoes')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'configuracoes' ? 'bg-primary-lt text-primary' : 'text-text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span>⚙️</span> Configurações
          </button>
        </nav>

        <div className="pt-4 border-t border-border space-y-2 mt-auto">
          <button onClick={exportData} className="w-full py-1.5 bg-card hover:bg-active border border-border text-xs font-bold rounded text-text transition-all cursor-pointer">
            Exportar JSON
          </button>
          <label className="w-full py-1.5 bg-card hover:bg-active border border-border text-xs font-bold rounded text-text block text-center cursor-pointer transition-all">
            Importar JSON
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
          <button
            onClick={toggleTheme}
            className="w-full py-2 bg-card hover:bg-active border border-border text-xs font-bold rounded text-text-muted hover:text-text flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 bg-danger/10 hover:bg-danger/20 border border-danger/25 text-xs font-bold rounded text-danger transition-all cursor-pointer"
          >
            Log Out
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full py-1.5 border text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-primary-lt border-primary text-primary'
                : 'bg-card border-border text-text-muted hover:text-text hover:bg-active'
            }`}
          >
            <span>📜</span> Logs
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-h-screen md:pl-0 pb-[76px] md:pb-6">
        
        {/* HEADER TOP BAR */}
        <header className="sticky top-0 z-[900] bg-surface/90 backdrop-blur-md h-[70px] border-b border-border flex justify-between items-center px-6 md:px-8">
          <div>
            <h2 className="text-xl font-extrabold text-text capitalize">
              {activeTab === 'relatorios' ? 'Relatórios' : activeTab === 'contas_pagar' ? 'Contas a Pagar' : activeTab === 'configuracoes' ? 'Configurações' : activeTab === 'logs' ? 'Logs' : activeTab}
            </h2>
            <p className="text-xs text-text-muted">NailArt Pro &mdash; Gestão</p>
          </div>
          <div className="flex md:hidden items-center gap-2">
            <button onClick={toggleTheme} className="p-2 bg-surface-card border border-border rounded-md text-sm">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} className="p-1 px-3 bg-danger/10 text-danger border border-danger/25 rounded-md text-xs font-bold">
              Sair
            </button>
          </div>
        </header>

        {/* SCREEN SECTION CONTAINER */}
        <div className="p-6 md:p-8 flex-1">
          {activeTab === 'dashboard' && (
            <Dashboard
              userName={user?.name || 'Profissional'}
              userRole={user?.role || 'admin'}
              onLogout={handleLogout}
              appointments={appointments}
              clients={clients}
              services={services}
              stock={stock}
              transactions={transactions}
              settings={settings}
              onAddAppointment={handleAddAppointment}
              onCancelAppointment={handleCancelAppointment}
              onCompleteAppointment={handleCompleteAppointment}
            />
          )}

          {activeTab === 'agenda' && (
            <AgendaView
              appointments={appointments}
              clients={clients}
              services={services}
              settings={settings}
              onAddAppointment={handleAddAppointment}
              onCancelAppointment={handleCancelAppointment}
              onCompleteAppointment={handleCompleteAppointment}
              onDeleteAppointment={handleDeleteAppointment}
              onUpdateAppointmentTime={handleUpdateAppointmentTime}
              onAddClient={handleAddClient}
              googleConnected={googleConnected}
              googleEmail={googleEmail}
              onConnectGoogle={handleConnectGoogle}
              onDisconnectGoogle={handleDisconnectGoogle}
              waitlist={waitlist}
              setWaitlist={setWaitlist}
            />
          )}

          {activeTab === 'clientes' && (
            <ClientesView
              clients={clients}
              appointments={appointments}
              services={services}
              onAddClient={handleAddClient}
              onEditClient={handleEditClient}
              onDeleteClient={handleDeleteClient}
              onUploadPhoto={handleUploadPhoto}
              onDeletePhoto={handleDeletePhoto}
            />
          )}

          {activeTab === 'servicos' && (() => {
            const displayedServices = services.filter(s => mostrarInativos || s.ativo !== false);
            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-4">
                    <h3 className="text-base font-extrabold text-text">Catálogo de Serviços</h3>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-text">
                      <input
                        type="checkbox"
                        className="accent-primary w-4 h-4 cursor-pointer rounded"
                        checked={mostrarInativos}
                        onChange={(e) => setMostrarInativos(e.target.checked)}
                      />
                      <span>👁️ Mostrar inativos</span>
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      setEditingService(null);
                      setSrvName('');
                      setSrvPrice('');
                      setSrvPriceError(null);
                      setSrvDuration('60');
                      setShowServiceModal(true);
                    }}
                    className="btn btn-primary btn-sm font-bold bg-gradient-to-r from-primary to-primary-hover text-white text-xs cursor-pointer"
                  >
                    + Novo Serviço
                  </button>
                </div>

                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                  <div className="table-wrap">
                    <table className="responsive-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Preço Sugerido</th>
                          <th>Duração Estimada</th>
                          <th>Status</th>
                          <th className="text-center" style={{ width: '160px' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedServices.map(s => (
                          <tr key={s.id} className={s.ativo === false ? 'opacity-55 bg-surface-active/10' : ''}>
                            <td data-label="Nome">
                              <strong>{s.nome}</strong>
                              {s.ativo === false && <span className="ml-2 text-[10px] bg-danger/10 text-danger border border-danger/25 px-1.5 py-0.5 rounded font-bold uppercase">Inativo</span>}
                            </td>
                            <td data-label="Preço Sugerido" className="text-success font-bold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.preco)}
                            </td>
                            <td data-label="Duração Estimada">⏱️ {s.duracao} minutos</td>
                            <td data-label="Status">
                              <button
                                onClick={() => handleToggleServiceActive(s.id, s.ativo === false)}
                                className={`btn btn-xs font-bold px-2 py-0.5 rounded ${
                                  s.ativo !== false 
                                    ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20' 
                                    : 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20'
                                }`}
                              >
                                {s.ativo !== false ? '🟢 Ativo' : '🔴 Inativo'}
                              </button>
                            </td>
                            <td data-label="Ações" className="text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingService(s);
                                    setSrvName(s.nome);
                                    setSrvPrice(s.preco.toString());
                                    setSrvPriceError(null);
                                    setSrvDuration(s.duracao.toString());
                                    setShowServiceModal(true);
                                  }}
                                  className="btn btn-secondary btn-xs cursor-pointer"
                                  title="Editar Serviço"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteService(s.id)}
                                  className="btn btn-danger btn-xs cursor-pointer"
                                  title="Excluir Permanentemente"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {displayedServices.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-text-muted italic">Nenhum serviço encontrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'estoque' && (() => {
            const displayedStock = filterLowStock ? stock.filter(s => s.qtd <= s.min) : stock;
            
            const exportStockPDF = () => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              
              const stockRows = displayedStock.map(s => `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px; font-weight: bold;">${s.nome}</td>
                  <td style="padding: 10px; text-align: center;">${s.qtd}</td>
                  <td style="padding: 10px; text-align: center;">${s.min}</td>
                  <td style="padding: 10px; color: ${s.qtd <= s.min ? '#e53e3e' : '#38a169'}; font-weight: bold;">
                    ${s.qtd <= s.min ? 'Necessita Reposição' : 'OK'}
                  </td>
                </tr>
              `).join('');

              printWindow.document.write(`
                <html>
                  <head>
                    <title>Relatório de Estoque - NailArt Pro</title>
                    <style>
                      body { font-family: sans-serif; padding: 20px; color: #333; }
                      h1 { color: #d4a373; border-bottom: 2px solid #d4a373; padding-bottom: 10px; }
                      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                      th { background-color: #f7f7f7; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
                      .footer { margin-top: 40px; font-size: 11px; color: #777; text-align: center; }
                    </style>
                  </head>
                  <body>
                    <h1>Relatório de Insumos - NailArt Pro</h1>
                    <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th style="text-align: center;">Qtd Atual</th>
                          <th style="text-align: center;">Estoque Mínimo</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${stockRows}
                      </tbody>
                    </table>
                    <div class="footer">NailArt Pro &mdash; Sistema de Gestão & Estética</div>
                    <script>
                      window.onload = function() {
                        window.print();
                        window.close();
                      }
                    </script>
                  </body>
                </html>
              `);
              printWindow.document.close();
            };

            const exportStockCSV = () => {
              const headers = ['Produto', 'Quantidade Atual', 'Estoque Minimo', 'Status'];
              const rows = displayedStock.map(s => [
                s.nome,
                s.qtd,
                s.min,
                s.qtd <= s.min ? 'Repor' : 'OK'
              ]);
              
              const csvContent = [
                headers.join(','),
                ...rows.map(e => e.map(val => `"${val}"`).join(','))
              ].join('\n');

              const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `nailart-pro-estoque-${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };

            const exportStockWhatsApp = () => {
              let message = `*Relatório de Estoque - NailArt Pro* \u{1F485}\n`;
              message += `Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
              
              displayedStock.forEach(s => {
                const statusEmoji = s.qtd <= s.min ? '\u{26A0}\u{FE0F}' : '\u{2705}';
                message += `${statusEmoji} *${s.nome}*\n   Qtd: ${s.qtd} (Mín: ${s.min}) - ${s.qtd <= s.min ? 'PRECISA DE REPOSIÇÃO' : 'OK'}\n`;
              });
              
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
            };

            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-base font-extrabold text-text">Gerenciamento de Insumos</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text select-none">
                      <input
                        type="checkbox"
                        checked={filterLowStock}
                        onChange={(e) => setFilterLowStock(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>⚠️ Apenas Estoque Baixo</span>
                    </label>
                    <button
                      onClick={() => {
                        setEditingStockItem(null);
                        setStockName('');
                        setStockQtd('5');
                        setStockMin('2');
                        setShowStockModal(true);
                      }}
                      className="btn btn-primary btn-sm font-bold bg-gradient-to-r from-primary to-primary-hover text-white text-xs cursor-pointer"
                    >
                      + Novo Item
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                  <div className="table-wrap">
                    <table className="responsive-table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th className="text-center">Qtd Atual</th>
                          <th className="text-center">Mínimo</th>
                          <th>Status</th>
                          <th className="text-center" style={{ width: '120px' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedStock.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-text-muted italic">
                              Nenhum insumo encontrado.
                            </td>
                          </tr>
                        ) : (
                          displayedStock.map(s => {
                            const isLow = s.qtd <= s.min;
                            return (
                              <tr key={s.id}>
                                <td data-label="Produto"><strong>{s.nome}</strong></td>
                                <td data-label="Qtd Atual" className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => adjustStockQuantity(s.id, -1)} className="btn btn-secondary btn-xs font-bold px-2 py-0 cursor-pointer">-</button>
                                    <span className="font-extrabold text-sm">{s.qtd}</span>
                                    <button onClick={() => adjustStockQuantity(s.id, 1)} className="btn btn-secondary btn-xs font-bold px-2 py-0 cursor-pointer">+</button>
                                  </div>
                                </td>
                                <td data-label="Mínimo" className="text-center text-text-muted">{s.min}</td>
                                <td data-label="Status">
                                  <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                                    {isLow ? 'Repor' : 'OK'}
                                  </span>
                                </td>
                                <td data-label="Ações" className="text-center">
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingStockItem(s);
                                        setStockName(s.nome);
                                        setStockQtd(s.qtd.toString());
                                        setStockMin(s.min.toString());
                                        setShowStockModal(true);
                                      }}
                                      className="btn btn-secondary btn-xs cursor-pointer"
                                    >
                                      ✏️
                                    </button>
                                    <button onClick={() => handleDeleteStock(s.id)} className="btn btn-danger btn-xs cursor-pointer">
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 bg-card p-3 border border-border rounded-lg justify-end items-center">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider mr-auto">Exportar Relatório de Estoque:</span>
                  <button
                    onClick={exportStockPDF}
                    className="px-3 py-1.5 bg-surface border border-border hover:border-border-hover text-text hover:text-primary text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Visualizar para Impressão / Salvar PDF"
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={exportStockCSV}
                    className="px-3 py-1.5 bg-surface border border-border hover:border-border-hover text-text hover:text-primary text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Baixar Planilha CSV"
                  >
                    📊 CSV
                  </button>
                  <button
                    onClick={exportStockWhatsApp}
                    className="px-3 py-1.5 bg-surface border border-border hover:border-border-hover text-text hover:text-success text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Enviar relatório por WhatsApp"
                  >
                    📱 WhatsApp
                  </button>
                </div>
              </div>
            );
          })()}

          {activeTab === 'relatorios' && (
            <RelatoriosView
              transactions={transactions}
              clients={clients}
              services={services}
              appointments={appointments}
              settings={settings}
              onAddTransaction={handleAddTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onQuitDebts={handleQuitDebts}
            />
          )}

          {activeTab === 'contas_pagar' && (
            <ContasPagarView
              bills={bills}
              onSaveBill={handleSaveBill}
              onDeleteBill={handleDeleteBill}
            />
          )}

          {activeTab === 'configuracoes' && (
            <ConfiguracoesView
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {activeTab === 'logs' && (
            <LogsView
              logs={logs}
            />
          )}
        </div>

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav id="bottom-nav" className="md:hidden">
        <button
          onClick={() => {
            setActiveTab('dashboard');
            setShowMoreMenu(false);
          }}
          className={`bottom-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <span className="bottom-icon">🏠</span>
          <span className="bottom-label">Início</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('agenda');
            setShowMoreMenu(false);
          }}
          className={`bottom-nav-btn ${activeTab === 'agenda' ? 'active' : ''}`}
        >
          <span className="bottom-icon">📅</span>
          <span className="bottom-label">Agenda</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('clientes');
            setShowMoreMenu(false);
          }}
          className={`bottom-nav-btn ${activeTab === 'clientes' ? 'active' : ''}`}
        >
          <span className="bottom-icon">👥</span>
          <span className="bottom-label">Clientes</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('relatorios');
            setShowMoreMenu(false);
          }}
          className={`bottom-nav-btn ${activeTab === 'relatorios' ? 'active' : ''}`}
        >
          <span className="bottom-icon">📊</span>
          <span className="bottom-label">Relatórios</span>
        </button>
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`bottom-nav-btn ${showMoreMenu ? 'active' : ''}`}
        >
          <span className="bottom-icon">☰</span>
          <span className="bottom-label">Mais</span>
        </button>
      </nav>

      {/* MOBILE "MAIS" DRAWER */}
      {showMoreMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[1800] md:hidden animate-fade-in"
            onClick={() => setShowMoreMenu(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 bg-surface border-t border-border rounded-t-xl z-[1850] p-5 pb-8 md:hidden shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
              <h3 className="text-sm font-extrabold text-text uppercase tracking-wider">Mais Opções</h3>
              <button 
                onClick={() => setShowMoreMenu(false)} 
                className="text-text-muted hover:text-text text-sm p-1"
                aria-label="Fechar menu"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setActiveTab('servicos');
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-3 p-3 text-sm font-semibold rounded-md border border-border transition-all ${
                  activeTab === 'servicos' ? 'bg-primary-lt border-primary text-primary' : 'bg-card text-text hover:bg-surface-active'
                }`}
              >
                <span className="text-lg">💅</span> Serviços
              </button>
              <button
                onClick={() => {
                  setActiveTab('estoque');
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-3 p-3 text-sm font-semibold rounded-md border border-border transition-all ${
                  activeTab === 'estoque' ? 'bg-primary-lt border-primary text-primary' : 'bg-card text-text hover:bg-surface-active'
                }`}
              >
                <span className="text-lg">📦</span> Estoque
              </button>
              <button
                onClick={() => {
                  setActiveTab('contas_pagar');
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-3 p-3 text-sm font-semibold rounded-md border border-border transition-all ${
                  activeTab === 'contas_pagar' ? 'bg-primary-lt border-primary text-primary' : 'bg-card text-text hover:bg-surface-active'
                }`}
              >
                <span className="text-lg">💸</span> Contas
              </button>
              <button
                onClick={() => {
                  setActiveTab('logs');
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-3 p-3 text-sm font-semibold rounded-md border border-border transition-all ${
                  activeTab === 'logs' ? 'bg-primary-lt border-primary text-primary' : 'bg-card text-text hover:bg-surface-active'
                }`}
              >
                <span className="text-lg">📜</span> Logs
              </button>
              <button
                onClick={() => {
                  setActiveTab('configuracoes');
                  setShowMoreMenu(false);
                }}
                className={`col-span-2 flex items-center gap-3 p-3 text-sm font-semibold rounded-md border border-border transition-all ${
                  activeTab === 'configuracoes' ? 'bg-primary-lt border-primary text-primary' : 'bg-card text-text hover:bg-surface-active'
                }`}
              >
                <span className="text-lg">⚙️</span> Configs
              </button>
            </div>
            <div className="pt-4 border-t border-border mt-4 flex gap-3">
              <button
                onClick={() => {
                  toggleTheme();
                  setShowMoreMenu(false);
                }}
                className="flex-1 py-2.5 bg-card hover:bg-active border border-border text-xs font-bold rounded text-text flex items-center justify-center gap-2 transition-all animate-none"
              >
                <span>{theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}</span>
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setShowMoreMenu(false);
                }}
                className="flex-1 py-2.5 bg-danger/10 hover:bg-danger/20 border border-danger/25 text-xs font-bold rounded text-danger transition-all animate-none"
              >
                Log Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* SERVICE MODAL */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border bg-surface flex justify-between items-center">
              <h3 className="text-sm font-bold text-text">{editingService ? 'Editar Serviço' : 'Novo Serviço'}</h3>
              <button onClick={() => setShowServiceModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveService}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Nome do Serviço</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: Alongamento em Gel"
                    value={srvName}
                    onChange={(e) => setSrvName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Valor Sugerido (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className={`w-full px-4 py-2.5 bg-surface border text-text rounded-md outline-none focus:border-primary text-sm font-medium ${
                        srvPriceError ? 'border-danger' : 'border-border'
                      }`}
                      placeholder="Ex: 140.00"
                      value={srvPrice}
                      onChange={(e) => {
                        setSrvPrice(e.target.value);
                        if (srvPriceError) setSrvPriceError(null);
                      }}
                      required
                    />
                    {srvPriceError && <span className="text-xs text-danger font-bold mt-1 block">{srvPriceError}</span>}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Duração (Minutos)</label>
                    <select
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium cursor-pointer"
                      value={srvDuration}
                      onChange={(e) => setSrvDuration(e.target.value)}
                    >
                      <option value="30">30 minutos</option>
                      <option value="60">60 minutos (1 hora)</option>
                      <option value="90">90 minutos (1.5 horas)</option>
                      <option value="120">120 minutos (2 horas)</option>
                      <option value="180">180 minutos (3 horas)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button type="button" onClick={() => setShowServiceModal(false)} className="btn btn-secondary btn-sm font-bold text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK MODAL */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border bg-surface flex justify-between items-center">
              <h3 className="text-sm font-bold text-text">{editingStockItem ? 'Editar Item' : 'Novo Item'}</h3>
              <button onClick={() => setShowStockModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveStock}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Nome do Produto</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: Cabine LED Volia"
                    value={stockName}
                    onChange={(e) => setStockName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Quantidade Atual</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      value={stockQtd}
                      onChange={(e) => setStockQtd(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Estoque Mínimo (Alerta)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      value={stockMin}
                      onChange={(e) => setStockMin(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button type="button" onClick={() => setShowStockModal(false)} className="btn btn-secondary btn-sm font-bold text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
