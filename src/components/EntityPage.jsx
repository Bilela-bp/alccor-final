import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { get, insertRow, updateRow, deleteRow } from '../lib/supabase';
import { fmtCurrency, fmtDate, maskCPF, isValidCPF, maskCNPJ, isValidCNPJ, maskPhone, isValidEmail } from '../lib/helpers';
import { WOOD } from '../lib/theme';
import { Badge, Modal, Field, ComboSelect, PrimaryButton, SecondaryButton, EmptyState, LoadingRows, PageHeader, Pagination, inputCls } from './ui';

export default function EntityPage({ table, title, Icon, fields, subtitle, onChanged, afterSave }) {
  const submittingRef = useRef(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [lookups, setLookups] = useState({});
  const [novoGrupoFor, setNovoGrupoFor] = useState(null); // key do campo que está criando grupo novo
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 12;

  const refFields = useMemo(() => fields.filter((f) => f.refTable || f.type === 'grupo'), [fields]);

  const loadLookups = useCallback(async () => {
    const results = {};
    for (const f of refFields) {
      const lookupTable = f.type === 'grupo' ? 'grupos_produtos' : f.refTable;
      const labelField = f.type === 'grupo' ? 'nome' : f.refLabel;
      try {
        const data = await get(lookupTable, `&order=${labelField}.asc`);
        // Para "grupo", o produto guarda o NOME do grupo direto (texto), não um id —
        // então tanto id quanto label do option usam o nome.
        results[f.key] = f.type === 'grupo'
          ? (data || []).map((d) => ({ id: d[labelField], label: d[labelField] }))
          : (data || []).map((d) => ({ id: d.id, label: d[labelField] }));
      } catch (e) {
        results[f.key] = [];
      }
    }
    setLookups(results);
  }, [refFields]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(table, `&order=${fields[0].key}.asc`);
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [table, fields]);

  useEffect(() => {
    load();
    loadLookups();
  }, [load, loadLookups]);

  function labelFor(field, id) {
    if (!id) return '—';
    const opt = (lookups[field.key] || []).find((o) => o.id === id);
    return opt ? opt.label : '—';
  }

  function openNew() {
    const init = {};
    fields.forEach((f) => {
      if (f.type === 'boolean') init[f.key] = true;
      else if (f.type === 'documento') { init[f.key] = ''; init[f.tipoKey] = 'cpf'; }
      else init[f.key] = '';
    });
    setFormData(init);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(row) {
    setFormData({ ...row });
    setEditing(row);
    setModalOpen(true);
  }

  async function handleDelete(row) {
    if (!window.confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return;
    try {
      await deleteRow(table, row.id);
      load();
      onChanged && onChanged();
    } catch (e) {
      const isForeignKeyError = /foreign key constraint|violates foreign key/i.test(e.message);
      const hasAtivo = fields.some((f) => f.key === 'ativo');
      if (isForeignKeyError && hasAtivo) {
        const desativar = window.confirm(
          'Esse registro já tem lançamentos vinculados (notas, movimentações, contas, etc.) e não pode ser excluído sem perder esse histórico.\n\nDeseja desativá-lo em vez disso? Ele deixa de aparecer nas listas de seleção, mas o histórico continua intacto.'
        );
        if (desativar) {
          try {
            await updateRow(table, row.id, { ativo: false });
            await load();
            onChanged && onChanged();
          } catch (e2) {
            window.alert('Erro ao desativar: ' + e2.message);
          }
        }
      } else if (isForeignKeyError) {
        window.alert('Esse registro já tem lançamentos vinculados (notas, movimentações, contas, etc.) e não pode ser excluído sem perder esse histórico.');
      } else {
        window.alert('Erro ao excluir: ' + e.message);
      }
    }
  }

  async function handleCriarGrupo(e) {
    e.preventDefault();
    if (criandoGrupo) return;
    const nome = novoGrupoNome.trim();
    if (!nome) { window.alert('Digite um nome para o grupo.'); return; }
    setCriandoGrupo(true);
    try {
      await insertRow('grupos_produtos', { nome });
      setLookups((prev) => {
        const atual = prev[novoGrupoFor] || [];
        const jaExiste = atual.some((o) => o.label.toLowerCase() === nome.toLowerCase());
        const novaLista = jaExiste ? atual : [...atual, { id: nome, label: nome }].sort((a, b) => a.label.localeCompare(b.label));
        return { ...prev, [novoGrupoFor]: novaLista };
      });
      setFormData((prev) => ({ ...prev, [novoGrupoFor]: nome }));
      setNovoGrupoFor(null);
      setNovoGrupoNome('');
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(e.message)
        ? 'Já existe um grupo com esse nome.'
        : e.message;
      window.alert('Erro ao criar grupo: ' + msg);
    }
    setCriandoGrupo(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return; // evita lançamento duplicado (duplo clique / Enter + clique)

    for (const f of fields) {
      const v = formData[f.key];
      if (f.type === 'cpf' && v && v.replace(/\D/g, '').length > 0 && !isValidCPF(v)) {
        window.alert('CPF inválido. Confira os números antes de salvar.');
        return;
      }
      if (f.type === 'cnpj') {
        const digits = (v || '').replace(/\D/g, '');
        if (f.required && digits.length === 0) { window.alert(`Informe o CNPJ em "${f.label}".`); return; }
        if (digits.length > 0 && !isValidCNPJ(v)) { window.alert('CNPJ inválido. Confira os números antes de salvar.'); return; }
      }
      if (f.type === 'email' && v && !isValidEmail(v)) {
        window.alert(`E-mail inválido em "${f.label}". Confira se digitou o @ e o domínio corretamente (ex: nome@empresa.com).`);
        return;
      }
      if (f.type === 'phone' && f.required && (!v || v.replace(/\D/g, '').length < 10)) {
        window.alert(`Informe um telefone válido (com DDD) em "${f.label}".`);
        return;
      }
      if (f.type === 'documento') {
        const tipo = formData[f.tipoKey] || 'cpf';
        const digits = (v || '').replace(/\D/g, '');
        if (digits.length === 0) {
          if (f.required) { window.alert('Informe o CPF ou CNPJ do cliente.'); return; }
        } else {
          const valido = tipo === 'cnpj' ? isValidCNPJ(v) : isValidCPF(v);
          if (!valido) { window.alert(`${tipo.toUpperCase()} inválido. Confira os números antes de salvar.`); return; }
        }
      }
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        let v = formData[f.key];
        if (f.type === 'number') v = v === '' || v === null || v === undefined ? null : Number(v);
        if (f.type === 'select' && v === '') v = null;
        if (f.type === 'date' && v === '') v = null;
        // campo numérico opcional deixado em branco vira 0 (ex: produto novo sem custo/estoque definidos ainda)
        if (f.type === 'number' && v === null && !f.required) v = 0;
        payload[f.key] = v;
        if (f.type === 'documento') payload[f.tipoKey] = formData[f.tipoKey] || 'cpf';
      });
      const editingBefore = editing;
      const result = editingBefore ? await updateRow(table, editingBefore.id, payload) : await insertRow(table, payload);
      const savedRow = Array.isArray(result) ? result[0] : result;
      setModalOpen(false);
      await load();
      onChanged && onChanged();
      if (afterSave && savedRow) await afterSave(savedRow, editingBefore);
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(e.message)
        ? 'Já existe um registro com esse mesmo valor (verifique campos que precisam ser únicos, como número da nota).'
        : e.message;
      window.alert('Erro ao salvar: ' + msg);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  const filteredRows = rows.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const totalPaginas = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginatedRows = filteredRows.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);
  const listFields = fields.filter((f) => f.showInList !== false).slice(0, 6);

  return (
    <div>
      <PageHeader Icon={Icon} title={title} subtitle={subtitle}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-stone-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagina(1); }}
              placeholder="Buscar…"
              className="pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-amber-700/30"
            />
          </div>
          <PrimaryButton onClick={openNew}><Plus size={16} /> Novo</PrimaryButton>
        </div>
      </PageHeader>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <LoadingRows />
        ) : filteredRows.length === 0 ? (
          <EmptyState icon={Icon} text="Nenhum registro encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {listFields.map((f) => (
                    <th key={f.key} className="text-left px-4 py-2.5 font-medium text-stone-500 break-words">{f.label}</th>
                  ))}
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    {listFields.map((f) => (
                      <td key={f.key} className="px-4 py-2.5 text-stone-800 break-words">
                        {f.render ? f.render(row[f.key], row) : f.refTable ? labelFor(f, row[f.key]) : f.type === 'boolean' ? (
                          row[f.key] ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Inativo</Badge>
                        ) : f.type === 'date' ? fmtDate(row[f.key]) : f.type === 'number' && f.currency ? fmtCurrency(row[f.key]) : (row[f.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(row)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredRows.length > 0 && <Pagination page={paginaAtual} totalPages={totalPaginas} totalItems={filteredRows.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />}
      </div>

      {modalOpen && (
        <Modal title={editing ? `Editar ${title}` : `Novo em ${title}`} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            {fields.map((f) => {
              if (f.hidden || f.type === 'docTipo') return null;
              return (
              <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
                {f.type === 'select' && f.options ? (
                  <select
                    className={inputCls}
                    required={f.required}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.refTable ? (
                  <ComboSelect
                    options={lookups[f.key] || []}
                    value={formData[f.key] || ''}
                    onChange={(id) => setFormData({ ...formData, [f.key]: id })}
                    placeholder="Buscar por nome…"
                    allowClear={!f.required}
                  />
                ) : f.type === 'grupo' ? (
                  <ComboSelect
                    options={lookups[f.key] || []}
                    value={formData[f.key] || ''}
                    onChange={(nome) => setFormData({ ...formData, [f.key]: nome })}
                    placeholder="Buscar grupo…"
                    allowClear={!f.required}
                    extraAction={(closeList) => (
                      <button
                        type="button"
                        onClick={() => { closeList(); setNovoGrupoNome(''); setNovoGrupoFor(f.key); }}
                        className="w-full text-left px-3 py-2 text-sm font-medium border-b border-stone-100"
                        style={{ color: WOOD.accentDark }}
                      >
                        + Criar novo grupo…
                      </button>
                    )}
                  />
                ) : f.type === 'boolean' ? (
                  <select
                    className={inputCls}
                    value={formData[f.key] ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value === 'true' })}
                  >
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  />
                ) : f.type === 'cpf' ? (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: maskCPF(e.target.value) })}
                    />
                    {formData[f.key] && formData[f.key].replace(/\D/g, '').length === 11 && !isValidCPF(formData[f.key]) && (
                      <span className="text-xs text-red-600 mt-1 block">CPF inválido — confira os números.</span>
                    )}
                  </>
                ) : f.type === 'cnpj' ? (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: maskCNPJ(e.target.value) })}
                    />
                    {formData[f.key] && formData[f.key].replace(/\D/g, '').length === 14 && !isValidCNPJ(formData[f.key]) && (
                      <span className="text-xs text-red-600 mt-1 block">CNPJ inválido — confira os números.</span>
                    )}
                  </>
                ) : f.type === 'email' ? (
                  <>
                    <input
                      type="email"
                      placeholder="nome@empresa.com"
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    />
                    {formData[f.key] && !isValidEmail(formData[f.key]) && (
                      <span className="text-xs text-red-600 mt-1 block">E-mail inválido — precisa ter @ e um domínio (ex: nome@empresa.com).</span>
                    )}
                  </>
                ) : f.type === 'phone' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    maxLength={16}
                    className={inputCls}
                    required={f.required}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: maskPhone(e.target.value) })}
                  />
                ) : f.type === 'documento' ? (
                  <>
                    <div className="flex gap-2 mb-2">
                      {['cpf', 'cnpj'].map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => setFormData({ ...formData, [f.tipoKey]: tipo, [f.key]: '' })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                          style={(formData[f.tipoKey] || 'cpf') === tipo
                            ? { backgroundColor: WOOD.accent, color: '#fff', borderColor: WOOD.accent }
                            : { borderColor: '#D6D3D1', color: '#57534E' }}
                        >
                          {tipo.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={(formData[f.tipoKey] || 'cpf') === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                      maxLength={18}
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => {
                        const tipo = formData[f.tipoKey] || 'cpf';
                        const masked = tipo === 'cnpj' ? maskCNPJ(e.target.value) : maskCPF(e.target.value);
                        setFormData({ ...formData, [f.key]: masked });
                      }}
                    />
                    {(() => {
                      const tipo = formData[f.tipoKey] || 'cpf';
                      const digits = (formData[f.key] || '').replace(/\D/g, '');
                      const complete = tipo === 'cnpj' ? digits.length === 14 : digits.length === 11;
                      const valido = tipo === 'cnpj' ? isValidCNPJ(formData[f.key]) : isValidCPF(formData[f.key]);
                      return complete && !valido ? (
                        <span className="text-xs text-red-600 mt-1 block">{tipo.toUpperCase()} inválido — confira os números.</span>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    className={inputCls}
                    required={f.required}
                    disabled={f.readOnly}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  />
                )}
              </Field>
              );
            })}
            <div className="flex gap-2 justify-end mt-2">
              <SecondaryButton onClick={() => setModalOpen(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {novoGrupoFor !== null && (
        <Modal title="Criar novo grupo" onClose={() => setNovoGrupoFor(null)}>
          <form onSubmit={handleCriarGrupo} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome do grupo" required>
              <input className={inputCls} required autoFocus value={novoGrupoNome} onChange={(e) => setNovoGrupoNome(e.target.value)} placeholder="Ex: Madeiras, Ferragens, Tecidos…" />
            </Field>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNovoGrupoFor(null)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={criandoGrupo}>{criandoGrupo ? 'Criando…' : 'Criar e usar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}