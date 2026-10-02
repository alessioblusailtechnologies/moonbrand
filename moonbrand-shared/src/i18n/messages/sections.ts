import { defineMessages } from '../define';

// Le sezioni del profilo di un brand (domain/sections): nome, titolo e sottotitolo per tipo di brand, errori e riepiloghi.
export const sections = defineMessages({
  it: {
    identity: {
      name: { person: 'Chi sei', company: 'Chi siete', client: 'Il cliente' },
      title: { person: 'Chi sei e cosa fai', company: 'Chi siete e cosa fate', client: 'Chi è il cliente e cosa fa' },
      subtitle: {
        person: 'Serve nei post: nome, ruolo e una frase che dice cosa fai davvero. Se c’è un sito, lo leggo e preparo i passi successivi.',
        company:
          'Serve nei post: nome, settore e una frase che dice cosa fa davvero l’azienda. Se c’è un sito, lo leggo e preparo i passi successivi.',
        client: 'Serve nei post: nome, settore e una frase che dice cosa fa davvero il cliente. Se c’è un sito, lo leggo e preparo i passi successivi.',
      },
    },
    positioning: {
      name: { person: 'Obiettivo', company: 'Obiettivo', client: 'Obiettivo' },
      title: { person: 'Perché pubblichi e per chi', company: 'Perché pubblicate e per chi', client: 'Perché pubblica e per chi' },
      subtitle: {
        person: 'Da qui decido il taglio: un post per founder non somiglia a un post per candidati.',
        company: 'Da qui decido il taglio: un post per chi compra non somiglia a un post per chi cerca lavoro.',
        client: 'Da qui decido il taglio: un post per chi compra non somiglia a un post per chi cerca lavoro.',
      },
    },
    channels: {
      name: { person: 'Canali', company: 'Canali', client: 'Canali' },
      title: { person: 'Scegli i canali', company: 'Scegli i canali', client: 'Scegli i canali' },
      subtitle: {
        person: 'Le proposte si adattano ai canali scelti. Collegarli serve a pubblicare al posto tuo: puoi farlo adesso o più avanti.',
        company: 'Le proposte si adattano ai canali scelti. Collegarli serve a pubblicare al posto tuo: puoi farlo adesso o più avanti.',
        client: 'Le proposte si adattano ai canali scelti. Collegarli serve a pubblicare al posto tuo: puoi farlo adesso o più avanti.',
      },
    },
    themes: {
      name: { person: 'Temi', company: 'Temi', client: 'Temi' },
      title: { person: 'I tuoi temi', company: 'I temi del brand', client: 'I temi del cliente' },
      subtitle: {
        person: 'Per ognuno scegli quanto spesso deve uscire: il piano dà più spazio ai temi che escono spesso.',
        company: 'Per ognuno scegli quanto spesso deve uscire: il piano dà più spazio ai temi che escono spesso.',
        client: 'Per ognuno scegli quanto spesso deve uscire: il piano dà più spazio ai temi che escono spesso.',
      },
    },
    voice: {
      name: { person: 'Voce', company: 'Voce', client: 'Voce' },
      title: { person: 'Come scrivi', company: 'Come scrive il brand', client: 'Come scrive il cliente' },
      subtitle: {
        person: 'Leggo testi reali e ne ricavo registro, ritmo e lessico. È la parte che fa la differenza.',
        company: 'Leggo testi reali e ne ricavo registro, ritmo e lessico. È la parte che fa la differenza.',
        client: 'Leggo testi reali e ne ricavo registro, ritmo e lessico. È la parte che fa la differenza.',
      },
    },
    visual: {
      name: { person: 'Identità', company: 'Identità', client: 'Identità' },
      title: { person: 'Come vuoi apparire', company: 'Come appare il brand', client: 'Come appare il cliente' },
      subtitle: {
        person: 'Logo, colori e qualche immagine che ti piace: ne ricavo lo stile delle card e ti mostro un esempio per ogni canale.',
        company: 'Logo, colori e qualche immagine che ti piace: ne ricavo lo stile delle card e ti mostro un esempio per ogni canale.',
        client: 'Logo, colori e qualche immagine che ti piace: ne ricavo lo stile delle card e ti mostro un esempio per ogni canale.',
      },
    },
    references: {
      name: { person: 'Riferimenti', company: 'Riferimenti', client: 'Riferimenti' },
      title: { person: 'Riferimenti e fonti', company: 'Riferimenti e fonti', client: 'Riferimenti e fonti' },
      subtitle: {
        person: 'Profili da cui imparare, fonti dei segnali e le date che contano. Servono a proporre idee con un appiglio reale.',
        company: 'Profili da cui imparare, fonti dei segnali e le date che contano. Servono a proporre idee con un appiglio reale.',
        client: 'Profili da cui imparare, fonti dei segnali e le date che contano. Servono a proporre idee con un appiglio reale.',
      },
    },
    errors: {
      identityPerson: 'Mi servono almeno il tuo nome e una frase su cosa fai.',
      identityOther: 'Mi servono almeno il nome e una frase su cosa fa.',
      goal: 'Scegli almeno un obiettivo.',
      audience: 'Scegli almeno un pubblico.',
      channel: 'Scegli almeno un canale.',
      theme: 'Serve almeno un tema.',
      themeName: 'Dai un nome a ogni tema.',
      weights: 'I pesi devono fare 100.',
    },
    summary: {
      roleAt: '{role} di {company}',
      toComplete: 'Da completare',
      forAudiences: 'per {audiences}',
      postsPerWeek: '{n, plural, one {# uscita} other {# uscite}} a settimana',
      noChannels: 'Nessun canale scelto',
      connected: '{channel} collegato',
      toConnect: '{channel} da collegare',
      noThemes: 'Nessun tema',
      voiceCard: 'Scheda v{version} da {source}',
      noVoice: 'Da completare: nessun testo analizzato',
      logo: 'Logo caricato',
      noLogo: 'Nessun logo',
      references: '{n, plural, one {# riferimento} other {# riferimenti}}',
      lineReady: 'linea pronta',
      signature: 'firma sulle card',
      sources:
        '{profiles, plural, one {# profilo} other {# profili}} · {sources, plural, one {# fonte} other {# fonti}} · {dates, plural, one {# data} other {# date}}',
    },
  },
  en: {
    identity: {
      name: { person: 'About you', company: 'About you', client: 'The client' },
      title: { person: 'Who you are and what you do', company: 'Who you are and what you do', client: 'Who the client is and what they do' },
      subtitle: {
        person: 'It goes into the posts: name, role and one sentence on what you really do. If there’s a website, I’ll read it and prepare the next steps.',
        company:
          'It goes into the posts: name, industry and one sentence on what the company really does. If there’s a website, I’ll read it and prepare the next steps.',
        client:
          'It goes into the posts: name, industry and one sentence on what the client really does. If there’s a website, I’ll read it and prepare the next steps.',
      },
    },
    positioning: {
      name: { person: 'Goal', company: 'Goal', client: 'Goal' },
      title: { person: 'Why you post and for whom', company: 'Why you post and for whom', client: 'Why they post and for whom' },
      subtitle: {
        person: 'This sets the angle: a post for founders doesn’t look like a post for candidates.',
        company: 'This sets the angle: a post for buyers doesn’t look like a post for job seekers.',
        client: 'This sets the angle: a post for buyers doesn’t look like a post for job seekers.',
      },
    },
    channels: {
      name: { person: 'Channels', company: 'Channels', client: 'Channels' },
      title: { person: 'Choose the channels', company: 'Choose the channels', client: 'Choose the channels' },
      subtitle: {
        person: 'Suggestions adapt to the channels you choose. Connecting them lets me publish for you: now or later.',
        company: 'Suggestions adapt to the channels you choose. Connecting them lets me publish for you: now or later.',
        client: 'Suggestions adapt to the channels you choose. Connecting them lets me publish for you: now or later.',
      },
    },
    themes: {
      name: { person: 'Topics', company: 'Topics', client: 'Topics' },
      title: { person: 'Your topics', company: 'The brand’s topics', client: 'The client’s topics' },
      subtitle: {
        person: 'For each one, choose how often it should come up: the plan gives more room to frequent topics.',
        company: 'For each one, choose how often it should come up: the plan gives more room to frequent topics.',
        client: 'For each one, choose how often it should come up: the plan gives more room to frequent topics.',
      },
    },
    voice: {
      name: { person: 'Voice', company: 'Voice', client: 'Voice' },
      title: { person: 'How you write', company: 'How the brand writes', client: 'How the client writes' },
      subtitle: {
        person: 'I read real texts and work out register, rhythm and vocabulary. This is the part that makes the difference.',
        company: 'I read real texts and work out register, rhythm and vocabulary. This is the part that makes the difference.',
        client: 'I read real texts and work out register, rhythm and vocabulary. This is the part that makes the difference.',
      },
    },
    visual: {
      name: { person: 'Look', company: 'Look', client: 'Look' },
      title: { person: 'How you want to look', company: 'How the brand looks', client: 'How the client looks' },
      subtitle: {
        person: 'Logo, colours and a few images you like: I’ll work out the style of the cards and show you an example for each channel.',
        company: 'Logo, colours and a few images you like: I’ll work out the style of the cards and show you an example for each channel.',
        client: 'Logo, colours and a few images you like: I’ll work out the style of the cards and show you an example for each channel.',
      },
    },
    references: {
      name: { person: 'References', company: 'References', client: 'References' },
      title: { person: 'References and sources', company: 'References and sources', client: 'References and sources' },
      subtitle: {
        person: 'Profiles to learn from, signal sources and the dates that matter. They help suggest ideas with a real hook.',
        company: 'Profiles to learn from, signal sources and the dates that matter. They help suggest ideas with a real hook.',
        client: 'Profiles to learn from, signal sources and the dates that matter. They help suggest ideas with a real hook.',
      },
    },
    errors: {
      identityPerson: 'I need at least your name and one sentence on what you do.',
      identityOther: 'I need at least the name and one sentence on what they do.',
      goal: 'Choose at least one goal.',
      audience: 'Choose at least one audience.',
      channel: 'Choose at least one channel.',
      theme: 'Add at least one topic.',
      themeName: 'Give each topic a name.',
      weights: 'The weights must add up to 100.',
    },
    summary: {
      roleAt: '{role} at {company}',
      toComplete: 'To complete',
      forAudiences: 'for {audiences}',
      postsPerWeek: '{n, plural, one {# post} other {# posts}} a week',
      noChannels: 'No channel chosen',
      connected: '{channel} connected',
      toConnect: '{channel} to connect',
      noThemes: 'No topics',
      voiceCard: 'Card v{version} from {source}',
      noVoice: 'To complete: no text analysed',
      logo: 'Logo uploaded',
      noLogo: 'No logo',
      references: '{n, plural, one {# reference} other {# references}}',
      lineReady: 'style ready',
      signature: 'signature on cards',
      sources:
        '{profiles, plural, one {# profile} other {# profiles}} · {sources, plural, one {# source} other {# sources}} · {dates, plural, one {# date} other {# dates}}',
    },
  },
  fr: {
    identity: {
      name: { person: 'Vous', company: 'Vous', client: 'Le client' },
      title: { person: 'Qui vous êtes et ce que vous faites', company: 'Qui vous êtes et ce que vous faites', client: 'Qui est le client et ce qu’il fait' },
      subtitle: {
        person:
          'Cela sert dans les publications : nom, fonction et une phrase sur ce que vous faites vraiment. S’il y a un site, je le lis et je prépare les étapes suivantes.',
        company:
          'Cela sert dans les publications : nom, secteur et une phrase sur ce que fait vraiment l’entreprise. S’il y a un site, je le lis et je prépare les étapes suivantes.',
        client:
          'Cela sert dans les publications : nom, secteur et une phrase sur ce que fait vraiment le client. S’il y a un site, je le lis et je prépare les étapes suivantes.',
      },
    },
    positioning: {
      name: { person: 'Objectif', company: 'Objectif', client: 'Objectif' },
      title: { person: 'Pourquoi vous publiez et pour qui', company: 'Pourquoi vous publiez et pour qui', client: 'Pourquoi il publie et pour qui' },
      subtitle: {
        person: 'C’est ce qui décide de l’angle : une publication pour des fondateurs ne ressemble pas à une publication pour des candidats.',
        company: 'C’est ce qui décide de l’angle : une publication pour des acheteurs ne ressemble pas à une publication pour des candidats.',
        client: 'C’est ce qui décide de l’angle : une publication pour des acheteurs ne ressemble pas à une publication pour des candidats.',
      },
    },
    channels: {
      name: { person: 'Réseaux', company: 'Réseaux', client: 'Réseaux' },
      title: { person: 'Choisissez les réseaux', company: 'Choisissez les réseaux', client: 'Choisissez les réseaux' },
      subtitle: {
        person: 'Les propositions s’adaptent aux réseaux choisis. Les connecter me permet de publier à votre place : maintenant ou plus tard.',
        company: 'Les propositions s’adaptent aux réseaux choisis. Les connecter me permet de publier à votre place : maintenant ou plus tard.',
        client: 'Les propositions s’adaptent aux réseaux choisis. Les connecter me permet de publier à votre place : maintenant ou plus tard.',
      },
    },
    themes: {
      name: { person: 'Thèmes', company: 'Thèmes', client: 'Thèmes' },
      title: { person: 'Vos thèmes', company: 'Les thèmes de la marque', client: 'Les thèmes du client' },
      subtitle: {
        person: 'Pour chacun, choisissez à quelle fréquence il doit revenir : le planning laisse plus de place aux thèmes fréquents.',
        company: 'Pour chacun, choisissez à quelle fréquence il doit revenir : le planning laisse plus de place aux thèmes fréquents.',
        client: 'Pour chacun, choisissez à quelle fréquence il doit revenir : le planning laisse plus de place aux thèmes fréquents.',
      },
    },
    voice: {
      name: { person: 'Voix', company: 'Voix', client: 'Voix' },
      title: { person: 'Comment vous écrivez', company: 'Comment écrit la marque', client: 'Comment écrit le client' },
      subtitle: {
        person: 'Je lis de vrais textes et j’en tire le registre, le rythme et le vocabulaire. C’est ce qui fait la différence.',
        company: 'Je lis de vrais textes et j’en tire le registre, le rythme et le vocabulaire. C’est ce qui fait la différence.',
        client: 'Je lis de vrais textes et j’en tire le registre, le rythme et le vocabulaire. C’est ce qui fait la différence.',
      },
    },
    visual: {
      name: { person: 'Identité', company: 'Identité', client: 'Identité' },
      title: { person: 'L’image que vous voulez donner', company: 'L’image de la marque', client: 'L’image du client' },
      subtitle: {
        person: 'Logo, couleurs et quelques images que vous aimez : j’en tire le style des visuels et je vous montre un exemple par réseau.',
        company: 'Logo, couleurs et quelques images que vous aimez : j’en tire le style des visuels et je vous montre un exemple par réseau.',
        client: 'Logo, couleurs et quelques images que vous aimez : j’en tire le style des visuels et je vous montre un exemple par réseau.',
      },
    },
    references: {
      name: { person: 'Références', company: 'Références', client: 'Références' },
      title: { person: 'Références et sources', company: 'Références et sources', client: 'Références et sources' },
      subtitle: {
        person: 'Des profils dont s’inspirer, les sources des signaux et les dates qui comptent. Ils servent à proposer des idées ancrées dans le réel.',
        company: 'Des profils dont s’inspirer, les sources des signaux et les dates qui comptent. Ils servent à proposer des idées ancrées dans le réel.',
        client: 'Des profils dont s’inspirer, les sources des signaux et les dates qui comptent. Ils servent à proposer des idées ancrées dans le réel.',
      },
    },
    errors: {
      identityPerson: 'Il me faut au moins votre nom et une phrase sur ce que vous faites.',
      identityOther: 'Il me faut au moins le nom et une phrase sur ce qu’il fait.',
      goal: 'Choisissez au moins un objectif.',
      audience: 'Choisissez au moins un public.',
      channel: 'Choisissez au moins un réseau.',
      theme: 'Il faut au moins un thème.',
      themeName: 'Donnez un nom à chaque thème.',
      weights: 'Les poids doivent faire 100.',
    },
    summary: {
      roleAt: '{role} chez {company}',
      toComplete: 'À compléter',
      forAudiences: 'pour {audiences}',
      postsPerWeek: '{n, plural, one {# publication} other {# publications}} par semaine',
      noChannels: 'Aucun réseau choisi',
      connected: '{channel} connecté',
      toConnect: '{channel} à connecter',
      noThemes: 'Aucun thème',
      voiceCard: 'Fiche v{version} à partir de {source}',
      noVoice: 'À compléter : aucun texte analysé',
      logo: 'Logo importé',
      noLogo: 'Aucun logo',
      references: '{n, plural, one {# référence} other {# références}}',
      lineReady: 'ligne prête',
      signature: 'signature sur les visuels',
      sources:
        '{profiles, plural, one {# profil} other {# profils}} · {sources, plural, one {# source} other {# sources}} · {dates, plural, one {# date} other {# dates}}',
    },
  },
});
