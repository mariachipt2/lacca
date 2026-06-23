import React, { useState } from 'react';
import type { Client, Appointment, Service } from '../types/database';
import { validarTelefone, capitalizarNome, validarDataNascimento } from '../utils/validations';

interface ClientesViewProps {
  clients: Client[];
  appointments: Appointment[];
  services: Service[];
  onAddClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  onEditClient: (id: string, client: Omit<Client, 'id' | 'createdAt'>) => void;
  onDeleteClient: (id: string) => void;
  onUploadPhoto: (clientId: string, photoBase64: string) => void;
  onDeletePhoto: (clientId: string, photoIndex: number) => void;
}

export const ClientesView: React.FC<ClientesViewProps> = ({
  clients,
  appointments,
  services,
  onAddClient,
  onEditClient,
  onDeleteClient,
  onUploadPhoto,
  onDeletePhoto
}) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [nailShape, setNailShape] = useState<Client['formatoUnha']>('Amendoada');
  const [allergies, setAllergies] = useState('Nenhuma');
  const [notes, setNotes] = useState('');
  const [birthDateError, setBirthDateError] = useState<string | null>(null);

  const filtered = clients
    .filter(c => 
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.celular.includes(search)
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const selectedClient = clients.find(c => c.id === selectedId) || filtered[0] || null;

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setPhoneError(null);
    setBirthDate('');
    setNailShape('Amendoada');
    setAllergies('Nenhuma');
    setNotes('');
    setBirthDateError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditingId(c.id);
    setName(c.nome);
    setPhone(c.celular);
    setPhoneError(null);
    setBirthDate(c.dataNascimento || '');
    setNailShape(c.formatoUnha || 'Amendoada');
    setAllergies(c.alergias || 'Nenhuma');
    setNotes(c.obsTecnicas || '');
    setBirthDateError(null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const phoneErr = validarTelefone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setPhoneError(null);

    const birthErr = validarDataNascimento(birthDate);
    if (birthErr) {
      setBirthDateError(birthErr);
      return;
    }
    setBirthDateError(null);

    const data = {
      nome: capitalizarNome(name),
      celular: phone,
      dataNascimento: birthDate,
      formatoUnha: nailShape,
      alergias: allergies,
      obsTecnicas: notes
    };

    if (editingId) {
      onEditClient(editingId, data);
    } else {
      onAddClient(data);
    }
    setShowModal(false);
  };

  // Image Upload handler (Base64 file reader)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClient) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadPhoto(selectedClient.id, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Get Client history
  const clientApts = selectedClient
    ? appointments
        .filter(a => a.clientId === selectedClient.id)
        .sort((a, b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora))
    : [];

  const totalSpent = clientApts
    .filter(a => a.status === 'Concluído')
    .reduce((sum, a) => sum + a.valor, 0);

  // Birthday checking
  const thisMonth = new Date().getMonth() + 1; // 1-12
  const anniversariantes = clients.filter(c => {
    if (!c.dataNascimento) return false;
    const birthMonth = parseInt(c.dataNascimento.split('-')[1]);
    return birthMonth === thisMonth;
  });

  const sendBirthdayGreetings = (c: Client) => {
    const text = `Parabéns, *${c.nome}*! 🥳🎉\nDesejamos a você um dia incrível e cheio de luz! Para comemorar seu aniversário, temos um mimo especial de 10% de desconto no seu próximo procedimento conosco neste mês. Vamos agendar seu horário? 💅💖`;
    const cleanPhone = c.celular.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* ANNIVERSARIANTES ALERTS */}
      {anniversariantes.length > 0 && (
        <div className="bg-gradient-to-r from-primary-lt to-gold-lt border border-primary/20 rounded-lg p-4 shadow-sm flex flex-col gap-2">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            🎉 Aniversariantes do Mês ({new Date().toLocaleDateString('pt-BR', { month: 'long' })})
          </h4>
          <div className="flex flex-wrap gap-2 mt-1">
            {anniversariantes.map(c => (
              <div key={c.id} className="bg-card border border-border px-3 py-1.5 rounded-md flex items-center gap-3 text-xs">
                <span>🧁 <strong>{c.nome}</strong> ({c.dataNascimento ? c.dataNascimento.split('-')[2] + '/' + c.dataNascimento.split('-')[1] : ''})</span>
                <button
                  onClick={() => sendBirthdayGreetings(c)}
                  className="p-1 bg-primary text-white rounded text-[10px] font-bold hover:opacity-90 transition-all"
                >
                  📱 Parabéns
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH AND ADD ACTION ROW */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="🔍 Buscar cliente por nome ou WhatsApp..."
          className="flex-1 px-4 py-2.5 bg-card border border-border text-text rounded-md outline-none focus:border-primary text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={handleOpenAdd}
          className="btn btn-primary font-bold bg-gradient-to-r from-primary to-primary-hover shadow-md text-white text-sm w-full sm:w-auto"
        >
          + Cadastrar Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* LIST CARD */}
        <div className="md:col-span-1 bg-card border border-border rounded-lg shadow-sm max-h-[600px] overflow-y-auto">
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8 italic">Nenhuma cliente encontrada.</p>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`px-4 py-3 cursor-pointer transition-all flex flex-col ${
                    selectedClient?.id === c.id ? 'bg-primary-lt border-l-4 border-primary pl-3' : 'hover:bg-surface-active'
                  }`}
                >
                  <span className="font-bold text-sm text-text">{c.nome}</span>
                  <span className="text-xs text-text-muted mt-1">📱 {c.celular || 'Sem WhatsApp'}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DETAILS PANEL */}
        <div className="md:col-span-2 bg-card border border-border rounded-lg shadow-sm p-6 space-y-6">
          {selectedClient ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-border pb-4 gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-text">{selectedClient.nome}</h2>
                  <p className="text-xs text-text-muted mt-1">
                    WhatsApp: <strong>{selectedClient.celular}</strong> 
                    {selectedClient.dataNascimento && ` &bull; Nasc: ${selectedClient.dataNascimento.split('-')[2]}/${selectedClient.dataNascimento.split('-')[1]}/${selectedClient.dataNascimento.split('-')[0]}`}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleOpenEdit(selectedClient)}
                    className="btn btn-secondary btn-sm font-semibold flex-1 sm:flex-none"
                  >
                    ✏️ Editar Ficha
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remover "${selectedClient.nome}"?`)) onDeleteClient(selectedClient.id);
                    }}
                    className="btn btn-danger btn-sm font-semibold flex-1 sm:flex-none"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>

              {/* TECHNICAL DATA CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface p-4 border border-border rounded-md">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Formato Preferido</span>
                  <span className="text-sm font-bold text-text block mt-1">💅 {selectedClient.formatoUnha || 'Não especificado'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Alergias</span>
                  <span className={`text-sm font-bold block mt-1 ${selectedClient.alergias && selectedClient.alergias !== 'Nenhuma' ? 'text-danger' : 'text-success'}`}>
                    ⚠️ {selectedClient.alergias || 'Nenhuma'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Total Investido</span>
                  <span className="text-sm font-bold text-success block mt-1">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSpent)}
                  </span>
                </div>
              </div>

              {/* NOTES */}
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Anotações Técnicas</h4>
                <p className="bg-surface border border-border rounded p-3 text-xs text-text leading-normal whitespace-pre-line">
                  {selectedClient.obsTecnicas || 'Nenhuma observação técnica cadastrada.'}
                </p>
              </div>

              {/* PHOTO GALLERY (INTERNAL FOR UNHAS) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Galeria de Fotos de Unhas</h4>
                  <label className="p-1 px-3 bg-primary text-white text-xs font-bold rounded cursor-pointer hover:opacity-90">
                    📸 Adicionar Foto
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
                
                {selectedClient.fotosUnhas && selectedClient.fotosUnhas.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedClient.fotosUnhas.map((imgUrl, i) => (
                      <div key={i} className="relative group rounded border border-border overflow-hidden bg-surface aspect-square">
                        <img src={imgUrl} alt={`Unha cliente ${i}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => onDeletePhoto(selectedClient.id, i)}
                          className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-all font-bold"
                          title="Remover Foto"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Nenhuma foto adicionada na ficha desta cliente.</p>
                )}
              </div>

              {/* APPOINTMENT LOGS */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border pb-2">Histórico de Visitas</h4>
                {clientApts.length === 0 ? (
                  <p className="text-xs text-text-muted italic">Nenhum atendimento realizado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {clientApts.map(a => {
                      const service = services.find(s => s.id === a.serviceId);
                      return (
                        <div key={a.id} className="bg-surface border border-border p-3 rounded-md flex justify-between gap-4 text-xs">
                          <div>
                            <span className="font-semibold text-text">{service?.nome || 'Procedimento'}</span>
                            <span className="text-text-muted mt-0.5 block">{fmtDate(a.data)} às {a.hora}</span>
                            {a.obs && <span className="text-text-muted block mt-1 font-mono">{a.obs}</span>}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-text">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.valor)}</span>
                            <span className="block text-[10px] text-text-muted uppercase font-bold mt-1">{a.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-text-muted">
              <span className="text-4xl block mb-2">👥</span>
              <p className="text-xs">Selecione uma cliente para gerenciar a ficha e fotos.</p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: ADD/EDIT CLIENT */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
              <h3 className="text-sm font-bold text-text">{editingId ? 'Editar Cliente' : 'Nova Cliente'}</h3>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Nome Completo</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: Clara Mendes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">WhatsApp</label>
                    <input
                      type="tel"
                      className={`w-full px-4 py-2.5 bg-surface border text-text rounded-md outline-none focus:border-primary text-sm font-medium ${
                        phoneError ? 'border-danger' : 'border-border'
                      }`}
                      placeholder="Ex: (11) 98888-8888"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneError) setPhoneError(null);
                      }}
                      required
                    />
                    {phoneError && <span className="text-xs text-danger font-bold mt-1 block">{phoneError}</span>}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Data de Nascimento</label>
                    <input
                      type="date"
                      min="1900-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                      className={`w-full px-4 py-2.5 bg-surface border text-text rounded-md outline-none focus:border-primary text-sm font-medium ${
                        birthDateError ? 'border-danger' : 'border-border'
                      }`}
                      value={birthDate}
                      onChange={(e) => {
                        setBirthDate(e.target.value);
                        if (birthDateError) setBirthDateError(null);
                      }}
                    />
                    {birthDateError && <span className="text-xs text-danger font-bold mt-1 block">{birthDateError}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Formato Predileto</label>
                    <select
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium cursor-pointer"
                      value={nailShape}
                      onChange={(e) => setNailShape(e.target.value as any)}
                    >
                      <option value="Amendoada">Amendoada</option>
                      <option value="Quadrada">Quadrada</option>
                      <option value="Stiletto">Stiletto</option>
                      <option value="Bailarina">Bailarina</option>
                      <option value="Oval">Oval</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Alergias</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      placeholder="Ex: Nenhuma, Monômero"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Anotações / Ficha Técnica</label>
                  <textarea
                    className="w-full px-4 py-2 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    rows={3}
                    placeholder="Descrição da unha, cutícula, preferências de esmaltes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm font-bold text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover">Salvar</button>
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
