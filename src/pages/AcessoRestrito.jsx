import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function AcessoRestrito() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-stone-400">
      <ShieldCheck size={32} className="mb-2" />
      <p className="text-sm">Essa área é restrita a usuários com cargo "admin".</p>
    </div>
  );
}