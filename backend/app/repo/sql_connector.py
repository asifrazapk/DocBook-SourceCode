import os
import asyncio
import asyncpg
import logging
from app.core.config import settings

DB_POOL_MIN_SIZE = settings.DB_POOL_MIN_SIZE
DB_POOL_MAX_SIZE = settings.DB_POOL_MAX_SIZE

logger = logging.getLogger("sage-be")

write_pool: asyncpg.Pool | None = None
read_pool: asyncpg.Pool | None = None
main_loop: asyncio.AbstractEventLoop | None = None


def get_main_loop() -> asyncio.AbstractEventLoop:
    if main_loop is None:
        raise RuntimeError("Main event loop not initialized")
    return main_loop


async def _create_pool_with_retries(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    min_size: int,
    max_size: int,
    max_retries: int,
    pool_name: str,
) -> asyncpg.Pool:

    for attempt in range(1, max_retries + 1):
        try:
            pool = await asyncpg.create_pool(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                min_size=min_size,
                max_size=max_size,
                command_timeout=60,

            )

            logger.info(
                f"{pool_name} pool initialized "
                f"(host={host})"
            )

            return pool

        except Exception as e:
            logger.warning(
                f"{pool_name} pool init attempt "
                f"{attempt}/{max_retries} failed: {e}"
            )

            if attempt < max_retries:
                await asyncio.sleep(2)

    raise RuntimeError(
        f"Failed to initialize {pool_name} pool"
    )


# =========================
# INIT POOLS
# =========================
async def init_db_pools(
    port: int | None = None,
    user: str | None = None,
    password: str | None = None,
    database: str | None = None,
    schema: str | None = None,
    min_size: int = DB_POOL_MIN_SIZE,
    max_size: int = DB_POOL_MAX_SIZE,
    max_retries: int = 5,
):
    global write_pool, read_pool

    primary_host = os.getenv("POSTGRES_HOST", "localhost")
    read_host = os.getenv("POSTGRES_READ_HOST", "")

    port = port or int(os.getenv("POSTGRES_PORT", 5432))
    user = user or os.getenv("POSTGRES_USER", "postgres")
    password = password or os.getenv("POSTGRES_PASSWORD", "1234")
    database = database or os.getenv("POSTGRES_DB", "sprouts_db")
    schema = schema or os.getenv("POSTGRES_SCHEMA", "public")

    if write_pool is None:
        # Primary / write pool
        write_pool = await _create_pool_with_retries(
            host=primary_host,
            port=port,
            user=user,
            password=password,
            database=database,
            min_size=min_size,
            max_size=max_size,
            max_retries=max_retries,
            pool_name="WRITE",
        )

    # Optional read replica
    if read_host and read_pool is None:
        read_pool = await _create_pool_with_retries(
            host=read_host,
            port=port,
            user=user,
            password=password,
            database=database,
            min_size=min_size,
            max_size=max_size,
            max_retries=max_retries,
            pool_name="READ",
        )
    else:
        logger.info(
            "POSTGRES_READ_HOST not configured. "
            "Reads will use primary DB."
        )


def get_write_pool() -> asyncpg.Pool:
    if write_pool is None:
        raise RuntimeError("Write pool not initialized")
    return write_pool


def get_read_pool() -> asyncpg.Pool:
    return read_pool or get_write_pool()


async def get_read_connection():
    return await get_read_pool().acquire()


async def get_write_connection():
    return await get_write_pool().acquire()


async def release_read_connection(conn):
    if conn is None:
        return
    try:
        await get_read_pool().release(conn)
    except Exception:
        # A connection that errored (e.g. timed out / was reset) may already be
        # dead; never let release failures mask the original error or leak.
        logger.warning("Failed to release DB connection cleanly", exc_info=True)

    


async def release_write_connection(conn):
    if conn is None:
        return
    try:
        await get_write_pool().release(conn)
    except Exception:
        # A connection that errored (e.g. timed out / was reset) may already be
        # dead; never let release failures mask the original error or leak.
        logger.warning("Failed to release DB connection cleanly", exc_info=True)



async def close_db_pools():
    global write_pool, read_pool

    if read_pool:
        await read_pool.close()
        read_pool = None

    if write_pool:
        await write_pool.close()
        write_pool = None


# =========================
# TRANSACTION CONTEXT
# =========================
class db_transaction:
    def __init__(self):
        self.conn = None
        self.tx = None
        self._tx_started = False

    async def __aenter__(self):
        self.conn = await get_write_pool().acquire()
        self.tx = self.conn.transaction()
        await self.tx.start()
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        
        try:
            if self.tx:
                if exc:
                    await self.tx.rollback()
                else:
                    await self.tx.commit()
        except Exception:
            logger.warning("Failed to finalize DB transaction cleanly", exc_info=True)
        finally:
            if self.conn:
                await release_write_connection(self.conn)