"""
Génération du numéro de dossier.

Format : PAYS-ANNEE-000001 (compteur par pays et par année).
"""

from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.dossier_reclamation import DossierReclamation


def generer_numero_dossier(db: Session, pays: str) -> str:
    pays = pays.upper()
    annee = date.today().year

    prefixe = f"{pays}-{annee}-"
    dernier_numero = (
        db.query(func.count(DossierReclamation.id))
        .filter(DossierReclamation.numero_dossier.like(f"{prefixe}%"))
        .scalar()
    )
    compteur = (dernier_numero or 0) + 1
    return f"{prefixe}{compteur:06d}"
