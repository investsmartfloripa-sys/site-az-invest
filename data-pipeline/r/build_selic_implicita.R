# Selic implicita (forward meeting-to-meeting) via rb3 + ggplot2 -> SVG + JSON opcional.
# Falha se rb3 ou curva PRE indisponivel (CI usa `|| true`).

suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(lubridate)
  library(tidyr)
  library(scales)
  library(jsonlite)
  library(svglite)
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
    labs(
      x = NULL,
      y = NULL,
      title = "Selic implicita (forward)"
    ) +
    theme_void(base_size = 12) +
    theme(
      plot.title = element_text(face = "bold", color = "#027DFC", hjust = 0),
      plot.background = element_rect(fill = "white", colour = NA)
    )
  svg_path <- file.path(static_dir, "selic_implicita.svg")
  svglite(svg_path, width = 10, height = 5.5)
  print(p)
  dev.off()
  write_json(
    list(status = "skipped", reason = reason, generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S")),
    file.path(out_dir, "selic_implicita.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
  message("SVG placeholder: ", normalizePath(svg_path, winslash = "/", mustWork = FALSE))
}

if (!requireNamespace("rb3", quietly = TRUE)) {
  write_placeholder("Curva PRE indisponivel no ambiente CI")
  quit(save = "no", status = 0)
}
library(rb3)

round_step_up <- function(x, step = 0.0025, eps = 1e-12) {
  ceiling((x - eps) / step) * step
}

parse_t1apr_from_taswap <- function(lines) {
  raw <- tibble::tibble(line = lines) |>
    filter(nchar(line) >= 72) |>
    transmute(
      refdate_chr = substr(line, 12, 19),
      curve_code = substr(line, 20, 24),
      curve_desc = trimws(substr(line, 27, 40)),
      cur_days = suppressWarnings(as.integer(substr(line, 42, 46))),
      biz_days = suppressWarnings(as.integer(substr(line, 47, 51))),
      sign_chr = substr(line, 52, 52),
      value_raw = suppressWarnings(as.numeric(substr(line, 53, 66)))
    ) |>
    mutate(
      refdate = suppressWarnings(as.Date(refdate_chr, format = "%Y%m%d")),
      sign = if_else(sign_chr == "-", -1, 1),
      # B3 TaxaSwap keeps rates with 9 implied decimal places.
      r_252 = sign * value_raw / 1e9,
      forward_date = refdate + days(cur_days)
    ) |>
    filter(
      curve_code == "T1APR",
      !is.na(refdate),
      !is.na(cur_days),
      !is.na(biz_days),
      !is.na(r_252)
    ) |>
    select(refdate, forward_date, biz_days, r_252) |>
    arrange(biz_days) |>
    distinct(biz_days, .keep_all = TRUE)

  if (!nrow(raw)) {
    stop("TaxaSwap sem linhas T1APR validas")
  }

  raw
}

get_pre_curve_from_taswap <- function(ref_date) {
  ymd_token <- format(as.Date(ref_date), "%y%m%d")
  endpoint <- sprintf(
    "https://www.b3.com.br/pesquisapregao/download?filelist=TS%s.ex_",
    ymd_token
  )

  tmp_zip <- tempfile(pattern = "pesquisa_pregao_", fileext = ".zip")
  tmp_dir <- tempfile(pattern = "pesquisa_pregao_dir_")
  dir.create(tmp_dir, recursive = TRUE, showWarnings = FALSE)

  on.exit(unlink(c(tmp_zip, tmp_dir), recursive = TRUE, force = TRUE), add = TRUE)

  ok_download <- tryCatch({
    suppressWarnings(utils::download.file(endpoint, tmp_zip, mode = "wb", quiet = TRUE))
    file.exists(tmp_zip) && file.info(tmp_zip)$size > 0
  }, error = function(e) FALSE)
  if (!ok_download) {
    stop(sprintf("Falha download TaxaSwap (%s)", endpoint))
  }

  outer_entries <- suppressWarnings(tryCatch({
    utils::unzip(tmp_zip, list = TRUE)
  }, error = function(e) NULL))
  if (is.null(outer_entries) || !nrow(outer_entries)) {
    stop("ZIP da pesquisa por pregao veio vazio/invalido")
  }
  ts_name <- outer_entries$Name[grepl("^TS[0-9]{6}\\.ex_$", basename(outer_entries$Name), ignore.case = TRUE)][1]
  if (!length(ts_name) || is.na(ts_name)) {
    stop("Arquivo TS*.ex_ nao encontrado no ZIP da pesquisa por pregao")
  }
  suppressWarnings(utils::unzip(tmp_zip, files = ts_name, exdir = tmp_dir, overwrite = TRUE))
  exe_path <- file.path(tmp_dir, basename(ts_name))

  entries <- suppressWarnings(tryCatch({
    utils::unzip(exe_path[1], list = TRUE)
  }, error = function(e) NULL))
  if (is.null(entries) || !"TaxaSwap.txt" %in% entries$Name) {
    stop("TaxaSwap.txt nao encontrado dentro do TS*.ex_")
  }

  utils::unzip(exe_path[1], files = "TaxaSwap.txt", exdir = tmp_dir, overwrite = TRUE)
  txt_path <- file.path(tmp_dir, "TaxaSwap.txt")
  if (!file.exists(txt_path)) {
    stop("Falha ao extrair TaxaSwap.txt")
  }

  lines <- readLines(txt_path, warn = FALSE, encoding = "latin1")
  parsed <- parse_t1apr_from_taswap(lines)
  parsed |> filter(refdate == as.Date(ref_date))
}

get_pre_curve <- function(ref_date) {
  rb3_bootstrap()
  fetch_marketdata(
    "b3-reference-rates",
    refdate = ref_date,
    curve_name = "PRE"
  )
  yc_brl_get() |>
    collect() |>
    mutate(
      forward_date = as.Date(forward_date),
      refdate = as.Date(refdate)
    ) |>
    filter(refdate == as.Date(ref_date))
}

resolve_pre_curve <- function(target_date, max_lookback_days = 10) {
  target_date <- as.Date(target_date)
  for (i in 0:max_lookback_days) {
    candidate_date <- target_date - days(i)
    yc_try <- tryCatch(
      get_pre_curve(candidate_date),
      error = function(e) {
        message(sprintf("Sem curva PRE para %s (%s)", format(candidate_date), conditionMessage(e)))
        NULL
      }
    )
    if (!is.null(yc_try) && nrow(yc_try) > 0) {
      if (i > 0) {
        message(sprintf(
          "Usando ultima curva disponivel em %s (fallback de %s).",
          format(candidate_date), format(target_date)
        ))
      }
      return(list(used_refdate = candidate_date, data = yc_try))
    }

    # Fallback resiliente: usa arquivo oficial da "Pesquisa por pregao" (TaxaSwap).
    yc_taswap_try <- tryCatch(
      get_pre_curve_from_taswap(candidate_date),
      error = function(e) {
        message(sprintf("Sem TaxaSwap PRE para %s (%s)", format(candidate_date), conditionMessage(e)))
        NULL
      }
    )
    if (!is.null(yc_taswap_try) && nrow(yc_taswap_try) > 0) {
      message(sprintf(
        "Curva PRE via TaxaSwap em %s%s",
        format(candidate_date),
        if (i > 0) sprintf(" (fallback de %s)", format(target_date)) else ""
      ))
      return(list(used_refdate = candidate_date, data = yc_taswap_try))
    }
  }
  stop(sprintf(
    "Nao foi possivel obter curva PRE para %s nem nos %d dias anteriores.",
    format(target_date), max_lookback_days
  ))
}

make_curve_window <- function(yc_data, years_ahead = 2) {
  ref <- as.Date(max(yc_data$refdate))
  end <- ref %m+% years(years_ahead)
  yc_data |>
    filter(refdate == ref, forward_date <= end) |>
    arrange(biz_days) |>
    distinct(biz_days, .keep_all = TRUE) |>
    mutate(df = 1 / ((1 + r_252)^(biz_days / 252)))
}

grid_on_dates <- function(yc, dates) {
  dates <- sort(unique(as.Date(dates)))
  yc |>
    select(forward_date, biz_days, df) |>
    crossing(target = dates) |>
    mutate(dist = abs(as.integer(forward_date - target))) |>
    group_by(target) |>
    slice_min(dist, n = 1, with_ties = FALSE) |>
    ungroup() |>
    arrange(biz_days) |>
    distinct(biz_days, .keep_all = TRUE) |>
    transmute(
      grid_date = target,
      forward_date,
      biz_days,
      df
    )
}

calc_forward <- function(grid_df) {
  grid_df |>
    mutate(
      du_next = lead(biz_days),
      df_next = lead(df),
      fwd = (df / df_next)^(252 / (du_next - biz_days)) - 1
    ) |>
    filter(!is.na(fwd), du_next > biz_days) |>
    select(grid_date, forward_date, biz_days, fwd)
}

requested_refdate <- as.Date(with_tz(Sys.time(), tzone = "America/Sao_Paulo"))

copom_decision_dates <- as.Date(c(
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-08-05", "2026-09-16", "2026-11-04", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-16"
))

build_curve_series <- function(anchor_date, label_prefix, lookback_days = 10) {
  resolved <- resolve_pre_curve(anchor_date, max_lookback_days = lookback_days)
  ref <- as.Date(resolved$used_refdate)
  yc_win <- make_curve_window(resolved$data, years_ahead = 2)
  end12 <- ref %m+% years(1)

  copom_in_window <- copom_decision_dates[
    copom_decision_dates >= ref &
      copom_decision_dates <= end12
  ]

  grid_dates <- sort(unique(c(ref, copom_in_window, end12)))
  grid_c <- grid_on_dates(yc_win, grid_dates)
  fwd <- calc_forward(grid_c)
  if (!nrow(fwd)) {
    stop(sprintf("Sem dados de forward para %s", format(ref)))
  }

  curve_label <- sprintf("%s (%s)", label_prefix, format(ref, "%d/%m/%Y"))
  data <- fwd |>
    mutate(
      curve = curve_label,
      fwd_raw = fwd,
      fwd_025_up = round_step_up(fwd, step = 0.0025),
      fwd = fwd_025_up
    ) |>
    select(grid_date, curve, fwd, fwd_raw, fwd_025_up)

  list(
    refdate = ref,
    end_plot = end12,
    copom_in_window = copom_in_window,
    data = data
  )
}

today_series <- tryCatch(
  build_curve_series(requested_refdate, "Hoje"),
  error = function(e) {
    write_placeholder("Curva PRE indisponivel para gerar Selic implicita")
    NULL
  }
)
if (is.null(today_series)) quit(save = "no", status = 0)

series_30 <- tryCatch(
  build_curve_series(requested_refdate - days(30), "30d atras"),
  error = function(e) NULL
)
series_90 <- tryCatch(
  build_curve_series(requested_refdate - days(90), "90d atras"),
  error = function(e) NULL
)

series_list <- Filter(Negate(is.null), list(today_series, series_30, series_90))
df_plot <- bind_rows(lapply(series_list, `[[`, "data")) |>
  mutate(grid_date = as.Date(grid_date))

if (!nrow(df_plot)) {
  write_placeholder("Sem dados para Selic implicita")
  quit(save = "no", status = 0)
}

curve_order <- c(
  sprintf("Hoje (%s)", format(today_series$refdate, "%d/%m/%Y")),
  if (!is.null(series_30)) sprintf("30d atras (%s)", format(series_30$refdate, "%d/%m/%Y")) else NULL,
  if (!is.null(series_90)) sprintf("90d atras (%s)", format(series_90$refdate, "%d/%m/%Y")) else NULL
)
df_plot <- df_plot |>
  mutate(curve = factor(curve, levels = curve_order))

vlines <- sort(unique(today_series$copom_in_window))
vdf <- data.frame(x = as.Date(vlines))

y_top <- max(df_plot$fwd, na.rm = TRUE)
y_rng <- diff(range(df_plot$fwd, na.rm = TRUE))
if (!is.finite(y_rng) || y_rng <= 0) y_rng <- 0.0025
y_lab <- y_top + 0.06 * y_rng

pal <- c(
  "Hoje" = "#000000",
  "30d" = "#6f6f6f",
  "90d" = "#0078fd"
)
pick_color <- function(curve_name) {
  nm <- tolower(curve_name)
  if (grepl("^hoje", nm)) return(pal[["Hoje"]])
  if (grepl("^30d", nm)) return(pal[["30d"]])
  if (grepl("^90d", nm)) return(pal[["90d"]])
  "#000000"
}

color_values <- setNames(vapply(as.character(curve_order), pick_color, character(1)), as.character(curve_order))
line_values <- setNames(ifelse(grepl("^Hoje", curve_order), 1.15, 0.95), as.character(curve_order))

p <- ggplot(df_plot, aes(x = grid_date, y = fwd, color = curve, linewidth = curve, group = curve)) +
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
  scale_y_continuous(
    labels = label_percent(accuracy = 0.1),
    breaks = pretty_breaks(n = 8)
  ) +
  coord_cartesian(ylim = c(NA, y_lab + 0.02 * y_rng)) +
  labs(
    x = "Data",
    y = "Taxa (%)",
    title = "Selic implicita (Forward)",
    subtitle = "Meeting-to-Meeting (25bps step)",
    color = NULL,
    caption = sprintf("Atualizado: %s", az_chart_stamp())
  ) +
  az_chart_theme(legend_position = "top")

svg_path <- file.path(static_dir, "selic_implicita.svg")
svglite(svg_path, width = 10, height = 5.5)
print(p)
dev.off()
message("SVG: ", normalizePath(svg_path, winslash = "/", mustWork = FALSE))

df_export <- df_plot |>
  mutate(grid_date = as.character(grid_date)) |>
  select(grid_date, curve, fwd, fwd_raw, fwd_025_up)

output <- list(
  status = "ok",
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
  ref_today = as.character(today_series$refdate),
  ref_30d = if (!is.null(series_30)) as.character(series_30$refdate) else NA_character_,
  ref_90d = if (!is.null(series_90)) as.character(series_90$refdate) else NA_character_,
  end_plot = as.character(today_series$end_plot),
  data = df_export,
  vlines = as.character(vlines)
)

json_path <- file.path(out_dir, "selic_implicita.json")
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
  file.path(tables_dir, "selic_implicita.json"),
  auto_unbox = TRUE,
  pretty = TRUE
)
