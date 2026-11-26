#!/bin/sh
# Run locally on the operator workstation. Keep CA keys offline.
set -eu
umask 077
out=${1:?usage: create-pki.sh NEW_DIRECTORY [--local-test]}
case "${2:-}" in
  '') server_ip=130.61.180.101 ;;
  --local-test) server_ip=127.0.0.1 ;;
  *) exit 2 ;;
esac
mkdir -- "$out"
cd -- "$out"
for role in server gateway; do
  openssl req -new -x509 -newkey rsa:3072 -nodes -sha256 -days 365     -subj "/CN=Trackium $role routing CA" -out "$role-ca.crt" -keyout "$role-ca.key"     -addext 'basicConstraints=critical,CA:TRUE,pathlen:0'     -addext 'keyUsage=critical,keyCertSign,cRLSign'
  openssl req -new -newkey rsa:3072 -nodes -subj "/CN=Trackium $role routing peer"     -out "$role.csr" -keyout "$role.key"
  {
    printf '%s\n' 'basicConstraints=critical,CA:FALSE' 'keyUsage=critical,digitalSignature,keyEncipherment'
    if [ "$role" = server ]; then
      printf '%s\n' 'extendedKeyUsage=serverAuth' "subjectAltName=IP:$server_ip"
    else
      printf '%s\n' 'extendedKeyUsage=clientAuth'
    fi
  } > "$role.ext"
  openssl x509 -req -in "$role.csr" -CA "$role-ca.crt" -CAkey "$role-ca.key"     -set_serial "0x$(openssl rand -hex 16)" -sha256 -days 90 -extfile "$role.ext" -out "$role.crt"
  rm -- "$role.csr" "$role.ext"
done
