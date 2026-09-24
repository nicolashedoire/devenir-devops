#!/usr/bin/env bash
# Cinq blocs de la section de maintenance du livre, dans leur ordre.
# SHA-256 de leur concaténation : 9394484500d1fa3de7b648645d39e3408e8ad307cbd01c90f4300083c01d5a50
set -e
umask 077
TASKBOARD_TLS_SOURCE="$PWD/work/operations/security"
test -f "$TASKBOARD_TLS_SOURCE/ca.key"
test -f "$TASKBOARD_TLS_SOURCE/runtime/server.key"
TASKBOARD_TLS_STAGE=$(mktemp -d "$TASKBOARD_TLS_SOURCE/renewal.XXXXXX")
cp "$TASKBOARD_TLS_SOURCE/ca.crt" "$TASKBOARD_TLS_STAGE/ca-avant.crt"
cp "$TASKBOARD_TLS_SOURCE/runtime/server.crt" "$TASKBOARD_TLS_STAGE/server-avant.crt"

openssl req -new -x509 -sha256 -days 30 \
  -key "$TASKBOARD_TLS_SOURCE/ca.key" \
  -subj /CN=TaskBoard-Laboratoire-CA \
  -addext basicConstraints=critical,CA:TRUE \
  -addext keyUsage=critical,keyCertSign,cRLSign \
  -addext subjectKeyIdentifier=hash \
  -out "$TASKBOARD_TLS_STAGE/ca.crt"
openssl req -new -sha256 \
  -key "$TASKBOARD_TLS_SOURCE/runtime/server.key" \
  -subj /CN=localhost -out "$TASKBOARD_TLS_STAGE/server.csr"
TASKBOARD_TLS_SERIAL=$(openssl rand -hex 16)
openssl x509 -req -sha256 -days 7 \
  -in "$TASKBOARD_TLS_STAGE/server.csr" \
  -CA "$TASKBOARD_TLS_STAGE/ca.crt" \
  -CAkey "$TASKBOARD_TLS_SOURCE/ca.key" \
  -set_serial "0x$TASKBOARD_TLS_SERIAL" \
  -extfile "$TASKBOARD_TLS_SOURCE/extensions.cnf" \
  -out "$TASKBOARD_TLS_STAGE/server.crt"

openssl x509 -in "$TASKBOARD_TLS_SOURCE/ca.crt" -pubkey -noout \
  > "$TASKBOARD_TLS_STAGE/ca-avant.pub"
openssl x509 -in "$TASKBOARD_TLS_STAGE/ca.crt" -pubkey -noout \
  > "$TASKBOARD_TLS_STAGE/ca-apres.pub"
cmp "$TASKBOARD_TLS_STAGE/ca-avant.pub" "$TASKBOARD_TLS_STAGE/ca-apres.pub"
openssl verify -purpose sslserver -verify_hostname localhost \
  -CAfile "$TASKBOARD_TLS_STAGE/ca.crt" "$TASKBOARD_TLS_STAGE/server.crt"
openssl verify -purpose sslserver -verify_ip 127.0.0.1 \
  -CAfile "$TASKBOARD_TLS_STAGE/ca.crt" "$TASKBOARD_TLS_STAGE/server.crt"
openssl x509 -in "$TASKBOARD_TLS_STAGE/ca.crt" -noout -dates
openssl x509 -in "$TASKBOARD_TLS_STAGE/server.crt" -noout -dates
echo "Dossier de maintenance : $TASKBOARD_TLS_STAGE"

dc_operations() {
  docker compose --env-file work/operations/lab.env \
    --project-directory "$PWD" -f operations/compose.yaml "$@"
}
dc_operations stop gateway
install -m 600 "$TASKBOARD_TLS_STAGE/ca.crt" "$TASKBOARD_TLS_SOURCE/ca.crt"
install -m 644 "$TASKBOARD_TLS_STAGE/server.crt" \
  "$TASKBOARD_TLS_SOURCE/runtime/server.crt"
dc_operations up -d --no-deps gateway
node operations/lab.mjs verify

openssl verify -purpose sslserver -verify_ip 127.0.0.1 \
  -CAfile "$TASKBOARD_TLS_STAGE/ca-avant.crt" \
  "$TASKBOARD_TLS_STAGE/server-avant.crt"
