# Blob Storage over REST with the VM's managed identity. Sourced, not run;
# expects ACCOUNT and CLIENT_ID to be set. No az CLI: it is 1 GB of Python for
# two HTTP requests.

blob_token() {
  curl -fsS -H Metadata:true \
    "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F&client_id=${CLIENT_ID}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
}

blob_url() { echo "https://${ACCOUNT}.blob.core.windows.net/$1/$2"; }

# blob_get CONTAINER NAME > file. Fails on a missing blob.
blob_get() {
  curl -fsS -H "Authorization: Bearer $(blob_token)" -H "x-ms-version: 2021-08-06" "$(blob_url "$1" "$2")"
}

# blob_put CONTAINER NAME FILE. Streams the file; a single PUT holds up to 5000 MiB.
blob_put() {
  curl -fsS -T "$3" -H "Authorization: Bearer $(blob_token)" -H "x-ms-version: 2021-08-06" \
    -H "x-ms-blob-type: BlockBlob" "$(blob_url "$1" "$2")" >/dev/null
}
