import { supabase } from './supabaseClient';
import type { Bill, ProfessionalSettings } from '../types/database';

export async function lerConfiguracoesGestorDb(userId: string): Promise<ProfessionalSettings> {
  try {
    const { data, error } = await supabase
      .from('professional_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao ler configuracoes do Supabase:', error);
    }

    if (data) {
      return {
        nomeNegocio: data.nome_negocio,
        nomeProfissional: data.nome_profissional,
        telefone: data.telefone,
        customPaymentMethods: data.custom_payment_methods || [],
        dashboardPreferences: {
          showDailyMetrics: data.show_daily_metrics ?? true,
          showFinancialMetrics: data.show_financial_metrics ?? true,
          showCharts: data.show_charts ?? true,
          showAlerts: data.show_alerts ?? true,
        }
      };
    }
  } catch (e) {
    console.error('Erro na leitura de configuracoes:', e);
  }

  // Fallback se não encontrar nada
  return {
    nomeNegocio: 'NailArt Pro',
    nomeProfissional: 'Designer',
    telefone: '11988887777',
    customPaymentMethods: [],
    dashboardPreferences: {
      showDailyMetrics: true,
      showFinancialMetrics: true,
      showCharts: true,
      showAlerts: true,
    }
  };
}

export async function salvarConfiguracoesGestorDb(settings: ProfessionalSettings, userId: string): Promise<void> {
  try {
    const payload = {
      user_id: userId,
      nome_negocio: settings.nomeNegocio,
      nome_profissional: settings.nomeProfissional,
      telefone: settings.telefone,
      custom_payment_methods: settings.customPaymentMethods || [],
      show_daily_metrics: settings.dashboardPreferences.showDailyMetrics,
      show_financial_metrics: settings.dashboardPreferences.showFinancialMetrics,
      show_charts: settings.dashboardPreferences.showCharts,
      show_alerts: settings.dashboardPreferences.showAlerts,
    };

    const { error } = await supabase
      .from('professional_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.error('Erro ao salvar configuracoes no Supabase:', error);
    }
  } catch (e) {
    console.error('Erro ao salvar configuracoes:', e);
  }
}

export async function listarContasPagarDb(userId: string): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('data_vencimento', { ascending: true });

    if (error) {
      console.error('Erro ao listar contas do Supabase:', error);
      return [];
    }

    return (data || []).map(b => ({
      id: b.id,
      descricao: b.descricao,
      valor: parseFloat(b.valor) || 0,
      dataVencimento: b.data_vencimento,
      status: b.status,
      createdAt: b.created_at,
    }));
  } catch (e) {
    console.error('Erro ao buscar contas:', e);
    return [];
  }
}

export async function salvarContaPagarDb(bill: Bill, userId: string): Promise<void> {
  try {
    const payload = {
      id: bill.id,
      user_id: userId,
      descricao: bill.descricao,
      valor: bill.valor,
      data_vencimento: bill.dataVencimento,
      status: bill.status,
      created_at: bill.createdAt,
    };

    const { error } = await supabase
      .from('bills')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Erro ao salvar conta no Supabase:', error);
    }
  } catch (e) {
    console.error('Erro ao salvar conta:', e);
  }
}

export async function excluirContaPagarDb(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir conta no Supabase:', error);
    }
  } catch (e) {
    console.error('Erro ao excluir conta:', e);
  }
}
