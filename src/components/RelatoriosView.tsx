import React, { useState } from 'react';
import type { Client, Service, Appointment, Transaction, ProfessionalSettings } from '../types/database';

interface RelatoriosViewProps {
  transactions: Transaction[];
  clients: Client[];
  services: Service[];
  appointments: Appointment[];
  settings: ProfessionalSettings;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  onQuitDebts: (clientId: string, paymentMethod: string) => void;
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  transactions,
  clients,
  services,
  appointments,
  settings,
  onAddTransaction,
  onDeleteTransaction,
  onQuitDebts
}) => {
  const [activeTab, setActiveTab] = useState<'caixa' | 'relatorios' | 'debitos'>('caixa');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for manual expense
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseVal, setExpenseVal] = useState('');

  // Inline debit quitação states
  const [quittingClientId, setQuittingClientId] = useState<string | null>(null);
  const [quitMethod, setQuitMethod] = useState<string>('Pix');

  // 1. GATHER TRANSACTIONS FOR SELECTED MONTH
  const filteredTransactions = transactions.filter(t => t.data.startsWith(selectedMonth));
  
  // Separation of Recebido vs Pendente (Pagar Depois / sem pagamento) for Cash Flow
  const totalRecebido = filteredTransactions
    .filter(t => t.tipo === 'Receita' && t.paymentMethod && t.paymentMethod !== 'Pagar Depois')
    .reduce((sum, t) => sum + t.valor, 0);

  const totalPendente = filteredTransactions
    .filter(t => t.tipo === 'Receita' && (!t.paymentMethod || t.paymentMethod === 'Pagar Depois'))
    .reduce((sum, t) => sum + t.valor, 0);

  const totalDespesas = filteredTransactions
    .filter(t => t.tipo === 'Despesa')
    .reduce((sum, t) => sum + t.valor, 0);

  const saldoLiquidoReal = totalRecebido - totalDespesas;

  // 2. ADVANCED REPORT CALCULATIONS (RECEBIDO VS PENDENTE)
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Daily Fechamento
  const fatHojeRecebido = transactions
    .filter(t => t.data === todayStr && t.tipo === 'Receita' && t.paymentMethod && t.paymentMethod !== 'Pagar Depois')
    .reduce((sum, t) => sum + t.valor, 0);
  const fatHojePendente = transactions
    .filter(t => t.data === todayStr && t.tipo === 'Receita' && (!t.paymentMethod || t.paymentMethod === 'Pagar Depois'))
    .reduce((sum, t) => sum + t.valor, 0);

  // Weekly faturamento (last 7 days)
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekStr = lastWeekDate.toISOString().slice(0, 10);

  const fatSemanaRecebido = transactions
    .filter(t => t.data >= lastWeekStr && t.data <= todayStr && t.tipo === 'Receita' && t.paymentMethod && t.paymentMethod !== 'Pagar Depois')
    .reduce((sum, t) => sum + t.valor, 0);
  const fatSemanaPendente = transactions
    .filter(t => t.data >= lastWeekStr && t.data <= todayStr && t.tipo === 'Receita' && (!t.paymentMethod || t.paymentMethod === 'Pagar Depois'))
    .reduce((sum, t) => sum + t.valor, 0);

  // Monthly faturamento
  const fatMesRecebido = transactions
    .filter(t => t.data.startsWith(todayStr.slice(0, 7)) && t.tipo === 'Receita' && t.paymentMethod && t.paymentMethod !== 'Pagar Depois')
    .reduce((sum, t) => sum + t.valor, 0);
  const fatMesPendente = transactions
    .filter(t => t.data.startsWith(todayStr.slice(0, 7)) && t.tipo === 'Receita' && (!t.paymentMethod || t.paymentMethod === 'Pagar Depois'))
    .reduce((sum, t) => sum + t.valor, 0);

  // Faturamento por meio de pagamento (exclui fiado ou mostra proporcional)
  const payMethods = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Pagar Depois'];
  const payMethodTotals = payMethods.map(method => {
    const total = transactions
      .filter(t => t.tipo === 'Receita' && t.paymentMethod === method)
      .reduce((sum, t) => sum + t.valor, 0);
    return { method, total };
  });
  const totalIncomeAllTime = payMethodTotals.reduce((sum, m) => sum + m.total, 0) || 1;

  // Ranking "Qual Cliente Rende Mais" (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);
  
  const clientRevenueMap: { [id: string]: number } = {};
  appointments
    .filter(a => a.status === 'Concluído' && a.data >= sixMonthsAgoStr)
    .forEach(a => {
      clientRevenueMap[a.clientId] = (clientRevenueMap[a.clientId] || 0) + a.valor;
    });

  const clientRanking = Object.entries(clientRevenueMap)
    .map(([clientId, total]) => {
      const client = clients.find(c => c.id === clientId);
      return { nome: client ? client.nome : 'Cliente Inativa', total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Ranking "Qual Serviço Rende Mais"
  const serviceStatsMap: { [id: string]: { totalRevenue: number; volume: number } } = {};
  appointments
    .filter(a => a.status === 'Concluído')
    .forEach(a => {
      if (!serviceStatsMap[a.serviceId]) {
        serviceStatsMap[a.serviceId] = { totalRevenue: 0, volume: 0 };
      }
      serviceStatsMap[a.serviceId].totalRevenue += a.valor;
      serviceStatsMap[a.serviceId].volume += 1;
    });

  const serviceRanking = Object.entries(serviceStatsMap)
    .map(([serviceId, stats]) => {
      const srv = services.find(s => s.id === serviceId);
      return { nome: srv ? srv.nome : 'Procedimento Geral', ...stats };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Churn / Clientes Sumidas (No appointments for 30+ days)
  const daysDiff = (d1: string, d2: string) => {
    const timeDiff = Math.abs(new Date(d1).getTime() - new Date(d2).getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const clientLastVisitMap: { [clientId: string]: string } = {};
  appointments
    .filter(a => a.status === 'Concluído')
    .forEach(a => {
      if (!clientLastVisitMap[a.clientId] || a.data > clientLastVisitMap[a.clientId]) {
        clientLastVisitMap[a.clientId] = a.data;
      }
    });

  const churnClients = clients
    .map(c => {
      const lastVisit = clientLastVisitMap[c.id];
      const days = lastVisit ? daysDiff(todayStr, lastVisit) : 999;
      return { client: c, lastVisit, days };
    })
    .filter(item => item.days >= 30)
    .sort((a, b) => b.days - a.days);

  const handleRescueClient = (c: Client) => {
    const bizSuffix = settings.nomeNegocio ? ` \u2014 *${settings.nomeNegocio}*` : '';
    const profPrefix = settings.nomeProfissional ? `Olá, aqui é a *${settings.nomeProfissional}*! Saudades de você e das suas unhas. \u{2728}\u{1F485}\n` : `Olá, *${c.nome}*! Saudades de você e das suas unhas. \u{2728}\u{1F485}\n`;
    const text = `${profPrefix}Passando para saber se gostaria de agendar uma manutenção ou alongamento para os próximos dias? Vamos deixar suas unhas lindas e brilhantes novamente! Vamos marcar?${bizSuffix} \u{1F970}`;
    const cleanPhone = c.celular.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  // Group pending debits by client
  const clientDebts: { [clientId: string]: { client: Client; total: number; transactions: Transaction[] } } = {};
  
  transactions
    .filter(t => t.tipo === 'Receita' && (t.paymentMethod === 'Pagar Depois' || !t.paymentMethod))
    .forEach(t => {
      const apt = appointments.find(a => a.id === t.appointmentId);
      if (apt) {
        const client = clients.find(c => c.id === apt.clientId);
        if (client) {
          if (!clientDebts[client.id]) {
            clientDebts[client.id] = { client, total: 0, transactions: [] };
          }
          clientDebts[client.id].total += t.valor;
          clientDebts[client.id].transactions.push(t);
        }
      }
    });

  const debitList = Object.values(clientDebts).sort((a, b) => b.total - a.total);

  // Send WhatsApp debit reminder
  const handleSendDebitMessage = (c: Client, value: number) => {
    const bizSuffix = settings.nomeNegocio ? ` \u2014 *${settings.nomeNegocio}*` : '';
    const profPrefix = settings.nomeProfissional ? `Olá, aqui é a *${settings.nomeProfissional}*! \u{2728}\n` : `Olá, *${c.nome}*! \u{2728}\n`;
    const text = `${profPrefix}Passando para lembrar que você possui um valor em aberto pendente de *${fmtMoney(value)}* referente aos seus atendimentos.\nCaso queira efetuar o pagamento por Pix ou outro método, me avise para eu poder dar baixa na sua ficha. Agradeço!${bizSuffix} \u{1F970}\u{1F485}`;
    const cleanPhone = c.celular.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleConfirmQuitação = (clientId: string) => {
    onQuitDebts(clientId, quitMethod);
    setQuittingClientId(null);
  };

  // Months generator for filters
  const uniqueMonths = new Set<string>();
  uniqueMonths.add(todayStr.slice(0, 7));
  transactions.forEach(t => uniqueMonths.add(t.data.slice(0, 7)));
  const monthOptions = [...uniqueMonths].sort().reverse();

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseVal) return;
    onAddTransaction({
      data: expenseDate,
      tipo: 'Despesa',
      descricao: expenseDesc,
      valor: parseFloat(expenseVal) || 0
    });
    setExpenseDesc('');
    setExpenseVal('');
    setShowAddModal(false);
  };

  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let content = '';
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const timeStr = new Date().toLocaleTimeString('pt-BR');
    const businessName = settings.nomeNegocio || 'NailArt Pro';

    if (activeTab === 'caixa') {
      const [y, mo] = selectedMonth.split('-');
      const monthName = new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const rows = filteredTransactions
        .sort((a,b) => b.data.localeCompare(a.data))
        .map(t => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px;">${fmtDate(t.data)}</td>
            <td style="padding: 8px;">${t.tipo}</td>
            <td style="padding: 8px; font-weight: bold;">${t.descricao}</td>
            <td style="padding: 8px;">${t.paymentMethod || '—'}</td>
            <td style="padding: 8px; text-align: right; color: ${t.tipo === 'Receita' ? (t.paymentMethod === 'Pagar Depois' || !t.paymentMethod ? '#cca652' : '#5eb38d') : '#d46161'}; font-weight: bold;">
              ${t.tipo === 'Receita' ? '+' : '-'} ${fmtMoney(t.valor)}
            </td>
          </tr>
        `).join('');

      content = `
        <h1>Fluxo de Caixa - ${monthName}</h1>
        <h3>${businessName}</h3>
        <p>Gerado em: ${dateStr} ${timeStr}</p>
        <div style="margin: 20px 0; background: #f9f9f9; padding: 15px; border-radius: 8px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          <div><strong>Recebido:</strong> ${fmtMoney(totalRecebido)}</div>
          <div><strong>Pendente:</strong> ${fmtMoney(totalPendente)}</div>
          <div><strong>Despesas:</strong> ${fmtMoney(totalDespesas)}</div>
          <div><strong>Saldo Líquido Real:</strong> ${fmtMoney(saldoLiquidoReal)}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Data</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Tipo</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Descrição</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Método</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhuma movimentação.</td></tr>'}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'relatorios') {
      const topClientsRows = clientRanking.map((c, i) => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px; font-weight: bold;">#${i+1} ${c.nome}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: #5eb38d;">${fmtMoney(c.total)}</td>
        </tr>
      `).join('');

      const topServicesRows = serviceRanking.map((s, i) => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px; font-weight: bold;">#${i+1} ${s.nome} (${s.volume} atendimentos)</td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: #d9929c;">${fmtMoney(s.totalRevenue)}</td>
        </tr>
      `).join('');

      const churnRows = churnClients.map(item => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>${item.client.nome}</strong></td>
          <td style="padding: 8px;">${item.client.celular}</td>
          <td style="padding: 8px;">${item.lastVisit ? fmtDate(item.lastVisit) : 'Nunca'} (${item.days} dias atrás)</td>
        </tr>
      `).join('');

      content = `
        <h1>Relatórios Avançados de Faturamento e Desempenho</h1>
        <h3>${businessName}</h3>
        <p>Gerado em: ${dateStr} ${timeStr}</p>
        
        <h2>1. Fechamento de Faturamento</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="padding: 8px; text-align: left;">Período</th>
              <th style="padding: 8px; text-align: right;">Recebido</th>
              <th style="padding: 8px; text-align: right;">Pendente (Fiado)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Hoje</td><td style="padding: 8px; text-align: right;">${fmtMoney(fatHojeRecebido)}</td><td style="padding: 8px; text-align: right;">${fmtMoney(fatHojePendente)}</td></tr>
            <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Últimos 7 dias</td><td style="padding: 8px; text-align: right;">${fmtMoney(fatSemanaRecebido)}</td><td style="padding: 8px; text-align: right;">${fmtMoney(fatSemanaPendente)}</td></tr>
            <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Este Mês</td><td style="padding: 8px; text-align: right;">${fmtMoney(fatMesRecebido)}</td><td style="padding: 8px; text-align: right;">${fmtMoney(fatMesPendente)}</td></tr>
          </tbody>
        </table>

        <h2>2. Faturamento por Meio de Pagamento</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="padding: 8px; text-align: left;">Meio de Pagamento</th>
              <th style="padding: 8px; text-align: right;">Valor Acumulado</th>
            </tr>
          </thead>
          <tbody>
            ${payMethodTotals.map(item => `<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">${item.method}</td><td style="padding: 8px; text-align: right;">${fmtMoney(item.total)}</td></tr>`).join('')}
          </tbody>
        </table>

        <h2>3. Ranking de Clientes (Últimos 6 meses)</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tbody>${topClientsRows || '<tr><td>Nenhum registro.</td></tr>'}</tbody>
        </table>

        <h2>4. Serviços Mais Rentáveis</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tbody>${topServicesRows || '<tr><td>Nenhum registro.</td></tr>'}</tbody>
        </table>

        <h2>5. Alerta de Churn (Clientes Sumidas a +30 dias)</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="padding: 8px; text-align: left;">Cliente</th>
              <th style="padding: 8px; text-align: left;">Celular</th>
              <th style="padding: 8px; text-align: left;">Última Visita</th>
            </tr>
          </thead>
          <tbody>${churnRows || '<tr><td colspan="3">Nenhuma cliente sumida.</td></tr>'}</tbody>
        </table>
      `;
    } else if (activeTab === 'debitos') {
      const rows = debitList.map(item => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px; font-weight: bold;">${item.client.nome}</td>
          <td style="padding: 8px;">${item.client.celular}</td>
          <td style="padding: 8px; font-weight: bold; color: #cca652;">${fmtMoney(item.total)}</td>
        </tr>
      `).join('');

      content = `
        <h1>Relatório de Valores Pendentes (Fiados / Débitos)</h1>
        <h3>${businessName}</h3>
        <p>Gerado em: ${dateStr} ${timeStr}</p>
        <div style="margin: 20px 0; background: #fff5f5; padding: 15px; border-radius: 8px; font-weight: bold; color: #c53030;">
          Total Geral de Débitos Pendentes: ${fmtMoney(debitList.reduce((sum, item) => sum + item.total, 0))}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Cliente</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Celular / WhatsApp</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Valor Total Devido</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="3" style="text-align: center; padding: 20px;">Nenhum débito pendente.</td></tr>'}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório - ${businessName}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; line-height: 1.4; }
            h1, h2 { color: #d16f7d; margin-top: 20px; }
            h1 { border-bottom: 2px solid #d16f7d; padding-bottom: 10px; margin-bottom: 5px; }
            h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; }
            .footer { margin-top: 50px; font-size: 11px; color: #777; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; }
          </style>
        </head>
        <body>
          ${content}
          <div class="footer">${businessName} &mdash; NailArt Pro</div>
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

  const exportExcel = () => {
    let csvContent = '';
    let filename = '';
    const businessName = settings.nomeNegocio || 'NailArt Pro';

    if (activeTab === 'caixa') {
      const [y, mo] = selectedMonth.split('-');
      const monthName = new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      filename = `Fluxo_de_Caixa_${businessName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.csv`;

      // Headers
      const headers = ['Data', 'Tipo', 'Descricao', 'Metodo de Pagamento', 'Valor (R$)'];
      const rows = filteredTransactions.map(t => [
        t.data,
        t.tipo,
        t.descricao.replace(/,/g, ';'),
        t.paymentMethod || '',
        t.valor.toFixed(2)
      ]);
      
      csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    } else if (activeTab === 'relatorios') {
      filename = `Relatorios_Avancados_${businessName.replace(/\s+/g, '_')}.csv`;
      
      const sections = [
        ['--- 1. FECHAMENTO DE FATURAMENTO ---'],
        ['Periodo', 'Recebido (R$)', 'Pendente (R$)'],
        ['Hoje', fatHojeRecebido.toFixed(2), fatHojePendente.toFixed(2)],
        ['Ultimos 7 dias', fatSemanaRecebido.toFixed(2), fatSemanaPendente.toFixed(2)],
        ['Este Mes', fatMesRecebido.toFixed(2), fatMesPendente.toFixed(2)],
        [''],
        ['--- 2. FATURAMENTO POR MEIO DE PAGAMENTO ---'],
        ['Meio de Pagamento', 'Valor Total (R$)'],
        ...payMethodTotals.map(item => [item.method, item.total.toFixed(2)]),
        [''],
        ['--- 3. RANKING DE CLIENTES (Ultimos 6 meses) ---'],
        ['Rank', 'Cliente', 'Total Rendido (R$)'],
        ...clientRanking.map((c, i) => [`#${i+1}`, c.nome, c.total.toFixed(2)]),
        [''],
        ['--- 4. SERVICOS MAIS RENTAVEIS ---'],
        ['Rank', 'Servico', 'Volume (Saidas)', 'Total Rendido (R$)'],
        ...serviceRanking.map((s, i) => [`#${i+1}`, s.nome, s.volume.toString(), s.totalRevenue.toFixed(2)]),
        [''],
        ['--- 5. ALERTA DE CHURN (Clientes Sumidas a +30 dias) ---'],
        ['Cliente', 'WhatsApp', 'Dias Sem Agendamento', 'Ultima Visita'],
        ...churnClients.map(item => [item.client.nome, item.client.celular, item.days.toString(), item.lastVisit || 'Nunca'])
      ];

      csvContent = sections.map(e => e.join(',')).join('\n');
    } else if (activeTab === 'debitos') {
      filename = `Debitos_Pendentes_${businessName.replace(/\s+/g, '_')}.csv`;
      const headers = ['Cliente', 'Celular / WhatsApp', 'Valor Total Devido (R$)'];
      const rows = debitList.map(item => [
        item.client.nome,
        item.client.celular,
        item.total.toFixed(2)
      ]);
      csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    }

    // Add BOM for Excel UTF-8 display compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportWhatsApp = () => {
    const businessName = settings.nomeNegocio || 'NailArt Pro';
    let text = `*RELATÓRIO FINANCEIRO - ${businessName.toUpperCase()}*\n`;
    text += `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n\n`;

    if (activeTab === 'caixa') {
      const [y, mo] = selectedMonth.split('-');
      const monthName = new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      text += `\u{1F4C5} *Fluxo de Caixa (${monthName.toUpperCase()})*\n`;
      text += `==================================\n`;
      text += `\u{1F4B0} *Recebido:* ${fmtMoney(totalRecebido)}\n`;
      text += `\u{23F3} *Pendente:* ${fmtMoney(totalPendente)}\n`;
      text += `\u{274C} *Despesas:* ${fmtMoney(totalDespesas)}\n`;
      text += `\u{1F4C8} *Saldo Líquido Real:* ${fmtMoney(saldoLiquidoReal)}\n\n`;
      text += `*Últimas 5 Movimentações:*\n`;
      
      filteredTransactions
        .sort((a,b) => b.data.localeCompare(a.data))
        .slice(0, 5)
        .forEach(t => {
          const sign = t.tipo === 'Receita' ? '\u{1F7E2}' : '\u{1F534}';
          text += `${sign} *${fmtDate(t.data)}* - ${t.descricao}: _${fmtMoney(t.valor)}_\n`;
        });
    } else if (activeTab === 'relatorios') {
      text += `\u{1F4CA} *Relatórios Avançados*\n`;
      text += `==================================\n`;
      text += `*1. Resumo de Faturamento:*\n`;
      text += `• Hoje: Ganhos: ${fmtMoney(fatHojeRecebido)} (Pend: ${fmtMoney(fatHojePendente)})\n`;
      text += `• Últimos 7 dias: Ganhos: ${fmtMoney(fatSemanaRecebido)} (Pend: ${fmtMoney(fatSemanaPendente)})\n`;
      text += `• Este Mês: Ganhos: ${fmtMoney(fatMesRecebido)} (Pend: ${fmtMoney(fatMesPendente)})\n\n`;
      
      text += `*2. Ranking de Serviços (Top 3):*\n`;
      serviceRanking.slice(0, 3).forEach((s, idx) => {
        text += `• #${idx+1} ${s.nome} (${s.volume}x) - _${fmtMoney(s.totalRevenue)}_\n`;
      });
      text += `\n`;
      
      text += `*3. Ranking de Clientes (Top 3):*\n`;
      clientRanking.slice(0, 3).forEach((c, idx) => {
        text += `• #${idx+1} ${c.nome} - _${fmtMoney(c.total)}_\n`;
      });
      text += `\n`;
 
      text += `\u{1F494} *Clientes Sumidas (>30 dias):* ${churnClients.length} em risco.`;
    } else if (activeTab === 'debitos') {
      const totalDebitoTotal = debitList.reduce((sum, item) => sum + item.total, 0);
      text += `\u{1F4B8} *Relatório de Débitos Pendentes*\n`;
      text += `==================================\n`;
      text += `\u{26A0}\u{FE0F} *Total Pendente Acumulado:* ${fmtMoney(totalDebitoTotal)}\n\n`;
      
      debitList.forEach((item, idx) => {
        text += `• #${idx+1} *${item.client.nome}*: ${fmtMoney(item.total)} (${item.client.celular})\n`;
      });
    }

    const managerPhone = settings.telefone ? settings.telefone.replace(/\D/g, '') : '';
    if (!managerPhone) {
      alert('Aviso: Nenhum telefone de gestor cadastrado nas Configurações! A mensagem será aberta para compartilhamento geral.');
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?phone=55${managerPhone}&text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* FINANCE NAV TABS */}
        <div className="flex flex-row gap-1.5 p-1 bg-card border border-border rounded-md w-full lg:max-w-lg">
          <button
            onClick={() => setActiveTab('caixa')}
            className={`flex-1 py-2 text-xs font-bold rounded transition-all text-center truncate ${
              activeTab === 'caixa' ? 'bg-active text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            💰 <span className="hidden sm:inline">Fluxo de </span>Caixa
          </button>
          <button
            onClick={() => setActiveTab('relatorios')}
            className={`flex-1 py-2 text-xs font-bold rounded transition-all text-center truncate ${
              activeTab === 'relatorios' ? 'bg-active text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            📊 <span className="hidden sm:inline">Relatórios </span>Avançados
          </button>
          <button
            onClick={() => setActiveTab('debitos')}
            className={`flex-1 py-2 text-xs font-bold rounded transition-all text-center truncate relative ${
              activeTab === 'debitos' ? 'bg-active text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            💸 Débitos<span className="hidden sm:inline"> em Aberto</span>
            {debitList.length > 0 && (
              <span className="ml-1 px-1 bg-danger/25 text-danger text-[9px] uppercase font-bold rounded-sm inline-block">
                {debitList.length}
              </span>
            )}
          </button>
        </div>

        {/* EXPORT BUTTONS */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-card p-2 border border-border rounded-md w-full lg:w-auto">
          <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider px-1 text-center sm:text-left">Exportar:</span>
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
            <button
              onClick={exportPDF}
              className="px-2 py-2 bg-surface border border-border hover:border-border-hover text-text hover:text-primary text-xs font-bold rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Visualizar para Impressão / Salvar PDF"
            >
              📄 PDF
            </button>
            <button
              onClick={exportExcel}
              className="px-2 py-2 bg-surface border border-border hover:border-border-hover text-text hover:text-primary text-xs font-bold rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Baixar Planilha Excel/CSV"
            >
              📊 Excel
            </button>
            <button
              onClick={exportWhatsApp}
              className="px-2 py-2 bg-surface border border-border hover:border-border-hover text-text hover:text-success text-xs font-bold rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Enviar para o WhatsApp do Gestor"
            >
              📱 WhatsApp
            </button>
          </div>
        </div>
      </div>


      {activeTab === 'caixa' && (
        /* ==================== CAIXA VIEW ==================== */
        <>
          {/* STATS BLOCK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-success-lt/5 border border-success/15 p-5 rounded-lg">
              <span className="text-[10px] font-bold text-success uppercase tracking-wider block">Faturamento Recebido</span>
              <h2 className="text-2xl font-extrabold text-success mt-1">{fmtMoney(totalRecebido)}</h2>
              <span className="text-[10px] text-text-muted block mt-1">Ganhos efetivos em mãos</span>
            </div>
            
            <div className="bg-warning-lt/5 border border-warning/15 p-5 rounded-lg">
              <span className="text-[10px] font-bold text-warning uppercase tracking-wider block">Faturamento Pendente</span>
              <h2 className="text-2xl font-extrabold text-warning mt-1">{fmtMoney(totalPendente)}</h2>
              <span className="text-[10px] text-text-muted block mt-1">Valores fiados (Pagar Depois)</span>
            </div>

            <div className="bg-danger-lt/5 border border-danger/15 p-5 rounded-lg">
              <span className="text-[10px] font-bold text-danger uppercase tracking-wider block">Despesas</span>
              <h2 className="text-2xl font-extrabold text-danger mt-1">{fmtMoney(totalDespesas)}</h2>
              <span className="text-[10px] text-text-muted block mt-1">Custos no mês selecionado</span>
            </div>

            <div className="bg-card border border-border p-5 rounded-lg">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Saldo Líquido Real</span>
              <h2 className={`text-2xl font-extrabold mt-1 ${saldoLiquidoReal >= 0 ? 'text-success' : 'text-danger'}`}>
                {fmtMoney(saldoLiquidoReal)}
              </h2>
              <span className="text-[10px] text-text-muted block mt-1">Recebido - Despesas</span>
            </div>
          </div>

          {/* ACTIONS AND FILTERS */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-card p-4 border border-border rounded-lg shadow-sm">
            <select
              className="px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none text-sm cursor-pointer w-full sm:w-auto text-center"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(m => {
                const [y, mo] = m.split('-');
                const name = new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{name}</option>;
              })}
            </select>
            <button
              onClick={() => {
                setExpenseDate(todayStr);
                setShowAddModal(true);
              }}
              className="btn btn-primary btn-sm font-bold bg-gradient-to-r from-primary to-primary-hover shadow-md text-white text-xs w-full sm:w-auto py-2 px-3"
            >
              + Registrar Despesa
            </button>
          </div>

          {/* TABLE OF TRANSACTIONS */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Método</th>
                    <th className="text-right">Valor</th>
                    <th className="text-center" style={{ width: '80px' }}>Excluir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-text-muted italic">
                        Nenhuma movimentação financeira neste mês.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions
                      .sort((a,b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
                      .map(t => {
                        const isIncome = t.tipo === 'Receita';
                        const isPending = t.paymentMethod === 'Pagar Depois' || !t.paymentMethod;
                        return (
                          <tr key={t.id}>
                            <td data-label="Data">{fmtDate(t.data)}</td>
                            <td data-label="Tipo">
                              <span className={`badge ${isIncome ? (isPending ? 'badge-warning' : 'badge-success') : 'badge-danger'}`}>
                                {isPending ? 'Pendente' : t.tipo}
                              </span>
                            </td>
                            <td data-label="Descrição"><strong>{t.descricao}</strong></td>
                            <td data-label="Método" className="text-muted">{t.paymentMethod || '—'}</td>
                            <td data-label="Valor" className={`text-right font-bold ${isIncome ? (isPending ? 'text-warning' : 'text-success') : 'text-danger'}`}>
                              {isIncome ? '+' : '-'} {fmtMoney(t.valor)}
                            </td>
                            <td data-label="Excluir" className="text-center">
                              <button
                                onClick={() => onDeleteTransaction(t.id)}
                                className="text-text-muted hover:text-danger text-sm"
                                title="Excluir"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'relatorios' && (
        /* ==================== REPORTS VIEW ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* 1. REPORT FECHAMENTO (PERIOD) */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-text border-b border-border pb-3">📊 1. Relatório de Fechamento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
              <div className="bg-surface border border-border p-3.5 rounded">
                <span className="text-xs text-text-muted font-bold block uppercase tracking-wider">Hoje</span>
                <span className="text-sm font-extrabold text-success block mt-1.5">{fmtMoney(fatHojeRecebido)} rec.</span>
                {fatHojePendente > 0 && <span className="text-xs font-bold text-warning block mt-0.5">{fmtMoney(fatHojePendente)} pend.</span>}
              </div>
              <div className="bg-surface border border-border p-3.5 rounded">
                <span className="text-xs text-text-muted font-bold block uppercase tracking-wider">Últimos 7 dias</span>
                <span className="text-sm font-extrabold text-success block mt-1.5">{fmtMoney(fatSemanaRecebido)} rec.</span>
                {fatSemanaPendente > 0 && <span className="text-xs font-bold text-warning block mt-0.5">{fmtMoney(fatSemanaPendente)} pend.</span>}
              </div>
              <div className="bg-surface border border-border p-3.5 rounded">
                <span className="text-xs text-text-muted font-bold block uppercase tracking-wider">Este Mês</span>
                <span className="text-sm font-extrabold text-success block mt-1.5">{fmtMoney(fatMesRecebido)} rec.</span>
                {fatMesPendente > 0 && <span className="text-xs font-bold text-warning block mt-0.5">{fmtMoney(fatMesPendente)} pend.</span>}
              </div>
            </div>
          </div>

          {/* 2. PAYMENT METHODS PERCENTAGE CHART */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-text border-b border-border pb-3">💳 2. Faturamento por Meio de Pagamento</h3>
            <div className="space-y-3">
              {payMethodTotals.map(item => {
                const pct = totalIncomeAllTime > 0 ? (item.total / totalIncomeAllTime) * 100 : 0;
                return (
                  <div key={item.method} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{item.method}</span>
                      <span className="text-text-muted">{fmtMoney(item.total)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2.5 bg-surface rounded-full overflow-hidden border border-border">
                      <div className={`h-full rounded-full ${item.method === 'Pagar Depois' ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. RANKING CLIENT REVENUE */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-text border-b border-border pb-3">👑 3. Quem Rende Mais (Últimos 6 meses)</h3>
            <div className="space-y-2">
              {clientRanking.length === 0 ? (
                <p className="text-xs text-text-muted italic text-center py-4">Sem dados de atendimentos.</p>
              ) : (
                clientRanking.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-surface p-2 border border-border rounded">
                    <span>🏆 <strong>#{idx+1} {item.nome}</strong></span>
                    <span className="text-success font-bold">{fmtMoney(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. RANKING SERVICES */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-text border-b border-border pb-3">💅 4. Serviços Mais Rentáveis</h3>
            <div className="space-y-2">
              {serviceRanking.length === 0 ? (
                <p className="text-xs text-text-muted italic text-center py-4">Sem dados de atendimentos.</p>
              ) : (
                serviceRanking.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-surface p-2 border border-border rounded">
                    <div>
                      <div className="font-semibold text-text">{item.nome}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">Volume: {item.volume} saídas</div>
                    </div>
                    <span className="text-primary font-bold">{fmtMoney(item.totalRevenue)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 5. CLIENTES SUMIDAS (CHURN 30+ DAYS) */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3 md:col-span-2">
            <h3 className="text-sm font-bold text-text border-b border-border pb-3 flex flex-col sm:flex-row gap-1.5 justify-between items-start sm:items-center">
              <span>💔 5. Clientes Sumidas (Alerta de Churn)</span>
              <span className="badge badge-danger text-[10px] sm:text-xs">{churnClients.length} clientes em risco</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {churnClients.length === 0 ? (
                <p className="text-xs text-text-muted italic text-center py-8 col-span-2">Nenhuma cliente sumida.</p>
              ) : (
                churnClients.map(item => (
                  <div key={item.client.id} className="bg-surface border border-border p-3 rounded-md flex justify-between items-center gap-3">
                    <div className="text-xs min-w-0">
                      <div className="font-bold text-text truncate">{item.client.nome}</div>
                      <div className="text-text-muted mt-0.5">
                        Última visita: {item.lastVisit ? fmtDate(item.lastVisit) : 'Nunca'} ({item.days} dias atrás)
                      </div>
                    </div>
                    <button
                      onClick={() => handleRescueClient(item.client)}
                      className="p-1 px-2.5 bg-primary text-white text-[10px] font-bold rounded shadow hover:opacity-90 transition-all flex-shrink-0"
                    >
                      Resgatar 📱
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'debitos' && (
        /* ==================== DEBITS VIEW ==================== */
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-text">Clientes com Valores Pendentes (Fiado)</h3>
              <p className="text-xs text-text-muted mt-0.5">Gerenciamento de cobrança e baixa de débitos em aberto.</p>
            </div>
            <span className="badge badge-danger">{debitList.length} clientes devendo</span>
          </div>

          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp / Celular</th>
                  <th>Valor Total Pendente</th>
                  <th className="text-center" style={{ width: '220px' }}>Ações / Quitação</th>
                </tr>
              </thead>
              <tbody>
                {debitList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-text-muted italic">
                      ✨ Parabéns! Nenhum cliente com débitos em aberto.
                    </td>
                  </tr>
                ) : (
                  debitList.map(item => {
                    const isQuitting = quittingClientId === item.client.id;
                    return (
                      <tr key={item.client.id}>
                        <td data-label="Cliente"><strong>{item.client.nome}</strong></td>
                        <td data-label="WhatsApp / Celular">
                          <div className="flex items-center gap-2">
                            <span>{item.client.celular}</span>
                            <button
                              onClick={() => handleSendDebitMessage(item.client, item.total)}
                              className="px-1.5 py-0.5 bg-success/10 text-success border border-success/20 text-[10px] font-bold rounded hover:bg-success/15"
                              title="Enviar cobrança amigável no WhatsApp"
                            >
                              📱 Cobrar
                            </button>
                          </div>
                        </td>
                        <td data-label="Valor Total Pendente" className="text-warning font-extrabold text-sm">{fmtMoney(item.total)}</td>
                        <td data-label="Ações / Quitação" className="text-center">
                          {isQuitting ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <select
                                className="px-2 py-1 bg-surface border border-border text-text rounded text-xs outline-none cursor-pointer font-semibold"
                                value={quitMethod}
                                onChange={(e) => setQuitMethod(e.target.value)}
                              >
                                {['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', ...(settings.customPaymentMethods || [])].map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleConfirmQuitação(item.client.id)}
                                className="px-2.5 py-1 bg-success text-white text-xs font-bold rounded hover:opacity-90"
                                title="Confirmar Recebimento"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setQuittingClientId(null)}
                                className="px-2.5 py-1 bg-surface border border-border text-text-muted text-xs rounded hover:text-text"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setQuitMethod('Pix');
                                setQuittingClientId(item.client.id);
                              }}
                              className="btn btn-secondary btn-xs text-xs font-semibold px-3 py-1 border border-border text-primary hover:text-primary-hover"
                            >
                              💰 Quitar Débito
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD MANUAL EXPENSE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
              <h3 className="text-sm font-bold text-text">Registrar Despesa</h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveExpense}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Data</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Descrição</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: Compra de Cabine LED, Aluguel do Espaço"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Valor Pago (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: 120.00"
                    value={expenseVal}
                    onChange={(e) => setExpenseVal(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm font-bold text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

function fmtDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
