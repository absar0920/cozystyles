#!/usr/bin/env bash
# LOCAL DRY RUN ONLY — never used against staging/production.
# Save/restore the local walkthrough database (docker MariaDB, database cozy_walk) + uploads folder, so a failing
# section can be re-run from the state right before it without repeating every earlier section.
#   walkthrough/checkpoint.sh reset            empty database (tables only) + empty uploads
#   walkthrough/checkpoint.sh save <name>      e.g. save before-04
#   walkthrough/checkpoint.sh restore <name>
set -euo pipefail
DB=cozy_walk; C=cozystyles-mysql; PW=cozystyles
UP=/tmp/cozy-walk-uploads; DIR=/tmp/cozy-walk-checkpoints
cd "$(dirname "$0")/.."
mkdir -p "$DIR"
case "${1:-}" in
  reset)
    docker exec $C mariadb -uroot -p$PW -e "DROP DATABASE IF EXISTS $DB"
    DATABASE_URL="mysql://root:$PW@127.0.0.1:3307/$DB" npx prisma migrate deploy >/dev/null
    rm -rf "$UP"; mkdir -p "$UP"; rm -rf walkthrough-output/local; echo "reset: empty $DB" ;;
  save)
    docker exec $C mariadb-dump -uroot -p$PW --single-transaction "$DB" > "$DIR/$2.sql"
    rm -rf "$DIR/$2.uploads" "$DIR/$2.output"; cp -R "$UP" "$DIR/$2.uploads"
    [ -d walkthrough-output/local ] && cp -R walkthrough-output/local "$DIR/$2.output" || true
    echo "saved $2" ;;
  restore)
    docker exec $C mariadb -uroot -p$PW -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB"
    docker exec -i $C mariadb -uroot -p$PW "$DB" < "$DIR/$2.sql"
    rm -rf "$UP"; cp -R "$DIR/$2.uploads" "$UP"
    rm -rf walkthrough-output/local; [ -d "$DIR/$2.output" ] && cp -R "$DIR/$2.output" walkthrough-output/local || true
    echo "restored $2" ;;
  *) echo "usage: $0 reset | save <name> | restore <name>"; exit 1 ;;
esac
