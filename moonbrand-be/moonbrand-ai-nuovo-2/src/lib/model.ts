// Il modello di Claude per i lavori del motore: scelto qui, mai lasciato al default dell'SDK (che era Fable 5.1, il più
// caro, 14/10/2026). CLAUDE_MODEL nel .env per cambiarlo senza toccare il codice.
export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
