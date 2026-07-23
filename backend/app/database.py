"""
Connexion à la base de données.

Lit DATABASE_URL depuis les variables d'environnement (voir .env.example
à la racine du projet).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://claimdesk:claimdesk@db:5432/claimdesk"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dépendance FastAPI : ouvre une session, la ferme toujours après la requête."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
