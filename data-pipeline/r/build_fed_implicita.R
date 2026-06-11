# Fed Funds implicita (forward meeting-to-meeting) a partir da curva CURTA de
# Treasury do FRED -> SVG (ggplot2) + JSON p/ o front.
#
# ESPELHA build_selic_implicita.R: la a curva PRE da B3 vira fatores de desconto
# e calculamos a taxa forward entre as datas das reunioes do COPOM. Aqui usamos a
# curva curta de Treasury (FRED) e as datas das reunioes do FOMC.
#
# Curva (granularidade CURTA, necessaria p/ forwards mensais entre reunioes):
#   DGS1MO, DGS3MO, DGS6MO, DGS1, DGS2  (a curva longa DGS5/10/30 nao basta).
#   FRED publica esses yields anualizados (% a.a.). Convertemos cada tenor em
#   prazo (anos, act/365) e construimos df = 1/(1+r)^(t) — capitalizacao anual,
#   analogo ao df = 1/(1+r)^(du/252) brasileiro. O forward entre duas datas de
#   reuniao sai de (df_i / df_j)^(1/dt) - 1.
#
# LIMITACAO IMPORTANTE (documentar no front tambem): o Treasury embute PREMIO DE
# PRAZO e nao e' o mesmo instrumento que OIS/Fed Funds futures. Logo esta serie e'
# uma APROXIMACAO da trajetoria implicita do Fed — NAO a precificacao exata do
# mercado de Fed Funds. Para a precificacao "de verdade" o ideal seria OIS/FF
# futures (CME FedWatch). Tratar como leitura direcional, nao como nivel exato.
#
# Saidas (mesmo formato do selic_implicita p/ o JurosLiveBlock consumir igual):
#   out/fed_implicita.json
#   out/charts/tables/fed_implicita.json
#   out/charts/static/fed_implicita.svg
# Requer FRED_API_KEY (cai p/ CSV publico se a API falhar).

suppressPackageStartupMessages({
  library(httr2)
  library(dplyr)
  library(tidyr)
  library(lubridate)
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
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
source(file.path(script_dir, "chart_theme.R"))

write_placeholder <- function(reason) {
  p <- ggplot(data.frame(x = 1, y = 1), aes(x = x, y = y)) +
    geom_text(label = reason, size = 5, color = "#6b7280") +
    xlim(0, 2) +
    ylim(0, 2) +
    labs(x = NULL, y = NULL) +
    theme_void(base_size = 12) +
    theme(
      plot.title = element_text(face = "bold", color = "#027DFC", hjust = 0),
      plot.background = element_rect(fill = "white", colour = NA)
    )
  svg_path <- file.path(static_dir, "fed_implicita.svg")
  svglite(svg_path, width = az_chart_width(), height = az_chart_height())
  print(p)
  dev.off()
  write_json(
    list(status = "skipped", reason = reason, generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S")),
    file.path(out_dir, "fed_implicita.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
  message("SVG placeholder: ", normalizePath(svg_path, winslash = "/", mustWork = FALSE))
}

round_step_up <- function(x, step = 0.0025, eps = 1e-12) {
  ceiling((x - eps) / step) * step
}

## ---------- FRED: curva curta de Treasury ----------
## Cada serie -> prazo aproximado em anos (act/365) usado p/ montar os df.

fred_key <- Sys.getenv("FRED_API_KEY", "")
short_series <- c("DGS1MO", "DGS3MO", "DGS6MO", "DGS1", "DGS2")
# Prazos nominais: 1m, 3m, 6m, 1a, 2a (em anos).
short_tenor_years <- c(1 / 12, 3 / 12, 6 / 12, 1, 2)
names(short_tenor_years) <- short_series

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
  ) |> filter(!is.na(date), !is.na(value))
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
  ) |> filter(!is.na(date), !is.na(value))
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

dfs <- lapply(short_series, function(s) fetch_series(s, fred_key))
df_all <- bind_rows(dfs)
if (!nrow(df_all)) {
  write_placeholder("Curva curta de Treasury indisponivel agora (FRED)")
  quit(save = "no", status = 0)
}

df_wide <- df_all |>
  pivot_wider(names_from = series, values_from = value) |>
  arrange(date)
for (col in short_series) {
  if (!col %in% names(df_wide)) df_wide[[col]] <- NA_real_
}

last_date <- max(df_wide$date, na.rm = TRUE)

# Snapshot = ultima linha COMPLETA (todas as series) ate target_date; se nenhuma
# linha completa, usa a ultima linha disponivel mesmo com algum NA.
get_snapshot <- function(target_date) {
  x <- df_wide |> filter(date <= target_date)
  if (!nrow(x)) return(NULL)
  complete <- x |> filter(if_all(all_of(short_series), ~ !is.na(.)))
  row <- if (nrow(complete)) dplyr::slice_tail(complete, n = 1) else dplyr::slice_tail(x, n = 1)
  row
}

# Curva de fatores de desconto a partir do snapshot (yields % a.a. -> df anual).
snapshot_curve <- function(row) {
  if (is.null(row) || !nrow(row)) return(NULL)
  out <- lapply(short_series, function(col) {
    y <- as.numeric(row[[col]][1])
    if (is.na(y)) return(NULL)
    t <- short_tenor_years[[col]]
    r <- y / 100
    tibble(series = col, t_years = t, r = r, df = 1 / ((1 + r)^t))
  })
  out <- bind_rows(Filter(Negate(is.null), out))
  if (!nrow(out)) return(NULL)
  out |> arrange(t_years) |> distinct(t_years, .keep_all = TRUE)
}

## ---------- Calendario FOMC (hardcoded, datas de DECISAO) ----------
## Fonte: federalreserve.gov/monetarypolicy/fomccalendars.htm (jun/2026).
## Datas = segundo dia (anuncio) de cada reuniao de 2 dias.

fomc_decision_dates <- as.Date(c(
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09",
  "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08"
))

## ---------- Grid nas datas de reuniao + forward ----------
## ref_snapshot = data do snapshot da curva (ancora dos prazos).
##
## DIFERENCA p/ o selic_implicita: la a curva PRE da B3 tem nos diarios densos,
## entao basta pegar o df do prazo mais proximo de cada data de reuniao. Aqui a
## curva curta de Treasury tem so 5 nos (1m/3m/6m/1a/2a); snapar no no mais
## proximo colaria varias reunioes no MESMO df (forward = 0% espurio) e geraria
## saltos absurdos. Por isso INTERPOLAMOS ln(df) linearmente em t (anos) — mesma
## ideia do interp_yield em build_yield_curves_svg.R — e achatamos nas pontas.

df_at <- function(curve, t) {
  if (t <= min(curve$t_years)) {
    r0 <- curve$r[1]
    return(1 / ((1 + r0)^t))
  }
  if (t >= max(curve$t_years)) {
    rN <- curve$r[nrow(curve)]
    return(1 / ((1 + rN)^t))
  }
  i <- max(which(curve$t_years <= t))
  x1 <- curve$t_years[i]
  x2 <- curve$t_years[i + 1]
  l1 <- log(curve$df[i])
  l2 <- log(curve$df[i + 1])
  w <- (t - x1) / (x2 - x1)
  exp(l1 + w * (l2 - l1))
}

grid_on_dates <- function(curve, ref_snapshot, dates) {
  ref_snapshot <- as.Date(ref_snapshot)
  dates <- sort(unique(as.Date(dates)))
  rows <- lapply(dates, function(td) {
    tt <- as.numeric(td - ref_snapshot) / 365
    tibble(
      grid_date = td,
      t_to = tt,
      df = if (tt <= 0) 1 else df_at(curve, tt)
    )
  })
  bind_rows(rows) |>
    filter(t_to > 0) |>
    arrange(t_to) |>
    distinct(t_to, .keep_all = TRUE)
}

calc_forward <- function(grid_df) {
  grid_df |>
    mutate(
      t_next = lead(t_to),
      df_next = lead(df),
      fwd = (df / df_next)^(1 / (t_next - t_to)) - 1
    ) |>
    filter(!is.na(fwd), t_next > t_to) |>
    select(grid_date, t_to, fwd)
}

requested_refdate <- as.Date(with_tz(Sys.time(), tzone = "America/New_York"))

# Janela visual: hoje -> hoje + 1 ano (igual ao selic_implicita).
chart_start <- requested_refdate
chart_end <- requested_refdate %m+% years(1)
fomc_in_window <- fomc_decision_dates[
  fomc_decision_dates >= chart_start & fomc_decision_dates <= chart_end
]
grid_dates <- sort(unique(c(chart_start, fomc_in_window, chart_end)))

row_today <- get_snapshot(last_date)
row_30 <- get_snapshot(last_date - 30)
row_90 <- get_snapshot(last_date - 90)

if (is.null(row_today)) {
  write_placeholder("Sem snapshot de Treasury curto p/ Fed implicita")
  quit(save = "no", status = 0)
}

compute_series_data <- function(row, label_prefix) {
  if (is.null(row) || !nrow(row)) return(NULL)
  curve <- snapshot_curve(row)
  if (is.null(curve) || nrow(curve) < 2) return(NULL)
  ref_snap <- as.Date(row$date[[1]])
  grid_c <- grid_on_dates(curve, ref_snap, grid_dates)
  fwd <- calc_forward(grid_c)
  if (!nrow(fwd)) return(NULL)
  curve_label <- sprintf("%s (%s)", label_prefix, format(ref_snap, "%d/%m/%Y"))
  fwd |>
    mutate(
      curve = curve_label,
      ref_snap = ref_snap,
      fwd_raw = fwd,
      fwd_025_up = round_step_up(fwd, step = 0.0025),
      fwd = fwd_025_up
    ) |>
    select(grid_date, curve, fwd, fwd_raw, fwd_025_up, ref_snap)
}

# Ordem: D-90 (mais antigo) -> D-30 -> Recente (mais recente, ultima coluna).
series_specs <- list(
  list(row = row_90, label = "D-90"),
  list(row = row_30, label = "D-30"),
  list(row = row_today, label = "Recente")
)
parts <- Filter(Negate(is.null), lapply(series_specs, function(s) compute_series_data(s$row, s$label)))
df_plot <- bind_rows(parts) |> mutate(grid_date = as.Date(grid_date))

if (!nrow(df_plot)) {
  write_placeholder("Sem dados para Fed implicita")
  quit(save = "no", status = 0)
}

ref_today <- as.Date(row_today$date[[1]])
ref_30 <- if (!is.null(row_30)) as.Date(row_30$date[[1]]) else NA
ref_90 <- if (!is.null(row_90)) as.Date(row_90$date[[1]]) else NA

curve_order <- c(
  if (!is.null(row_90)) sprintf("D-90 (%s)", format(ref_90, "%d/%m/%Y")) else NULL,
  if (!is.null(row_30)) sprintf("D-30 (%s)", format(ref_30, "%d/%m/%Y")) else NULL,
  sprintf("Recente (%s)", format(ref_today, "%d/%m/%Y"))
)
curve_order <- intersect(curve_order, unique(as.character(df_plot$curve)))
df_plot <- df_plot |> mutate(curve = factor(curve, levels = curve_order))

vlines <- sort(unique(fomc_in_window))
vdf <- data.frame(x = as.Date(vlines))

y_top <- max(df_plot$fwd, na.rm = TRUE)
y_rng <- diff(range(df_plot$fwd, na.rm = TRUE))
if (!is.finite(y_rng) || y_rng <= 0) y_rng <- 0.0025
y_lab <- y_top + 0.06 * y_rng

pal <- c(
  "Recente" = "#000000",
  "D-30" = "#6f6f6f",
  "D-90" = "#0078fd"
)
pick_color <- function(curve_name) {
  nm <- tolower(curve_name)
  if (grepl("^(recente|hoje)", nm)) return(pal[["Recente"]])
  if (grepl("^d-30|^30d", nm)) return(pal[["D-30"]])
  if (grepl("^d-90|^90d", nm)) return(pal[["D-90"]])
  "#000000"
}
color_values <- setNames(vapply(as.character(curve_order), pick_color, character(1)), as.character(curve_order))
line_values <- setNames(ifelse(grepl("^(Recente|Hoje)", curve_order), 1.15, 0.95), as.character(curve_order))

# Estende o ultimo degrau de cada curva ate chart_end (geom_step nao desenha
# apos o ultimo ponto). df_plot, sem o fantasma, alimenta tabela/JSON.
df_chart <- df_plot |>
  group_by(curve) |>
  group_modify(~ {
    last_row <- dplyr::slice_tail(.x, n = 1) |> mutate(grid_date = chart_end)
    bind_rows(.x, last_row)
  }) |>
  ungroup()

p <- ggplot(df_chart, aes(x = grid_date, y = fwd, color = curve, linewidth = curve, group = curve)) +
  geom_step() +
  geom_vline(
    xintercept = vdf$x,
    linetype = "dashed",
    linewidth = 0.65,
    color = "#ff5713"
  ) +
  geom_text(
    data = transform(vdf, y = y_lab, lab = format(x, "%d/%m")),
    aes(x = x, y = y, label = lab),
    inherit.aes = FALSE,
    vjust = 0,
    size = 4.3,
    color = "#0078fd"
  ) +
  scale_color_manual(values = color_values, breaks = curve_order) +
  scale_linewidth_manual(values = line_values, breaks = curve_order, guide = "none") +
  scale_x_date(
    date_labels = "%b/%y",
    expand = expansion(mult = c(0.01, 0.01))
  ) +
  scale_y_continuous(
    labels = label_percent(accuracy = 0.1),
    breaks = pretty_breaks(n = 8)
  ) +
  coord_cartesian(
    xlim = c(chart_start, chart_end),
    ylim = c(NA, y_lab + 0.02 * y_rng)
  ) +
  labs(
    x = "Data",
    y = "Taxa (%)",
    color = NULL
  ) +
  az_chart_theme(legend_position = "bottom")

svg_path <- file.path(static_dir, "fed_implicita.svg")
svglite(svg_path, width = az_chart_width(), height = az_chart_height())
print(p)
dev.off()
message("SVG: ", normalizePath(svg_path, winslash = "/", mustWork = FALSE))

df_export <- df_plot |>
  mutate(grid_date = as.character(grid_date)) |>
  select(grid_date, curve, fwd, fwd_raw, fwd_025_up)

output <- list(
  status = "ok",
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
  approximation_note = paste(
    "Aproximacao via Treasury (embute premio de prazo); nao e' a precificacao",
    "exata do mercado de Fed Funds (OIS/FF futures)."
  ),
  source_series = paste(short_series, collapse = ","),
  ref_today = as.character(ref_today),
  ref_30d = if (!is.na(ref_30)) as.character(ref_30) else NA_character_,
  ref_90d = if (!is.na(ref_90)) as.character(ref_90) else NA_character_,
  chart_start = as.character(chart_start),
  chart_end = as.character(chart_end),
  curve_lag_calendar_days = as.integer(as.Date(chart_start) - as.Date(ref_today)),
  data = df_export,
  vlines = as.character(vlines)
)
json_path <- file.path(out_dir, "fed_implicita.json")
write_json(output, json_path, auto_unbox = TRUE, pretty = TRUE)
message("JSON: ", normalizePath(json_path, winslash = "/", mustWork = FALSE))

table_wide <- df_plot |>
  select(grid_date, curve, fwd) |>
  mutate(curve = as.character(curve)) |>
  tidyr::pivot_wider(names_from = curve, values_from = fwd) |>
  arrange(grid_date)
curve_cols <- setdiff(names(table_wide), "grid_date")
table_payload <- list(
  status = "ok",
  generated_at = output$generated_at,
  ref_today = as.character(ref_today),
  chart_start = as.character(chart_start),
  chart_end = as.character(chart_end),
  curve_lag_calendar_days = as.integer(as.Date(chart_start) - as.Date(ref_today)),
  columns = c(
    list(list(key = "grid_date", label = "Data")),
    lapply(curve_cols, function(k) list(key = k, label = k))
  ),
  rows = lapply(seq_len(nrow(table_wide)), function(i) {
    row <- table_wide[i, , drop = FALSE]
    out <- list(grid_date = format(as.Date(row$grid_date[[1]]), "%d/%m/%Y"))
    for (k in curve_cols) {
      v <- row[[k]][[1]]
      out[[k]] <- if (is.na(v)) NULL else sprintf("%.2f%%", as.numeric(v) * 100)
    }
    out
  })
)
write_json(
  table_payload,
  file.path(tables_dir, "fed_implicita.json"),
  auto_unbox = TRUE,
  pretty = TRUE
)
message("Tabela JSON: ", normalizePath(file.path(tables_dir, "fed_implicita.json"), winslash = "/", mustWork = FALSE))
