"use client";

import { useEffect } from "react";

const SELETOR = ".overflow-x-auto, .overflow-x-scroll, .overflow-auto";

/**
 * Sinal de "tem mais para o lado" em toda tabela ou faixa com rolagem horizontal do site.
 * Marca o contêiner com data-rola="dir" | "esq" | "ambos" conforme o que ainda está escondido;
 * o CSS (globals.css) esmaece a borda correspondente. Na revisão de 12/11/2026, tabelas que
 * rolavam no celular foram lidas como "cortadas": faltava só o sinal.
 */
export function ScrollHints() {
  useEffect(() => {
    let quadro = 0;
    let espera = 0;
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(marcar);
    };
    function marcar() {
      quadro = 0;
      document.querySelectorAll<HTMLElement>(SELETOR).forEach((el) => {
        const sobra = el.scrollWidth - el.clientWidth;
        let valor = "";
        if (sobra > 2) {
          const esquerda = el.scrollLeft > 2;
          const direita = el.scrollLeft < sobra - 2;
          valor = esquerda && direita ? "ambos" : direita ? "dir" : esquerda ? "esq" : "";
          if (!el.dataset.rolaOuve) {
            el.dataset.rolaOuve = "1";
            el.addEventListener("scroll", agendar, { passive: true });
          }
        }
        if ((el.dataset.rola ?? "") !== valor) {
          if (valor) el.dataset.rola = valor;
          else delete el.dataset.rola;
        }
      });
    }
    agendar();
    const aoMudar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(agendar, 250);
    };
    const mo = new MutationObserver(aoMudar);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", aoMudar);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", aoMudar);
      window.clearTimeout(espera);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return null;
}
