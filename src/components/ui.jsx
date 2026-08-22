import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { WOOD } from '../lib/theme';

function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', serif; }
      .font-body { font-family: 'Inter', sans-serif; }
    `}</style>
  );
}

function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-stone-100 text-stone-700 border-stone-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, tone = 'default', sub }) {
  const toneColor = {
    default: '#292B2D',
    red: '#B23A2E',
    green: '#3F6B3F',
    amber: '#C08A3E',
  }[tone];
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex-1" style={{ minWidth: 160 }}>
      <p className="text-xs font-medium text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-display font-semibold" style={{ color: toneColor }}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,24,15,0.45)' }}>
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} overflow-y-auto overflow-x-hidden`}
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-display text-lg font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, required, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-stone-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-stone-400 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700/40 focus:border-amber-700';

function ImageLightbox({ src, alt, className = '' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`cursor-zoom-in ${className}`} aria-label={`Ampliar ${alt}`}>
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={() => setOpen(false)}>
          <button type="button" onClick={() => setOpen(false)} className="absolute top-5 right-5 rounded-lg p-2 text-white hover:bg-white/15" aria-label="Fechar imagem">
            <X size={24} />
          </button>
          <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// Campo de seleção com busca (por nome e, quando houver, por grupo/categoria),
// para substituir <select> grandes por uma lista curta e filtrável.
function ComboSelect({ options, value, onChange, placeholder = 'Buscar…', extraAction, allowClear }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(q))
    : options;

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        className={inputCls}
        placeholder={placeholder}
        value={open ? query : (selected ? selected.label : '')}
        onFocus={() => setQuery('')}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg">
          {allowClear && value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 text-sm text-stone-400 hover:bg-stone-50 border-b border-stone-100">
              Limpar seleção
            </button>
          )}
          {extraAction && extraAction(() => { setOpen(false); setQuery(''); })}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-stone-400">Nenhum resultado.</div>
          ) : filtered.map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center justify-between gap-2"
            >
              <span className="text-stone-800">{o.label}</span>
              {o.sublabel && <span className="text-xs text-stone-400 shrink-0">{o.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, type = 'button', disabled, full }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${full ? 'w-full' : ''}`}
      style={{ backgroundColor: WOOD.accent }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.backgroundColor = WOOD.accentDark)}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.backgroundColor = WOOD.accent)}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, type = 'button', danger }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
        danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-stone-400">
      <Icon size={32} className="mb-2" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function LoadingRows() {
  return <div className="py-12 text-center text-sm text-stone-400">Carregando…</div>;
}

// =========================================================================
// GENERIC CRUD ENTITY PAGE
// =========================================================================

export {
  FontStyles,
  Badge,
  Stat,
  Modal,
  Field,
  ComboSelect,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  LoadingRows,
  ImageLightbox,
  inputCls,
};
