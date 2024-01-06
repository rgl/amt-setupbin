amt_domain='amt.test'
amt_domain_pfx_password='HeyH0Password!'
amt_device_current_password='admin'
amt_device_new_password='HeyH0Password!'

mkdir -p amt-ca
pushd amt-ca >/dev/null

# Create AMT domain certificate signing request.
cat >"$amt_domain-crt.conf" <<EOF
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, 2.16.840.1.113741.1.2.3
subjectAltName = @alt_names

[alt_names]
DNS.1 = $amt_domain
EOF
cat >"$amt_domain-csr.conf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
CN = $amt_domain
EOF
openssl genrsa \
  -out "$amt_domain-key.pem" \
  2048
openssl req \
  -new \
  -config "$amt_domain-csr.conf" \
  -key "$amt_domain-key.pem" \
  -out "$amt_domain-csr.pem"

# Create the private AMT CA and use it to sign the AMT domain CSR.
if [ ! -f amt-ca-crt.pem ]; then
  openssl req \
    -x509 \
    -sha256 \
    -days 3560 \
    -nodes \
    -newkey rsa:2048 \
    -subj "/CN=AMT CA" \
    -keyout amt-ca-key.pem \
    -out amt-ca-crt.pem
fi
openssl x509 \
  -req \
  -sha256 \
  -days 3650 \
  -in "$amt_domain-csr.pem" \
  -CA amt-ca-crt.pem \
  -CAkey amt-ca-key.pem \
  -CAcreateserial \
  -extfile "$amt_domain-crt.conf" \
  -out "$amt_domain-crt.pem"

# Bundle the AMT domain private key and certificate into a PFX file.
openssl pkcs12 \
  -inkey "$amt_domain-key.pem" \
  -in "$amt_domain-crt.pem" \
  -certfile amt-ca-crt.pem \
  -export \
  -passout "pass:$amt_domain_pfx_password" \
  -out "$amt_domain.pfx"

# get the amt ca certificate hash.
amt_ca_certificate_hash="$(
  openssl x509 -noout -fingerprint -sha256 -in amt-ca-crt.pem \
    | perl -lne '/sha256 Fingerprint=([0-9A-Fa-f:]+)/ && print lc($1) =~ s/://rg')"

# go back to the original directory.
popd >/dev/null

# Create the AMT configuration file.
bun . \
  --debug \
  --current-password "$amt_device_current_password" \
  --new-password "$amt_device_new_password" \
  --pki-dns-suffix "$amt_domain" \
  --certificate "$amt_ca_certificate_hash AMT CA" \
  --path amt-ca/Setup.bin

# create a disk image with the AMT configuration file.
pushd amt-setupbin-img >/dev/null
rm -f ../amt-ca/Setup.bin.img
docker build -t amt-setupbin-img .
docker run --rm \
  -i \
  -u "$(id -u):$(id -g)" \
  -v "$PWD/../amt-ca:/host:rw" \
  -w /host \
  amt-setupbin-img
popd >/dev/null
