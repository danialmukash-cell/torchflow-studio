import os

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    """Run the same API contract against FastAPI or an external server."""
    url = os.getenv("TORCHFLOW_TEST_API_URL")
    with (httpx.Client(base_url=url) if url else TestClient(app)) as api:
        yield api
