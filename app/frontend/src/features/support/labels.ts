export const FEEDBACK_CATEGORY_LABEL = { SUGGESTION: 'Sugestão', PRAISE: 'Elogio', COMPLAINT: 'Reclamação', BUG: 'Problema no sistema' } as const;
export const TICKET_CATEGORY_LABEL = { ACCOUNT: 'Minha conta', BOOKING: 'Agendamentos', SHOP: 'Minha empresa', BUG: 'Erro no sistema', OTHER: 'Outro assunto' } as const;
export const TICKET_STATUS_LABEL = { OPEN: 'Aberto', IN_PROGRESS: 'Em atendimento', CLOSED: 'Encerrado' } as const;
export const TICKET_STATUS_TONE = { OPEN: 'info', IN_PROGRESS: 'warning', CLOSED: 'neutral' } as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORY_LABEL;
export type TicketCategory = keyof typeof TICKET_CATEGORY_LABEL;
export type TicketStatus = keyof typeof TICKET_STATUS_LABEL;

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
