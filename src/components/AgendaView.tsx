import React, { useState } from 'react';
import type { Client, Service, Appointment, ProfessionalSettings } from '../types/database';
import { InlineCompleteForm } from './InlineCompleteForm';
import { validarDataAgendamento, validarPrecoServico, capitalizarNome } from '../utils/validations';

interface AgendaViewProps {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  settings: ProfessionalSettings;
  onAddAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => void;
  onCancelAppointment: (id: string) => void;
  onCompleteAppointment: (id: string, splits: { method: string; value: number }[]) => void;
  onDeleteAppointment: (id: string) => void;
  onUpdateAppointmentTime: (id: string, hora: string) => void;
  onAddClient?: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  googleConnected: boolean;
  googleEmail: string;
  onConnectGoogle: (email: string) => void;
  onDisconnectGoogle: () => void;
  waitlist: { id: string; nome: string; celular: string; obs: string; data: string }[];
  setWaitlist: React.Dispatch<React.SetStateAction<{ id: string; nome: string; celular: string; obs: string; data: string }[]>>;
}

// Helper to convert time HH:MM to minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Helper to add minutes to a time string and return HH:MM
export function addMinutesToTime(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes;
  return minutesToTime(total);
}

// Helper to convert minutes back to HH:MM
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper to generate dynamic 30-min time slots based on professional settings
function generateTimeSlots(startHour: string = '08:00', endHour: string = '20:00'): string[] {
  const slots: string[] = [];
  const startMinutes = timeToMinutes(startHour);
  const endMinutes = timeToMinutes(endHour);
  
  let current = startMinutes;
  const limit = endMinutes > startMinutes ? endMinutes : startMinutes + 720;
  
  while (current < limit) {
    const h = Math.floor(current / 60) % 24;
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    current += 30;
  }
  return slots;
}

// Helper to get week dates (Monday to Sunday)
function getWeekDates(dateStr: string): { name: string; dateStr: string; dateObj: Date }[] {
  const current = new Date(dateStr + 'T12:00:00');
  const day = current.getDay(); // 0 (Sun) to 6 (Sat)
  // Adjust so Monday is 0, Sunday is 6
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(current);
  monday.setDate(current.getDate() + distanceToMonday);
  
  const days = [];
  const weekDayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      name: weekDayNames[i],
      dateStr: d.toISOString().slice(0, 10),
      dateObj: d
    });
  }
  return days;
}

// Helper to get 42 days grid for monthly calendar view (starts on Sunday)
function getMonthGridDays(dateStr: string): Date[] {
  const current = new Date(dateStr + 'T12:00:00');
  const year = current.getFullYear();
  const month = current.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 6 = Sat
  
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() - startDayOfWeek);
  
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  return days;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  clients,
  services,
  settings,
  onAddAppointment,
  onCancelAppointment,
  onCompleteAppointment,
  onDeleteAppointment,
  onUpdateAppointmentTime,
  onAddClient,
  googleConnected,
  googleEmail,
  onConnectGoogle,
  onDisconnectGoogle,
  waitlist,
  setWaitlist
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState<'diario' | 'semanal' | 'mensal'>('diario');
  const [completingAptId, setCompletingAptId] = useState<string | null>(null);
  const [hideFreeSlots, setHideFreeSlots] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleFormEmail, setGoogleFormEmail] = useState('admin@example.com');
  const [formTime, setFormTime] = useState(() => settings.workStartHour || '08:00');

  const timeSlots = generateTimeSlots(settings.workStartHour, settings.workEndHour);
  

  const [newWaitName, setNewWaitName] = useState('');
  const [newWaitPhone, setNewWaitPhone] = useState('');
  const [newWaitObs, setNewWaitObs] = useState('');

  // Form states for new appointments
  const [formClientId, setFormClientId] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formIsBlocked, setFormIsBlocked] = useState(false);
  const [formBlockLabel, setFormBlockLabel] = useState('Intervalo / Almoço');
  const [formBlockDuration, setFormBlockDuration] = useState(60);
  const [dateError, setDateError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Today's list (excluding canceled)
  const todayApts = appointments.filter(a => a.data === selectedDate && a.status !== 'Cancelado');

  // Build occupancy map for the daily grid
  const slotOccupancyMap: {
    [slot: string]: Array<{
      type: 'appointment' | 'block';
      label: string;
      apt?: Appointment;
      slotsSpan: number;
      offsetMinutes: number;
    }>
  } = {};

  todayApts.forEach(apt => {
    const isBlock = apt.clientId === 'BLOCKED_SLOT';
    const duration = isBlock ? (parseInt(apt.obs || '60') || 60) : (services.find(s => s.id === apt.serviceId)?.duracao || 30);
    
    // Find the slot this appointment falls into
    const aptMinutes = timeToMinutes(apt.hora);
    const startSlotMinutes = Math.floor(aptMinutes / 30) * 30;
    const offsetMinutes = aptMinutes - startSlotMinutes;

    const endMinutes = aptMinutes + duration;
    
    const slotsSpan = Math.ceil((endMinutes - startSlotMinutes) / 30);

    for (let i = 0; i < slotsSpan; i++) {
      const currentSlotMinutes = startSlotMinutes + i * 30;
      const slotTime = minutesToTime(currentSlotMinutes);
      
      if (timeSlots.includes(slotTime)) {
        if (!slotOccupancyMap[slotTime]) {
          slotOccupancyMap[slotTime] = [];
        }
        
        if (i === 0) {
          let label = '';
          if (isBlock) {
            label = `⚠️ BLOQUEADO: ${apt.paymentMethod || 'Compromisso'} (${apt.hora})`;
          } else {
            const client = clients.find(c => c.id === apt.clientId);
            const service = services.find(s => s.id === apt.serviceId);
            label = `(${apt.hora}) ${client ? client.nome : 'Cliente'} - ${service ? service.nome : 'Unhas'}`;
          }
          slotOccupancyMap[slotTime].push({
            type: isBlock ? 'block' : 'appointment',
            label,
            apt,
            slotsSpan,
            offsetMinutes
          });
        } else {
          slotOccupancyMap[slotTime].push({
            type: isBlock ? 'block' : 'appointment',
            label: '↳ ocupado em atendimento/bloqueio',
            slotsSpan: 0,
            offsetMinutes: 0
          });
        }
      }
    }
  });

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleOpenAddModal = (slot: string) => {
    setFormTime(slot);
    setFormIsBlocked(false);
    setDateError(null);
    setPriceError(null);
    setShowAddModal(true);
  };

  const handleServiceChange = (id: string) => {
    setFormServiceId(id);
    const srv = services.find(s => s.id === id);
    if (srv) setFormPrice(srv.preco.toString());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Date
    const dateErr = validarDataAgendamento(selectedDate, false);
    if (dateErr) {
      setDateError(dateErr);
      return;
    }
    setDateError(null);

    // Validate Price (only if not blocked)
    if (!formIsBlocked) {
      const priceErr = validarPrecoServico(formPrice);
      if (priceErr) {
        setPriceError(priceErr);
        return;
      }
    }
    setPriceError(null);

    if (formIsBlocked) {
      onAddAppointment({
        clientId: 'BLOCKED_SLOT',
        serviceId: 'BLOCKED_SRV',
        data: selectedDate,
        hora: formTime,
        valor: 0,
        status: 'Concluído',
        obs: formBlockDuration.toString(),
        paymentMethod: formBlockLabel as any
      });
    } else {
      if (!formClientId || !formServiceId || !formPrice) return;
      
      let targetClientId = formClientId;
      if (formClientId.startsWith('wt_')) {
        const waitItem = waitlist.find(w => w.id === formClientId);
        if (waitItem && onAddClient) {
          try {
            const newClient = await onAddClient({
              nome: waitItem.nome,
              celular: waitItem.celular,
              obsTecnicas: waitItem.obs || ''
            });
            targetClientId = newClient.id;
            
            // Remove from waitlist
            setWaitlist(prev => prev.filter(w => w.id !== waitItem.id));
          } catch (err) {
            console.error('Erro ao converter cliente da lista de espera:', err);
            return;
          }
        }
      }

      onAddAppointment({
        clientId: targetClientId,
        serviceId: formServiceId,
        data: selectedDate,
        hora: formTime,
        valor: parseFloat(formPrice) || 0,
        status: 'Agendado',
        obs: formObs
      });
    }

    setFormClientId('');
    setFormServiceId('');
    setFormPrice('');
    setFormObs('');
    setShowAddModal(false);
  };

  // Waitlist Handlers
  const handleAddWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaitName) return;
    const newItem = {
      id: 'wt_' + Date.now(),
      nome: capitalizarNome(newWaitName),
      celular: newWaitPhone,
      obs: newWaitObs,
      data: selectedDate
    };
    setWaitlist([...waitlist, newItem]);
    setNewWaitName('');
    setNewWaitPhone('');
    setNewWaitObs('');
  };

  const handleRemoveWaitlist = (id: string) => {
    setWaitlist(waitlist.filter(w => w.id !== id));
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, targetSlot: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      onUpdateAppointmentTime(id, targetSlot);
    }
  };

  // Google Calendar Mock OAuth Connect Handler
  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnectGoogle(googleFormEmail);
    setShowGoogleModal(false);
  };

  const handleSendReminder = (aptId: string) => {
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;
    const client = clients.find(c => c.id === apt.clientId);
    const service = services.find(s => s.id === apt.serviceId);
    if (!client) return;

    const bizSuffix = settings.nomeNegocio ? ` \u2014 *${settings.nomeNegocio}*` : '';
    const profPrefix = settings.nomeProfissional ? `Olá, aqui é a *${settings.nomeProfissional}*! \u{2728}\n` : 'Olá! \u{2728}\n';

    const text = `${profPrefix}Passando para confirmar seu horário hoje às *${apt.hora}* para o serviço de *${service ? service.nome : 'unhas'}*.\nConfirma?${bizSuffix} \u{1F485}`;
    const cleanPhone = client.celular.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const weekDays = getWeekDates(selectedDate);
  const monthDays = getMonthGridDays(selectedDate);

  // Compact occupied appointments list (for upcoming list sidebar)
  const occupiedAptsToday = appointments
    .filter(a => a.data === selectedDate && a.status !== 'Cancelado' && a.clientId !== 'BLOCKED_SLOT')
    .sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROL BAR */}
      <div className="flex flex-col gap-4 bg-card p-4 border border-border rounded-lg shadow-sm">
        
        {/* Row 1: Date Navigation */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 w-full">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button 
              onClick={() => changeDate(viewMode === 'semanal' ? -7 : -1)} 
              className="btn btn-secondary btn-sm font-bold flex-1 sm:flex-initial text-xs px-2.5 py-2"
            >
              &larr; Anterior
            </button>
            <input
              type="date"
              className="px-2.5 py-2 bg-surface border border-border text-text rounded-md font-semibold text-xs outline-none cursor-pointer flex-1 sm:flex-initial text-center min-w-0"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button 
              onClick={() => changeDate(viewMode === 'semanal' ? 7 : 1)} 
              className="btn btn-secondary btn-sm font-bold flex-1 sm:flex-initial text-xs px-2.5 py-2"
            >
              Próximo &rarr;
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="btn btn-secondary btn-sm font-bold w-full sm:w-auto mt-1 sm:mt-0 text-xs py-2"
          >
            Hoje
          </button>
        </div>

        {/* Row 2: View modes & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full border-t border-border/30 pt-3">
          {/* View Mode Sub-tabs */}
          <div className="flex bg-surface border border-border p-1 rounded-md w-full sm:w-auto">
            <button
              onClick={() => setViewMode('diario')}
              className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-xs font-bold rounded transition-all ${
                viewMode === 'diario' ? 'bg-active text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              Diário
            </button>
            <button
              onClick={() => setViewMode('semanal')}
              className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-xs font-bold rounded transition-all ${
                viewMode === 'semanal' ? 'bg-active text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setViewMode('mensal')}
              className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-xs font-bold rounded transition-all ${
                viewMode === 'mensal' ? 'bg-active text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              Mensal
            </button>
          </div>

          {/* Hide free slots filter (only in daily view) */}
          {viewMode === 'diario' && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-text py-1">
              <input
                type="checkbox"
                className="accent-primary w-4 h-4 cursor-pointer rounded"
                checked={hideFreeSlots}
                onChange={(e) => setHideFreeSlots(e.target.checked)}
              />
              <span>👁️ Ocultar Livres</span>
            </label>
          )}
        </div>

        {/* Row 3: Action Buttons */}
        <div className="grid grid-cols-2 gap-2 w-full border-t border-border/30 pt-3">
          <button
            onClick={() => {
              setFormTime('12:00');
              setFormIsBlocked(true);
              setDateError(null);
              setPriceError(null);
              setShowAddModal(true);
            }}
            className="btn btn-secondary btn-sm font-bold w-full text-xs py-2 px-2.5 truncate"
          >
            🚫 Bloquear
          </button>
          <button
            onClick={() => {
              setFormTime(settings.workStartHour || '08:00');
              setFormIsBlocked(false);
              setDateError(null);
              setPriceError(null);
              setShowAddModal(true);
            }}
            className="btn btn-primary btn-sm font-bold bg-gradient-to-r from-primary to-primary-hover text-white shadow-sm w-full text-xs py-2 px-2.5 truncate"
          >
            + Novo Agendamento
          </button>
        </div>

      </div>

      {/* VIEW MODES */}

      {viewMode === 'diario' && (
        /* ==================== DIÁRIO VIEW ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* DAILY 30-MIN SLOTS GRID */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface flex justify-between items-center">
              <h3 className="font-bold text-sm text-text">Fila Horária de Atendimentos</h3>
              <span className="text-xs text-text-muted">Arraste atendimentos para reagendar</span>
            </div>

            <div className="divide-y divide-border">
              {timeSlots.map(slot => {
                const occupancies = slotOccupancyMap[slot] || [];
                
                // If this slot is fully covered by ongoing spanned appointments (all slotsSpan === 0)
                const isOnlySpanned = occupancies.length > 0 && occupancies.every(occ => occ.slotsSpan === 0);
                if (isOnlySpanned) {
                  return null;
                }

                // If hideFreeSlots is checked, hide empty slots
                if (hideFreeSlots && occupancies.length === 0) {
                  return null;
                }

                return (
                  <div
                    key={slot}
                    onDragOver={occupancies.length === 0 ? (e) => e.preventDefault() : undefined}
                    onDrop={occupancies.length === 0 ? (e) => handleDrop(e, slot) : undefined}
                    className={`px-3 sm:px-6 py-3 flex flex-col hover:bg-surface-active/30 transition-all gap-2 ${
                      occupancies.length === 0 
                        ? 'border border-transparent hover:border-dashed hover:border-primary/40 hover:bg-primary-lt/5' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-4 w-full">
                      {/* Time indicator */}
                      <div className="text-sm font-extrabold text-primary min-w-[45px] sm:min-w-[50px] pt-1">
                        {slot}
                      </div>

                      {/* Content / Draggable elements */}
                      <div className="flex-1 flex flex-col gap-2 min-w-0">
                        {occupancies.length > 0 ? (
                          occupancies.map((occ, idx) => {
                            if (occ.slotsSpan === 0) return null; // skip rendering secondary spans
                            
                            const isBlockedSlot = occ.type === 'block';
                            const cardStyle = occ.offsetMinutes > 0 ? { marginTop: `${Math.round((occ.offsetMinutes / 30) * 45)}px` } : undefined;

                            return (
                              <div key={idx} style={cardStyle} className="flex flex-col gap-2 w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface/50 p-2 border border-border rounded-md">
                                  <div
                                    draggable={occ.type === 'appointment'}
                                    onDragStart={
                                      occ.type === 'appointment'
                                        ? (e) => handleDragStart(e, occ.apt!.id)
                                        : undefined
                                    }
                                    className={`flex-1 rounded px-3 py-1.5 border text-xs min-h-[32px] flex items-center justify-between ${
                                      isBlockedSlot
                                        ? 'bg-warning-lt/5 border-warning/20 text-warning/80 font-semibold'
                                        : 'bg-primary-lt/20 border-primary/20 text-text font-bold cursor-grab active:cursor-grabbing hover:bg-primary-lt/30 transition-all'
                                    }`}
                                  >
                                    <div className="truncate">
                                      {isBlockedSlot ? '🚫 ' : '💅 '}
                                      {occ.label}
                                      {googleConnected && !isBlockedSlot && (
                                        <span className="ml-2 px-1 bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] uppercase font-bold rounded-sm inline-block">
                                          📅 Google Agenda
                                        </span>
                                      )}
                                      {occ.apt?.obs && (
                                        <span className="text-[10px] font-normal text-text-muted block mt-0.5 ml-4">
                                          {occ.apt.obs}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                                    {isBlockedSlot ? (
                                      <button
                                        onClick={() => onDeleteAppointment(occ.apt!.id)}
                                        className="btn btn-secondary btn-xs text-xs font-semibold"
                                        title="Desbloquear Horário"
                                      >
                                        🔓 Desbloquear
                                      </button>
                                    ) : (
                                      <>
                                        {occ.apt?.status === 'Agendado' && (
                                          <>
                                            <button
                                              onClick={() => handleSendReminder(occ.apt!.id)}
                                              className="p-1 bg-surface border border-border hover:border-border-hover text-text-muted hover:text-text rounded-md text-xs"
                                              title="Enviar Lembrar no WhatsApp"
                                            >
                                              📱 <span className="hidden sm:inline">Lembrar</span>
                                            </button>
                                            {completingAptId !== occ.apt!.id && (
                                              <button
                                                onClick={() => setCompletingAptId(occ.apt!.id)}
                                                className="p-1 bg-success/15 border border-success/30 text-success hover:bg-success/20 rounded-md text-xs font-bold"
                                                title="Concluir Atendimento"
                                              >
                                                ✓ <span className="hidden sm:inline">Concluir</span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() => onCancelAppointment(occ.apt!.id)}
                                              className="p-1 bg-danger/15 border border-danger/30 text-danger hover:bg-danger/20 rounded-md text-xs"
                                              title="Cancelar Agendamento"
                                            >
                                              ✕ <span className="hidden sm:inline">Cancelar</span>
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={() => onDeleteAppointment(occ.apt!.id)}
                                          className="p-1 hover:bg-active rounded text-xs"
                                          title="Excluir do Banco de Dados"
                                        >
                                          🗑️
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {occ.apt && !isBlockedSlot && completingAptId === occ.apt.id && (
                                  <InlineCompleteForm
                                    appointmentId={occ.apt.id}
                                    valorTotal={occ.apt.valor}
                                    customPaymentMethods={settings.customPaymentMethods}
                                    onComplete={(id, splits) => {
                                      onCompleteAppointment(id, splits);
                                      setCompletingAptId(null);
                                    }}
                                    onCancel={() => setCompletingAptId(null)}
                                  />
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-text-muted/50 italic">Livre</span>
                        )}
                      </div>

                      {/* If the slot has no occupancy, show the quick reserve button */}
                      {occupancies.length === 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleOpenAddModal(slot)}
                            className="btn btn-secondary btn-xs text-xs font-semibold text-primary hover:text-primary-hover border border-border flex items-center justify-center min-w-[34px] px-2"
                          >
                            <span className="hidden sm:inline">+ Reservar</span>
                            <span className="sm:hidden text-sm font-bold">+</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR COLUMNS (Waitlist + Cronograma + Google Sync) */}
          <div className="space-y-6">
            
            {/* GOOGLE CALENDAR CARD */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <h4 className="font-bold text-sm text-text flex items-center gap-2">
                <span>🗓️</span> Google Calendar
              </h4>
              {googleConnected ? (
                <div className="space-y-3">
                  <div className="bg-success-lt/5 border border-success/20 p-3 rounded text-xs text-success flex items-center justify-between">
                    <span>🟢 Conectado: <strong>{googleEmail}</strong></span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Seus agendamentos serão adicionados e atualizados no seu Google Agenda automaticamente.
                  </p>
                  <button
                    onClick={onDisconnectGoogle}
                    className="w-full py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded text-xs font-bold transition-all"
                  >
                    Desconectar Conta Google
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-muted leading-relaxed">
                    Sincronize sua agenda de Nail Design com o seu celular e receba alertas diretamente no Google Agenda.
                  </p>
                  <button
                    onClick={() => setShowGoogleModal(true)}
                    className="w-full py-2 bg-gradient-to-r from-[#4285F4] to-[#357AE8] hover:opacity-90 text-white rounded text-xs font-bold shadow-sm transition-all"
                  >
                    Conectar Google Agenda
                  </button>
                </div>
              )}
            </div>

            {/* UPCOMING OCCUPIED SLOTS PANEL */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-text border-b border-border pb-3 flex items-center justify-between">
                <span>📋 Horários Preenchidos de Hoje</span>
                <span className="badge badge-primary">{occupiedAptsToday.length}</span>
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {occupiedAptsToday.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-6 italic">Nenhum atendimento ocupado hoje.</p>
                ) : (
                  occupiedAptsToday.map(apt => {
                    const client = clients.find(c => c.id === apt.clientId);
                    const service = services.find(s => s.id === apt.serviceId);
                    return (
                      <div key={apt.id} className="bg-surface border border-border p-2.5 rounded-md flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-extrabold text-primary">{apt.hora}</span>
                          <span className="font-bold text-text block truncate mt-0.5">{client?.nome}</span>
                          <span className="text-[10px] text-text-muted block truncate mt-0.5">{service?.nome}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          apt.status === 'Concluído' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ENCAIXE RÁPIDO */}
            <div className="bg-card border border-border rounded-lg shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-sm text-text border-b border-border pb-3 flex items-center gap-2">
                <span>📋</span> Lista de Espera (Hoje)
              </h3>

              <form onSubmit={handleAddWaitlist} className="space-y-3 bg-surface p-3 border border-border rounded-md">
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-bold text-text-muted uppercase tracking-wider">Cliente</label>
                  <input
                    type="text"
                    placeholder="Clara Silva"
                    className="w-full px-3 py-1.5 bg-card border border-border rounded text-xs outline-none focus:border-primary text-text"
                    value={newWaitName}
                    onChange={(e) => setNewWaitName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-bold text-text-muted uppercase tracking-wider">Celular</label>
                  <input
                    type="tel"
                    placeholder="(11) 91234-5678"
                    className="w-full px-3 py-1.5 bg-card border border-border rounded text-xs outline-none focus:border-primary text-text"
                    value={newWaitPhone}
                    onChange={(e) => setNewWaitPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-bold text-text-muted uppercase tracking-wider">Observações</label>
                  <input
                    type="text"
                    placeholder="Preferência fim de tarde"
                    className="w-full px-3 py-1.5 bg-card border border-border rounded text-xs outline-none focus:border-primary text-text"
                    value={newWaitObs}
                    onChange={(e) => setNewWaitObs(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-gradient-to-r from-primary to-primary-hover text-white text-xs font-bold rounded shadow hover:opacity-90"
                >
                  Adicionar à Espera
                </button>
              </form>

              <div className="space-y-2">
                {waitlist.filter(w => w.data === selectedDate).length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4 italic">Nenhuma cliente na fila de espera.</p>
                ) : (
                  waitlist
                    .filter(w => w.data === selectedDate)
                    .map(item => (
                      <div key={item.id} className="bg-surface border border-border p-3 rounded-md flex justify-between gap-2">
                        <div className="text-xs min-w-0">
                          <div className="font-bold text-text truncate">{item.nome}</div>
                          <div className="text-text-muted mt-0.5">{item.celular || 'Sem número'}</div>
                          {item.obs && <div className="text-primary font-semibold mt-1">{item.obs}</div>}
                        </div>
                        <button
                          onClick={() => handleRemoveWaitlist(item.id)}
                          className="text-text-muted hover:text-danger text-sm self-start"
                          title="Excluir"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {viewMode === 'semanal' && (
        /* ==================== SEMANAL VIEW ==================== */
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="font-bold text-sm text-text">Visualização Semanal</h3>
            <span className="text-xs text-text-muted">Semana de {fmtDate(weekDays[0].dateStr)} a {fmtDate(weekDays[6].dateStr)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
            {weekDays.map(day => {
              const dayApts = appointments.filter(a => a.data === day.dateStr && a.status !== 'Cancelado');
              const isSelectedDay = day.dateStr === selectedDate;
              
              return (
                <div
                  key={day.dateStr}
                  className={`bg-surface border rounded-md p-3 min-h-[300px] flex flex-col justify-between ${
                    isSelectedDay ? 'border-primary shadow-sm bg-primary-lt/5' : 'border-border'
                  }`}
                >
                  <div className="space-y-3 flex-1">
                    {/* Header Col */}
                    <div
                      onClick={() => {
                        setSelectedDate(day.dateStr);
                        setViewMode('diario');
                      }}
                      className="border-b border-border pb-2 text-center cursor-pointer hover:text-primary transition-all"
                    >
                      <span className="text-[10px] font-bold text-text-muted block uppercase">{day.name}</span>
                      <span className="text-sm font-extrabold text-text mt-0.5 block">{day.dateStr.split('-')[2]}</span>
                    </div>

                    {/* Lists cards */}
                    <div className="space-y-1.5">
                      {dayApts.length === 0 ? (
                        <p className="text-[10px] text-text-muted text-center py-6 italic">Livre</p>
                      ) : (
                        dayApts
                          .sort((a,b) => a.hora.localeCompare(b.hora))
                          .map(apt => {
                            const isBlock = apt.clientId === 'BLOCKED_SLOT';
                            const client = clients.find(c => c.id === apt.clientId);
                            const service = services.find(s => s.id === apt.serviceId);
                            
                            return (
                              <div
                                key={apt.id}
                                className={`p-1.5 border rounded text-[10px] ${
                                  isBlock 
                                    ? 'bg-warning-lt/5 border-warning/20 text-warning/70' 
                                    : 'bg-card border-border text-text font-semibold hover:border-primary/30 transition-all'
                                }`}
                              >
                                <span className="font-extrabold block text-primary">{apt.hora}</span>
                                <span className="truncate block mt-0.5">{isBlock ? '🚫 Bloqueio' : (client?.nome || 'Cliente')}</span>
                                {!isBlock && <span className="text-[9px] text-text-muted truncate block">{service?.nome}</span>}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDate(day.dateStr);
                      setViewMode('diario');
                    }}
                    className="w-full mt-3 py-1 bg-surface border border-border text-[9px] font-bold rounded hover:bg-active transition-all"
                  >
                    Ver Dia
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'mensal' && (
        /* ==================== MENSAL VIEW ==================== */
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="font-bold text-sm text-text">Calendário Mensal</h3>
            <span className="text-xs text-text-muted font-bold capitalize">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Grid header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-text-muted uppercase mb-2">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((date, idx) => {
              const dateStr = date.toISOString().slice(0, 10);
              const dayApts = appointments.filter(a => a.data === dateStr && a.status !== 'Cancelado');
              const activeApts = dayApts.filter(a => a.clientId !== 'BLOCKED_SLOT');
              const isSelectedDay = dateStr === selectedDate;
              const isCurrentMonth = date.getMonth() === new Date(selectedDate + 'T12:00:00').getMonth();

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setViewMode('diario');
                  }}
                  className={`border p-2 min-h-[70px] sm:min-h-[85px] rounded-md cursor-pointer flex flex-col justify-between transition-all hover:bg-surface-active/40 ${
                    isSelectedDay 
                      ? 'border-primary bg-primary-lt/5' 
                      : isCurrentMonth ? 'border-border bg-surface' : 'border-border/30 bg-surface/30 opacity-40'
                  }`}
                >
                  <span className={`text-xs font-bold ${isSelectedDay ? 'text-primary' : 'text-text-muted'}`}>
                    {date.getDate()}
                  </span>
                  
                  {activeApts.length > 0 && (
                    <div className="mt-1">
                      <div className="hidden sm:block text-[9px] bg-primary-lt text-primary px-1 rounded truncate text-center font-bold">
                        💅 {activeApts.length} atend.
                      </div>
                      <div className="sm:hidden flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: GOOGLE ACCOUNT LOGIN SIMULATOR */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-modal-in">
            <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
              <h3 className="text-sm font-bold text-text flex items-center gap-1.5">
                <span className="text-lg">🔐</span> Conectar Conta Google
              </h3>
              <button onClick={() => setShowGoogleModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>
            
            <form onSubmit={handleGoogleSubmit}>
              <div className="p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-[#4285F4]/10 text-[#4285F4] rounded-full flex items-center justify-center text-xl mx-auto font-bold border border-[#4285F4]/20 shadow-sm">
                    G
                  </div>
                  <p className="text-xs text-text font-bold">NailArt Pro quer acessar seu Google Agenda</p>
                  <p className="text-[11px] text-text-muted">Isso permitirá ler e criar eventos de seus horários de atendimento.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">Seu e-mail do Google</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                    placeholder="Ex: mariamanicure@gmail.com"
                    value={googleFormEmail}
                    onChange={(e) => setGoogleFormEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="btn btn-secondary btn-sm font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover"
                >
                  Permitir Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD APPOINTMENT / BLOCK */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-card border border-border-hover rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-modal-in">
            
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface">
              <h3 className="text-sm font-bold text-text">
                {formIsBlocked ? 'Bloquear Grade Horária' : `Reservar Horário: ${formTime}`}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-text text-sm">✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                
                <div className="flex gap-2 p-1 bg-surface rounded border border-border">
                  <button
                    type="button"
                    className={`flex-1 py-1 text-xs font-bold rounded-sm ${
                      !formIsBlocked ? 'bg-active text-text' : 'text-text-muted'
                    }`}
                    onClick={() => setFormIsBlocked(false)}
                  >
                    Agendamento
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1 text-xs font-bold rounded-sm ${
                      formIsBlocked ? 'bg-active text-text' : 'text-text-muted'
                    }`}
                    onClick={() => setFormIsBlocked(true)}
                  >
                    Bloquear Agenda
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Horário</label>
                    <input
                      type="time"
                      className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Data</label>
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      max={(() => {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 1);
                        return d.toISOString().slice(0, 10);
                      })()}
                      className={`w-full px-4 py-2.5 bg-surface border text-text rounded-md outline-none focus:border-primary text-sm font-medium ${
                        dateError ? 'border-danger' : 'border-border'
                      }`}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        if (dateError) setDateError(null);
                      }}
                      required
                    />
                    {dateError && <span className="text-xs text-danger font-bold mt-1 block">{dateError}</span>}
                  </div>
                </div>

                {formIsBlocked ? (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Motivo do Bloqueio</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                        value={formBlockLabel}
                        onChange={(e) => setFormBlockLabel(e.target.value)}
                      >
                        <option value="Almoço / Descanso">Almoço / Descanso</option>
                        <option value="Compromisso Pessoal">Compromisso Pessoal</option>
                        <option value="Reunião / Treinamento">Reunião / Treinamento</option>
                        <option value="Manutenção do Espaço">Manutenção do Espaço</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Duração (Minutos)</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                        value={formBlockDuration}
                        onChange={(e) => setFormBlockDuration(parseInt(e.target.value))}
                      >
                        <option value="30">30 minutos (1 slot)</option>
                        <option value="60">60 minutos (2 slots)</option>
                        <option value="90">90 minutos (3 slots)</option>
                        <option value="120">120 minutos (4 slots)</option>
                        <option value="180">180 minutos (6 slots)</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Cliente</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium cursor-pointer"
                        value={formClientId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormClientId(val);
                          if (val.startsWith('wt_')) {
                            const waitItem = waitlist.find(w => w.id === val);
                            if (waitItem && waitItem.obs) {
                              setFormObs(waitItem.obs);
                            }
                          }
                        }}
                        required
                      >
                        <option value="">Selecione...</option>
                        <optgroup label="Clientes Cadastrados">
                          {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </optgroup>
                        {waitlist.length > 0 && (
                          <optgroup label="Fila de Espera">
                            {waitlist.map(w => (
                              <option key={w.id} value={w.id}>{w.nome} (Fila &rarr; {w.celular})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Serviço</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                        value={formServiceId}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        required
                      >
                        <option value="">Selecione...</option>
                        {services.filter(s => s.ativo !== false).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Valor Combinado (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className={`w-full px-4 py-2.5 bg-surface border text-text rounded-md outline-none focus:border-primary text-sm font-medium ${
                          priceError ? 'border-danger' : 'border-border'
                        }`}
                        value={formPrice}
                        onChange={(e) => {
                          setFormPrice(e.target.value);
                          if (priceError) setPriceError(null);
                        }}
                        required
                      />
                      {priceError && <span className="text-xs text-danger font-bold mt-1 block">{priceError}</span>}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Anotações</label>
                      <input
                        type="text"
                        placeholder="Fibra amendoada, esmalte nude"
                        className="w-full px-4 py-2.5 bg-surface border border-border text-text rounded-md outline-none focus:border-primary text-sm font-medium"
                        value={formObs}
                        onChange={(e) => setFormObs(e.target.value)}
                      />
                    </div>
                  </>
                )}

              </div>

              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary btn-sm font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm font-bold text-white text-xs bg-gradient-to-r from-primary to-primary-hover"
                >
                  Confirmar Reserva
                </button>
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
