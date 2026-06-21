import React, { useState } from 'react';
import type { Bill } from '../types/database';

interface ContasPagarViewProps {
  bills: Bill[];
  onSaveBill: (bill: Bill) => void;
  onDeleteBill: (id: string) => void;
}

export const ContasPagarView: React.FC<ContasPagarViewProps> = ({
  bills,
  onSaveBill,
  onDeleteBill,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'Pago' | 'Pendente'>('Pendente');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Pago' | 'Pendente'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Handle Save Bill
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor) return;

    onSaveBill({
      id: 'bill_' + Date.now(),
      descricao,
      valor: parseFloat(valor) || 0,
      dataVencimento,
      status,
      createdAt: new Date().toISOString()
    });

    // Reset Form
    setDescricao('');
    setValor('');
    setDataVencimento(new Date().toISOString().slice(0, 10));
    setStatus('Pendente');
    setShowAddForm(false);
  };

  // Metrics
  const totalPago = bills.filter(b => b.status === 'Pago').reduce((sum, b) => sum + b.valor, 0);
  const totalPendente = bills.filter(b => b.status === 'Pendente').reduce((sum, b) => sum + b.valor, 0);
  const totalGeral = totalPago + totalPendente;

  // Filtered Bills
  const filteredBills = bills
    .filter(b => {
      if (filterStatus === 'Pago') return b.status === 'Pago';
      if (filterStatus === 'Pendente') return b.status === 'Pendente';
      return true;
    })
    .filter(b => b.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

  // Toggle Status Helper
  const handleToggleStatus = (bill: Bill) => {
    onSaveBill({
      ...bill,
      status: bill.status === 'Pago' ? 'Pendente' : 'Pago'
    });
  };

  function fmtMoney(val: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }

  function fmtDate(isoDate: string): string {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="space-y-6">
      
      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-success-lt/5 border border-success/15 p-5 rounded-lg">
          <span className="text-[10px] font-bold text-success uppercase tracking-wider block">Total Pago</span>
          <h2 className="text-2xl font-extrabold text-success mt-1">{fmtMoney(totalPago)}</h2>
          <span className="text-[10px] text-text-muted block mt-1">Contas já quitadas</span>
        </div>

        <div className="bg-danger-lt/5 border border-danger/15 p-5 rounded-lg">
          <span className="text-[10px] font-bold text-danger uppercase tracking-wider block">Total Pendente</span>
          <h2 className="text-2xl font-extrabold text-danger mt-1">{fmtMoney(totalPendente)}</h2>
          <span className="text-[10px] text-text-muted block mt-1">Vencimentos em aberto</span>
        </div>

        <div className="bg-card border border-border p-5 rounded-lg">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Total Geral</span>
          <h2 className="text-2xl font-extrabold text-text mt-1">{fmtMoney(totalGeral)}</h2>
          <span className="text-[10px] text-text-muted block mt-1">Soma de todas as despesas</span>
        </div>
      </div>

      {/* ACTION & FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 border border-border rounded-lg shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('Todos')}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              filterStatus === 'Todos' ? 'bg-active text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            📋 Todas ({bills.length})
          </button>
          <button
            onClick={() => setFilterStatus('Pendente')}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              filterStatus === 'Pendente' ? 'bg-danger/10 text-danger border border-danger/25' : 'text-text-muted hover:text-text'
            }`}
          >
            ⏳ Pendentes ({bills.filter(b => b.status === 'Pendente').length})
          </button>
          <button
            onClick={() => setFilterStatus('Pago')}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              filterStatus === 'Pago' ? 'bg-success/10 text-success border border-success/25' : 'text-text-muted hover:text-text'
            }`}
          >
            ✓ Pagas ({bills.filter(b => b.status === 'Pago').length})
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🔍 Buscar conta..."
            className="px-3 py-1.5 bg-surface border border-border text-text rounded text-xs outline-none focus:border-primary w-full sm:w-48"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary btn-sm font-bold bg-gradient-to-r from-primary to-primary-hover text-white text-xs whitespace-nowrap"
          >
            + Registrar Conta
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Descrição / Conta</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th className="text-right">Valor</th>
                <th className="text-center" style={{ width: '160px' }}>Baixa</th>
                <th className="text-center" style={{ width: '80px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted italic">
                    Nenhuma conta cadastrada nesta categoria.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const isPaid = bill.status === 'Pago';
                  return (
                    <tr key={bill.id} className={isPaid ? 'opacity-70' : ''}>
                      <td data-label="Descrição / Conta"><strong>{bill.descricao}</strong></td>
                      <td data-label="Vencimento">{fmtDate(bill.dataVencimento)}</td>
                      <td data-label="Status">
                        <span className={`badge ${isPaid ? 'badge-success' : 'badge-danger'}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td data-label="Valor" className={`text-right font-bold ${isPaid ? 'text-text-muted' : 'text-danger'}`}>
                        {fmtMoney(bill.valor)}
                      </td>
                      <td data-label="Baixa" className="text-center">
                        <button
                          onClick={() => handleToggleStatus(bill)}
                          className={`px-3 py-1 text-xs font-semibold rounded transition-all border ${
                            isPaid
                              ? 'bg-surface border-border text-text hover:bg-card'
                              : 'bg-success/10 border-success/20 text-success hover:bg-success/20 font-bold'
                          }`}
                        >
                          {isPaid ? 'Estornar ↺' : 'Marcar como Paga ✓'}
                        </button>
                      </td>
                      <td data-label="Ações" className="text-center">
                        <button
                          onClick={() => {
                            if (confirm('Deseja excluir esta conta?')) onDeleteBill(bill.id);
                          }}
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

      {/* MODAL: ADD BILL */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
              <h3 className="text-sm font-bold text-text">Lançar Nova Conta</h3>
              <button onClick={() => setShowAddForm(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Descrição da Conta / Nome</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: Conta de Luz, Compra de Esmaltes, Aluguel"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Valor a Pagar (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      placeholder="Ex: 150.00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Data de Vencimento</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Status Inicial</label>
                  <select
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium cursor-pointer"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="Pendente">⏳ Pendente</option>
                    <option value="Pago">✓ Pago</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm font-bold text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover">Salvar Conta</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
