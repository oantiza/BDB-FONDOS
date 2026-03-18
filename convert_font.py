import requests
import base64

url = "https://fonts.gstatic.com/s/robotoflex/v30/NaNnepOXO_NexZs0b5QrzlOHb8wCikXpYqmZsWI-__OGbt8jZktqc2V3Zs0KvDLdBP8SBZtOs2IifRuUZQMsPJtUsR4DEK6cULNeUx9XgTnH37Ha_FIAp4Fm0PP1hw45DntW2x0wZGzhPmr1YNMYKYn9_1IQXGwJAiUJVUMdN5YUW4O8HtSoXjC1z3QSabshNFVe3e0O5j3ZjrZCu23Qd4G0EBysQNK-QKavMl1cKq3tHXtXi8mzLjaAQbE.ttf"
response = requests.get(url)
if response.status_code == 200:
    b64 = base64.b64encode(response.content).decode('utf-8')
    with open("roboto_flex_b64.txt", "w") as f:
        f.write(b64)
    print("Success: roboto_flex_b64.txt created")
else:
    print(f"Error: {response.status_code}")
