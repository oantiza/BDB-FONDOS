import requests
import os
import logging

def get_financial_news(query: str, mode: str):
    """
    Fetches financial news using NewsAPI.
    """
    api_key = os.environ.get('NEWS_API_KEY')
    if not api_key:
        return {'articles': [], 'error': 'Missing NEWS_API_KEY'}
    
    url = f"https://newsapi.org/v2/everything?q={query}&sortBy=publishedAt&language=en&apiKey={api_key}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        return {'articles': [], 'error': f"API Error: {response.status_code}"}
    except Exception as e:
        return {'articles': [], 'error': str(e)}
