export const UE_NAMES: Record<string, string> = {
  PR: "Produire",
  AG: "Agir",
  CN: "Concevoir",
  PROJET: "Projet",
  PL: "Piloter",
  SH: "Sciences Humaines",
  STOUV: "Stage Ouvrier",
  CDSF: "Cahier des Spécifications Fonctionnel",
  MIF: "Mathématiques et Informatique Fondamentales",
  MIA: "Mathématiques et Informatique Avancées",
  LANGAGES: "Ingénierie des Sciences du Numériques - LANGAGES",
  BASES: "Ingénierie des Sciences du Numériques - BASES",
  CYBER: "Cybersécurité (techniques et outils)",
  SHSJC: "Sciences Humaines, Sociales, Juridiques et de Communication",
  ENT: "Rapport de stage",
};


export function getUeName(code: string): string {
  return UE_NAMES[code.toUpperCase()] || code;
}

export function isUe(code: string): boolean {
  return Object.values(UE_NAMES)
    .map((name) => name.toUpperCase())
    .includes(code.toUpperCase());
}
