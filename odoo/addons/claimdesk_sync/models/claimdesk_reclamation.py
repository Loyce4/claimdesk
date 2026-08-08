from odoo import fields, models


class ClaimdeskReclamation(models.Model):
    _name = "claimdesk.reclamation"
    _description = "Réclamation ClaimDesk (synchronisée depuis le portail)"
    _rec_name = "numero_dossier"
    _order = "create_date desc"

    numero_dossier = fields.Char(string="Numéro de dossier", required=True, index=True)
    pays = fields.Char(string="Pays")
    type_reclamation = fields.Char(string="Type de réclamation")
    description = fields.Text(string="Description")
    nom_client = fields.Char(string="Nom du client")
    email_client = fields.Char(string="Email du client")
    montant_reclame = fields.Float(string="Montant réclamé")
    statut = fields.Char(string="Statut")
    date_echeance = fields.Date(string="Date d'échéance")