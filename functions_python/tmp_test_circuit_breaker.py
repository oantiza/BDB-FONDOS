import pandas as pd
import numpy as np
from services.data_fetcher import DataFetcher
from unittest.mock import MagicMock

# Create dummy history data
history_data = {"history": []}
for i in range(1, 25):
    history_data["history"].append({"date": f"2023-01-{i:02d}", "nav": 100 + i})

# Add jump
history_data["history"].append({"date": "2023-01-25", "nav": 200})
history_data["history"].append({"date": "2023-01-26", "nav": 201})

# we need to mock db get_all or something, but data_fetcher does the logic inside get_price_data.
# get_price_data calls db... 
# Let's mock db
mock_db = MagicMock()
mock_doc = MagicMock()
mock_doc.id = "TestFund"
mock_doc.exists = True
mock_doc.to_dict.return_value = history_data
mock_db.get_all.return_value = [mock_doc]

# Create dummy fetcher without db dependency for just the parse aspect
fetcher = DataFetcher(db_client=mock_db)

try:
    df, merged = fetcher.get_price_data(["TestFund"], strict=False, no_fill=False)
    print("FAILED: Did not raise exception")
except Exception as e:
    print(f"SUCCESS: Raised expected exception: {e}")
