"""
Format commun du dossier de réclamation (modèle SQLAlchemy).

C'est la base sur laquelle s'appuient : le formulaire de dépôt, le moteur de
règles juridiques, la génération de courriers, le suivi temps réel et la
connexion Odoo.
"""

import enum
import uuid

from sqlalchemy import Column, String, Text, Float, Date, DateTime, Enum, JSON, Integer
from sqlalchemy.sql import func

from app.database import Base


class TypeReclamation(str, enum.Enum):
    PRODUIT_NON_CONFORME = "produit_non_conforme"
    NON_LIVRAISON = "non_livraison"
    RETRACTATION = "retractation"
    # à compléter avec la matrice juridique de Félicite


class StatutDossier(str, enum.Enum):
    DEPOSE = "depose"
    EN_COURS = "en_cours"
    EN_ATTENTE_PIECES = "en_attente_pieces"
    PROPOSITION_ENVOYEE = "proposition_envoyee"
    ESCALADE = "escalade"
    CLOTURE = "cloture"


PAYS_AUTORISES = {"FR", "DE", "ES", "IT", "BE", "NL", "PL"}


class DossierReclamation(Base):
    __tablename__ = "dossiers_reclamation"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    numero_dossier = Column(String, unique=True, nullable=False, index=True)

    pays = Column(String(2), nullable=False)
    langue = Column(String(2), nullable=False)
    type_reclamation = Column(Enum(TypeReclamation), nullable=False)
    description = Column(Text, nullable=False)
    nom_client = Column(String, nullable=False)
    email_client = Column(String, nullable=False)
    montant_reclame = Column(Float, nullable=True)

    date_depot = Column(Date, nullable=False, server_default=func.current_date())
    statut = Column(Enum(StatutDossier), nullable=False, default=StatutDossier.DEPOSE)

    # Renseignés automatiquement par le moteur de règles (rules_engine/)
    base_juridique = Column(String, nullable=True)
    delai_cible_jours = Column(Integer, nullable=True)
    date_echeance = Column(Date, nullable=True)
    organe_escalade = Column(String, nullable=True)

    historique = Column(JSON, default=list)  # [{statut, date, auteur}, ...]
    pieces_jointes = Column(JSON, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
