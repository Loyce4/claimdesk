/**
 * Intégration Odoo — le service juridique gère les dossiers depuis Odoo.
 *
 * Utilise le protocole JSON-RPC natif d'Odoo (endpoint /jsonrpc), qui ne
 * nécessite aucune dépendance externe : on utilise juste fetch (natif à
 * partir de Node 18+).
 *
 * Comportement volontaire : si Odoo est injoignable ou mal configuré, la
 * synchronisation échoue silencieusement (avec un log d'erreur) — un
 * dossier de réclamation doit toujours pouvoir être créé côté client même
 * si le service juridique / Odoo est temporairement indisponible.
 */

export interface DossierPourOdoo {
  numeroDossier: string;
  pays: string;
  typeReclamation: string;
  description: string;
  nomClient: string;
  emailClient: string;
  montantReclame: number | null;
  statut: string;
  dateEcheance: string | null;
}

interface ConfigOdoo {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  modele: string;
}

function chargerConfig(): ConfigOdoo | null {
  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const username = process.env.ODOO_USERNAME;
  const apiKey = process.env.ODOO_API_KEY;
  const modele = process.env.ODOO_MODEL ?? "claimdesk.reclamation";

  if (!url || !db || !username || !apiKey) {
    return null;
  }
  return { url, db, username, apiKey, modele };
}

let uidCache: number | null = null;

async function appelerJsonRpc(url: string, method: string, params: unknown[]): Promise<any> {
  const response = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method,
        args: params,
      },
      id: Date.now(),
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Erreur Odoo: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function authentifier(config: ConfigOdoo): Promise<number> {
  if (uidCache !== null) return uidCache;

  const response = await fetch(`${config.url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "login",
        args: [config.db, config.username, config.apiKey],
      },
      id: Date.now(),
    }),
  });

  const data = await response.json();
  if (data.error || !data.result) {
    throw new Error("Échec d'authentification Odoo — vérifie ODOO_USERNAME / ODOO_API_KEY.");
  }
 const uid = data.result as number;
  uidCache = uid;
  return uid;
}

/**
 * Crée ou met à jour le dossier correspondant dans Odoo.
 *
 * Ne lève jamais d'exception vers l'appelant : retourne simplement false
 * en cas d'échec, avec le détail loggé côté serveur pour investigation.
 */
export async function synchroniserVersOdoo(dossier: DossierPourOdoo): Promise<boolean> {
  const config = chargerConfig();
  if (!config) {
    // Odoo pas configuré (environnement de dev sans accès ERP) -> on
    // n'échoue pas, on ignore simplement la synchronisation.
    return false;
  }

  try {
    const uid = await authentifier(config);

    const existants = await appelerJsonRpc(config.url, "execute_kw", [
      config.db,
      uid,
      config.apiKey,
      config.modele,
      "search",
      [[["numero_dossier", "=", dossier.numeroDossier]]],
    ]);

    const valeurs = {
      numero_dossier: dossier.numeroDossier,
      pays: dossier.pays,
      type_reclamation: dossier.typeReclamation,
      description: dossier.description,
      nom_client: dossier.nomClient,
      email_client: dossier.emailClient,
      montant_reclame: dossier.montantReclame,
      statut: dossier.statut,
      date_echeance: dossier.dateEcheance,
    };

    if (existants && existants.length > 0) {
      await appelerJsonRpc(config.url, "execute_kw", [
        config.db,
        uid,
        config.apiKey,
        config.modele,
        "write",
        [existants, valeurs],
      ]);
    } else {
      await appelerJsonRpc(config.url, "execute_kw", [
        config.db,
        uid,
        config.apiKey,
        config.modele,
        "create",
        [valeurs],
      ]);
    }

    return true;
  } catch (err) {
    // Invalide la session en cache : la prochaine tentative se réauthentifiera
    uidCache = null;
    console.error("Synchronisation Odoo échouée:", err);
    return false;
  }
}
/**
 * Resynchronise un dossier vers Odoo à partir de son état courant en base.
 * À appeler après tout changement de statut (escalade, règlement, etc.)
 * pour que le back-office juridique reste le reflet fidèle du portail.
 */
export async function resynchroniserDossier(numeroDossier: string): Promise<boolean> {
  const { pool } = await import("../db/pool.js");

  const result = await pool.query(
    `SELECT numero_dossier, pays, type_reclamation, description, nom_client,
            email_client, montant_reclame, statut, date_echeance
       FROM dossiers_reclamation
      WHERE numero_dossier = $1`,
    [numeroDossier]
  );

  if (result.rows.length === 0) return false;
  const row = result.rows[0];

  return synchroniserVersOdoo({
    numeroDossier: row.numero_dossier,
    pays: row.pays,
    typeReclamation: row.type_reclamation,
    description: row.description,
    nomClient: row.nom_client,
    emailClient: row.email_client,
    montantReclame: row.montant_reclame !== null ? Number(row.montant_reclame) : null,
    statut: row.statut,
    dateEcheance: row.date_echeance
      ? row.date_echeance.toLocaleDateString("fr-CA")
      : null,
  });
}