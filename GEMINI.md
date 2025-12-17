# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to understand and effectively assist with this project.

## Project Overview

This is a Python project named "ISCN Authenticator". Its purpose is to provide a tool for validating the nomenclature of ISCN (International System for Human Cytogenomic Nomenclature) karyotypes.

The project is structured as a Python package. The main logic resides in `iscn_authenticator/main.py`, which contains the function `is_valid_karyotype` for the validation. The project has no external dependencies.

Tests are located in the `tests/` directory and use Python's built-in `unittest` framework.

## Building and Running

### Dependencies

There are no external dependencies to install.

### Running the Application

The application can be run as an interactive script:

```bash
python iscn_authenticator/main.py
```

### Running Tests

To run the tests, execute the following command from the project root:

```bash
python -m unittest tests/test_main.py
```

## Development Conventions

- The project uses the standard Python `unittest` framework for tests.
- New tests should be added to `tests/test_main.py`.
- The core validation logic is located in `iscn_authenticator/main.py`.
