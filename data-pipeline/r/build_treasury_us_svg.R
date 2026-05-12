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
  library(jsonlite)
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
tables_dir <- file.path(out_dir, "charts", "tables")
dir.create(static_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)
source(file.path(script_dir, "chart_theme.R"))

write_treasury_placeholder <- function(reason) {
  p <- ggplot(data.frame(x = 1, y = 1), aes(x = x, y = y)) +
    geom_text(label = reason, size = 5, color = "#6b7280") +
    xlim(0, 2) +
    ylim(0, 2) +
    labs(
      x = NULL,
      y = NULL
    ) +
    theme_void(base_size = 12) +
    theme(
      plot.title = element_text(face = "bold", color = "#027DFC", hjust = 0),
      plot.background = element_rect(fill = "white", colour = NA)
    )
  svglite(file.path(static_dir, "juros_treasury_us.svg"), width = az_chart_width(), height = az_chart_height())
  print(p)
  dev.off()
  message("SVG placeholder: juros_treasury_us.svg")
}

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
  payload <- fromJSON(resp_body_string(req))
  obs <- payload$observations
  if (is.null(obs) || !length(obs)) {
    return(tibble(date = as.Date(character()), value = numeric(), series = character()))
  }
  df <- as.data.frame(obs, stringsAsFactors = FALSE)
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
  date_col <- if ("observation_date" %in% names(df)) "observation_date" else if ("DATE" %in% names(df)) "DATE" else NA_character_
  if (is.na(date_col) || !(series_id %in% names(df))) {
    return(tibble(date = as.Date(character()), value = numeric(), series = character()))
  }
  tibble(
    date = as.Date(df[[date_col]]),
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
if (!nrow(df)) {
  write_treasury_placeholder("Dados Treasury indisponiveis agora")
  quit(save = "no", status = 0)
}

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
  curve_to_long(row_today, snap_label("Recente", row_today))
)

if (!nrow(curves)) {
  write_treasury_placeholder("Curva Treasury indisponivel agora")
  quit(save = "no", status = 0)
}

snap_order <- unique(curves$snapshot)
curves$snapshot <- factor(curves$snapshot, levels = snap_order)
greens <- colorRampPalette(c("#8BE28F", "#2BBF5E", "#0B6B2E", "#000000"))(length(snap_order))
names(greens) <- snap_order

p <- ggplot(curves, aes(x = tenor, y = yield, color = snapshot, group = snapshot)) +
  geom_line(linewidth = 0.9) +
  geom_point(size = 2) +
  scale_x_continuous(breaks = tenor_years) +
  scale_color_manual(values = greens) +
  labs(
    x = "Maturidade (anos)",
    y = "Yield (%)",
    color = NULL
  ) +
  az_chart_theme(legend_position = "bottom")

svglite(file.path(static_dir, "juros_treasury_us.svg"), width = az_chart_width(), height = az_chart_height())
print(p)
dev.off()

treasury_wide <- curves %>%
  mutate(snapshot = as.character(snapshot)) %>%
  tidyr::pivot_wider(names_from = snapshot, values_from = yield) %>%
  arrange(tenor)
curve_cols <- setdiff(names(treasury_wide), "tenor")
table_payload <- list(
  status = "ok",
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
  columns = c(
    list(list(key = "tenor", label = "Maturidade (anos)")),
    lapply(curve_cols, function(k) list(key = k, label = k))
  ),
  rows = lapply(seq_len(nrow(treasury_wide)), function(i) {
    row <- treasury_wide[i, , drop = FALSE]
    out <- list(tenor = as.character(row$tenor[[1]]))
    for (k in curve_cols) {
      v <- row[[k]][[1]]
      out[[k]] <- if (is.na(v)) NULL else sprintf("%.2f%%", as.numeric(v))
    }
    out
  })
)
write_json(
  table_payload,
  file.path(tables_dir, "juros_treasury_us.json"),
  auto_unbox = TRUE,
  pretty = TRUE
)
message("SVG: juros_treasury_us.svg")
