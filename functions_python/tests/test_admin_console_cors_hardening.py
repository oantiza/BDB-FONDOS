"""
Test: CORS hardening for endpoints_admin_console.py
Validates that cors_config uses an explicit allowlist, not wildcard '*'.
"""
import unittest
import inspect

from api.endpoints_admin_console import cors_config


class TestAdminConsoleCorsConfig(unittest.TestCase):
    """Verify endpoints_admin_console.py cors_config is hardened."""

    def test_cors_config_not_wildcard_string(self):
        """cors_origins must not be the string '*'."""
        self.assertNotEqual(
            cors_config.cors_origins, "*",
            "cors_origins must not be wildcard '*'"
        )

    def test_cors_config_is_list(self):
        """cors_origins must be a list (allowlist)."""
        self.assertIsInstance(
            cors_config.cors_origins, list,
            "cors_origins should be a list of allowed origins"
        )

    def test_cors_config_has_production_origins(self):
        """Allowlist must include production domain patterns."""
        origins = cors_config.cors_origins
        origins_str = " ".join(str(o) for o in origins)
        has_web_app = "web" in origins_str and "app" in origins_str
        has_firebaseapp = "firebaseapp" in origins_str
        self.assertTrue(has_web_app, "Missing *.web.app pattern")
        self.assertTrue(has_firebaseapp, "Missing *.firebaseapp.com pattern")

    def test_cors_config_has_dev_origins(self):
        """Allowlist must include localhost dev ports."""
        origins = cors_config.cors_origins
        origins_str = " ".join(str(o) for o in origins)
        self.assertIn("localhost:5173", origins_str, "Missing localhost:5173")
        self.assertIn("localhost:3000", origins_str, "Missing localhost:3000")

    def test_cors_config_no_wildcard_in_list(self):
        """No element in the allowlist should be '*'."""
        if isinstance(cors_config.cors_origins, list):
            for origin in cors_config.cors_origins:
                self.assertNotEqual(str(origin), "*", f"Wildcard found in allowlist: {origin}")


class TestAdminConsoleCorsSourceInvariant(unittest.TestCase):
    """Source-level invariant: no wildcard CORS in endpoints_admin_console.py."""

    def test_no_wildcard_cors_in_source(self):
        """The source code must not contain cors_origins='*'."""
        import api.endpoints_admin_console as mod
        source = inspect.getsource(mod)
        self.assertNotIn(
            'cors_origins="*"', source,
            "Source still contains wildcard CORS (double quotes)"
        )
        self.assertNotIn(
            "cors_origins='*'", source,
            "Source still contains wildcard CORS (single quotes)"
        )


if __name__ == "__main__":
    unittest.main()
