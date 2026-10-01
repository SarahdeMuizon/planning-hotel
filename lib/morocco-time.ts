// Heure du Maroc.
// Depuis le 20 septembre 2026, le Maroc est définitivement à l'heure GMT (UTC+0).
// Si l'heure légale change à nouveau, il suffit de modifier MOROCCO_UTC_OFFSET_MINUTES.
//
// On ne passe volontairement PAS par le fuseau 'Africa/Casablanca' : les navigateurs
// et téléphones non mis à jour l'afficheraient encore en UTC+1.

export const MOROCCO_UTC_OFFSET_MINUTES = 0;

/**
 * Renvoie un objet Date dont les champs « locaux » (getHours, getDate, format de date-fns…)
 * correspondent à l'heure qu'il est au Maroc, quel que soit le fuseau de l'appareil
 * (manager en France, téléphone d'employé mal réglé, etc.).
 */
export function moroccoNow(): Date {
  const t = Date.now() + MOROCCO_UTC_OFFSET_MINUTES * 60_000;
  // Deux passes pour rester juste même la nuit d'un changement d'heure local (ex : France).
  let shifted = new Date(t + new Date(t).getTimezoneOffset() * 60_000);
  shifted = new Date(t + shifted.getTimezoneOffset() * 60_000);
  return shifted;
}
