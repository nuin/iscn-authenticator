import unittest

from fastapi.testclient import TestClient

from api.server import app


class ValidationApiTests(unittest.TestCase):
    def setUp(self):
        self.client = self.enterContext(TestClient(app))

    def test_health_is_available_without_validation_input(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})

    def test_both_methods_return_a_serialized_validation_result(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                response = self.validate(method, "46,XX")

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.json(),
                    {
                        "valid": True,
                        "errors": [],
                        "parsed": {
                            "chromosome_count": 46,
                            "sex_chromosomes": "XX",
                            "abnormalities": [],
                            "cell_lines": None,
                            "modifiers": None,
                        },
                    },
                )

    def test_nested_abnormalities_preserve_breakpoints_and_original_text(self):
        response = self.client.post(
            "/validate", json={"karyotype": "46,XY,t(9;22)(q34;q11.2)"}
        )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"], [])
        self.assertEqual(
            result["parsed"]["abnormalities"],
            [
                {
                    "type": "t",
                    "chromosome": "9;22",
                    "breakpoints": [
                        {
                            "arm": "q",
                            "region": 3,
                            "band": 4,
                            "subband": None,
                            "uncertain": False,
                        },
                        {
                            "arm": "q",
                            "region": 1,
                            "band": 1,
                            "subband": "2",
                            "uncertain": False,
                        },
                    ],
                    "inheritance": None,
                    "uncertain": False,
                    "copy_count": None,
                    "raw": "t(9;22)(q34;q11.2)",
                }
            ],
        )

    def test_parse_errors_are_validation_results_with_no_parsed_data(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                response = self.validate(method, "not-a-karyotype")

                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertFalse(result["valid"])
                self.assertIsNone(result["parsed"])
                self.assertTrue(result["errors"])
                self.assertTrue(all(isinstance(error, str) for error in result["errors"]))

    def test_query_parameter_preserves_plus_signs(self):
        response = self.client.get("/validate", params={"karyotype": "47,XY,+21"})

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["valid"])
        self.assertEqual(result["parsed"]["chromosome_count"], 47)
        self.assertEqual(result["parsed"]["abnormalities"][0]["raw"], "+21")

    def test_mosaic_cell_lines_are_serialized(self):
        response = self.client.post(
            "/validate", json={"karyotype": "45,X[10]/46,XX[20]"}
        )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result["valid"])
        self.assertEqual(
            result["parsed"]["cell_lines"],
            [
                {
                    "chromosome_count": 45,
                    "sex_chromosomes": "X",
                    "abnormalities": [],
                    "count": 10,
                    "is_donor": False,
                },
                {
                    "chromosome_count": 46,
                    "sex_chromosomes": "XX",
                    "abnormalities": [],
                    "count": 20,
                    "is_donor": False,
                },
            ],
        )

    def test_empty_karyotypes_are_bad_requests(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                response = self.validate(method, "")

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), {"detail": "No karyotype provided"})

    def test_missing_karyotypes_identify_the_required_field(self):
        for method, location in (("GET", "query"), ("POST", "body")):
            with self.subTest(method=method):
                response = self.client.request(method, "/validate", json={})

                self.assertEqual(response.status_code, 422)
                error = response.json()["detail"][0]
                self.assertEqual(error["loc"], [location, "karyotype"])
                self.assertEqual(error["type"], "missing")

    def test_post_rejects_non_string_karyotypes(self):
        for value in (None, True, 46, [], {}):
            with self.subTest(value=value):
                response = self.client.post("/validate", json={"karyotype": value})

                self.assertEqual(response.status_code, 422)
                error = response.json()["detail"][0]
                self.assertEqual(error["loc"], ["body", "karyotype"])
                self.assertEqual(error["type"], "string_type")

    def test_post_rejects_malformed_json(self):
        response = self.client.post(
            "/validate",
            content='{"karyotype":',
            headers={"Content-Type": "application/json"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"][0]["type"], "json_invalid")

    def validate(self, method, karyotype):
        if method == "GET":
            return self.client.get("/validate", params={"karyotype": karyotype})
        return self.client.post("/validate", json={"karyotype": karyotype})
