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

if (!requireNamespace("rb3", quietly = TRUE)) {
  stop("Pacote rb3 nao instalado. Rode: Rscript r/install_packages.R")
}
library(rb3)

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
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

round_step_up <- function(x, step = 0.0025, eps = 1e-12) {
  ceiling((x - eps) / step) * step
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

copom_decision_dates_2026 <- as.Date(c(
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-08-05", "2026-09-16", "2026-11-04", "2026-12-09"
))

resolved_curve <- resolve_pre_curve(requested_refdate, max_lookback_days = 10)
refdate <- resolved_curve$used_refdate
yc_data <- resolved_curve$data

yc_win <- make_curve_window(yc_data, years_ahead = 2)
end12 <- refdate %m+% years(1)

copom_in_window <- copom_decision_dates_2026[
  copom_decision_dates_2026 >= refdate &
    copom_decision_dates_2026 <= end12
]

grid_dates <- sort(unique(c(copom_in_window, end12)))
grid_c <- grid_on_dates(yc_win, grid_dates)

fwd_c <- calc_forward(grid_c) |>
  mutate(fwd_025_up = round_step_up(fwd, step = 0.0025))

if (!nrow(fwd_c)) {
  stop(sprintf("Sem dados de forward para a data de referencia %s.", format(refdate)))
}

df_plot <- transform(fwd_c, fwd = fwd_025_up)
df_plot$grid_date <- as.Date(df_plot$grid_date)

vdf <- data.frame(x = as.Date(copom_in_window))

y_top <- max(df_plot$fwd, na.rm = TRUE)
y_rng <- diff(range(df_plot$fwd, na.rm = TRUE))
if (!is.finite(y_rng) || y_rng <= 0) y_rng <- 0.0025
y_lab <- y_top + 0.06 * y_rng

p <- ggplot(df_plot, aes(x = grid_date, y = fwd)) +
  geom_step(linewidth = 0.9, color = "black") +
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
  scale_y_continuous(
    labels = label_percent(accuracy = 0.1),
    breaks = pretty_breaks(n = 8)
  ) +
  coord_cartesian(ylim = c(NA, y_lab + 0.02 * y_rng)) +
  labs(
    x = NULL,
    y = "Forward",
    title = "Forward entre reunioes do Copom (meeting-to-meeting) — 25 bps"
  ) +
  theme_classic(base_size = 12) +
  theme(
    panel.background = element_rect(fill = "#f5f5f4", colour = NA),
    plot.background = element_rect(fill = "white", colour = NA),
    panel.grid.major.y = element_line(color = "grey85", linewidth = 0.4),
    panel.grid.minor.y = element_line(color = "grey92", linewidth = 0.25),
    panel.grid.major.x = element_line(color = "grey85", linewidth = 0.4),
    panel.grid.minor.x = element_line(color = "grey92", linewidth = 0.25)
  )

svg_path <- file.path(static_dir, "selic_implicita.svg")
svglite(svg_path, width = 10, height = 5.5)
print(p)
dev.off()
message("SVG: ", normalizePath(svg_path, winslash = "/", mustWork = FALSE))

df_export <- df_plot |>
  mutate(grid_date = as.character(grid_date)) |>
  select(grid_date, fwd)

output <- list(
  status = "ok",
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
  refdate_requested = as.character(requested_refdate),
  refdate_used = as.character(refdate),
  data = df_export,
  vlines = as.character(copom_in_window)
)

json_path <- file.path(out_dir, "selic_implicita.json")
write_json(output, json_path, auto_unbox = TRUE, pretty = TRUE)
message("JSON: ", normalizePath(json_path, winslash = "/", mustWork = FALSE))
