import type { Identity } from '@moonbrand/shared/domain/brand';

// Il form "Inizia con Moonbrand" del sito apre /register con nome, email, brand e lingua nell'indirizzo.
// Nome ed email riempiono la registrazione; il brand aspetta l'onboarding, che arriva dopo la conferma dell'email
// (anche da un'altra scheda), quindi resta nel browser finché il primo brand non lo usa.
const BRAND_KEY = 'mb.signup.brand';

export interface SignupPrefill {
  name: string;
  email: string;
  lang: string | null;
}

export function readSignupPrefill(params: URLSearchParams): SignupPrefill {
  const brand = params.get('brand')?.trim().slice(0, 120);
  if (brand) {
    try {
      localStorage.setItem(BRAND_KEY, brand);
    } catch {
      // Senza storage il nome del brand si scrive nell'onboarding.
    }
  }
  return { name: params.get('name')?.trim() ?? '', email: params.get('email')?.trim() ?? '', lang: params.get('lang') };
}

/** Il nome del brand lasciato dal sito, una volta sola: va nel campo giusto dell'identità se è ancora vuoto. */
export function takeSignupBrand(identity: Identity): Identity {
  let brand: string | null = null;
  try {
    brand = localStorage.getItem(BRAND_KEY);
    localStorage.removeItem(BRAND_KEY);
  } catch {
    return identity;
  }
  // Per una persona il brand è l'azienda; il nome è il suo.
  const key = identity.kind === 'person' ? 'company' : 'name';
  return brand && !identity[key].trim() ? { ...identity, [key]: brand } : identity;
}
