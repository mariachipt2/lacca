import React, { useState } from 'react';
import type { AuditLog } from '../types/database';

interface LogsViewProps {
  logs: AuditLog[];
}

export const LogsView: React.FC<LogsViewProps> = ({ logs }) => {
  // Filter states
  const [search, setSearch] = useState('');
  const [userEmailFilter, setUserEmailFilter] = useState('');
  const [acaoFilter, setAcaoFilter] = useState('');
  const [entidadeFilter, setEntidadeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Extract unique emails for the email filter
  const uniqueEmails = Array.from(new Set(logs.map(l => l.userEmail))).filter(Boolean).sort();

  // Reset filters
  const handleClearFilters = () => {
    setSearch('');
    setUserEmailFilter('');
    setAcaoFilter('');
    setEntidadeFilter('');
    setStartDate('');
    setEndDate('');
  };

  // Filter logic
  const filteredLogs = logs.filter(log => {
    // 1. Search term (in details or email)
    if (search && !log.detalhes.toLowerCase().includes(search.toLowerCase()) && !log.userEmail.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    // 2. User Email filter
    if (userEmailFilter && log.userEmail !== userEmailFilter) {
      return false;
    }

    // 3. Action filter
    if (acaoFilter && log.acao !== acaoFilter) {
      return false;
    }

    // 4. Entity filter
    if (entidadeFilter && log.entidade !== entidadeFilter) {
      return false;
    }

    // 5. Start date filter
    if (startDate) {
      const logDate = log.createdAt.substring(0, 10); // YYYY-MM-DD
      if (logDate < startDate) return false;
    }

    // 6. End date filter
    if (endDate) {
      const logDate = log.createdAt.substring(0, 10); // YYYY-MM-DD
      if (logDate > endDate) return false;
    }

    return true;
  });

  // Get color for action tag
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'Criação':
        return 'bg-success-lt text-success border-success/20';
      case 'Edição':
        return 'bg-warning-lt text-warning border-warning/20';
      case 'Exclusão':
        return 'bg-danger-lt text-danger border-danger/20';
      default:
        return 'bg-active text-text-muted border-border';
    }
  };

  // Get color for entity tag
  const getEntityBadgeColor = (entity: string) => {
    switch (entity) {
      case 'Cliente':
        return 'bg-primary-lt text-primary border-primary/20';
      case 'Agendamento':
        return 'bg-gold-lt text-gold border-gold/20';
      case 'Serviço':
        return 'border-border text-text-muted bg-active';
      case 'Financeiro':
        return 'bg-success-lt text-success border-success/20';
      case 'Estoque':
        return 'bg-warning-lt text-warning border-warning/20';
      case 'Contas':
        return 'bg-danger-lt text-danger border-danger/20';
      default:
        return 'bg-active text-text border-border';
    }
  };

  // Helper to format JSON payload cleanly
  const formatPayload = (val: any) => {
    if (!val) return 'Nenhum';
    try {
      // Remove sensitive or unnecessary internal fields if needed
      const cleanObj = { ...val };
      delete cleanObj.user_id; // Clean internal user mapping from display
      return JSON.stringify(cleanObj, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            📜 Logs do Sistema
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Histórico completo de alterações e auditoria de ações realizadas pelos usuários.
          </p>
        </div>
        {logs.length > 0 && (
          <button
            onClick={handleClearFilters}
            className="btn btn-secondary btn-sm"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* FILTER PANEL */}
      <div className="bg-card border border-border p-4 rounded-lg shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
        {/* Search Input */}
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Buscar por Texto</label>
          <input
            type="text"
            placeholder="Buscar termo..."
            className="w-full px-3 py-2 bg-bg border border-border text-text rounded-md outline-none focus:border-primary text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* User filter */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Usuário</label>
          <select
            className="w-full px-3 py-2 bg-bg border border-border text-text rounded-md outline-none focus:border-primary text-xs cursor-pointer"
            value={userEmailFilter}
            onChange={(e) => setUserEmailFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {uniqueEmails.map(email => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>

        {/* Action filter */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Ação</label>
          <select
            className="w-full px-3 py-2 bg-bg border border-border text-text rounded-md outline-none focus:border-primary text-xs cursor-pointer"
            value={acaoFilter}
            onChange={(e) => setAcaoFilter(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="Criação">Criação</option>
            <option value="Edição">Edição</option>
            <option value="Exclusão">Exclusão</option>
          </select>
        </div>

        {/* Entity filter */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Entidade</label>
          <select
            className="w-full px-3 py-2 bg-bg border border-border text-text rounded-md outline-none focus:border-primary text-xs cursor-pointer"
            value={entidadeFilter}
            onChange={(e) => setEntidadeFilter(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="Cliente">Cliente</option>
            <option value="Agendamento">Agendamento</option>
            <option value="Serviço">Serviço</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Estoque">Estoque</option>
            <option value="Contas">Contas</option>
          </select>
        </div>

        {/* Date filters */}
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Período (Início - Fim)</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-bg border border-border text-text rounded-md outline-none focus:border-primary text-xs"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-text-muted text-xs">a</span>
            <input
              type="date"
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-bg border border-border text-text rounded-md outline-none focus:border-primary text-xs"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABLE/CARDS FOR LOGS */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <p className="text-sm text-text-muted italic">Nenhum log de auditoria encontrado para os filtros selecionados.</p>
            {logs.length > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-bold text-primary hover:underline hover:opacity-90"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Detalhes</th>
                  <th className="text-center">Valores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map(log => {
                  const logTime = new Date(log.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const hasPayload = log.valorAnterior || log.valorNovo;

                  return (
                    <tr key={log.id} className="hover:bg-active/20 transition-colors">
                      <td data-label="Data/Hora" className="font-semibold text-text whitespace-nowrap text-xs">
                        {logTime}
                      </td>
                      <td data-label="Usuário" className="text-text-muted text-xs truncate max-w-[150px]" title={log.userEmail}>
                        {log.userEmail}
                      </td>
                      <td data-label="Ação" className="whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${getActionBadgeColor(log.acao)}`}>
                          {log.acao}
                        </span>
                      </td>
                      <td data-label="Entidade" className="whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${getEntityBadgeColor(log.entidade)}`}>
                          {log.entidade}
                        </span>
                      </td>
                      <td data-label="Detalhes" className="text-text text-xs font-medium pr-4 break-words">
                        {log.detalhes}
                      </td>
                      <td data-label="Valores" className="text-center whitespace-nowrap">
                        {hasPayload ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn btn-secondary btn-xs bg-active text-xs font-bold hover:bg-border px-2 py-1 transition-all"
                          >
                            🔎 Comparar
                          </button>
                        ) : (
                          <span className="text-[10px] text-text-subtle italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPARISON MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card border border-border w-full max-w-4xl rounded-lg shadow-lg overflow-hidden animate-modal-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface">
              <div>
                <h3 className="font-bold text-text flex items-center gap-2">
                  🔍 Detalhes da Modificação
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">
                  ID do Registro: {selectedLog.registroId}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-text-muted hover:text-text text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Summary details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-active/40 border border-border p-4 rounded-lg">
                <div>
                  <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Usuário</span>
                  <span className="text-xs font-semibold text-text">{selectedLog.userEmail}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Data / Hora</span>
                  <span className="text-xs font-semibold text-text">
                    {new Date(selectedLog.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Ação</span>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border mt-0.5 ${getActionBadgeColor(selectedLog.acao)}`}>
                    {selectedLog.acao}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Entidade</span>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border mt-0.5 ${getEntityBadgeColor(selectedLog.entidade)}`}>
                    {selectedLog.entidade}
                  </span>
                </div>
                <div className="sm:col-span-2 md:col-span-4 border-t border-border/50 pt-2.5 mt-1">
                  <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">Descrição</span>
                  <span className="text-xs text-text font-medium">{selectedLog.detalhes}</span>
                </div>
              </div>

              {/* Side by side payloads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-danger flex items-center gap-1.5">
                    🔴 Estado Anterior (Antes)
                  </h4>
                  <pre className="text-[11px] bg-bg border border-border/60 text-text p-4 rounded-lg overflow-auto max-h-[350px] font-mono leading-relaxed shadow-inner">
                    {formatPayload(selectedLog.valorAnterior)}
                  </pre>
                </div>

                {/* After */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-success flex items-center gap-1.5">
                    🟢 Estado Novo (Depois)
                  </h4>
                  <pre className="text-[11px] bg-bg border border-border/60 text-text p-4 rounded-lg overflow-auto max-h-[350px] font-mono leading-relaxed shadow-inner">
                    {formatPayload(selectedLog.valorNovo)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-border flex justify-end bg-surface">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary text-xs px-5 py-2 font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
