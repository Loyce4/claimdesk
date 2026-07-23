"""
Schémas Pydantic — ce que l'API accepte en entrée et renvoie en sortie.
Séparés du modèle SQLAlchemy (app/models) pour ne jamais exposer les
champs internes par erreur.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.dossier_reclamation import TypeReclamation, StatutDossier, PAYS_AUTORISES


class DepotReclamationIn(BaseModel):
    """Ce que le client envoie via le formulaire de dépôt."""

    pays: str = Field(..., min_length=2, max_length=2, description="Code pays ISO, ex: FR")
    langue: str = Field(..., min_length=2, max_length=2)
    type_reclamation: TypeReclamation
    description: str = Field(..., min_length=10, max_length=5000)
    nom_client: str = Field(..., min_length=1, max_length=200)
    email_client: EmailStr
    montant_reclame: Optional[float] = Field(default=None, ge=0)

    def pays_valide(self) -> bool:
        return self.pays.upper() in PAYS_AUTORISES


class DossierReclamationOut(BaseModel):
    numero_dossier: str
    pays: str
    langue: str
    type_reclamation: TypeReclamation
    description: str
    nom_client: str
    statut: StatutDossier
    date_depot: date
    date_echeance: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True
