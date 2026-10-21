docker compose up -d

или
docker compose build --no-cache
+
docker compose up -d

 docker exec -i aup_3d-1-postgres-1 psql -U postgres -d postgres < dump_29.sql
  docker build --no-cache -t aup_3d-1-gateway .