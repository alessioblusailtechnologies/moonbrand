// Claude Code esegue insieme solo i tool MCP che si dichiarano di sola lettura: gli altri, anche se Claude li chiede
// nello stesso momento, vanno in fila. I tool che non si pestano i piedi (ognuno scrive il suo file) si dichiarano così
// per girare insieme: tre immagini o due controlli chiesti insieme finiscono nel tempo di uno. Sui permessi non cambia
// niente, i job girano con bypassPermissions.
export const PARALLEL = { alwaysLoad: true, annotations: { readOnlyHint: true } } as const;
