# Curvas Prefixado e IPCA+ (Hoje, D-30, D-90) como SVG (ggplot2 + svglite).
# Fonte: Tesouro Transparente CSV + BCB SGS 11 (apenas se precisar no futuro).

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
    I(raw),
    delim = ";",
    locale = locale(encoding = "Latin1", decimal_mark = ",", grouping_mark = "."),
    show_col_types = FALSE,
    name_repair = "minimal"
  ) |>
    transmute(
      tipo_titulo = .data[["Tipo Titulo"]],
      vencimento = dmy(.data[["Data Vencimento"]]),
      data_base = dmy(.data[["Data Base"]]),
      taxa_venda = parse_taxa_percent(.data[["Taxa Venda Manha"]])
    ) |>
    filter(!is.na(vencimento), !is.na(data_base), !is.na(taxa_venda))
}

ref_dates <- function(dates) {
  u <- sort(unique(as.Date(dates)))
  if (!length(u)) stop("Sem datas na base Tesouro")
  d_hoje <- max(u)
  pick <- function(target) {
    s <- u[u <= target]
    if (!length(s)) return(as.Date(NA))
    max(s)
  }
  list(
    `D-90` = pick(d_hoje - 90),
    `D-30` = pick(d_hoje - 30),
    Hoje = d_hoje
  )
}

snapshots_long <- function(td, tipo_predicate) {
  sub <- td %>% filter(tipo_predicate(tipo_titulo))
  if (!nrow(sub)) return(NULL)
  refs <- ref_dates(sub$data_base)
  rows <- list()
  for (nm in names(refs)) {
    d <- refs[[nm]]
    if (is.na(d)) next
    snap <- sub %>% filter(data_base == d) %>% arrange(vencimento)
    if (!nrow(snap)) next
    lab <- sprintf("%s (%s)", nm, format(d, "%d/%m/%Y"))
    snap <- snap %>% mutate(snapshot_label = lab, curve_key = nm)
    rows[[length(rows) + 1]] <- snap
  }
  if (!length(rows)) return(NULL)
  bind_rows(rows) %>%
    mutate(
      snapshot_label = factor(snapshot_label, levels = unique(snapshot_label))
    )
}

stamp <- az_chart_stamp()

plot_curves <- function(long_df, title, pal) {
  label_map <- long_df %>%
    distinct(curve_key, snapshot_label) %>%
    arrange(match(curve_key, names(pal)))
  ggplot(long_df, aes(x = vencimento, y = taxa_venda, color = curve_key, group = snapshot_label)) +
    geom_line(linewidth = 0.9) +
    geom_point(size = 1.8) +
    scale_color_manual(
      values = pal,
      breaks = label_map$curve_key,
      labels = as.character(label_map$snapshot_label)
    ) +
    scale_x_date(date_labels = "%Y") +
    scale_y_continuous(labels = comma_format(decimal.mark = ",", big.mark = ".")) +
    labs(
      x = "Vencimento",
      y = "Taxa (%)",
      title = title,
      subtitle = "Curvas historicas (D-90, D-30 e Hoje)",
      color = NULL,
      caption = paste("Atualizado:", stamp)
    ) +
    az_chart_theme(legend_position = "bottom")
}

write_curve_table_json <- function(long_df, slug, generated_at) {
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

  payload <- list(
    status = "ok",
    generated_at = generated_at,
    columns = columns,
    rows = rows
  )
  write_json(
    payload,
    file.path(tables_dir, paste0(slug, ".json")),
    auto_unbox = TRUE,
    pretty = TRUE
  )
}

message("Baixando Tesouro Direto...")
td <- fetch_tesouro()
message("Linhas: ", nrow(td))

cores_pre <- c(`D-90` = "#000000", `D-30` = "#00008B", Hoje = "#56B4E9")
cores_ipca <- c(`D-90` = "#000000", `D-30` = "#8B0000", Hoje = "#F8766D")

# Use only principal bond families to avoid duplicate maturities
# (e.g., with/without semiannual coupons) creating zigzag lines.
is_prefixado_principal <- function(tt) {
  trimws(tt) == "Tesouro Prefixado"
}

is_ipca_principal <- function(tt) {
  trimws(tt) == "Tesouro IPCA+"
}

long_pre <- snapshots_long(td, is_prefixado_principal)
if (!is.null(long_pre)) {
  p <- plot_curves(long_pre, "Curva Prefixado", cores_pre)
  svglite(file.path(static_dir, "juros_prefixado.svg"), width = 10, height = 5.5)
  print(p)
  dev.off()
  write_curve_table_json(long_pre, "juros_prefixado", format(Sys.time(), "%Y-%m-%dT%H:%M:%S"))
  message("SVG: juros_prefixado.svg")
} else {
  message("AVISO: sem dados Prefixado")
}

long_ipca <- snapshots_long(td, is_ipca_principal)
if (!is.null(long_ipca)) {
  p2 <- plot_curves(long_ipca, "Curva IPCA+", cores_ipca)
  svglite(file.path(static_dir, "juros_ipca.svg"), width = 10, height = 5.5)
  print(p2)
  dev.off()
  write_curve_table_json(long_ipca, "juros_ipca", format(Sys.time(), "%Y-%m-%dT%H:%M:%S"))
  message("SVG: juros_ipca.svg")
} else {
  message("AVISO: sem dados IPCA+")
}

message("build_yield_curves_svg.R OK")
