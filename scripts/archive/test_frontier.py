"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: test_frontier.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/test_frontier.py
"""

import os
from firebase_admin import credentials, initialize_app, firestore
from services.portfolio.frontier_engine import generate_efficient_frontier

try:
    cred = credentials.Certificate(r'c:\Users\oanti\Documents\BDB-FONDOS\bdb-fondos-firebase-adminsdk-p1f3d-513689c894.json')
    initialize_app(cred)
except Exception:
    pass

db = firestore.client()

# Mix of funds including young ones
assets = [
    'LU0119753308',  # Some fund
    'ES0144292008',  # Hamco
]

res = generate_efficient_frontier(assets, db, period='3y')
print(res)
