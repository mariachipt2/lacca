/**
 * Valida a data de um agendamento.
 * @param dateStr Data no formato YYYY-MM-DD
 * @param isEditing Indica se é edição de um agendamento existente
 * @param originalDateStr Data original do agendamento (se houver)
 * @returns string com a mensagem de erro ou null se for válida
 */
export function validarDataAgendamento(
  dateStr: string,
  isEditing: boolean = false,
  originalDateStr?: string
): string | null {
  if (!dateStr) return "A data é obrigatória";
  
  const targetDate = new Date(dateStr + 'T00:00:00');
  if (isNaN(targetDate.getTime())) {
    return "A data digitada é inválida";
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  oneYearFromNow.setHours(23, 59, 59, 999);

  // Se for edição e a data não foi alterada, permite mesmo se for no passado
  if (isEditing && originalDateStr && dateStr === originalDateStr) {
    return null;
  }

  if (targetDate < today) {
    return "A data não pode ser anterior a hoje";
  }

  if (targetDate > oneYearFromNow) {
    return "A data não pode ser superior a 1 ano no futuro";
  }

  // Verificar se o ano tem comprimento razoável para evitar typos de digitação
  const yearPart = dateStr.split('-')[0];
  if (yearPart.length !== 4) {
    return "O ano deve ter exatamente 4 dígitos (Ex: 2026)";
  }

  return null;
}

/**
 * Valida o número de telefone/WhatsApp.
 * @param phoneStr Número de telefone formatado ou não
 * @returns string com a mensagem de erro ou null se for válido
 */
export function validarTelefone(phoneStr: string): string | null {
  if (!phoneStr) return "O telefone é obrigatório";
  const digits = phoneStr.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) {
    return "O telefone deve ter 10 ou 11 dígitos (com DDD)";
  }
  return null;
}

/**
 * Valida o valor monetário de um serviço.
 * @param valor Valor numérico ou string
 * @returns string com a mensagem de erro ou null se for válido
 */
export function validarPrecoServico(valor: number | string): string | null {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(num) || num <= 0) {
    return "O valor deve ser maior que zero";
  }
  if (num > 50000) {
    return "O valor não pode ser superior a R$ 50.000,00";
  }
  return null;
}

/**
 * Capitaliza a primeira letra de cada palavra de um nome.
 * Ex: "maria da silva" -> "Maria Da Silva"
 * @param nome Nome a ser capitalizado
 * @returns Nome formatado com as iniciais em maiúsculas
 */
export function capitalizarNome(nome: string): string {
  if (!nome) return "";
  return nome
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Valida a data de nascimento de um cliente.
 * @param dateStr Data no formato YYYY-MM-DD
 * @returns string com a mensagem de erro ou null se for válida
 */
export function validarDataNascimento(dateStr: string): string | null {
  if (!dateStr) return null; // Opcional
  
  const targetDate = new Date(dateStr + 'T00:00:00');
  if (isNaN(targetDate.getTime())) {
    return "A data digitada é inválida";
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = new Date('1900-01-01T00:00:00');

  if (targetDate > today) {
    return "A data de nascimento não pode ser no futuro";
  }

  if (targetDate < minDate) {
    return "A data de nascimento não pode ser anterior a 01/01/1900";
  }

  const yearPart = dateStr.split('-')[0];
  if (yearPart.length !== 4) {
    return "O ano deve ter exatamente 4 dígitos (Ex: 1995)";
  }

  return null;
}
