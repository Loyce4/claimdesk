"""
Tests du moteur de règles — cas normal et cas limite.
"""

import json
import pytest

from app.rules_engine import moteur


@pytest.fixture()
def regles_test(tmp_path, monkeypatch):
    """Remplace le fichier de règles par un jeu de données de test isolé."""
    contenu = {
        "regles": [
            {
                "type_reclamation": "non_livraison",
                "pays": "FR",
                "base_juridique": "Code de la consommation, art. L216-1",
                "condition_recevabilite": "Livraison non effectuée après la date convenue",
                "remede_possible": "Remboursement intégral",
                "delai_cible_jours": 30,
                "delai_prescription_jours": 730,
                "organe_escalade": "Médiateur de la consommation",
                "source": "https://www.legifrance.gouv.fr/",
                "date_verification": "2026-01-01",
            }
        ]
    }
    fichier = tmp_path / "regles_juridiques.json"
    fichier.write_text(json.dumps(contenu), encoding="utf-8")
    monkeypatch.setattr(moteur, "REGLES_PATH", fichier)
    return contenu


def test_regle_trouvee_pour_cas_connu(regles_test):
    regle = moteur.trouver_regle("non_livraison", "FR")
    assert regle is not None
    assert regle["organe_escalade"] == "Médiateur de la consommation"


def test_aucune_regle_pour_pays_non_couvert(regles_test):
    # Cas limite : réclamation depuis un pays hors périmètre (ou pas encore
    # renseigné par Félicite) -> None, pas d'exception, pour ne jamais
    # bloquer le dépôt du dossier côté client.
    regle = moteur.trouver_regle("non_livraison", "PL")
    assert regle is None
def test_date_echeance_calculee(regles_test):
    from datetime import date
    from app.models.dossier_reclamation import DossierReclamation, TypeReclamation, StatutDossier

    dossier = DossierReclamation(
        numero_dossier="FR-2026-000099",
        pays="FR",
        langue="fr",
        type_reclamation=TypeReclamation.NON_LIVRAISON,
        description="Test de calcul d'échéance.",
        nom_client="Client Test",
        email_client="client@example.com",
        date_depot=date(2026, 1, 1),
        statut=StatutDossier.DEPOSE,
    )

    moteur.appliquer_regle(dossier)

    assert dossier.date_echeance == date(2026, 1, 31)  # 1er janvier + 30 jours
    assert dossier.base_juridique == "Code de la consommation, art. L216-1"