from datetime import datetime, timedelta
import requests
from .config import EODHD_API_KEY

def get_market_index(symbol, range_val):
    try:
        days_map = {'1m': 30, '3m': 90, '6m': 180, '1y': 365, 'ytd': 0}
        days = days_map.get(range_val, 365)
        
        if range_val == 'ytd':
             start_date = datetime(datetime.now().year, 1, 1).strftime('%Y-%m-%d')
        else:
             start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        url = f"https://eodhd.com/api/eod/{symbol}"
        params = {'api_token': EODHD_API_KEY, 'fmt': 'json', 'from': start_date, 'order': 'a'}
        
        r = requests.get(url, params=params, timeout=5)
        raw = r.json() if r.status_code == 200 else []
        
        series = []
        if isinstance(raw, list):
            for p in raw:
                if p.get('date') and p.get('close'):
                    series.append({'x': p['date'], 'y': float(p['close'])})
                    
        return {'series': series, 'symbol': symbol}
    except Exception as e:
        return {'error': str(e), 'series': []}

def get_yield_curve(region):
    try:
        # Desired Scale: 1, 5, 10, 15, 20, 25, 30
        
        if region == 'EU':
            # German Bunds as proxy
            tickers_map = {
                '1Y': 'DE1Y.GBOND', 
                '5Y': 'DE5Y.GBOND',
                '10Y': 'DE10Y.GBOND',
                '20Y': 'DE20Y.GBOND',
                '30Y': 'DE30Y.GBOND'
            }
        elif region == 'EURIBOR':
             tickers_map = {
                '1W': 'EURIBOR1W.MONEY',
                '1M': 'EURIBOR1M.MONEY',
                '3M': 'EURIBOR3M.MONEY',
                '6M': 'EURIBOR6M.MONEY',
                '12M': 'EURIBOR12M.MONEY'
            }
        else:
            # US Treasuries (Default)
            tickers_map = {
                '1Y': 'US1Y.GBOND',
                '5Y': 'US5Y.GBOND', 
                '10Y': 'US10Y.GBOND', 
                '20Y': 'US20Y.GBOND',
                '30Y': 'US30Y.GBOND'
            }
            
        # 1. Fetch Anchors
        yields = {}
        for label, ticker in tickers_map.items():
            try:
                url = f"https://eodhd.com/api/eod/{ticker}"
                params = {'api_token': EODHD_API_KEY, 'fmt': 'json', 'order': 'd', 'limit': 1}
                r = requests.get(url, params=params, timeout=3)
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list) and len(data) > 0:
                         val = data[0]['close']
                         if val is not None:
                             yields[label] = float(val)
            except Exception as e:
                print(f"Error fetching {label}: {e}")

        # 2. Interpolation
        def get_val(lbl): return yields.get(lbl)

        def interpolate(y1, y2, x1, x2, target_x):
            if y1 is None or y2 is None: return None
            return y1 + (y2 - y1) * ((target_x - x1) / (x2 - x1))

        # 3. Fill Interpolations (15Y, 25Y)
        y10 = get_val('10Y')
        y20 = get_val('20Y')
        y30 = get_val('30Y')
        
        if y20 is None and y10 is not None and y30 is not None:
             y20 = interpolate(y10, y30, 10, 30, 20)
             yields['20Y'] = y20

        if '15Y' not in yields:
             if y10 is not None and y20 is not None:
                 yields['15Y'] = interpolate(y10, y20, 10, 20, 15)

        if '25Y' not in yields:
             if y20 is not None and y30 is not None:
                 yields['25Y'] = interpolate(y20, y30, 20, 30, 25)

        # Final ordered list construction
        final_data = []
        if region == 'EURIBOR':
             desired_order = ['1W', '1M', '3M', '6M', '12M']
        else:
             desired_order = ['1Y', '5Y', '10Y', '15Y', '20Y', '25Y', '30Y']
        
        for maturity in desired_order:
            val = yields.get(maturity)
            if val is not None:
                final_data.append({'maturity': maturity, 'yield': round(val, 2)})
            
        if not final_data:
             final_data = [{'maturity': 'Error', 'yield': 0}]
            
        return {'curve': final_data, 'region': region}

    except Exception as e:
        print(f"Yield Error: {e}")
        return {'curve': [{'maturity': 'Error', 'yield': 0}], 'error': str(e)}

def get_financial_news(query, mode):
    try:
        TAG_MAP = {
            'general': 'balance',
            'inflation': 'inflation',
            'interest rates': 'interest rates',
            'gdp': 'gdp',
            'employment': 'employment',
            'earnings': 'earnings'
        }
        
        final_query = query
        if mode == 'general' and query in TAG_MAP:
            final_query = TAG_MAP[query]

        url = "https://eodhd.com/api/news"
        params = {'api_token': EODHD_API_KEY, 'limit': 20, 'offset': 0}
        
        if mode == 'ticker':
            params['s'] = final_query 
        else:
            params['t'] = final_query 

        r = requests.get(url, params=params, timeout=10)
        news_list = r.json() if r.status_code == 200 else []
        
        if not isinstance(news_list, list): 
             news_list = [] 

        articles = []
        for item in news_list:
            if not item.get('title'): continue
            articles.append({
                'title': item.get('title'),
                'summary': item.get('content', '')[:250] + "...",
                'link': item.get('link'),
                'date': item.get('date'),
                'source': 'EOD Wire'
            })
            
        return {'articles': articles}

    except Exception as e:
        print(f"News Error: {e}")
        return {'articles': [], 'error': str(e)}
