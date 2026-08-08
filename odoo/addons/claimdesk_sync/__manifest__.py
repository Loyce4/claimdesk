{
    "name": "ClaimDesk - Synchronisation des réclamations",
    "version": "17.0.1.0.0",
    "category": "Services/Helpdesk",
    "summary": "Reçoit et affiche les dossiers de réclamation synchronisés depuis le portail ClaimDesk (OMNIVIA).",
    "author": "Josias",
    "depends": ["base"],
    "data": [
        "security/ir.model.access.csv",
        "views/claimdesk_reclamation_views.xml",
    ],
    "installable": True,
    "application": True,
    "license": "LGPL-3",
}