# Pacotes necessarios para o pipeline estatico (ggplot2 + svglite)
pkgs <- c(
  "httr2", "readr", "dplyr", "tidyr", "lubridate",
  "ggplot2", "svglite", "jsonlite", "scales", "tibble", "rlang"
)

install_if_missing <- function(p) {
  if (!requireNamespace(p, quietly = TRUE)) {
    install.packages(p, repos = "https://cloud.r-project.org", quiet = TRUE)
  }
}

invisible(lapply(pkgs, install_if_missing))

# Opcional: Selic implicita (curva PRE via B3)
tryCatch(
  {
    if (!requireNamespace("rb3", quietly = TRUE)) {
      install.packages("rb3", repos = "https://cloud.r-project.org", quiet = TRUE)
    }
  },
  error = function(e) message("rb3 nao instalado (opcional): ", conditionMessage(e))
)

message("install_packages.R OK")
