# Upload de um arquivo local para Vercel Blob (PUT).
# Uso: Rscript upload_to_blob.R <local_path> <blob_path>
# Requer BLOB_READ_WRITE_TOKEN no ambiente.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Uso: Rscript upload_to_blob.R <local_path> <blob_path>")
}

local_path <- args[[1]]
blob_path <- args[[2]]

token <- Sys.getenv("BLOB_READ_WRITE_TOKEN", "")
if (!nzchar(token)) {
  message("SKIP upload_to_blob (sem BLOB_READ_WRITE_TOKEN)")
  quit(save = "no", status = 0)
}

if (!file.exists(local_path)) {
  stop("Arquivo nao existe: ", local_path)
}

url <- paste0("https://blob.vercel-storage.com/", blob_path)
body <- readBin(local_path, "raw", file.info(local_path)$size)

ct <- if (grepl("\\.svg$", local_path, ignore.case = TRUE)) {
  "image/svg+xml"
} else if (grepl("\\.json$", local_path, ignore.case = TRUE)) {
  "application/json; charset=utf-8"
} else {
  "application/octet-stream"
}

if (!requireNamespace("httr2", quietly = TRUE)) {
  install.packages("httr2", repos = "https://cloud.r-project.org")
}
library(httr2)

resp <- request(url) |>
  req_method("PUT") |>
  req_headers(
    Authorization = paste("Bearer", token),
    `x-api-version` = "7",
    `Content-Type` = ct
  ) |>
  req_body_raw(body) |>
  req_perform()

if (resp_status(resp) >= 400) {
  stop("Blob upload falhou: ", resp_status(resp), " ", resp_body_string(resp))
}

message("Uploaded ", blob_path)
