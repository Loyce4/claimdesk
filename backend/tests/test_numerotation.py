"""
Tests du service de numérotation — cas normal + cas limite.
Utilise une base SQLite en mémoire pour ne pas dépendre de Postgres.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.dossier_reclamation import DossierReclamation, TypeReclamation, StatutDossier
from app.services.numerotation import generer_numero_dossier
from datetime import date


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_premier_numero_dossier_pour_un_pays(db_session):
    numero = generer_numero_dossier(db_session, "FR")
    annee = date.today().year
    assert numero == f"FR-{annee}-000001"


def test_numero_dossier_incremente(db_session):
    annee = date.today().year
    dossier = DossierReclamation(
        numero_dossier=f"FR-{annee}-000001",
        pays="FR",
        langue="fr",
        type_reclamation=TypeReclamation.NON_LIVRAISON,
        description="Colis jamais reçu, commande du 1er juin.",
        nom_client="Client Test",
        email_client="client@example.com",
        date_depot=date.today(),
        statut=StatutDossier.DEPOSE,
    )
    db_session.add(dossier)
    db_session.commit()

    numero_suivant = generer_numero_dossier(db_session, "FR")
    assert numero_suivant == f"FR-{annee}-000002"


def test_compteurs_independants_par_pays(db_session):
    # Cas limite : un dossier existant en FR ne doit pas influencer le
    # compteur d'un autre pays.
    annee = date.today().year
    dossier = DossierReclamation(
        numero_dossier=f"FR-{annee}-000001",
        pays="FR",
        langue="fr",
        type_reclamation=TypeReclamation.NON_LIVRAISON,
        description="Colis jamais reçu, commande du 1er juin.",
        nom_client="Client Test",
        email_client="client@example.com",
        date_depot=date.today(),
        statut=StatutDossier.DEPOSE,
    )
    db_session.add(dossier)
    db_session.commit()

    numero_de = generer_numero_dossier(db_session, "DE")
    assert numero_de == f"DE-{annee}-000001"
