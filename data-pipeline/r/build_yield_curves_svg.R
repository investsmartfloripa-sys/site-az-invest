# Curvas Prefixado e IPCA+ (Hoje, D-30, D-90) como SVG.
#
# Fonte primaria: B3 ReferenceRates via rb3 (atualiza diariamente).
#   - Curva PRE  -> serie Prefixado (LTN/NTN-F)
#   - Curva DIC  -> serie IPCA+ (NTN-B)
# Fallback: Tesouro Transparente CSV (caso rb3/B3 falhe).
#
# A curva da B3 e' continua (em biz_days) e e' interpolada nos vencimentos-padrao
# dos titulos do Tesouro Direto. O resultado e' visualmente compativel com o
# grafico anterior (vencimentos fixos no eixo X) mas com dados frescos.

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

## ---------- B3 via rb3 (primario) ----------

has_rb3 <- requireNamespace("rb3", quietly = TRUE)
if (has_rb3) {
  suppressPackageStartupMessages(library(rb3))
}

get_b3_curve <- function(ref_date, curve_name) {
  if (!has_rb3) stop("rb3 nao disponivel")
  rb3_bootstrap()
  fetch_marketdata("b3-reference-rates", refdate = ref_date, curve_name = curve_name)
  raw <- if (curve_name == "PRE") {
    yc_brl_get()
  } else if (curve_name == "DIC") {
    if (exists("yc_ipca_get", mode = "function")) {
      yc_ipca_get()
    } else {
      stop("rb3 sem accessor para curva DIC nessa versao")
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

## ---------- Tesouro Direto (fallback) ----------

TD_URL <- paste0(
  "https://www.tesourotransparente.gov.br/ckan/dataset/",
  "df56aa42-484a-4a59-8184-7676580c81e3/resource/",
  "796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv"
)
ua <- "Mozilla/5.0 (compatible; AZInvestDataBot/1.0)"

parse_taxa_percent <- function(x) {
  if (is.numeric(x)) return(as.numeric(x))
  chr <- trimws(as.character(x))
  has_comma <- grepl(",", chr, fixed = TRUE)
  chr[has_comma] <- gsub("\\.", "", chr[has_comma])
  chr[has_comma] <- sub(",", ".", chr[has_comma], fixed = TRUE)
  suppressWarnings(as.numeric(chr))
}

fetch_tesouro <- function() {
  resp <- request(TD_URL) |>
    req_headers("User-Agent" = ua) |>
    req_timeout(120) |>
    req_perform()
  raw <- resp_body_string(resp, encoding = "latin1")
  read_delim(
    I(raw), delim = ";",
    locale = locale(encoding = "Latin1", decimal_mark = ",", grouping_mark = "."),
    show_col_types = FALSE, name_repair = "minimal"
  ) |>
    transmute(
      tipo_titulo = .data[["Tipo Titulo"]],
      vencimento = dmy(.data[["Data Vencimento"]]),
      data_base = dmy(.data[["Data Base"]]),
      taxa_venda = parse_taxa_percent(.data[["Taxa Venda Manha"]])
    ) |>
    filter(!is.na(vencimento), !is.na(data_base), !is.na(taxa_venda))
}

resolve_tesouro_snapshot <- function(td, tipo_predicate, target_date) {
  sub <- td %>% filter(tipo_predicate(tipo_titulo))
  if (!nrow(sub)) return(NULL)
  u <- sort(unique(as.Date(sub$data_base)))
  cand <- u[u <= as.Date(target_date)]
  if (!length(cand)) return(NULL)
  ref <- max(cand)
  snap <- sub %>% filter(data_base == ref) %>% arrange(vencimento)
  if (!nrow(snap)) return(NULL)
  list(used_refdate = ref, data = snap %>% select(vencimento, taxa_venda))
}

is_prefixado_principal <- function(tt) trimws(tt) == "Tesouro Prefixado"
is_ipca_principal      <- function(tt) trimws(tt) == "Tesouro IPCA+"

## ---------- Orchestrator ----------

build_snapshot <- function(anchor_date, label_prefix, curve_name, target_vencs,
                           td_cache, td_predicate) {
  if (has_rb3) {
    b3 <- tryCatch(resolve_b3_curve(anchor_date, curve_name), error = function(e) NULL)
    if (!is.null(b3) && nrow(b3$data) > 0) {
      interp <- interp_yield(b3$data, target_vencs)
      if (nrow(interp) > 0) {
        lab <- sprintf("%s (%s)", label_prefix, format(b3$used_refdate, "%d/%m/%Y"))
        return(list(
          source = "b3",
          refdate = as.Date(b3$used_refdate),
          rows = interp %>% mutate(curve_key = label_prefix, snapshot_label = lab, data_base = as.Date(b3$used_refdate))
        ))
      }
    }
  }
  if (!is.null(td_cache)) {
    td <- resolve_tesouro_snapshot(td_cache, td_predicate, anchor_date)
    if (!is.null(td) && nrow(td$data) > 0) {
      lab <- sprintf("%s (%s)", label_prefix, format(td$used_refdate, "%d/%m/%Y"))
      rows <- td$data %>% filter(vencimento %in% target_vencs) %>%
        mutate(curve_key = label_prefix, snapshot_label = lab, data_base = as.Date(td$used_refdate))
      if (nrow(rows) == 0) {
        rows <- td$data %>%
          mutate(curve_key = label_prefix, snapshot_label = lab, data_base = as.Date(td$used_refdate))
      }
      return(list(source = "td", refdate = as.Date(td$used_refdate), rows = rows))
    }
  }
  NULL
}

requested_refdate <- as.Date(with_tz(Sys.time(), tzone = "America/Sao_Paulo"))
message("Refdate solicitado: ", format(requested_refdate))

td_cache <- tryCatch({
  message("Baixando Tesouro Direto (fallback)...")
  fetch_tesouro()
}, error = function(e) {
  message("Falha Tesouro Direto: ", conditionMessage(e))
  NULL
})

build_set <- function(curve_name, target_vencs, td_predicate, slug) {
  today <- build_snapshot(requested_refdate, "Hoje", curve_name, target_vencs, td_cache, td_predicate)
  d30   <- build_snapshot(requested_refdate - days(30), "D-30", curve_name, target_vencs, td_cache, td_predicate)
  d90   <- build_snapshot(requested_refdate - days(90), "D-90", curve_name, target_vencs, td_cache, td_predicate)
  snaps <- Filter(Negate(is.null), list(today, d30, d90))
  if (!length(snaps)) return(NULL)
  long_df <- bind_rows(lapply(snaps, `[[`, "rows")) %>%
    mutate(snapshot_label = factor(snapshot_label, levels = unique(snapshot_label)))
  list(long_df = long_df,
       ref_today = if (!is.null(today)) today$refdate else NA,
       today_source = if (!is.null(today)) today$source else NA)
}

## ---------- Cores e plot ----------

cores_pre  <- c(`D-90` = "#56B4E9", `D-30` = "#00008B", Hoje = "#000000")
cores_ipca <- c(`D-90` = "#F8766D", `D-30` = "#8B0000", Hoje = "#000000")

plot_curves <- function(long_df, pal) {
  label_map <- long_df %>%
    distinct(curve_key, snapshot_label) %>%
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

run_one <- function(curve_name, target_vencs, td_predicate, slug, palette, title_log) {
  result <- build_set(curve_name, target_vencs, td_predicate, slug)
  if (is.null(result)) {
    message(sprintf("AVISO: sem dados para %s", slug))
    return(invisible(NULL))
  }
  message(sprintf("%s -> fonte 'Hoje': %s, refdate=%s",
                  title_log, result$today_source, format(result$ref_today)))
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

run_one("PRE",  TARGET_VENC_PRE,  is_prefixado_principal, "juros_prefixado", cores_pre,  "Prefixado")
run_one("DIC",  TARGET_VENC_IPCA, is_ipca_principal,      "juros_ipca",      cores_ipca, "IPCA+")

message("build_yield_curves_svg.R OK")
