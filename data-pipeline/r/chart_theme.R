az_chart_stamp <- function() {
  format(Sys.time(), "%d/%m/%Y %H:%M", tz = "America/Sao_Paulo")
}

az_chart_width <- function() {
  10
}

az_chart_height <- function() {
  # Proporcao padrao 5:4 para melhor leitura em cards responsivos.
  8
}

az_chart_theme <- function(legend_position = "bottom", title_color = "#027DFC") {
  ggplot2::theme_classic(base_size = 14) +
    ggplot2::theme(
      panel.background = ggplot2::element_rect(fill = "#f5f5f4", colour = NA),
      plot.background = ggplot2::element_rect(fill = "white", colour = NA),
      panel.grid.major.y = ggplot2::element_line(color = "grey85", linewidth = 0.4),
      panel.grid.minor.y = ggplot2::element_line(color = "grey92", linewidth = 0.25),
      panel.grid.major.x = ggplot2::element_line(color = "grey85", linewidth = 0.4),
      panel.grid.minor.x = ggplot2::element_line(color = "grey92", linewidth = 0.25),
      legend.position = legend_position,
      legend.justification = "center",
      legend.text = ggplot2::element_text(size = 12, color = "#111827"),
      legend.title = ggplot2::element_text(size = 12, color = "#111827"),
      axis.text = ggplot2::element_text(size = 12, color = "#111827"),
      axis.title = ggplot2::element_text(size = 13, color = "#111827"),
      plot.title = ggplot2::element_text(face = "bold", color = title_color),
      plot.subtitle = ggplot2::element_text(color = "#4b5563"),
      plot.caption = ggplot2::element_text(size = 12, color = "#4b5563", hjust = 1)
    )
}

