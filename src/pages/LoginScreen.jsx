import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
import logoAlccor from "../assets/logo-alccor.png";
import { get, signIn, signOut } from "../lib/supabase";
import {
  Field,
  FontStyles,
  ImageLightbox,
  PrimaryButton,
  inputCls,
} from "../components/ui";

export default function LoginScreen({ onLogin, dark, toggleDark }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await signIn(email.trim(), password);
      const authId = session.user.id;
      const rows = await get("usuarios", `&id=eq.${authId}`);
      const perfil = rows && rows[0];
      if (!perfil) {
        await signOut();
        setError(
          'Login válido, mas não existe um cadastro correspondente na tabela "usuarios". Peça para um administrador te cadastrar.',
        );
        setLoading(false);
        return;
      }
      if (!perfil.ativo) {
        await signOut();
        setError("Seu usuário está inativo. Fale com um administrador.");
        setLoading(false);
        return;
      }
      onLogin(perfil);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div
      className="relative flex items-center justify-center bg-stone-50 p-6"
      style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh" }}
    >
      <FontStyles />
      <button
        onClick={toggleDark}
        className="absolute top-5 right-5 p-2 rounded-lg border border-stone-300 text-stone-500 hover:bg-stone-100"
        title={dark ? "Modo claro" : "Modo escuro"}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <ImageLightbox
          src={logoAlccor}
          alt="ALCCOR"
          className="w-16 h-16 rounded-xl mx-auto mb-4 overflow-hidden"
        />
        <h1 className="font-display text-xl font-semibold text-stone-900 mb-1">
          ALCCOR
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Entre com seu e-mail e senha
        </p>

        <form onSubmit={handleSubmit} className="text-left">
          <Field label="E-mail" required>
            <input
              type="email"
              required
              autoComplete="username"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </Field>
          <Field label="Senha" required>
            <input
              type="password"
              required
              autoComplete="current-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" full disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
