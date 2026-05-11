# Curvas Prefixado e IPCA+ (Hoje, D-30, D-90) como SVG.
#
# Estrategia em camadas:
#   1. rb3::yc_brl_get / yc_ipca_get (canal padrao do rb3)
#   2. Fallback TaxaSwap (download direto do TS{YYMMDD}.ex_ da B3) - PRE
#   3. Fallback Tesouro Transparente CSV - IPCA (B3 nao publica TaxaSwap IPCA direto)
#
# Mesmo padrao da build_selic_implicita.R, garante dados frescos quando rb3
# nao consegue parsear o arquivo da B3 (acontece com Invalid file warnings).

suppressPackageStartupMessages({
  library(httr2)
  library(readr)
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

## ---------- TaxaSwap B3 PRE (camada 2 - fallback) ----------

parse_t1apr_from_taswap <- function(lines) {
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
    filter(curve_code == "T1APR", !is.na(refdate), !is.na(cur_days),
           !is.na(biz_days), !is.na(r_252)) |>
    select(refdate, forward_date, biz_days, r_252) |>
    arrange(biz_days) |> distinct(biz_days, .keep_all = TRUE)
}

get_pre_from_taswap <- function(ref_date) {
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
  if (!ok) stop(sprintf("falha download TaxaSwap (%s)", endpoint))
  outer <- suppressWarnings(tryCatch(utils::unzip(tmp_zip, list = TRUE), error = function(e) NULL))
  if (is.null(outer) || !nrow(outer)) stop("ZIP TaxaSwap vazio")
  ts_name <- outer$Name[grepl("^TS[0-9]{6}\\.ex_$", basename(outer$Name), ignore.case = TRUE)][1]
  if (!length(ts_name) || is.na(ts_name)) stop("TS*.ex_ nao encontrado")
  suppressWarnings(utils::unzip(tmp_zip, files = ts_name, exdir = tmp_dir, overwrite = TRUE))
  exe_path <- file.path(tmp_dir, basename(ts_name))
  entries <- suppressWarnings(tryCatch(utils::unzip(exe_path[1], list = TRUE), error = function(e) NULL))
  if (is.null(entries) || !"TaxaSwap.txt" %in% entries$Name) stop("TaxaSwap.txt nao encontrado")
  utils::unzip(exe_path[1], files = "TaxaSwap.txt", exdir = tmp_dir, overwrite = TRUE)
  txt_path <- file.path(tmp_dir, "TaxaSwap.txt")
  if (!file.exists(txt_path)) stop("falha extrair TaxaSwap.txt")
  lines <- readLines(txt_path, warn = FALSE, encoding = "latin1")
  parsed <- parse_t1apr_from_taswap(lines)
  parsed |> filter(refdate == as.Date(ref_date))
}

resolve_pre_curve <- function(target_date, max_lookback_days = 10) {
  target_date <- as.Date(target_date)
  for (i in 0:max_lookback_days) {
    candidate <- target_date - days(i)
    # tentativa 1: rb3
    if (has_rb3) {
      yc <- tryCatch(get_b3_curve_rb3(candidate, "PRE"), error = function(e) NULL)
      if (!is.null(yc) && nrow(yc) > 0) return(list(used_refdate = candidate, data = yc))
    }
    # tentativa 2: TaxaSwap
    yc <- tryCatch(get_pre_from_taswap(candidate), error = function(e) {
      message(sprintf("[taswap] %s sem PRE (%s)", format(candidate), conditionMessage(e)))
      NULL
    })
    if (!is.null(yc) && nrow(yc) > 0) {
      message(sprintf("PRE via TaxaSwap em %s", format(candidate)))
      return(list(used_refdate = candidate, data = yc))
    }
  }
  NULL
}

## ---------- Tesouro Direto CSV (fallback IPCA) ----------

TD_URL <- paste0(
  "https://www.tesourotransparente.gov.br/ckan/dataset/",
  "df56aa42-484a-4a59-8184-7676580c81e3/resource/",
  "796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv"
)

parse_taxa_percent <- function(x) {
  if (is.numeric(x)) return(as.numeric(x))
  chr <- trimws(as.character(x))
  has_comma <- grepl(",", chr, fixed = TRUE)
  chr[has_comma] <- gsub("\\.", "", chr[has_comma])
  chr[has_comma] <- sub(",", ".", chr[has_comma], fixed = TRUE)
  suppressWarnings(as.numeric(chr))
}

td_cache <- NULL
fetch_td_ipca <- function() {
  if (!is.null(td_cache)) return(td_cache)
  message("Baixando Tesouro Direto (fallback IPCA)...")
  resp <- request(TD_URL) |>
    req_headers("User-Agent" = "Mozilla/5.0 (AZInvestDataBot/1.0)") |>
    req_timeout(120) |> req_perform()
  raw <- resp_body_string(resp, encoding = "latin1")
  df <- read_delim(I(raw), delim = ";",
    locale = locale(encoding = "Latin1", decimal_mark = ",", grouping_mark = "."),
    show_col_types = FALSE, name_repair = "minimal") |>
    transmute(
      tipo_titulo = .data[["Tipo Titulo"]],
      vencimento = dmy(.data[["Data Vencimento"]]),
      data_base = dmy(.data[["Data Base"]]),
      taxa_venda = parse_taxa_percent(.data[["Taxa Venda Manha"]])
    ) |>
    filter(!is.na(vencimento), !is.na(data_base), !is.na(taxa_venda),
           trimws(tipo_titulo) == "Tesouro IPCA+")
  td_cache <<- df
  df
}

resolve_ipca_curve_td <- function(target_date) {
  df <- tryCatch(fetch_td_ipca(), error = function(e) {
    message(sprintf("Tesouro falhou: %s", conditionMessage(e))); NULL
  })
  if (is.null(df) || !nrow(df)) return(NULL)
  u <- sort(unique(as.Date(df$data_base)))
  cand <- u[u <= as.Date(target_date)]
  if (!length(cand)) return(NULL)
  ref <- max(cand)
  snap <- df |> filter(data_base == ref) |> arrange(vencimento) |>
    select(vencimento, taxa_venda)
  list(used_refdate = ref, data = snap, source = "td")
}

resolve_ipca_curve <- function(target_date, max_lookback_days = 10) {
  target_date <- as.Date(target_date)
  # tenta rb3 DIC nos ultimos dias
  if (has_rb3) {
    for (i in 0:max_lookback_days) {
      candidate <- target_date - days(i)
      yc <- tryCatch(get_b3_curve_rb3(candidate, "DIC"), error = function(e) NULL)
      if (!is.null(yc) && nrow(yc) > 0) {
        return(list(used_refdate = candidate, data = yc, source = "rb3"))
      }
    }
  }
  # fallback Tesouro CSV
  td <- resolve_ipca_curve_td(target_date)
  if (!is.null(td)) return(td)
  NULL
}

## ---------- Interpolacao + Plot ----------

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

build_pre_snapshot <- function(anchor_date, label_prefix, target_vencs) {
  resolved <- resolve_pre_curve(anchor_date)
  if (is.null(resolved)) return(NULL)
  interp <- interp_yield(resolved$data, target_vencs)
  if (!nrow(interp)) return(NULL)
  lab <- sprintf("%s (%s)", label_prefix, format(resolved$used_refdate, "%d/%m/%Y"))
  list(refdate = as.Date(resolved$used_refdate),
       rows = interp |> mutate(curve_key = label_prefix, snapshot_label = lab))
}

build_ipca_snapshot <- function(anchor_date, label_prefix, target_vencs) {
  resolved <- resolve_ipca_curve(anchor_date)
  if (is.null(resolved)) return(NULL)
  ref <- as.Date(resolved$used_refdate)
  lab <- sprintf("%s (%s)", label_prefix, format(ref, "%d/%m/%Y"))
  if (identical(resolved$source, "td")) {
    rows <- resolved$data |> filter(vencimento %in% target_vencs)
    if (!nrow(rows)) rows <- resolved$data
    rows <- rows |> mutate(curve_key = label_prefix, snapshot_label = lab)
  } else {
    interp <- interp_yield(resolved$data, target_vencs)
    if (!nrow(interp)) return(NULL)
    rows <- interp |> mutate(curve_key = label_prefix, snapshot_label = lab)
  }
  list(refdate = ref, rows = rows)
}

requested_refdate <- as.Date(with_tz(Sys.time(), tzone = "America/Sao_Paulo"))
message("Refdate solicitado: ", format(requested_refdate))

build_set <- function(builder, target_vencs, slug) {
  today <- builder(requested_refdate, "Hoje", target_vencs)
  d30   <- builder(requested_refdate - days(30), "D-30", target_vencs)
  d90   <- builder(requested_refdate - days(90), "D-90", target_vencs)
  snaps <- Filter(Negate(is.null), list(today, d30, d90))
  if (!length(snaps)) {
    message(sprintf("AVISO: sem dados para %s", slug)); return(NULL)
  }
  long_df <- bind_rows(lapply(snaps, `[[`, "rows")) |>
    mutate(snapshot_label = factor(snapshot_label, levels = unique(snapshot_label)))
  list(long_df = long_df, ref_today = if (!is.null(today)) today$refdate else NA)
}

cores_pre  <- c(`D-90` = "#56B4E9", `D-30` = "#00008B", Hoje = "#000000")
cores_ipca <- c(`D-90` = "#F8766D", `D-30` = "#8B0000", Hoje = "#000000")

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

run_one <- function(builder, target_vencs, slug, palette, title_log) {
  result <- build_set(builder, target_vencs, slug)
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

run_one(build_pre_snapshot,  TARGET_VENC_PRE,  "juros_prefixado", cores_pre,  "Prefixado")
run_one(build_ipca_snapshot, TARGET_VENC_IPCA, "juros_ipca",      cores_ipca, "IPCA+")

message("build_yield_curves_svg.R OK")
