import sys
import unittest
from unittest.mock import MagicMock, patch

# MOCK MODULES BEFORE IMPORT
sys.modules['firebase_functions'] = MagicMock()
sys.modules['firebase_functions.https_fn'] = MagicMock()

# Decorator Passthrough Hack
def on_call_mock(*args, **kwargs):
    def decorator(f):
        return f
    return decorator

sys.modules['firebase_functions'].https_fn.on_call.side_effect = on_call_mock

sys.modules['firebase_functions.options'] = MagicMock()
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()

# Now import main
try:
    import main
except ImportError:
    # If running from different dir, add path
    import os
    sys.path.append(os.getcwd())
    import main

class TestSmartPortfolio(unittest.TestCase):
    @patch('services.optimizer.run_optimization') 
    @patch('services.data.get_price_data')
    @patch('services.optimizer.firestore.client')
    def test_hydraulic_balancer_logic(self, mock_db, mock_get_price, mock_run_opt):
        mock_collection = MagicMock()
        mock_db.return_value.collection.return_value = mock_collection
        
        # Scenario: User wants "Tech" (US Heavy)
        # Fund US: High Score but 0% Europe
        f_us = {
            'isin': 'US_TECH', 'name': 'US Tech Fund',
            'category_morningstar': 'Tech',
            'perf': {'sharpe': 2.0, 'alpha': 5.0, 'r2': 90}, # Great Score
            'regions': {'americas': 100, 'europe': 0}
        }
        
        # Fund EU: Moderate Score but 100% Europe (The Balancer)
        f_eu = {
            'isin': 'EU_INDEX', 'name': 'Europe Index',
            'category_morningstar': 'RV Europa',
            'perf': {'sharpe': 0.8, 'alpha': 0.0, 'r2': 95},
            'regions': {'americas': 0, 'europe': 100}
        }
        
        # Mock Query Results
        # First call: Query for "Tech" -> Returns f_us
        # Second call: Query for "RV Europa" (Balancer) -> Returns f_eu
        
        mock_doc_us = MagicMock()
        mock_doc_us.to_dict.return_value = f_us
        
        mock_doc_eu = MagicMock()
        mock_doc_eu.to_dict.return_value = f_eu
        
        # Mocking stream() is tricky with multiple calls.
        # We can mock the 'where' chain.
        
        # Logic in code:
        # 1. query = funds_ref.where(..., 'Tech') -> stream() -> [f_us]
        # 2. avg_eu check -> 0% < 40%
        # 3. balancers_query = funds_ref.where(..., 'RV Europa') -> stream() -> [f_eu]
        
        def stream_side_effect():
            # We need to distinguish calls. 
            # A hacky way is checking the mock_query object or using an iterator if calls are sequential.
            # But here `limit(5).stream()` creates a NEW mock object usually.
            pass
            
        # Let's simplify: Mock the `funds_ref.where().stream()` and `funds_ref.where().limit().stream()`
        # But `where` returns a Query object.
        
        # Chain 1: Tech
        mock_query_tech = MagicMock()
        mock_query_tech.stream.return_value = [mock_doc_us]
        
        # Chain 2: Balancer
        mock_query_bal = MagicMock()
        mock_query_bal.stream.return_value = [mock_doc_eu]
        
        # Dispatcher for `where`
        def where_side_effect(filter):
            # filter object is hard to inspect in mocks sometimes (FieldFilter).
            # Let's assume sequential calls for this specific test flow.
            # First call is Tech, Second is RV Europa
            return mock_query_tech
            
        # Wait, the code calls `query.where(...)` then `stream()`. 
        # And later `funds_ref.where(...)`.
        # If we make `where` return `mock_query_tech` initially, 
        # and then `mock_query_bal` on second call?
        
        mock_collection.where.side_effect = [mock_query_tech, mock_query_bal] 
        # Note: If code has other where calls this might break.
        # In `generateSmartPortfolio`, `where` is called for Category.
        # Then if avg_eu < 40, `where` is called for Balancer.
        # So [Tech, Europa] seems correct order.
        
        # Also `limit(5)` is called on the balancer query.
        mock_query_bal.limit.return_value = mock_query_bal # Chainable
        
        # Optimization Mock
        # Expected: Both US_TECH and EU_INDEX passed to optimizer
        # And mock optimizer returns weights that satisfy constraints (we just simulate result)
        mock_run_opt.return_value = {
            'status': 'optimal',
            'weights': {'US_TECH': 0.60, 'EU_INDEX': 0.40}, # 40% EU constraint met
            'metrics': {},
            'warnings': []
        }
        
        # Request
        req = MagicMock()
        req.data = {'category': 'Tech', 'risk_level': 5, 'num_funds': 2}
        
        print("Calling generateSmartPortfolio (Hydraulic Test)...")
        result = main.generateSmartPortfolio(req)
        
        print("Result:", result)
        
        self.assertIn('portfolio', result)
        p = result['portfolio']
        
        # Check if EU_INDEX was injected
        f_eu_res = next((x for x in p if x['isin'] == 'EU_INDEX'), None)
        self.assertIsNotNone(f_eu_res, "Balancer Fund (European) should be injected")
        self.assertEqual(f_eu_res['role'], 'Balancer')
        print("✅ Balancer Injected and Identified.")
        
        # Check Metadata passed to optimizer
        # args[4] is asset_metadata
        call_args = mock_run_opt.call_args
        self.assertIsNotNone(call_args)
        asset_meta = call_args[0][4]
        self.assertIn('US_TECH', asset_meta)
        self.assertIn('EU_INDEX', asset_meta)
        print("✅ Asset Metadata passed to Optimizer.")

if __name__ == '__main__':
    unittest.main()
