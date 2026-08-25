import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Pencil, Plus, ShieldCheck, Users } from 'lucide-react';
import { get, insertRow, updateRow, signUpUser } from '../lib/supabase';
import { isValidEmail } from '../lib/helpers';
import { Badge, EmptyState, Field, LoadingRows, Modal, PageHeader, PrimaryButton, SecondaryButton, Pagination, inputCls } from '../components/ui';

const CARGOS_USUARIO = [
  { value: 'admin', label: 'Admin' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'vendedor', label: 'Vendedor' },
];

export default function UsuariosPage() {
  const submittingRef = useRef(false);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ nome: '', email: '', cargo: 'vendedor', senha: '', confirmarSenha: '', ativo: true });
  const [editForm, setEditForm] = useState({ nome: '', cargo: 'vendedor', ativo: true });
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 12;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get('usuarios', '&order=nome.asc');
      setUsuarios(data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const totalPaginas = Math.max(1, Math.ceil(usuarios.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginatedUsuarios = usuarios.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  function openNew() {
    setNewForm({ nome: '', email: '', cargo: 'vendedor', senha: '', confirmarSenha: '', ativo: true });
    setNewModal(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!isValidEmail(newForm.email)) { window.alert('E-mail inválido. Confira se digitou o @ e o domínio corretamente (ex: nome@empresa.com).'); return; }
    if (newForm.senha.length < 6) { window.alert('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (newForm.senha !== newForm.confirmarSenha) { window.alert('As senhas não conferem.'); return; }
    submittingRef.current = true;
    setSaving(true);
    try {
      const authUser = await signUpUser(newForm.email.trim(), newForm.senha);
      await insertRow('usuarios', {
        id: authUser.id,
        nome: newForm.nome,
        email: newForm.email.trim(),
        cargo: newForm.cargo,
        ativo: newForm.ativo,
      });
      setNewModal(false);
      await load();
      window.alert(`Usuário criado! Repasse a senha combinada para ${newForm.nome} entrar no sistema. Se o Supabase estiver com confirmação de e-mail ativada, a pessoa vai precisar confirmar o e-mail antes do primeiro login (confira em Authentication → Providers → Email).`);
    } catch (e) {
      window.alert('Erro ao criar usuário: ' + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  function openEdit(row) {
    setEditForm({ nome: row.nome, cargo: row.cargo, ativo: row.ativo });
    setEditing(row);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      await updateRow('usuarios', editing.id, editForm);
      setEditing(null);
      await load();
    } catch (e) {
      window.alert('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDeactivate(row) {
    if (!window.confirm(`Desativar o acesso de "${row.nome}"? A pessoa não vai mais conseguir entrar no sistema, mas o histórico dela é mantido.`)) return;
    try {
      await updateRow('usuarios', row.id, { ativo: false });
      await load();
    } catch (e) {
      window.alert('Erro ao desativar: ' + e.message);
    }
  }

  return (
    <div>
      <PageHeader Icon={ShieldCheck} title="Usuários" subtitle="Quem tem acesso ao sistema">
        <PrimaryButton onClick={openNew}><Plus size={16} /> Novo usuário</PrimaryButton>
      </PageHeader>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : usuarios.length === 0 ? (
          <EmptyState icon={ShieldCheck} text="Nenhum usuário cadastrado ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">E-mail</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Cargo</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsuarios.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-800 font-medium">{u.nome}</td>
                  <td className="px-4 py-2.5 text-stone-700">{u.email}</td>
                  <td className="px-4 py-2.5 text-stone-700 capitalize">{u.cargo}</td>
                  <td className="px-4 py-2.5">{u.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Inativo</Badge>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                        <Pencil size={15} />
                      </button>
                      {u.ativo && (
                        <button onClick={() => handleDeactivate(u)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600" title="Desativar acesso">
                          <Lock size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && usuarios.length > 0 && <Pagination page={paginaAtual} totalPages={totalPaginas} totalItems={usuarios.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />}
      </div>

      {newModal && (
        <Modal title="Novo usuário" onClose={() => setNewModal(false)}>
          <form onSubmit={handleCreate} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome" required>
              <input className={inputCls} required value={newForm.nome} onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })} />
            </Field>
            <Field label="E-mail" required>
              <input type="email" className={inputCls} required value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
            </Field>
            <Field label="Cargo" required>
              <select className={inputCls} value={newForm.cargo} onChange={(e) => setNewForm({ ...newForm, cargo: e.target.value })}>
                {CARGOS_USUARIO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Senha provisória" required>
              <input type="password" className={inputCls} required minLength={6} value={newForm.senha} onChange={(e) => setNewForm({ ...newForm, senha: e.target.value })} />
            </Field>
            <Field label="Confirmar senha" required>
              <input type="password" className={inputCls} required minLength={6} value={newForm.confirmarSenha} onChange={(e) => setNewForm({ ...newForm, confirmarSenha: e.target.value })} />
            </Field>
            <p className="text-xs text-stone-400 mb-4">Combine essa senha com a pessoa — ela pode trocar depois pelo próprio Supabase, se você quiser habilitar isso futuramente.</p>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNewModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar usuário'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar ${editing.nome}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEditSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome" required>
              <input className={inputCls} required value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </Field>
            <Field label="Cargo" required>
              <select className={inputCls} value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })}>
                {CARGOS_USUARIO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Ativo">
              <select className={inputCls} value={editForm.ativo ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, ativo: e.target.value === 'true' })}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </Field>
            <p className="text-xs text-stone-400 mb-4">E-mail e senha não são editáveis por aqui. Para redefinir a senha de alguém, use Authentication → Users → ... → Reset password no painel do Supabase.</p>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setEditing(null)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}