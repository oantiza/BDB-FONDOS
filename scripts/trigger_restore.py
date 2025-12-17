import requests
import json

url = "https://europe-west1-bdb-fondos.cloudfunctions.net/restore_historico"
headers = {"Content-Type": "application/json"}
payload = {"data": {}}

print(f"Triggering {url}...")
try:
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
