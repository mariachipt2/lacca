export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
  createdAt: string;
}

export interface Client {
  id: string;
  nome: string;
  celular: string; // WhatsApp
  dataNascimento?: string; // YYYY-MM-DD
  formatoUnha?: 'Quadrada' | 'Amendoada' | 'Stiletto' | 'Bailarina' | 'Oval' | 'Outro';
  alergias?: string;
  obsTecnicas?: string;
  fotosUnhas?: string[]; // Base64 or local paths representing client nail photo gallery
  createdAt: string;
}

export interface Service {
  id: string;
  nome: string;
  preco: number;
  duracao: number; // in minutes (multiples of 30)
}

export interface Appointment {
  id: string;
  clientId: string;
  serviceId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  valor: number;
  status: 'Agendado' | 'Concluído' | 'Cancelado';
  paymentMethod?: string; // Flexibilized to support custom methods
  obs?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: 'Receita' | 'Despesa';
  descricao: string;
  valor: number;
  appointmentId?: string; // link to completed appointment
  paymentMethod?: string; // Flexibilized to support custom methods
  createdAt: string;
}

export interface Bill {
  id: string;
  descricao: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  status: 'Pago' | 'Pendente';
  createdAt: string;
}

export interface ProfessionalSettings {
  nomeNegocio: string;
  nomeProfissional: string;
  telefone: string; // WhatsApp
  customPaymentMethods: string[];
  dashboardPreferences: {
    showDailyMetrics: boolean;
    showFinancialMetrics: boolean;
    showCharts: boolean;
    showAlerts: boolean;
  };
  workStartHour?: string; // e.g. "08:00"
  workEndHour?: string;   // e.g. "20:00"
}

