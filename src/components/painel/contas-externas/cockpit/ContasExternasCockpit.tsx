"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { AtividadeCodaceData } from "@/lib/painel-atividade";
import type { CambioMacroData, ContasExternasComexData, ContasExternasData } from "@/lib/painel-contas-externas";
import { Divisor, KpiCard } from "@/components/painel/core";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { ContasExternasTabs } from "@/components/painel/contas-externas/ContasExternasTabs";
import { fmtDataBR, fmtMesCurto, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { formatGiroDia } from "@/lib/data-stamp";
import { CambioRealCard, FundamentosCambioCard, PpcCard } from "./CambioCards";
import { ComposicaoComercioCard } from "./ComposicaoComercioCard";
import { BensCard, ServicosRendaCard } from "./ContaCorrenteAbertaCards";
import { EstadoNoTempoBp } from "./EstadoNoTempoBp";
import { CoberturaIdpCard, ContaFinanceiraFuncaoCard, NaoResidentesCard } from "./FinanciamentoCards";
import { FluxoCambialCard, FocusExternoCard } from "./FluxoFocusCards";
import { LiquidezExternaCard, PiiCard } from "./LiquidezCards";
import { DecomposicaoTcCard, TcSaldoCard } from "./SaldoCards";
import { TabelaMestraBp } from "./TabelaMestraBp";
import { fmtTrimPii, fmtUsBi, fmtUsBiSigned, isoMes, pctPib, ultimoDe, val } from "./cockpit-shared";

/**
 * CONTAS EXTERNAS — COCKPIT do balanço de pagamentos (decisão do dono,
 * 23/09/2026: "cockpit da nossa balança de pagamentos", mesmo shell do PIB).
 * Abas → header técnico → 4 KPIs + fila secundária → divisores de uma linha +
 * grade xl:grid-cols-2 → ficha técnica. Títulos fixos, número em chip/KPI,
 * editorial atrás do (?). Cobertura: 100% do BPM6 mensal (tabela mestra), PII
 * trimestral, fluxo cambial diário, Focus, câmbio real/PPC/fundamentos e pauta.
 */

function KpiLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block min-w-0 rounded-xl transition hover:ring-1 hover:ring-[#027DFC]/40">
      {children}
    </a>
  );
}

export function ContasExternasCockpit({
  data,
  comex,
  cambio,
  codace,
}: {
  data: ContasExternasData;
  comex: ContasExternasComexData | null;
  cambio: CambioMacroData | null;
  codace: AtividadeCodaceData | null;
}) {
  const bp = data.bp_mestre!;
  const geradoEm = data.gerado_em;

  const d = useMemo(() => {
    const rows = bp.acum_12m;
    const u = ultimoDe(rows);
    const a = rows.length > 12 ? rows[rows.length - 13] : undefined;
    const dif = (k: string, pib = false) => {
      const x = pib ? pctPib(u, k) : val(u, k);
      const y = pib ? pctPib(a, k) : val(a, k);
      return x != null && y != null ? +(x - y).toFixed(2) : null;
    };
    const tc = val(u, "tc");
    const idp = val(u, "idp");
    const cobertura = tc != null && idp != null && tc < 0 ? (idp / -tc) * 100 : null;
    const cobAnt = val(a, "tc") != null && val(a, "idp") != null && (val(a, "tc") as number) < 0 ? ((val(a, "idp") as number) / -(val(a, "tc") as number)) * 100 : null;
    const meses = ultimoDe((data.bloco_c.meses_importacao_serie ?? []).filter((r) => r.meses_bens_servicos != null));
    const pii = ultimoDe(data.pii?.serie ?? []);
    const fluxo = data.fluxo_cambial;
    const ptax = cambio?.hero.ptax ?? null;
    return { u, dif, cobertura, cobAnt, meses, pii, fluxo, ptax };
  }, [bp.acum_12m, data, cambio]);

  const u = d.u;
  const mesRef = u?.mes ?? data.ultima_referencia_mensal ?? "";

  return (
    <div className="flex flex-col gap-4">
      <ContasExternasTabs />

      {/* ── Status geral ── */}
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#132960]">
          Contas Externas — Balanço de pagamentos
          <MethodInfo className="ml-2 align-middle">
            Cockpit de acompanhamento das Estatísticas do Setor Externo do BCB (BPM6), na ordem em que a mesa confere a
            divulgação: saldo em transações correntes e sua decomposição, a tabela mestra linha a linha, a conta corrente
            aberta (bens, serviços, renda), o financiamento (conta financeira por função, cobertura pelo IDP e ingressos de
            não residentes), o estado no tempo de 12 linhas, a liquidez externa (reservas, meses de importação, reservas ÷
            dívida de curto prazo, PII), o fluxo cambial diário, as expectativas Focus, o câmbio (real, PPC e fundamentos) e
            a pauta de comércio. O número vive no chip ou no KPI, nunca no título; metodologia atrás do (?) de cada card e na
            ficha técnica.
          </MethodInfo>
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Referência BP: {mesRef ? fmtMesCurto(isoMes(mesRef)) : "—"} · reservas {data.ultima_referencia_diaria ? fmtDataBR(data.ultima_referencia_diaria) : "—"} ·
          fluxo cambial {d.fluxo ? fmtDataBR(d.fluxo.ultimo_dia) : "—"} · PII {d.pii ? fmtTrimPii(d.pii.trim) : "—"} · giro do pipeline{" "}
          {formatGiroDia(geradoEm) ?? "—"} · BCB SGS 22701–23060 · 24010–24068 · 13961–13970 · 13982 · 4192 · Olinda Focus · SECEX
        </p>
        {data.revisoes?.revised_at ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            Revisão detectada em {fmtDataBR(data.revisoes.revised_at.slice(0, 10))}: {data.revisoes.n_meses} meses da TC 12m mudaram
            (máx. {fmtNum(data.revisoes.max_abs_diff_usd_bi ?? 0, 2)} bi).
          </p>
        ) : null}
      </header>

      {/* ── KPIs principais ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Transações correntes 12m"
          value={fmtSignedPct(pctPib(u, "tc"), 2)}
          unit="do PIB"
          delta={d.dif("tc", true)}
          deltaUnit="p.p."
          deltaDec={2}
          deltaHint="vs 12m antes"
          hint={`${fmtUsBiSigned(val(u, "tc"), 1)} · risco: déficit > 4% PIB · SGS 22701`}
          size="lg"
        />
        <KpiCard
          label="IDP 12m"
          value={fmtSignedPct(pctPib(u, "idp"), 2)}
          unit="do PIB"
          delta={d.dif("idp", true)}
          deltaUnit="p.p."
          deltaDec={2}
          deltaHint="vs 12m antes"
          hint={`${fmtUsBi(val(u, "idp"), 1)} · cobre ${d.cobertura != null ? fmtPct(d.cobertura, 0) : "—"} do déficit · SGS 22885`}
        />
        <KpiCard
          label="Reservas internacionais"
          value={data.hero.reservas_us_bi.valor != null ? fmtNum(data.hero.reservas_us_bi.valor, 1) : "—"}
          unit="US$ bi"
          hint={`liquidez · ${data.ultima_referencia_diaria ? fmtDataBR(data.ultima_referencia_diaria) : "—"} · ${d.meses ? `${fmtNum(d.meses.meses_bens_servicos, 1)} meses de importação` : ""}`}
        />
        <KpiCard
          label="Balança de bens 12m"
          value={val(u, "bens") != null ? fmtNum(val(u, "bens"), 1) : "—"}
          unit="US$ bi"
          delta={d.dif("bens")}
          deltaUnit="abs"
          deltaDec={1}
          deltaHint="bi vs 12m antes"
          hint={`exportações ${fmtUsBi(val(u, "bens_x"), 0)} · importações ${fmtUsBi(val(u, "bens_m"), 0)} · BPM6`}
        />
      </div>

      {/* ── KPIs secundários ── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiLink href="#servicos-renda">
          <KpiCard size="sm" label="Serviços 12m" value={fmtUsBiSigned(val(u, "servicos"), 1)} hint={`${fmtSignedPct(pctPib(u, "servicos"), 2)} PIB · SGS 22719`} />
        </KpiLink>
        <KpiLink href="#servicos-renda">
          <KpiCard size="sm" label="Renda primária 12m" value={fmtUsBiSigned(val(u, "renda_primaria"), 1)} hint={`${fmtSignedPct(pctPib(u, "renda_primaria"), 2)} PIB · SGS 22800`} />
        </KpiLink>
        <KpiLink href="#nao-residentes">
          <KpiCard
            size="sm"
            label="Carteira — não residentes 12m"
            value={fmtUsBiSigned(val(u, "carteira_passivos"), 1)}
            hint={`ações+fundos ${fmtUsBiSigned((val(u, "acoes_passivos") ?? 0) + (val(u, "fundos_passivos") ?? 0), 1)} · títulos ${fmtUsBiSigned(val(u, "titulos_passivos"), 1)}`}
          />
        </KpiLink>
        <KpiLink href="#fluxo-cambial">
          <KpiCard
            size="sm"
            label={`Fluxo cambial ${d.fluxo?.ano_corrente.ano ?? ""}`}
            value={fmtUsBiSigned(d.fluxo?.ano_corrente.total ?? null, 1)}
            hint={d.fluxo ? `até ${fmtDataBR(d.fluxo.ultimo_dia)} · financeiro ${fmtUsBiSigned(d.fluxo.ano_corrente.financeiro, 1)}` : "sem dado"}
          />
        </KpiLink>
        <KpiLink href="#liquidez-externa">
          <KpiCard
            size="sm"
            label="Reservas ÷ dívida CP"
            value={d.pii?.guidotti != null ? `${fmtNum(d.pii.guidotti, 2)}×` : "—"}
            hint={d.pii ? `${fmtTrimPii(d.pii.trim)} · prazo original · régua 1×` : "PII indisponível"}
          />
        </KpiLink>
        <KpiLink href="#cambio-real">
          <KpiCard
            size="sm"
            label="PTAX"
            value={d.ptax ? fmtNum(d.ptax.valor, 4) : "—"}
            hint={d.ptax ? `R$/US$ · ${fmtDataBR(d.ptax.data)} · REER 12m ${fmtSignedPct(cambio?.hero.reer_var_12m_pct ?? null, 1)}` : "sem dado"}
          />
        </KpiLink>
      </div>

      {/* ── Saldo ── */}
      <Divisor
        label="Saldo — transações correntes"
        info="O saldo em transações correntes acumulado em 12 meses é a grandeza-mestra do setor externo: quanto o país absorve de poupança externa. Em % do PIB com a referência assimétrica de risco (déficit acima de 4%); a decomposição mostra qual conta move o saldo."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <TcSaldoCard bp={bp} codace={codace} geradoEm={geradoEm} />
        <DecomposicaoTcCard bp={bp} geradoEm={geradoEm} />
      </div>

      {/* ── Tabela mestra ── */}
      <Divisor
        label="Tabela mestra — raio-X da divulgação"
        info="Todas as linhas do BPM6 mensal, da conta corrente aos erros e omissões, no mês selecionado contra o mesmo mês do ano anterior e em 12 meses contra 12 meses um ano antes. É a planilha que a divulgação do BCB traz na primeira página."
      />
      <TabelaMestraBp bp={bp} geradoEm={geradoEm} />

      {/* ── Conta corrente aberta ── */}
      <Divisor
        label="Conta corrente aberta — bens, serviços e rendas"
        info="O superávit de bens paga (ou não) o déficit estrutural de serviços e de renda primária. Bens em exportações × importações; serviços por conta; renda primária por componente (lucros, reinvestimento, juros)."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <BensCard bp={bp} geradoEm={geradoEm} />
        {data.bloco_servicos?.serie_12m?.length && data.bloco_renda?.serie_12m?.length ? (
          <ServicosRendaCard servicos={data.bloco_servicos.serie_12m} renda={data.bloco_renda.serie_12m} geradoEm={geradoEm} />
        ) : null}
      </div>

      {/* ── Financiamento ── */}
      <Divisor
        label="Financiamento — conta financeira"
        info="Como o saldo em transações correntes é financiado: a conta financeira por função (investimento direto, carteira, derivativos, outros investimentos, reservas), a cobertura do déficit pelo IDP e a necessidade de financiamento externo, e o lado do passivo — o que os não residentes aplicaram, por instrumento."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <ContaFinanceiraFuncaoCard bp={bp} geradoEm={geradoEm} />
        <CoberturaIdpCard bp={bp} geradoEm={geradoEm} />
      </div>
      <NaoResidentesCard bp={bp} geradoEm={geradoEm} />

      {/* ── Estado no tempo ── */}
      <Divisor
        label="Estado no tempo — 12 linhas do BP"
        info="Small multiples das linhas mais acompanhadas, com o percentil do % do PIB contra a própria história desde 2005. A tabela mestra tem todas as linhas."
      />
      <EstadoNoTempoBp bp={bp} geradoEm={geradoEm} />

      {/* ── Liquidez externa ── */}
      <Divisor
        label="Liquidez e posição externa"
        info="O colchão (reservas no conceito liquidez, em meses de importação e contra a dívida de curto prazo) e o balanço patrimonial externo (posição de investimento internacional, trimestral)."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <LiquidezExternaCard data={data} />
        {data.pii?.serie?.length ? <PiiCard pii={data.pii.serie} geradoEm={geradoEm} /> : null}
      </div>

      {/* ── Fluxo cambial e expectativas ── */}
      <Divisor
        label="Fluxo cambial e expectativas"
        info="O dado externo mais frequente (câmbio contratado, diário, defasagem de ~3 dias úteis) e o consenso Focus para conta corrente, balança, IDP e câmbio do ano, ancorado no realizado."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {data.fluxo_cambial ? <FluxoCambialCard fluxo={data.fluxo_cambial} geradoEm={geradoEm} /> : null}
        {data.focus ? <FocusExternoCard focus={data.focus} bp={bp} ptax={d.ptax} geradoEm={geradoEm} /> : null}
      </div>

      {/* ── Câmbio ── */}
      {cambio ? (
        <>
          <Divisor
            label="Câmbio — real, paridade e fundamentos"
            info="Os preços que ajustam o setor externo: câmbio efetivo real (IPCA e IPA), efetivo nominal, real bilateral e PTAX; a paridade do poder de compra e o nível de preços relativo; e os fundamentos (termos de troca, commodities em dólar e diferencial de juro real). Análise de valor justo e UIP na aba Câmbio."
            right={
              <Link href="/painel-economico/economia/brasil/contas-externas/cambio" className="font-semibold text-[#027DFC] hover:underline">
                aba Câmbio →
              </Link>
            }
          />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <CambioRealCard cambio={cambio} />
            <FundamentosCambioCard cambio={cambio} />
          </div>
          <PpcCard cambio={cambio} />
        </>
      ) : null}

      {/* ── Pauta ── */}
      {comex ? (
        <>
          <Divisor label="Pauta de comércio — composição" info="Composição por produto e parceiro (SECEX). Só composição: saldos e totais do painel são do BPM6." />
          <ComposicaoComercioCard comex={comex} />
        </>
      ) : null}

      {/* ── Ficha técnica ── */}
      <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
          Ficha técnica — fontes, metodologia e convenções
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
          <p>
            <b>Fontes e séries.</b> BCB/SGS, Estatísticas do Setor Externo (BPM6), mensal em US$ milhões: transações correntes
            22701 (bens 22707, exportações 22711, serviços 22719 e contas 22728/22740/22776/22779, renda primária 22800 e
            componentes 22803/22806/22812/22815, renda secundária 22838); conta capital 22851; conta financeira 22863
            (investimento direto 22864, IDE 22865, IDP 22885 e 22891/22892/22893, carteira 22905 com ativos 22906 e passivos
            22924 — ações 22927, fundos 22936, títulos 22939/22942/22945 —, derivativos 22966, outros investimentos 22969 com
            ativos 22970 e passivos 22971/22994/23026, ativos de reserva 23043); erros e omissões 23060. PIB 12m em US$: 4192.
            Reservas: 13982 (diária, liquidez) e 3546 (mensal). PII trimestral: 24010–24068. Câmbio contratado: 13961, 13967,
            13970 (diário). Focus: Olinda ExpectativasMercadoAnuais. Câmbio: SGS 1, 11752, 11753, 11757, 20360, 27574/29042
            (IC-Br), FUNCEX via Ipeadata (termos de troca), Banco Mundial ICP (PPC), FRED (CPI e Fed Funds). Pauta: SECEX Comex
            Stat. Recessões: CODACE/FGV.
          </p>
          <p>
            <b>Convenções.</b> Acumulado de 12 meses é a leitura de tendência; o mês bruto só contra o mesmo mês do ano anterior
            (sazonalidade de soja e de remessas). Conta financeira no BPM6 = ativos − passivos: negativa = entrada líquida.
            Identidades auditadas no builder: TC = bens + serviços + renda primária + renda secundária; TC + conta capital −
            conta financeira + erros e omissões = 0; conta financeira = soma das cinco funções. Verde = subiu, vermelho = caiu
            (direção literal, sem juízo). Índices de câmbio: alta = depreciação do real.
          </p>
          <p>
            <b>Réguas declaradas.</b> Déficit em TC acima de 4% do PIB (assimétrica, risco); cobertura pelo IDP 100%; reservas
            em 3 meses de importação (regra de bolso do FMI); reservas ÷ dívida de curto prazo 1× (Guidotti-Greenspan, com a
            aproximação por prazo original explicada no card); câmbio real contra média ± 1 dp desde 2000 (posição relativa,
            não equilíbrio). Percentis dos tiles desde jan/2005.
          </p>
          <p>
            <b>Calendário e revisões.</b> O BP mensal sai por volta do dia 25 do mês seguinte; a PII trimestral, cerca de 2
            meses após o trimestre; o câmbio contratado, com ~3 dias úteis. O BCB reescreve a série em julho (CBE) e novembro
            (Censo de capitais): o builder compara o acumulado 12m da TC com o giro anterior e registra a revisão (aviso no
            cabeçalho quando houver). Pipeline: data-pipeline/python/build_contas_externas.py (schema v{data.schema_version}) +
            contas_externas_v3.py e build_cambio_macro.py · workflow contas-externas-pipeline.yml (diário 23h30 UTC), cache
            purgado por tag ao publicar.
          </p>
        </div>
      </details>
    </div>
  );
}
