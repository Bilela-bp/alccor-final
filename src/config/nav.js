import {
  LayoutDashboard, Package, FileText, Users, Truck, ArrowUpCircle, ArrowDownCircle,
  Wallet, UserCog, CalendarCheck, ShieldCheck, BarChart3, History, ClipboardList,
} from 'lucide-react';

export const THEME_STORAGE_KEY = 'alccor_theme';

export const NAV = [
  { key: 'dashboard', label: 'Painel', Icon: LayoutDashboard },
  { key: 'produtos', label: 'Estoque', Icon: Package },
  { key: 'notas', label: 'Notas fiscais', Icon: FileText },
  { key: 'clientes', label: 'Clientes', Icon: Users },
  { key: 'orcamentos', label: 'Orçamentos', Icon: ClipboardList },
  { key: 'fornecedores', label: 'Fornecedores', Icon: Truck },
  { key: 'contas_pagar', label: 'Contas a pagar', Icon: ArrowUpCircle },
  { key: 'contas_receber', label: 'Contas a receber', Icon: ArrowDownCircle },
  { key: 'relatorios', label: 'Relatórios financeiros', Icon: BarChart3 },
  { key: 'caixa', label: 'Caixa', Icon: Wallet },
  { key: 'funcionarios', label: 'Funcionários', Icon: UserCog },
  { key: 'folha', label: 'Folha de pagamento', Icon: CalendarCheck },
  { key: 'usuarios', label: 'Usuários', Icon: ShieldCheck, adminOnly: true },
  { key: 'historico', label: 'Histórico de alterações', Icon: History, adminOnly: true },
];
