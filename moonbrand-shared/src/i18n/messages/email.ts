import { defineMessages } from '../define';

// Le email che manda l'API (con Resend), nella lingua dell'account. {name} è il nome dell'account, {url} il link.
export const email = defineMessages({
  it: {
    footer: 'Hai ricevuto questa email perché il tuo indirizzo è stato usato su Moonbrand. Se non ne sai niente, ignorala.',
    linkHint: 'Se il pulsante non funziona, copia questo indirizzo nel browser:',
    welcome: {
      subject: 'Ti diamo il benvenuto su Moonbrand: conferma la tua email',
      title: 'Ciao {name}, il tuo studio è pronto',
      body: 'Da qui costruisci il tuo brand, trovi le idee, pianifichi le uscite e prepari i contenuti per i social, con l’assistente che scrive come scriveresti tu.',
      confirm: 'Conferma la tua email per tenere l’account al sicuro e poter recuperare la password.',
      button: 'Conferma l’email',
    },
    confirm: {
      subject: 'Conferma la tua email su Moonbrand',
      title: 'Conferma la tua email',
      body: 'Ciao {name}, apri il link per confermare che questo indirizzo è tuo.',
      button: 'Conferma l’email',
    },
    reset: {
      subject: 'Scegli una nuova password per Moonbrand',
      title: 'Una nuova password',
      body: 'Ciao {name}, qualcuno ha chiesto di cambiare la password del tuo account. Il link vale un’ora e si usa una volta sola.',
      ignore: 'Se non l’hai chiesto tu, ignora questa email: la password resta quella di prima.',
      button: 'Scegli la nuova password',
    },
  },
  en: {
    footer: 'You received this email because your address was used on Moonbrand. If it wasn’t you, ignore it.',
    linkHint: 'If the button doesn’t work, copy this address into your browser:',
    welcome: {
      subject: 'Welcome to Moonbrand: confirm your email',
      title: 'Hi {name}, your studio is ready',
      body: 'This is where you build your brand, find ideas, plan your posts and prepare content for social media, with an assistant that writes the way you would.',
      confirm: 'Confirm your email to keep your account safe and be able to recover your password.',
      button: 'Confirm email',
    },
    confirm: {
      subject: 'Confirm your email on Moonbrand',
      title: 'Confirm your email',
      body: 'Hi {name}, open the link to confirm this address is yours.',
      button: 'Confirm email',
    },
    reset: {
      subject: 'Choose a new password for Moonbrand',
      title: 'A new password',
      body: 'Hi {name}, someone asked to change your account password. The link is valid for one hour and works only once.',
      ignore: 'If you didn’t ask for it, ignore this email: your password stays the same.',
      button: 'Choose a new password',
    },
  },
  fr: {
    footer: 'Vous recevez cet e-mail parce que votre adresse a été utilisée sur Moonbrand. Si ce n’était pas vous, ignorez-le.',
    linkHint: 'Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :',
    welcome: {
      subject: 'Bienvenue sur Moonbrand : confirmez votre e-mail',
      title: 'Bonjour {name}, votre studio est prêt',
      body: 'C’est ici que vous construisez votre marque, trouvez des idées, planifiez vos publications et préparez vos contenus pour les réseaux, avec un assistant qui écrit comme vous le feriez.',
      confirm: 'Confirmez votre e-mail pour sécuriser votre compte et pouvoir récupérer votre mot de passe.',
      button: 'Confirmer l’e-mail',
    },
    confirm: {
      subject: 'Confirmez votre e-mail sur Moonbrand',
      title: 'Confirmez votre e-mail',
      body: 'Bonjour {name}, ouvrez le lien pour confirmer que cette adresse est la vôtre.',
      button: 'Confirmer l’e-mail',
    },
    reset: {
      subject: 'Choisissez un nouveau mot de passe pour Moonbrand',
      title: 'Un nouveau mot de passe',
      body: 'Bonjour {name}, quelqu’un a demandé à changer le mot de passe de votre compte. Le lien est valable une heure et ne fonctionne qu’une fois.',
      ignore: 'Si vous n’en êtes pas à l’origine, ignorez cet e-mail : votre mot de passe reste le même.',
      button: 'Choisir un nouveau mot de passe',
    },
  },
});
