"""
Route de dépôt d'une réclamation — étape 3 du parcours client.

Valide les champs obligatoires, vérifie le pays, génère le numéro de
dossier, puis applique le moteur de règles juridiques.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dossier_reclamation import DossierReclamation, StatutDossier
from app.models.schemas import DepotReclamationIn, DossierReclamationOut
from app.services.numerotation import generer_numero_dossier
from app.rules_engine.moteur import trouver_regle

router = APIRouter()


@router.post("", response_model=DossierReclamationOut, status_code=201)
def deposer_reclamation(payload: DepotReclamationIn, db: Session = Depends(get_db)):
    if not payload.pays_valide():
        raise HTTPException(
            status_code=400,
            detail=f"Pays '{payload.pays}' hors périmètre (FR, DE, ES, IT, BE, NL, PL).",
        )

    numero_dossier = generer_numero_dossier(db, payload.pays)

    dossier = DossierReclamation(
        numero_dossier=numero_dossier,
        pays=payload.pays.upper(),
        langue=payload.langue.lower(),
        type_reclamation=payload.type_reclamation,
        description=payload.description,
        nom_client=payload.nom_client,
        email_client=payload.email_client,
        montant_reclame=payload.montant_reclame,
        date_depot=date.today(),
        statut=StatutDossier.DEPOSE,
        historique=[{"statut": "depose", "date": date.today().isoformat(), "auteur": "client"}],
    )

    # Applique la règle juridique correspondante si elle existe déjà dans la
    # matrice de Félicite. Sinon, le dossier reste créé mais sans échéance —
    # à qualifier manuellement, pour ne jamais bloquer un client au dépôt.
    regle = trouver_regle(payload.type_reclamation.value, payload.pays.upper())
    if regle:
        dossier.base_juridique = regle.get("base_juridique") or None
        dossier.organe_escalade = regle.get("organe_escalade") or None

    db.add(dossier)
    db.commit()
    db.refresh(dossier)

    return dossier


@router.get("/{numero_dossier}", response_model=DossierReclamationOut)
def consulter_reclamation(numero_dossier: str, db: Session = Depends(get_db)):
    dossier = (
        db.query(DossierReclamation)
        .filter(DossierReclamation.numero_dossier == numero_dossier)
        .first()
    )
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable.")
    return dossier
