# Curva Treasury EUA (FRED DGS*) — SVG via ggplot2.
# Requer FRED_API_KEY

suppressPackageStartupMessages({
  library(httr2)
  library(dplyr)
  library(tidyr)
  library(ggplot2)
  library(svglite)
  library(scales)
  library(tibble)
})

args_trailing <- commandArgs(trailingOnly = FALSE)
file_arg <- sub("^--file=", "", args_trailing[grepl("^--file=", args_trailing)])
script_dir <- if (length(file_arg) && nzchar(file_arg[1])) {
  dirname(normalizePath(file_arg[1], winslash = "/", mustWork = TRUE))
} else {
  getwd()
}
data_pipeline_root <- normalizePath(file.path(script_dir, ".."), winslash = "/", mustWork = TRUE)
out_dir <- Sys.getenv("DATA_PIPELINE_OUT", unset = file.path(data_pipeline_root, "out"))
static_dir <- file.path(out_dir, "charts", "static")
dir.create(static_dir, recursive = TRUE, showWarnings = FALSE)

fred_key <- Sys.getenv("FRED_API_KEY", "")

series_cols <- c("DGS1", "DGS2", "DGS3", "DGS5", "DGS7", "DGS10", "DGS20", "DGS30")
tenor_years <- c(1, 2, 3, 5, 7, 10, 20, 30)
base_url <- "https://api.stlouisfed.org/fred/series/observations"
fallback_csv_url <- "https://fred.stlouisfed.org/graph/fredgraph.csv"

get_fred_api <- function(series_id, api_key) {
  req <- request(base_url) |>
    req_url_query(api_key = api_key, series_id = series_id, file_type = "json") |>
    req_timeout(60) |>
    req_perform()
  payload <- resp_body_json(req)
  obs <- payload$observations
  if (is.null(obs) || !length(obs)) {
    return(tibble(date = as.Date(character()), value = numeric(), series = character()))
  }
  df <- tibble::as_tibble(obs)
  tibble(
    date = as.Date(df$date),
    value = suppressWarnings(as.numeric(df$value)),
    series = series_id
  ) %>% filter(!is.na(date), !is.na(value))
}

get_fred_csv <- function(series_id) {
  req <- request(fallback_csv_url) |>
    req_url_query(id = series_id) |>
    req_timeout(60) |>
    req_perform()
  payload <- resp_body_string(req)
  con <- textConnection(payload)
  on.exit(close(con), add = TRUE)
  df <- read.csv(con, stringsAsFactors = FALSE)
  if (!all(c("DATE", series_id) %in% names(df))) {
    return(tibble(date = as.Date(character()), value = numeric(), series = character()))
  }
  tibble(
    date = as.Date(df$DATE),
    value = suppressWarnings(as.numeric(df[[series_id]])),
    series = series_id
  ) %>% filter(!is.na(date), !is.na(value))
}

fetch_series <- function(series_id, api_key) {
  via_api <- if (nzchar(api_key)) {
    tryCatch(
      get_fred_api(series_id, api_key),
      error = function(e) {
        message("WARN FRED API ", series_id, ": ", conditionMessage(e))
        tibble(date = as.Date(character()), value = numeric(), series = character())
      }
    )
  } else {
    tibble(date = as.Date(character()), value = numeric(), series = character())
  }
  if (nrow(via_api) > 0) return(via_api)
  tryCatch(
    get_fred_csv(series_id),
    error = function(e) {
      message("WARN FRED CSV ", series_id, ": ", conditionMessage(e))
      tibble(date = as.Date(character()), value = numeric(), series = character())
    }
  )
}

dfs <- lapply(series_cols, function(s) {
  fetch_series(s, fred_key)
})
df <- bind_rows(dfs)
if (!nrow(df)) stop("Nenhum dado FRED")

df_wide <- df %>%
  pivot_wider(names_from = series, values_from = value) %>%
  arrange(date)

for (col in series_cols) {
  if (!col %in% names(df_wide)) df_wide[[col]] <- NA_real_
}

last_date <- max(df_wide$date, na.rm = TRUE)

get_snapshot <- function(target_date) {
  x <- df_wide %>% filter(date <= target_date)
  if (!nrow(x)) return(x[0, , drop = FALSE])
  x %>% slice_tail(n = 1)
}

curve_to_long <- function(row, label) {
  if (!nrow(row)) return(tibble())
  yv <- vapply(series_cols, function(col) as.numeric(row[[col]][1]), numeric(1))
  tibble(
    tenor = tenor_years,
    yield = yv,
    snapshot = label
  ) %>% filter(!is.na(yield))
}

snap_label <- function(prefix, row) {
  if (!nrow(row)) return(character(0))
  paste0(prefix, " (", format(row$date[[1]], "%d/%m/%Y"), ")")
}

row_today <- get_snapshot(last_date)
row_30 <- get_snapshot(last_date - 30)
row_90 <- get_snapshot(last_date - 90)
row_365 <- get_snapshot(last_date - 365)

curves <- bind_rows(
  curve_to_long(row_365, snap_label("D-365", row_365)),
  curve_to_long(row_90, snap_label("D-90", row_90)),
  curve_to_long(row_30, snap_label("D-30", row_30)),
  curve_to_long(row_today, snap_label("Hoje", row_today))
)

if (!nrow(curves)) stop("Curva Treasury vazia")

snap_order <- unique(curves$snapshot)
curves$snapshot <- factor(curves$snapshot, levels = snap_order)
greens <- colorRampPalette(c("#8BE28F", "#2BBF5E", "#0B6B2E", "#000000"))(length(snap_order))
names(greens) <- snap_order

stamp <- format(Sys.time(), "%d/%m/%Y %H:%M", tz = "America/Sao_Paulo")

p <- ggplot(curves, aes(x = tenor, y = yield, color = snapshot, group = snapshot)) +
  geom_line(linewidth = 0.9) +
  geom_point(size = 2) +
  scale_x_continuous(breaks = tenor_years) +
  scale_color_manual(values = greens) +
  labs(
    x = "Maturidade (anos)",
    y = "Yield (%)",
    title = "Curva Treasury EUA",
    color = NULL,
    caption = paste("Atualizado:", stamp)
  ) +
  theme_minimal(base_size = 12) +
  theme(
    legend.position = "bottom",
    plot.title = element_text(face = "bold", color = "#132960")
  )

svglite(file.path(static_dir, "juros_treasury_us.svg"), width = 10, height = 5.5)
print(p)
dev.off()
message("SVG: juros_treasury_us.svg")
