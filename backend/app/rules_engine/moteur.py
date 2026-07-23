"""
Moteur de règles juridiques.

Règle d'or : ce fichier ne doit contenir AUCUNE règle juridique en dur.
Toutes les règles viennent de `regles_juridiques.json` (ou d'une table en
base plus tard), fourni et mis à jour par l'équipe Droit international.
"""

import json
from pathlib import Path
from datetime import timedelta


REGLES_PATH = Path(__file__).parent / "regles_juridiques.json"


def charger_regles() -> list[dict]:
    with open(REGLES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data["regles"]


def trouver_regle(type_reclamation: str, pays: str) -> dict | None:
    """Retourne la règle applicable pour un type de réclamation et un pays."""
    for regle in charger_regles():
        if regle["type_reclamation"] == type_reclamation and regle["pays"] == pays:
            return regle
    return None


def appliquer_regle(dossier) -> None:
    """
    À appeler au dépôt du dossier pour renseigner automatiquement :
    base_juridique, delai_cible_jours, date_echeance, organe_escalade.

    Ne lève pas d'exception si aucune règle n'existe encore pour ce
    type de réclamation / pays — le dossier reste créé, juste sans
    échéance, à qualifier manuellement en attendant que la matrice
    juridique soit complétée par l'équipe Droit international.
    """
    regle = trouver_regle(dossier.type_reclamation, dossier.pays)
    if regle is None:
        return

    dossier.base_juridique = regle.get("base_juridique") or None
    dossier.organe_escalade = regle.get("organe_escalade") or None

    delai = regle.get("delai_cible_jours")
    if delai is not None:
        dossier.delai_cible_jours = delai
        dossier.date_echeance = dossier.date_depot + timedelta(days=delai)
        