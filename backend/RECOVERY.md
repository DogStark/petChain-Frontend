# PetChain Database Recovery Procedures

This document outlines the steps for full restore and Point-In-Time Recovery (PITR) for the PetChain PostgreSQL database.

## 1. Prerequisites
- Access to the backup storage (Base backups and WAL archives).
- Docker environment with `petchain_postgres` container.

## 2. Full Restore (Latest Backup)

Use these steps to restore the database to the state of the most recent base backup.

1.  **Stop the Application**:
    ```bash
    docker-compose stop
    ```

2.  **Clear Existing Data**:
    ```bash
    docker volume rm backend_postgres_data
    ```

3.  **Restore Base Backup**:
    - Start the postgres container (it will recreate the volume).
    - Extract the latest base backup into `/var/lib/postgresql/data`.
    ```bash
    tar -xzf /var/lib/postgresql/data/backups/base_backup_YYYYMMDD_HHMMSS.tar.gz -C /var/lib/postgresql/data
    ```

4.  **Restart Container**:
    ```bash
    docker-compose up -d postgres
    ```

## 3. Point-In-Time Recovery (PITR)

Use these steps to restore the database to a specific point in time.

1.  **Stop the Application and Clear Data** (as above).

2.  **Restore Latest Base Backup** (as above).

3.  **Create Recovery Configuration**:
    - Create a `recovery.signal` file in the data directory.
    - Update `postgresql.conf` or add `restore_command`:
    ```ini
    restore_command = 'cp /var/lib/postgresql/data/archive/%f %p'
    recovery_target_time = 'YYYY-MM-DD HH:MM:SS'
    ```

4.  **Start PostgreSQL**:
    PostgreSQL will read the WAL files from the archive and apply them until it reaches the target time.

5.  **Verify Data**:
    Once recovery is complete, PostgreSQL will rename `recovery.signal` to `recovery.done` (or just start accepting connections). Verify the data integrity.

## 4. Verification

After any restore operation, run the following:
- Check PostgreSQL logs: `docker logs petchain_postgres`.
- Run application health checks.
- Verify data consistency via the Admin portal.
