/**
 * Notifications du client aux étapes clés du dossier (US-F1).
 *
 * Centralise le choix du gabarit selon l'événement, la génération dans la
 * langue du client et l'envoi tracé. Les routes n'ont plus qu'à déclarer
 * l'événement survenu.
 */

import { pool } from "../db/pool.js";
import { genererCourrier } from "./courriers.js";
import { envoyerCourrier } from "./envoiCourrier.js";

/** Étapes du dossier donnant lieu à une notification client. */
export type EvenementDossier =
  | "accuseReception"
  | "demandePieces"
  | "proposition"
  | "escalade"
  | "notificationReglement"
  | "cloture";

/**
 * Prépare le courrier correspondant à un événement, dans la langue du
 * dossier, sans l'envoyer. Utilisé pour l'envoi comme pour la
 * prévisualisation, afin que les deux restent toujours cohérents.
 */
export async function genererCourrierDossier(
  numeroDossier: string,
  evenement: EvenementDossier
): Promise<{ texte: string; langue: string; destinataire: string } | null> {
  const result = await pool.query(
    `SELECT numero_dossier, nom_client, email_client, langue, type_reclamation,
            date_depot, base_juridique, delai_cible_jours, date_echeance,
            organe_escalade, recevable, motif_irrecevabilite,
            montant_reclame, montant_indemnite_eur, delai_traitement_jours
       FROM dossiers_reclamation
      WHERE numero_dossier = $1`,
    [numeroDossier]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];

  const enTexte = (valeur: unknown) =>
    valeur instanceof Date ? valeur.toLocaleDateString("fr-CA") : (valeur ?? null);

  // Le courrier de règlement parle du délai réellement écoulé, les autres
  // du délai de réponse encore attendu.
  const estReglement = evenement === "notificationReglement";

  const texte = genererCourrier(
    {
      numeroDossier: row.numero_dossier,
      nomClient: row.nom_client,
      dateDepot: enTexte(row.date_depot) as string,
      typeReclamation: row.type_reclamation,
      baseJuridique: row.base_juridique ?? null,
      delaiCibleJours: estReglement
        ? row.delai_traitement_jours ?? null
        : row.delai_cible_jours ?? null,
      dateEcheance: enTexte(row.date_echeance) as string | null,
      recevable: row.recevable ?? null,
      motifIrrecevabilite: row.motif_irrecevabilite ?? null,
      montantReclame: estReglement
        ? (row.montant_indemnite_eur !== null ? Number(row.montant_indemnite_eur) : null)
        : (row.montant_reclame !== null ? Number(row.montant_reclame) : null),
      organeEscalade: row.organe_escalade ?? null,
    },
    row.langue,
    evenement
  );

  return { texte, langue: row.langue, destinataire: row.email_client };
}

/** Génère puis envoie la notification correspondant à l'événement (US-F1). */
export async function notifierClient(
  numeroDossier: string,
  evenement: EvenementDossier
): Promise<boolean> {
  const courrier = await genererCourrierDossier(numeroDossier, evenement);
  if (!courrier) return false;

  await envoyerCourrier({
    numeroDossier,
    typeCourrier: evenement,
    destinataire: courrier.destinataire,
    langue: courrier.langue,
    contenu: courrier.texte,
  });

  return true;
}