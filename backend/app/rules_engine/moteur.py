"""
Moteur de règles juridiques.

Règle d'or : ce fichier ne doit contenir AUCUNE règle juridique en dur.
Toutes les règles viennent de `regles_juridiques.json` (ou d'une table en
base plus tard), fourni et mis à jour par l'équipe Droit international.
"""

import json
from pathlib import Path

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
    """
    regle = trouver_regle(dossier.type_reclamation, dossier.pays)
    if regle is None:
        raise ValueError(
            f"Aucune règle trouvée pour {dossier.type_reclamation} / {dossier.pays} "
            "— à signaler à l'équipe Droit international."
        )
    # TODO: appliquer les valeurs de `regle` au dossier une fois le modèle
    # de données confirmé (dossier.base_juridique = regle["base_juridique"], etc.)
