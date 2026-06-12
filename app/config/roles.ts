// app/config/roles.ts

export const ROLES = {
  PROMOTEUR: 'promoteur',
  COMPTABLE: 'comptable',
  DIRECTEUR: 'directeur',
  CAISSIER: 'caissier',
} as const;

export type RoleType = typeof ROLES[keyof typeof ROLES];

export interface RoleInfo {
  label: string;
  pin: string;
  allowedPages: string[];
  description: string;
}

export const ROLES_CONFIG: Record<RoleType, RoleInfo> = {
  [ROLES.PROMOTEUR]: {
    label: "Promoteur",
    pin: "4210",
    description: "Propriétaire & Administration totale",
    allowedPages: ['/dashboard', '/classes', '/students', '/teachers', '/finance', '/bulletins', '/performance', '/admin/settings'],
  },
  [ROLES.COMPTABLE]: {
    label: "Comptable",
    pin: "4321",
    description: "Gestion financière & Recouvrements",
    allowedPages: ['/dashboard', '/classes', '/students', '/teachers', '/finance', '/performance', '/admin/settings'],
  },
  [ROLES.DIRECTEUR]: {
    label: "Directeur",
    pin: "1228",
    description: "Gestion pédagogique & Personnel",
    // ❌ Pas d'accès à /finance
    allowedPages: ['/dashboard', '/classes', '/students', '/teachers', '/bulletins', '/performance', '/admin/settings', 'App'],
  },
  [ROLES.CAISSIER]: {
    label: "Caissier",
    pin: "5678",
    description: "Encaissements & Suivi des reçus",
    // ❌ Même accès que le Directeur sauf les bulletins (/bulletins) mais a accès à la fiche élève pour l'historique
    allowedPages: ['/dashboard', '/classes', '/students', '/teachers', '/performance', '/admin/settings'],
  },
};