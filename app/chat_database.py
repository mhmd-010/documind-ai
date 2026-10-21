
import json
import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = BASE_DIR / "data" / "chat_history.db"


def get_connection():
    """Open a connection to the SQLite database."""
    DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=10
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():
    """Create the messages table if it does not exist."""
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                role TEXT NOT NULL
                    CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                sources TEXT,
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_messages_document_id
            ON messages(document_id)
            """
        )


def save_message(
    document_id: str,
    role: str,
    content: str,
    sources: list | None = None
):
    """Save one chat message to SQLite."""
    if role not in ("user", "assistant"):
        raise ValueError("Invalid message role")

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO messages (
                document_id,
                role,
                content,
                sources
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                document_id,
                role,
                content,
                json.dumps(sources or [])
            )
        )


def get_messages(document_id: str) -> list[dict]:
    """Retrieve a document's chat messages in order."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, role, content, sources, created_at
            FROM messages
            WHERE document_id = ?
            ORDER BY id ASC
            """,
            (document_id,)
        ).fetchall()

    return [
        {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "sources": json.loads(row["sources"] or "[]"),
            "created_at": row["created_at"]
        }
        for row in rows
    ]


def delete_messages(document_id: str) -> int:
    """Delete chat messages belonging to a document."""
    with get_connection() as connection:
        cursor = connection.execute(
            """
            DELETE FROM messages
            WHERE document_id = ?
            """,
            (document_id,)
        )

        return cursor.rowcount
