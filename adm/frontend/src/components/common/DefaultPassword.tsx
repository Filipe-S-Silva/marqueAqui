import { KeyRound } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';

/** Mostra ao admin a senha provisória de novos gestores, para repassar. A troca é obrigatória no primeiro acesso. */
export function DefaultPassword() {
  const r = useAsync(() => api.get<{ managerPassword: string }>('/defaults').catch(() => null), []);
  if (!r.data) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
      <KeyRound className="size-4 shrink-0 text-primary" aria-hidden />
      <span>Senha provisória de um gestor novo: <code className="rounded bg-background px-1.5 py-0.5 font-mono font-bold select-all">{r.data.managerPassword}</code></span>
      <span className="text-muted-foreground">O gestor precisa trocá-la no primeiro acesso. Se o e-mail já tem conta, a senha dele não muda.</span>
    </p>
  );
}
