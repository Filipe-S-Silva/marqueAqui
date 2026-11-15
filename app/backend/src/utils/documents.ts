// Geração de CSV e de documento .doc (HTML compatível com o Word). Spec 13.

const FORMULA_START = /^[=+\-@\t\r]/;

/** CSV com proteção contra injeção de fórmula em planilhas (CSV injection). */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
    return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  // BOM para o Excel reconhecer UTF-8
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface WordDocInput {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  footer?: string;
}

/** Documento .doc (HTML aceito pelo Microsoft Word). Todo conteúdo é escapado. */
export function buildWordDoc(input: WordDocInput): string {
  const th = input.headers.map((h) => `<th style="border:1px solid #444;padding:4px 8px;background:#e8eefc">${escapeHtml(h)}</th>`).join('');
  const body = input.rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td style="border:1px solid #888;padding:4px 8px">${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1{font-size:16pt}table{border-collapse:collapse;width:100%}</style></head>
<body>
<h1>${escapeHtml(input.title)}</h1>
${input.subtitle ? `<p>${escapeHtml(input.subtitle)}</p>` : ''}
<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
${input.footer ? `<p style="margin-top:12pt;color:#555">${escapeHtml(input.footer)}</p>` : ''}
</body></html>`;
}

/** Máscara de telefone para conferência: mantém DDD e os 2 últimos dígitos. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 8) return '';
  const ddd = digits.length >= 10 ? digits.slice(0, 2) : '';
  const last = digits.slice(-2);
  return `${ddd ? `(${ddd}) ` : ''}*****-**${last}`;
}
