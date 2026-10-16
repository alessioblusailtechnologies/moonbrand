// I lavori che questo motore non fa più. Il worker legge i messaggi dell'SDK di Claude: qui si scrive solo il risultato.
// style: la guida di stile letta dai riferimenti non serve più (Claude guarda le immagini), il job finisce bene e vuoto.
// visual, visual-edit: gli esempi dell'onboarding non ci sono più, il job fallisce con il motivo.
const [kind] = process.argv.slice(2);

const emit = (message: unknown) => console.log(JSON.stringify(message));

if (kind === 'style') emit({ type: 'result', subtype: 'success', structured_output: { style: '' } });
else emit({ type: 'result', subtype: 'error_during_execution', errors: ['Gli esempi dell’onboarding non ci sono più in questo motore: il brand parte dai suoi riferimenti.'] });
