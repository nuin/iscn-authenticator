import unittest
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from iscn_authenticator.main import is_valid_karyotype

class TestIsValidKaryotype(unittest.TestCase):

    def test_valid_karyotypes(self):
        self.assertTrue(is_valid_karyotype("46,XX"))
        self.assertTrue(is_valid_karyotype("47,XY"))
        self.assertTrue(is_valid_karyotype("47,XXX"))
        self.assertTrue(is_valid_karyotype("45,X"))
        self.assertTrue(is_valid_karyotype("47,XX,+21"))
        self.assertTrue(is_valid_karyotype("46,XX,del(5)(q13)"))

    def test_invalid_karyotypes(self):
        self.assertFalse(is_valid_karyotype("46,X")) # Should be 45,X
        self.assertFalse(is_valid_karyotype("46,Y"))
        self.assertFalse(is_valid_karyotype("46,Z"))
        self.assertFalse(is_valid_karyotype("46XX"))
        self.assertFalse(is_valid_karyotype("46,XX,"))
        self.assertFalse(is_valid_karyotype("foo,bar"))
        self.assertFalse(is_valid_karyotype("46,XXY")) # Should be 47,XXY
        self.assertFalse(is_valid_karyotype("47,XX,21"))
        self.assertFalse(is_valid_karyotype("47,XX,+21,+"))

    def test_abnormality_karyotypes(self):
        # Interstitial Deletions
        self.assertTrue(is_valid_karyotype("46,XX,del(5)(q13q33)"))
        self.assertFalse(is_valid_karyotype("46,XX,del(5)(q)"))
        self.assertFalse(is_valid_karyotype("46,XX,del(5)(13q)"))
        self.assertFalse(is_valid_karyotype("46,XX,del(5)q13"))
        self.assertFalse(is_valid_karyotype("46,XX,del(5)(q13q)"))


if __name__ == '__main__':
    unittest.main()
