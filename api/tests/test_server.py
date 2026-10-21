import unittest

from fastapi.testclient import TestClient

from api.server import app


class ValidationApiTests(unittest.TestCase):
    def setUp(self):
        self.client = self.enterContext(TestClient(app))

    def test_interphase_nuclei_fraction_is_preserved_without_cell_lines(self):
        payload = "(D21S259)x3[25/100]"
        for separator in ("", " ", "\t"):
            with self.subTest(separator=separator):
                response = self.client.post(
                    "/validate", json={"karyotype": f"nuc ish{separator}{payload}"}
                )
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertTrue(result["valid"], result["errors"])
                self.assertEqual(result["parsed"]["modifiers"]["ish"], payload)
                self.assertIsNone(result["parsed"]["cell_lines"])
                self.assertIsNone(result["parsed"]["chromosome_count"])

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
                            "count": None,
                            "raw": "46,XX",
                            "reference": None,
                            "changes": None,
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
                    "composite": False,
                    "raw": "45,X[10]",
                    "reference": None,
                    "changes": None,
                },
                {
                    "chromosome_count": 46,
                    "sex_chromosomes": "XX",
                    "abnormalities": [],
                    "count": 20,
                    "is_donor": False,
                    "composite": False,
                    "raw": "46,XX[20]",
                    "reference": None,
                    "changes": None,
                },
            ],
        )

    def test_empty_karyotypes_are_bad_requests(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                response = self.validate(method, "")

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), {"detail": "No karyotype provided"})

    def test_later_cell_line_errors_are_returned_by_both_methods(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                response = self.validate(method, "47,XX,+21[5]/47,XX,+99[10]")
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertFalse(result["valid"])
                self.assertIn("Cell line 2: Invalid chromosome '99'", "\n".join(result["errors"]))
                self.assertEqual(len(result["parsed"]["cell_lines"]), 2)

    def test_missing_karyotypes_identify_the_required_field(self):
        for method, location in (("GET", "query"), ("POST", "body")):
            with self.subTest(method=method):
                response = self.client.request(method, "/validate", json={})

                self.assertEqual(response.status_code, 422)
                error = response.json()["detail"][0]
                self.assertEqual(error["loc"], [location, "karyotype"])
                self.assertEqual(error["type"], "missing")

    def test_routine_notation_errors_reach_both_http_methods(self):
        for notation in ("46,XX,+21", "46,XX,del(99)(p15)", "46,XX,del(5)(p99)", "48~45,XX"):
            for method in ("GET", "POST"):
                with self.subTest(notation=notation, method=method):
                    response = self.validate(method, notation)
                    self.assertEqual(response.status_code, 200)
                    result = response.json()
                    self.assertFalse(result["valid"])
                    self.assertTrue(result["errors"])

    def test_single_line_metaphase_count_and_raw_input_are_retained(self):
        response = self.validate("POST", "47,XX,+21[20]")
        result = response.json()
        self.assertTrue(result["valid"])
        self.assertEqual(result["parsed"]["count"], 20)
        self.assertEqual(result["parsed"]["raw"], "47,XX,+21[20]")

    def test_acquired_sex_chromosome_losses_are_not_double_subtracted(self):
        for notation in ("45,X,-Y[20]/46,XY[5]", "45,X,-X[8]"):
            with self.subTest(notation=notation):
                result = self.validate("POST", notation).json()
                self.assertTrue(result["valid"], result["errors"])

    def test_unmapped_insertion_layouts_do_not_skip_band_checks(self):
        result = self.validate("POST", "46,XX,ins(1;2;3;4)(p99q99q99)").json()
        self.assertFalse(result["valid"])
        self.assertTrue(result["errors"])

    def test_related_clone_keeps_reference_and_resolved_findings(self):
        result = self.validate("POST", "47,XX,+8[10]/48,idem,+21[5]").json()
        self.assertTrue(result["valid"])
        line = result["parsed"]["cell_lines"][1]
        self.assertEqual(line["raw"], "48,idem,+21[5]")
        self.assertEqual(line["reference"], {"token": "idem", "cell_line": 1, "multiplier": None, "adjusted": False})
        self.assertEqual([item["raw"] for item in line["abnormalities"]], ["+8", "+21"])
        self.assertEqual([item["raw"] for item in line["changes"]], ["+21"])

    def test_expanded_clone_and_composite_metadata(self):
        result = self.validate("POST", "47,XY,+8[10]/94,idemx2[5]").json()
        self.assertTrue(result["valid"], result["errors"])
        line = result["parsed"]["cell_lines"][1]
        self.assertEqual(line["sex_chromosomes"], "XXYY")
        self.assertEqual(line["reference"]["multiplier"], 2)
        self.assertEqual(line["abnormalities"][0]["copy_count"], 2)
        result = self.validate("POST", "45~47,XX,+8[cp12]/46,XX[8]").json()
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual([line["count"] for line in result["parsed"]["cell_lines"]], [12, 8])
        self.assertTrue(result["parsed"]["cell_lines"][0]["composite"])

    def test_nested_derivative_errors_reach_http_clients(self):
        result = self.validate("POST", "46,XX,der(5)t(5;99)(q13;p13)").json()
        self.assertFalse(result["valid"])
        self.assertIn("Invalid chromosome '99'", "; ".join(result["errors"]))

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
