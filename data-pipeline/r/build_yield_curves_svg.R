# Curvas Prefixado e IPCA+ (Recente, D-30, D-90) como SVG.
#
# Estrategia em camadas:
#   1. rb3::yc_brl_get / yc_ipca_get (canal padrao do rb3)
#   2. Fallback TaxaSwap (download direto do TS{YYMMDD}.ex_ da B3)
#      - T1APR para curva PRE (Prefixado)
#      - T1DIC para curva DI x IPCA cupom sujo (IPCA+, taxa real dos NTN-B)
#
# Curva e' interpolada nos vencimentos-padrao dos titulos Tesouro Direto.

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
} else getwd()
data_pipeline_root <- normalizePath(file.path(script_dir, ".."), winslash = "/", mustWork = TRUE)
out_dir <- Sys.getenv("DATA_PIPELINE_OUT", unset = file.path(data_pipeline_root, "out"))
static_dir <- file.path(out_dir, "charts", "static")
tables_dir <- file.path(out_dir, "charts", "tables")
dir.create(static_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)
source(file.path(script_dir, "chart_theme.R"))

## ---------- Vencimentos alvo ----------

TARGET_VENC_PRE <- as.Date(c(
  "2027-01-01", "2028-01-01", "2029-01-01", "2031-01-01", "2032-01-01"
))
TARGET_VENC_IPCA <- as.Date(c(
  "2026-08-15", "2029-05-15", "2032-08-15", "2035-05-15",
  "2040-08-15", "2045-05-15", "2050-08-15"
))

## ---------- rb3 (camada 1) ----------

has_rb3 <- requireNamespace("rb3", quietly = TRUE)
if (has_rb3) suppressPackageStartupMessages(library(rb3))

get_b3_curve_rb3 <- function(ref_date, curve_name) {
  if (!has_rb3) stop("rb3 nao disponivel")
  rb3_bootstrap()
  fetch_marketdata("b3-reference-rates", refdate = ref_date, curve_name = curve_name)
  raw <- if (curve_name == "PRE") yc_brl_get() else if (curve_name == "DIC") {
    if (exists("yc_ipca_get", mode = "function")) yc_ipca_get() else stop("yc_ipca_get nao existe")
  } else stop(sprintf("curve_name nao suportado: %s", curve_name))
  raw |> collect() |>
    mutate(forward_date = as.Date(forward_date), refdate = as.Date(refdate)) |>
    filter(refdate == as.Date(ref_date)) |>
    arrange(biz_days) |> distinct(biz_days, .keep_all = TRUE)
}

## ---------- TaxaSwap B3 (camada 2 - fallback) ----------
## T1APR = DI x PRE (Prefixado), T1DIC = DI x IPCA cupom sujo (IPCA+ taxa real)

parse_taxa_swap <- function(lines, curve_code_filter) {
  tibble::tibble(line = lines) |>
    filter(nchar(line) >= 72) |>
    transmute(
      refdate_chr = substr(line, 12, 19),
      curve_code = substr(line, 20, 24),
      cur_days = suppressWarnings(as.integer(substr(line, 42, 46))),
      biz_days = suppressWarnings(as.integer(substr(line, 47, 51))),
      sign_chr = substr(line, 52, 52),
      value_raw = suppressWarnings(as.numeric(substr(line, 53, 66)))
    ) |>
    mutate(
      refdate = suppressWarnings(as.Date(refdate_chr, format = "%Y%m%d")),
      sign = if_else(sign_chr == "-", -1, 1),
      r_252 = sign * value_raw / 1e9,
      forward_date = refdate + days(cur_days)
    ) |>
    filter(curve_code == curve_code_filter, !is.na(refdate),
           !is.na(cur_days), !is.na(biz_days), !is.na(r_252)) |>
    select(refdate, forward_date, biz_days, r_252) |>
    arrange(biz_days) |> distinct(biz_days, .keep_all = TRUE)
}

# Cache em memoria do TaxaSwap pra evitar refazer download a cada candidate
TASWAP_CACHE <- new.env(parent = emptyenv())

download_taswap_lines <- function(ref_date) {
  key <- format(as.Date(ref_date), "%Y-%m-%d")
  if (!is.null(TASWAP_CACHE[[key]])) return(TASWAP_CACHE[[key]])
  ymd_token <- format(as.Date(ref_date), "%y%m%d")
  endpoint <- sprintf(
    "https://www.b3.com.br/pesquisapregao/download?filelist=TS%s.ex_", ymd_token
  )
  tmp_zip <- tempfile(pattern = "ts_", fileext = ".zip")
  tmp_dir <- tempfile(pattern = "ts_dir_")
  dir.create(tmp_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(c(tmp_zip, tmp_dir), recursive = TRUE, force = TRUE), add = TRUE)
  ok <- tryCatch({
    suppressWarnings(utils::download.file(endpoint, tmp_zip, mode = "wb", quiet = TRUE))
    file.exists(tmp_zip) && file.info(tmp_zip)$size > 0
  }, error = function(e) FALSE)
  if (!ok) {
    TASWAP_CACHE[[key]] <- character(0)
    return(character(0))
  }
  outer <- suppressWarnings(tryCatch(utils::unzip(tmp_zip, list = TRUE), error = function(e) NULL))
  if (is.null(outer) || !nrow(outer)) {
    TASWAP_CACHE[[key]] <- character(0); return(character(0))
  }
  ts_name <- outer$Name[grepl("^TS[0-9]{6}\\.ex_$", basename(outer$Name), ignore.case = TRUE)][1]
  if (!length(ts_name) || is.na(ts_name)) {
    TASWAP_CACHE[[key]] <- character(0); return(character(0))
  }
  suppressWarnings(utils::unzip(tmp_zip, files = ts_name, exdir = tmp_dir, overwrite = TRUE))
  exe_path <- file.path(tmp_dir, basename(ts_name))
  entries <- suppressWarnings(tryCatch(utils::unzip(exe_path[1], list = TRUE), error = function(e) NULL))
  if (is.null(entries) || !"TaxaSwap.txt" %in% entries$Name) {
    TASWAP_CACHE[[key]] <- character(0); return(character(0))
  }
  utils::unzip(exe_path[1], files = "TaxaSwap.txt", exdir = tmp_dir, overwrite = TRUE)
  txt_path <- file.path(tmp_dir, "TaxaSwap.txt")
  if (!file.exists(txt_path)) {
    TASWAP_CACHE[[key]] <- character(0); return(character(0))
  }
  lines <- readLines(txt_path, warn = FALSE, encoding = "latin1")
  TASWAP_CACHE[[key]] <- lines
  lines
}

get_curve_from_taswap <- function(ref_date, curve_code_filter) {
  lines <- download_taswap_lines(ref_date)
  if (!length(lines)) stop(sprintf("TaxaSwap vazio (%s)", format(ref_date)))
  parsed <- parse_taxa_swap(lines, curve_code_filter)
  parsed |> filter(refdate == as.Date(ref_date))
}

resolve_curve <- function(target_date, rb3_curve, taswap_code, max_lookback_days = 10) {
  target_date <- as.Date(target_date)
  for (i in 0:max_lookback_days) {
    candidate <- target_date - days(i)
    # tentativa 1: rb3
    if (has_rb3) {
      yc <- tryCatch(get_b3_curve_rb3(candidate, rb3_curve), error = function(e) NULL)
      if (!is.null(yc) && nrow(yc) > 0) {
        message(sprintf("%s via rb3 em %s", rb3_curve, format(candidate)))
        return(list(used_refdate = candidate, data = yc))
      }
    }
    # tentativa 2: TaxaSwap
    yc <- tryCatch(get_curve_from_taswap(candidate, taswap_code), error = function(e) {
      message(sprintf("[taswap] %s sem %s (%s)", format(candidate), taswap_code, conditionMessage(e)))
      NULL
    })
    if (!is.null(yc) && nrow(yc) > 0) {
      message(sprintf("%s via TaxaSwap em %s", taswap_code, format(candidate)))
      return(list(used_refdate = candidate, data = yc))
    }
  }
  NULL
}

## ---------- Interpolacao ----------

interp_yield <- function(yc_data, target_dates) {
  yc <- yc_data |> arrange(biz_days) |> distinct(biz_days, .keep_all = TRUE) |>
    mutate(df = 1 / ((1 + r_252) ^ (biz_days / 252)))
  ref_date <- as.Date(min(yc_data$refdate))
  use_bizdays <- requireNamespace("bizdays", quietly = TRUE)
  rows <- lapply(target_dates, function(td) {
    td <- as.Date(td)
    bdays <- if (use_bizdays) tryCatch(bizdays::bizdays(ref_date, td, "Brazil/ANBIMA"),
      error = function(e) as.numeric(td - ref_date) * 252 / 365)
      else as.numeric(td - ref_date) * 252 / 365
    if (is.na(bdays) || bdays <= 0) return(NULL)
    r <- if (bdays <= min(yc$biz_days)) yc$r_252[1]
         else if (bdays >= max(yc$biz_days)) yc$r_252[nrow(yc)]
         else {
           idx <- max(which(yc$biz_days <= bdays))
           x1 <- yc$biz_days[idx]; x2 <- yc$biz_days[idx+1]
           df1 <- yc$df[idx]; df2 <- yc$df[idx+1]
           w <- (bdays - x1) / (x2 - x1)
           exp(log(df1) + w * (log(df2) - log(df1))) ^ (-252 / bdays) - 1
         }
    tibble::tibble(vencimento = td, taxa_venda = r * 100)
  })
  bind_rows(Filter(Negate(is.null), rows))
}

build_snapshot <- function(anchor_date, label_prefix, rb3_curve, taswap_code, target_vencs) {
  resolved <- resolve_curve(anchor_date, rb3_curve, taswap_code)
  if (is.null(resolved)) return(NULL)
  interp <- interp_yield(resolved$data, target_vencs)
  if (!nrow(interp)) return(NULL)
  lab <- sprintf("%s (%s)", label_prefix, format(resolved$used_refdate, "%d/%m/%Y"))
  list(refdate = as.Date(resolved$used_refdate),
       rows = interp |> mutate(curve_key = label_prefix, snapshot_label = lab))
}

requested_refdate <- as.Date(with_tz(Sys.time(), tzone = "America/Sao_Paulo"))
message("Refdate solicitado: ", format(requested_refdate))

# Labels: "Recente" em vez de "Hoje" (dado e' sempre D-1 ou mais antigo).
LABEL_RECENT <- "Recente"
LABEL_D30 <- "D-30"
LABEL_D90 <- "D-90"

build_set <- function(rb3_curve, taswap_code, target_vencs, slug) {
  recent <- build_snapshot(requested_refdate,        LABEL_RECENT, rb3_curve, taswap_code, target_vencs)
  d30    <- build_snapshot(requested_refdate - days(30), LABEL_D30, rb3_curve, taswap_code, target_vencs)
  d90    <- build_snapshot(requested_refdate - days(90), LABEL_D90, rb3_curve, taswap_code, target_vencs)
  snaps <- Filter(Negate(is.null), list(recent, d30, d90))
  if (!length(snaps)) {
    message(sprintf("AVISO: sem dados para %s", slug)); return(NULL)
  }
  long_df <- bind_rows(lapply(snaps, `[[`, "rows")) |>
    mutate(snapshot_label = factor(snapshot_label, levels = unique(snapshot_label)))
  list(long_df = long_df, ref_today = if (!is.null(recent)) recent$refdate else NA)
}

## ---------- Cores e plot ----------

cores_pre  <- c(`D-90` = "#56B4E9", `D-30` = "#00008B", Recente = "#000000")
cores_ipca <- c(`D-90` = "#F8766D", `D-30` = "#8B0000", Recente = "#000000")

plot_curves <- function(long_df, pal) {
  label_map <- long_df |> distinct(curve_key, snapshot_label) |>
    arrange(match(curve_key, names(pal)))
  ggplot(long_df, aes(x = vencimento, y = taxa_venda, color = curve_key, group = snapshot_label)) +
    geom_line(linewidth = 0.9) + geom_point(size = 1.8) +
    scale_color_manual(values = pal, breaks = label_map$curve_key,
                       labels = as.character(label_map$snapshot_label)) +
    scale_x_date(date_labels = "%Y") +
    scale_y_continuous(labels = comma_format(decimal.mark = ",", big.mark = ".")) +
    labs(x = "Vencimento", y = "Taxa (%)", color = NULL) +
    az_chart_theme(legend_position = "bottom")
}

write_curve_table_json <- function(long_df, slug, generated_at, ref_today) {
  if (!nrow(long_df)) return(invisible(NULL))
  wide <- long_df |> mutate(vencimento = format(vencimento, "%d/%m/%Y")) |>
    select(vencimento, snapshot_label, taxa_venda) |>
    mutate(snapshot_label = as.character(snapshot_label)) |>
    tidyr::pivot_wider(names_from = snapshot_label, values_from = taxa_venda) |>
    arrange(as.Date(vencimento, format = "%d/%m/%Y"))
  curve_cols <- setdiff(names(wide), "vencimento")
  columns <- c(list(list(key = "vencimento", label = "Vencimento")),
               lapply(curve_cols, function(k) list(key = k, label = k)))
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
  payload <- list(
    status = "ok", generated_at = generated_at,
    ref_today = if (!is.na(ref_today)) format(ref_today, "%Y-%m-%d") else NULL,
    columns = columns, rows = rows
  )
  write_json(payload, file.path(tables_dir, paste0(slug, ".json")), auto_unbox = TRUE, pretty = TRUE)
}

run_one <- function(rb3_curve, taswap_code, target_vencs, slug, palette, title_log) {
  result <- build_set(rb3_curve, taswap_code, target_vencs, slug)
  if (is.null(result)) return(invisible(NULL))
  message(sprintf("%s -> refdate=%s", title_log, format(result$ref_today)))
  p <- plot_curves(result$long_df, palette)
  svglite(file.path(static_dir, paste0(slug, ".svg")),
          width = az_chart_width(), height = az_chart_height())
  print(p); dev.off()
  write_curve_table_json(result$long_df, slug,
    format(Sys.time(), "%Y-%m-%dT%H:%M:%S"), result$ref_today)
  message(sprintf("SVG: %s.svg", slug))
}

run_one("PRE", "T1APR", TARGET_VENC_PRE,  "juros_prefixado", cores_pre,  "Prefixado")
run_one("DIC", "T1DIC", TARGET_VENC_IPCA, "juros_ipca",      cores_ipca, "IPCA+")

message("build_yield_curves_svg.R OK")
