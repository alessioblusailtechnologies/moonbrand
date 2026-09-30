// Il modello di Claude per il job: lo sceglie il worker (CLAUDE_MODEL_<TIPO> nel .env, es. CLAUDE_MODEL_IDEAS, o il job
// stesso) e arriva allo script in MOONBRAND_MODEL. Senza, Claude Code usa il suo modello predefinito.
export function claudeModel(): { model?: string } {
  const model = process.env.MOONBRAND_MODEL;
  return model ? { model } : {};
}
