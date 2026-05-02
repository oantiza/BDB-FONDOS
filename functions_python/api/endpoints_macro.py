import requests
from firebase_functions import https_fn
import json

@https_fn.on_call()
def get_economic_calendar(req: https_fn.CallableRequest) -> dict:
    """
    Proxy function to fetch the economic calendar from Forex Factory
    avoiding CORS issues on the frontend.
    """
    url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Verify it's JSON
        data = response.json()
        
        return {
            "success": True,
            "data": data
        }
        
    except Exception as e:
        print(f"Error fetching economic calendar: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
