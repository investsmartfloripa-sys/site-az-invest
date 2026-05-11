# Curvas Prefixado e IPCA+ (Hoje, D-30, D-90) via B3 (rb3) -> SVG + JSON.
#
# Fonte unica: B3 ReferenceRates via rb3 (atualiza diariamente).
#   - Curva PRE  -> serie Prefixado (LTN/NTN-F)
#   - Curva DIC  -> serie IPCA+ (NTN-B)
#
# A curva da B3 e' continua (em biz_days) e e' interpolada nos vencimentos-padrao
# dos titulos do Tesouro Direto. O resultado e' visualmente compativel com o
# grafico anterior (mesmos vencimentos no eixo X) com dados frescos.
# Tesouro Transparente CSV foi removido por estar desatualizado e ser pesado.

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(jsonlite)
  library(ggplot2)
  library(svglite)
  library(lubridate)
  library(scales)
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

## ---------- Vencimentos alvo ----------

# Prefixado (LTN/NTN-F) — vencimentos 01/01 dos anos disponiveis
TARGET_VENC_PRE <- as.Date(c(
  "2027-01-01", "2028-01-01", "2029-01-01", "2031-01-01", "2032-01-01"
))
# IPCA+ (NTN-B) — vencimentos 15/05 ou 15/08
TARGET_VENC_IPCA <- as.Date(c(
  "2026-08-15", "2029-05-15", "2032-08-15", "2035-05-15",
  "2040-08-15", "2045-05-15", "2050-08-15"
))

## ---------- rb3 ----------

if (!requireNamespace("rb3", quietly = TRUE)) {
  stop("rb3 nao disponivel — instale com install.packages('rb3')")
}
suppressPackageStartupMessages(library(rb3))

# Pega curva PRE ou DIC para um refdate.
# Retorna tibble com refdate, forward_date, biz_days, r_252.
get_b3_curve <- function(ref_date, curve_name) {
  rb3_bootstrap()
  fetch_marketdata("b3-reference-rates", refdate = ref_date, curve_name = curve_name)
  raw <- if (curve_name == "PRE") {
    yc_brl_get()
  } else if (curve_name == "DIC") {
    if (exists("yc_ipca_get", mode = "function")) {
      yc_ipca_get()
    } else {
      stop("rb3 nao tem accessor para curva DIC nessa versao — atualize com install.packages('rb3')")
    }
  } else {
    stop(sprintf("curve_name nao suportado: %s", curve_name))
  }
  raw |>
    collect() |>
    mutate(forward_date = as.Date(forward_date), refdate = as.Date(refdate)) |>
    filter(refdate == as.Date(ref_date)) |>
    arrange(biz_days) |>
    distinct(biz_days, .keep_all = TRUE)
}

# Tenta candidato e os max_lookback_days dias anteriores ate achar curva.
resolve_b3_curve <- function(target_date, curve_name, max_lookback_days = 10) {
  target_date <- as.Date(target_date)
  for (i in 0:max_lookback_days) {
    candidate <- target_date - days(i)
    yc_try <- tryCatch(
      get_b3_curve(candidate, curve_name),
      error = function(e) {
        message(sprintf("[b3] %s sem curva %s (%s)", format(candidate), curve_name, conditionMessage(e)))
        NULL
      }
    )
    if (!is.null(yc_try) && nrow(yc_try) > 0) {
      return(list(used_refdate = candidate, data = yc_try))
    }
  }
  NULL
}

# Interpola taxa anual (% a.a.) nos target_dates via log-linear no DF.
interp_yield <- function(yc_data, target_dates) {
  yc <- yc_data |>
    arrange(biz_days) |>
    distinct(biz_days, .keep_all = TRUE) |>
    mutate(df = 1 / ((1 + r_252) ^ (biz_days / 252)))
  ref_date <- as.Date(min(yc_data$refdate))
  use_bizdays <- requireNamespace("bizdays", quietly = TRUE)
  rows <- lapply(target_dates, function(td) {
    td <- as.Date(td)
    bdays <- if (use_bizdays) {
      tryCatch(bizdays::bizdays(ref_date, td, "Brazil/ANBIMA"),
               error = function(e) as.numeric(td - ref_date) * 252 / 365)
    } else {
      as.numeric(td - ref_date) * 252 / 365
    }
    if (is.na(bdays) || bdays <= 0) return(NULL)
    if (bdays <= min(yc$biz_days)) {
      r <- yc$r_252[1]
    } else if (bdays >= max(yc$biz_days)) {
      r <- yc$r_252[nrow(yc)]
    } else {
      idx_below <- max(which(yc$biz_days <= bdays))
      x1 <- yc$biz_days[idx_below]; x2 <- yc$biz_days[idx_below + 1]
      df1 <- yc$df[idx_below];      df2 <- yc$df[idx_below + 1]
      w <- (bdays - x1) / (x2 - x1)
      log_df <- log(df1) + w * (log(df2) - log(df1))
      r <- exp(log_df) ^ (-252 / bdays) - 1
    }
    tibble::tibble(vencimento = td, taxa_venda = r * 100)
  })
  bind_rows(Filter(Negate(is.null), rows))
}

## ---------- Orchestrator ----------

build_snapshot <- function(anchor_date, label_prefix, curve_name, target_vencs) {
  b3 <- resolve_b3_curve(anchor_date, curve_name)
  if (is.null(b3) || nrow(b3$data) == 0) return(NULL)
  interp <- interp_yield(b3$data, target_vencs)
  if (nrow(interp) == 0) return(NULL)
  lab <- sprintf("%s (%s)", label_prefix, format(b3$used_refdate, "%d/%m/%Y"))
  list(
    refdate = as.Date(b3$used_refdate),
    rows = interp |>
      mutate(curve_key = label_prefix, snapshot_label = lab,
             data_base = as.Date(b3$used_refdate))
  )
}

requested_refdate <- as.Date(with_tz(Sys.time(), tzone = "America/Sao_Paulo"))
message("Refdate solicitado: ", format(requested_refdate))

build_set <- function(curve_name, target_vencs, slug) {
  today <- build_snapshot(requested_refdate, "Hoje", curve_name, target_vencs)
  d30   <- build_snapshot(requested_refdate - days(30), "D-30", curve_name, target_vencs)
  d90   <- build_snapshot(requested_refdate - days(90), "D-90", curve_name, target_vencs)
  snaps <- Filter(Negate(is.null), list(today, d30, d90))
  if (!length(snaps)) {
    message(sprintf("AVISO: sem dados para %s (B3 indisponivel)", slug))
    return(NULL)
  }
  long_df <- bind_rows(lapply(snaps, `[[`, "rows")) |>
    mutate(snapshot_label = factor(snapshot_label, levels = unique(snapshot_label)))
  list(long_df = long_df,
       ref_today = if (!is.null(today)) today$refdate else NA)
}

## ---------- Cores e plot ----------
## Hoje preto (mais escuro); D-30 medio; D-90 claro (mais distante = mais claro).
## Consistente com o padrao da Selic implicita.

cores_pre  <- c(`D-90` = "#56B4E9", `D-30` = "#00008B", Hoje = "#000000")
cores_ipca <- c(`D-90` = "#F8766D", `D-30` = "#8B0000", Hoje = "#000000")

plot_curves <- function(long_df, pal) {
  label_map <- long_df |>
    distinct(curve_key, snapshot_label) |>
    arrange(match(curve_key, names(pal)))
  ggplot(long_df, aes(x = vencimento, y = taxa_venda, color = curve_key, group = snapshot_label)) +
    geom_line(linewidth = 0.9) +
    geom_point(size = 1.8) +
    scale_color_manual(
      values = pal, breaks = label_map$curve_key,
      labels = as.character(label_map$snapshot_label)
    ) +
    scale_x_date(date_labels = "%Y") +
    scale_y_continuous(labels = comma_format(decimal.mark = ",", big.mark = ".")) +
    labs(x = "Vencimento", y = "Taxa (%)", color = NULL) +
    az_chart_theme(legend_position = "bottom")
}

write_curve_table_json <- function(long_df, slug, generated_at, ref_today) {
  if (!nrow(long_df)) return(invisible(NULL))
  wide <- long_df |>
    mutate(vencimento = format(vencimento, "%d/%m/%Y")) |>
    select(vencimento, snapshot_label, taxa_venda) |>
    mutate(snapshot_label = as.character(snapshot_label)) |>
    tidyr::pivot_wider(names_from = snapshot_label, values_from = taxa_venda) |>
    arrange(as.Date(vencimento, format = "%d/%m/%Y"))
  curve_cols <- setdiff(names(wide), "vencimento")
  columns <- c(
    list(list(key = "vencimento", label = "Vencimento")),
    lapply(curve_cols, function(k) list(key = k, label = k))
  )
  rows <- lapply(seq_len(nrow(wide)), function(i) {
    row <- wide[i, , drop = FALSE]
    out <- list(vencimento = row$vencimento[[1]])
    for (k in curve_cols) {
      v <- row[[k]][[1]]
      out[[k]] <- if (is.na(v)) NULL else sprintf("%.2f%%", as.numeric(v))
    }
    out
  })
  ref_today <- as.Date(ref_today)
  chart_start <- ref_today
  chart_end <- if (!is.na(ref_today)) seq.Date(ref_today, by = "12 months", length.out = 2)[2] else NA
  curve_lag <- if (!is.na(ref_today)) as.integer(Sys.Date() - ref_today) else NA_integer_
  payload <- list(
    status = "ok", generated_at = generated_at,
    ref_today = if (!is.na(ref_today)) format(ref_today, "%Y-%m-%d") else NULL,
    chart_start = if (!is.na(chart_start)) format(chart_start, "%Y-%m-%d") else NULL,
    chart_end = if (!is.na(chart_end)) format(chart_end, "%Y-%m-%d") else NULL,
    curve_lag_calendar_days = if (!is.na(curve_lag)) curve_lag else NULL,
    columns = columns, rows = rows
  )
  write_json(payload, file.path(tables_dir, paste0(slug, ".json")), auto_unbox = TRUE, pretty = TRUE)
}

run_one <- function(curve_name, target_vencs, slug, palette, title_log) {
  result <- build_set(curve_name, target_vencs, slug)
  if (is.null(result)) return(invisible(NULL))
  message(sprintf("%s -> refdate=%s", title_log, format(result$ref_today)))
  p <- plot_curves(result$long_df, palette)
  svglite(file.path(static_dir, paste0(slug, ".svg")),
          width = az_chart_width(), height = az_chart_height())
  print(p)
  dev.off()
  write_curve_table_json(result$long_df, slug,
                          format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
                          result$ref_today)
  message(sprintf("SVG: %s.svg", slug))
}

run_one("PRE", TARGET_VENC_PRE,  "juros_prefixado", cores_pre,  "Prefixado")
run_one("DIC", TARGET_VENC_IPCA, "juros_ipca",      cores_ipca, "IPCA+")

message("build_yield_curves_svg.R OK")
