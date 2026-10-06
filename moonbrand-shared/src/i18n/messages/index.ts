import { auth } from './auth';
import { brand } from './brand';
import { catalog } from './catalog';
import { chat } from './chat';
import { common } from './common';
import { contents } from './contents';
import { days } from './days';
import { email } from './email';
import { errors } from './errors';
import { ideas } from './ideas';
import { language } from './language';
import { onboarding } from './onboarding';
import { plan } from './plan';
import { profile } from './profile';
import { sections } from './sections';
import { server } from './server';
import { shell } from './shell';
import { steps } from './steps';
import { ui } from './ui';

// Le aree dei testi: il nome dell'area è la prima parte della chiave ('shell.newChat').
export const NAMESPACES = {
  auth,
  brand,
  catalog,
  chat,
  common,
  contents,
  days,
  email,
  errors,
  ideas,
  language,
  onboarding,
  plan,
  profile,
  sections,
  server,
  shell,
  steps,
  ui,
};
