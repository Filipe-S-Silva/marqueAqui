import { useId, type ReactElement, cloneElement } from 'react';
import { Label } from '@/components/ui/label';

interface Props {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}

export function Field({ label, error, hint, children }: Props) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? msgId : undefined })}
      {error ? <p id={msgId} role="alert" className="text-xs text-destructive">{error}</p>
        : hint ? <p id={msgId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
