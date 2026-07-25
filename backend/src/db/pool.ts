/**
 * Connexion à PostgreSQL et initialisation du schéma.
 *
 * On utilise le driver `pg` directement (pas d'ORM) : le cahier des charges
 * n'impose rien de ce côté, et ça garde la couche base de données simple
 * et facile à faire évoluer.
 */

import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dossiers_reclamation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_dossier TEXT UNIQUE NOT NULL,
  pays TEXT NOT NULL,
  langue TEXT NOT NULL,
  type_reclamation TEXT NOT NULL,
  description TEXT NOT NULL,
  nom_client TEXT NOT NULL,
  email_client TEXT NOT NULL,
  montant_reclame NUMERIC,
  reference_commande TEXT NOT NULL,
  date_achat DATE NOT NULL,
  date_depot DATE NOT NULL DEFAULT CURRENT_DATE,
  statut TEXT NOT NULL DEFAULT 'recu',
  base_juridique TEXT,
  delai_cible_jours INTEGER,
  date_echeance DATE,
  organe_escalade TEXT,
  historique JSONB DEFAULT '[]',
  pieces_jointes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/**
 * Migrations idempotentes pour les bases créées avec une version
 * antérieure du schéma. Chaque instruction est sans effet si la base
 * est déjà à jour (IF NOT EXISTS / WHERE ciblé).
 */
const MIGRATE_SQL = `
ALTER TABLE dossiers_reclamation
  ADD COLUMN IF NOT EXISTS reference_commande TEXT,
  ADD COLUMN IF NOT EXISTS date_achat DATE;

ALTER TABLE dossiers_reclamation
  ALTER COLUMN statut SET DEFAULT 'recu';

UPDATE dossiers_reclamation SET statut = 'recu' WHERE statut = 'depose';
UPDATE dossiers_reclamation SET statut = 'en_traitement' WHERE statut = 'en_cours';
UPDATE dossiers_reclamation SET statut = 'proposition' WHERE statut = 'proposition_envoyee';
`;

export async function initDatabase(): Promise<void> {
  // Nécessaire pour gen_random_uuid() sur certaines images Postgres
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  await pool.query(CREATE_TABLE_SQL);
  await pool.query(MIGRATE_SQL);
}