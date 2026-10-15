// I lavori che il motore nuovo 2 non fa ancora. Il worker legge i messaggi dell'SDK di Claude: qui si scrive solo il
// risultato. video-setup: niente da preparare, il job finisce bene. Gli altri (i video) falliscono con il motivo.
const [kind] = process.argv.slice(2);

const emit = (message: unknown) => console.log(JSON.stringify(message));

if (kind === 'video-setup') emit({ type: 'result', subtype: 'success', structured_output: {} });
else emit({ type: 'result', subtype: 'error_during_execution', errors: ['I video non sono ancora nel motore nuovo 2.'] });
