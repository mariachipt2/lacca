import React, { useState, useEffect } from 'react';

interface InlineCompleteFormProps {
  appointmentId: string;
  valorTotal: number;
  onComplete: (id: string, splits: { method: string; value: number }[]) => void;
  onCancel: () => void;
  customPaymentMethods?: string[];
}

export const InlineCompleteForm: React.FC<InlineCompleteFormProps> = ({
  appointmentId,
  valorTotal,
  onComplete,
  onCancel,
  customPaymentMethods = [],
}) => {
  const defaultMethods = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Pagar Depois'];
  const methods = [...defaultMethods, ...customPaymentMethods];
  
  // Track which methods are checked
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['Pix']);
  
  // Track the values for each selected method
  const [values, setValues] = useState<Record<string, string>>({
    Pix: valorTotal.toString(),
    Dinheiro: '',
    'Cartão de Crédito': '',
    'Cartão de Débito': '',
    'Pagar Depois': '',
  });

  // Automatically adjust values when checkboxes are toggled
  useEffect(() => {
    if (selectedMethods.length === 0) {
      return;
    }
    
    if (selectedMethods.length === 1) {
      // Auto-fill the single method with the full total
      const singleMethod = selectedMethods[0];
      setValues(prev => {
        const next = { ...prev };
        methods.forEach(m => {
          next[m] = m === singleMethod ? valorTotal.toString() : '';
        });
        return next;
      });
    } else {
      // If multiple are selected, split the total equally as a default starting point
      const equalShare = (valorTotal / selectedMethods.length).toFixed(2);
      setValues(prev => {
        const next = { ...prev };
        methods.forEach(m => {
          if (selectedMethods.includes(m)) {
            next[m] = equalShare;
          } else {
            next[m] = '';
          }
        });
        return next;
      });
    }
  }, [selectedMethods, valorTotal]);

  const handleCheckboxChange = (method: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(method)) {
        return prev.filter(m => m !== method);
      } else {
        return [...prev, method];
      }
    });
  };

  const handleValueChange = (method: string, val: string) => {
    setValues(prev => ({
      ...prev,
      [method]: val
    }));
  };

  // Calculate sum of values
  const currentSum = selectedMethods.reduce((sum, m) => {
    const parsed = parseFloat(values[m]);
    return sum + (isNaN(parsed) ? 0 : parsed);
  }, 0);

  // Validate if sum is equal to total (using safe epsilon check)
  const isValid = selectedMethods.length > 0 && Math.abs(currentSum - valorTotal) < 0.02;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    // Build splits array
    const splits = selectedMethods.map(method => {
      const val = parseFloat(values[method]);
      return {
        method,
        value: isNaN(val) ? 0 : val
      };
    });

    onComplete(appointmentId, splits);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-surface border border-border rounded-lg space-y-3 animate-fade-in w-full text-left">
      <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
        Concluir Atendimento &mdash; Escolha o Pagamento
      </div>

      <div className="space-y-2">
        {methods.map(method => {
          const isChecked = selectedMethods.includes(method);
          const showInput = selectedMethods.length > 1 && isChecked;

          return (
            <div key={method} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-card/50 border border-border/40 hover:border-border transition-all">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-text select-none py-1">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCheckboxChange(method)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <span>{method}</span>
              </label>

              {showInput && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="text-[10px] text-text-muted font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 px-2 py-1 bg-surface border border-border text-text rounded text-xs outline-none focus:border-primary font-bold text-right"
                    placeholder="0.00"
                    value={values[method]}
                    onChange={(e) => handleValueChange(method, e.target.value)}
                    required
                  />
                </div>
              )}

              {!showInput && isChecked && (
                <div className="text-xs text-success font-bold self-end sm:self-auto pr-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Verification / Summary bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-border pt-3 gap-2">
        <div className="text-[11px] font-medium">
          {selectedMethods.length > 1 ? (
            <div className="space-y-0.5">
              <div>Total: <span className="font-extrabold text-text">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}</span></div>
              <div className={isValid ? 'text-success font-bold' : 'text-danger font-bold'}>
                Digitado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentSum)}
              </div>
            </div>
          ) : (
            <span className="text-text-muted">Total a registrar: <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}</strong></span>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-surface border border-border text-text-muted hover:text-text text-xs font-bold rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className={`px-4 py-1.5 text-xs font-bold rounded shadow text-white transition-all ${
              isValid
                ? 'bg-gradient-to-r from-success to-success-hover hover:opacity-90 cursor-pointer'
                : 'bg-card border border-border text-text-muted cursor-not-allowed opacity-50'
            }`}
          >
            Confirmar Conclusão
          </button>
        </div>
      </div>
    </form>
  );
};
