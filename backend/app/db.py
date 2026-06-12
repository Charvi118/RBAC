"""
Database connection module for the RBAC backend.

Responsibilities:
- load database settings from environment variables
- create PostgreSQL connections for the application
- optionally support connection pooling

This file must not be responsible for:
- RBAC permission checks
- authentication or session handling
- business SQL queries

Security note:
- database credentials must come from environment variables
- credentials must never be hardcoded

Production note:
- pooling is optional and controlled by environment variables
- callers must still close connections properly
"""
import os

import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

_db_pool = None


class PooledConnection:

    def __init__(self, pooled_connection, db_pool):
        """
        Store the real psycopg2 connection and its owning pool.

        Args:
            pooled_connection: connection borrowed from the pool
            db_pool: active SimpleConnectionPool instance
        """
        self._connection = pooled_connection
        self._db_pool = db_pool

    def close(self):
        """
        Return the connection to the pool instead of closing it permanently.
        """
        self._db_pool.putconn(self._connection)

    def __getattr__(self, name):
        """
        Forward missing attributes to the wrapped psycopg2 connection.

        Args:
            name: attribute name requested by the caller

        Returns:
            Any: attribute from the wrapped psycopg2 connection
        """
        return getattr(self._connection, name)


def _get_pool():
    """
    Create or return the shared PostgreSQL connection pool.

    Returns:
        psycopg2.pool.SimpleConnectionPool | None:
            active connection pool when pooling is enabled, otherwise None

    Raises:
        psycopg2.OperationalError:
            if pooling is enabled and the pool cannot be created

    Production note:
        The pool is process-local. Multi-process deployments still create
        separate pools per process.
    """
    global _db_pool

    use_pool = os.getenv("DB_USE_POOL", "false").lower() == "true"
    if not use_pool:
        return None

    if _db_pool is None:
        min_conn = int(os.getenv("DB_POOL_MIN_CONN", "1"))
        max_conn = int(os.getenv("DB_POOL_MAX_CONN", "5"))

        _db_pool = pool.SimpleConnectionPool(
            min_conn,
            max_conn,
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
        )

    return _db_pool


def get_connection():
    """
    Create and return a PostgreSQL database connection.

    Returns:
        psycopg2.extensions.connection | PooledConnection:
            active PostgreSQL connection object

    Raises:
        psycopg2.OperationalError:
            if the database is unreachable or credentials are invalid

    Security note:
        This function only creates a connection. It does not validate SQL
        safety, user identity, or access permissions.

    Production note:
        When DB_USE_POOL=true, this function returns a pooled connection
        wrapper. Calling close() returns it to the pool.
    """
    db_pool = _get_pool()
    if db_pool is not None:
        return PooledConnection(db_pool.getconn(), db_pool)

    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )
