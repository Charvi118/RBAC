"""
Database connection module for the RBAC backend.
Responsibilities:
- Load database configuration from environment variables. 
- Provide a PostgreSQL connection using psycopg2.
- Keep database connection creation centralized. 

Environment variables required:
- DB_HOST: Database host address.
- DB_PORT: Database port number.
- DB_NAME: Name of the database to connect to.
- DB_USER: Database username.
- DB_PASSWORD: Database password.

Security notes:
- Database credentials must never be harcoded. 
- Credentials must come from environment variables or secure manager. 

Production notes:
- This module currently opens a new connection per call.
- Add conncetion pooling before production use.
- Add safer error handling for failed database connections. 
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    """
    Create and return a new PostgreSQL database connection. 

    Returns:
        psycopg2.extensions.connection: Active PostgreSQL connnection. 
    Raises:
        psycopg2.OperationalError: If the database is unreachable or credentials are invalid. 
    Production note:
        Replace direct connection creation with a connection pool before production use.
    """
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )
