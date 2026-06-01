from dataclasses import dataclass
from typing import Any, Callable, Optional

from iscn_authenticator.models import KaryotypeAST


@dataclass
class Rule:
    """A validation rule for karyotype components."""

    id: str
    category: str
    description: str
    validate: Callable[[Any, Optional[KaryotypeAST]], list[str]]
