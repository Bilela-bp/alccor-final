// Funções utilitárias compartilhadas pelo sistema ALCCOR.

// =========================================================================
const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const fmtDate = (d) => (d ? new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => new Date().toISOString().slice(0, 7) + '-01';

// Aplica a máscara 000.000.000-00 enquanto o usuário digita
const maskCPF = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Valida os dígitos verificadores do CPF (algoritmo oficial)
const isValidCPF = (value) => {
  const cpf = (value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === Number(cpf[10]);
};

// Aplica a máscara 00.000.000/0000-00 enquanto o usuário digita
const maskCNPJ = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Valida os dígitos verificadores do CNPJ (algoritmo oficial)
const isValidCNPJ = (value) => {
  const cnpj = (value || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcDigit = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((s, d, i) => s + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calcDigit(cnpj.slice(0, 12));
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calcDigit(cnpj.slice(0, 13));
  return d2 === Number(cnpj[13]);
};

// Aplica a máscara (00) 00000-0000 (ou (00) 0000-0000 para fixo) enquanto digita
const maskPhone = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

// Validação de formato de e-mail (exige @ e um domínio com ponto).
// Uma verificação real de "o e-mail existe de verdade" exigiria enviar um
// e-mail de confirmação ou consultar um serviço externo — não é algo confiável
// de se fazer só no navegador. Para os usuários do sistema (login), o Supabase
// Auth já impede e-mails duplicados/mal-formados na hora de criar a conta.
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());


export {
  fmtCurrency,
  fmtDate,
  fmtDateTime,
  todayISO,
  monthISO,
  maskCPF,
  isValidCPF,
  maskCNPJ,
  isValidCNPJ,
  maskPhone,
  isValidEmail,
};
