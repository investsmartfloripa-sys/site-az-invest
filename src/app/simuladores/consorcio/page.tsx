"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { submitConsorcioLead } from "./actions";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  Car,
  Check,
  ChevronLeft,
  Home,
  Info,
  Key,
  Layers,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);
const fmtCents = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `R$ ${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${(n / 1e3).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
};

const NOMES_INDICE: Record<string, string> = {
  igpm: "IGPM",
  incc: "INCC",
  ipca: "IPCA",
  pre3: "Pré 3%",
};
const ADMS = [
  "Porto",
  "Embracon",
  "Rodobens",
  "Ademicon",
  "CNP",
  "Mapfre",
  "Itaú",
  "HS",
  "Bradesco",
  "Santander",
];

const VALORIZACAO_IMOVEL = 0.05;
const CDI_PROJECAO = 0.1;

const C = {
  blue: "#027DFC",
  blueDark: "#0065c1",
  blueBg: "#e0f2fe",
  blueBgSoft: "#f0f9ff",
  orange: "#FF5713",
  orangeDark: "#E04A0F",
  orangeBg: "#fff7ed",
  orangeBgSoft: "#fff3ed",
  dark: "#0f172a",
  darker: "#020617",
};

type NumFieldProps = {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  width?: string;
  size?: string;
};

const NumField = ({
  value,
  onChange,
  min,
  max,
  prefix,
  suffix,
  width = "w-28",
  size = "text-xl",
}: NumFieldProps) => (
  <div className="inline-flex items-center gap-1">
    {prefix && (
      <span className="text-sm" style={{ color: "#64748b" }}>
        {prefix}
      </span>
    )}
    <input
      type="text"
      inputMode="numeric"
      value={value.toLocaleString("pt-BR")}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/\D/g, "");
        const num = cleaned === "" ? 0 : parseInt(cleaned, 10);
        onChange(Math.min(Math.max(num, min), max));
      }}
      onFocus={(e) => e.target.select()}
      className={`${size} font-bold tabular-nums bg-transparent rounded px-1.5 py-0.5 outline-none border transition-colors text-right ${width}`}
      style={{ color: C.dark, borderColor: "transparent" }}
      onMouseEnter={(e) => {
        if (document.activeElement !== e.currentTarget)
          e.currentTarget.style.borderColor = "#e2e8f0";
      }}
      onMouseLeave={(e) => {
        if (document.activeElement !== e.currentTarget)
          e.currentTarget.style.borderColor = "transparent";
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = C.blue;
        e.currentTarget.style.backgroundColor = "#f8fafc";
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    />
    {suffix && (
      <span className="text-sm" style={{ color: "#64748b" }}>
        {suffix}
      </span>
    )}
  </div>
);

type LegendItem = { color: string; label: string };

const ChartLegend = ({ items }: { items: LegendItem[] }) => (
  <div
    className="flex items-center justify-center flex-wrap gap-4 mb-3 text-xs"
    style={{ color: "#475569" }}
  >
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: it.color }} />
        <span>{it.label}</span>
      </div>
    ))}
  </div>
);

type TipoBem = "imovel" | "carro" | null;
type ObjetivoId =
  | "sair-aluguel"
  | "trocar"
  | "renda"
  | "primeiro-trocar"
  | "trabalhar"
  | null;

type ObjetivoOpt = {
  id: Exclude<ObjetivoId, null>;
  nome: string;
  desc: string;
  icone: typeof Home;
};

export default function SimuladorConsorcio() {
  const [step, setStep] = useState(0);
  const [tipoBem, setTipoBem] = useState<TipoBem>(null);
  const [objetivo, setObjetivo] = useState<ObjetivoId>(null);
  const [valorBem, setValorBem] = useState(400000);
  const [prazo, setPrazo] = useState(180);
  const [aluguelAtual, setAluguelAtual] = useState(2500);
  const [invMensal, setInvMensal] = useState(0);
  const [aluguelEsperado, setAluguelEsperado] = useState(2500);
  const [invMensalRenda, setInvMensalRenda] = useState(0);
  const [faturamentoEsperado, setFaturamentoEsperado] = useState(3000);
  const [lanceProprioAtivo, setLanceProprioAtivo] = useState(false);
  const [valorLance, setValorLance] = useState(0);
  const [lanceEmbutidoAtivo, setLanceEmbutidoAtivo] = useState(false);
  const [embutidoPerc, setEmbutidoPerc] = useState(10);
  const [taxaAdmCustom, setTaxaAdmCustom] = useState<number | null>(null);
  const [indiceCorrecao, setIndiceCorrecao] = useState("incc");
  const [redutor, setRedutor] = useState<"nenhum" | "25" | "50">("nenhum");
  const [numCartas, setNumCartas] = useState(1);
  const [aumentarChances, setAumentarChances] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [leadNome, setLeadNome] = useState("");
  const [leadTel, setLeadTel] = useState("");
  const [leadEnviado, setLeadEnviado] = useState(false);
  const [leadErro, setLeadErro] = useState<string | null>(null);
  const [leadEnviando, startLeadTransition] = useTransition();
  const [selicAnual, setSelicAnual] = useState(0.1475);
  const [selicStatus, setSelicStatus] = useState<"loading" | "live" | "fallback">("loading");

  const isImovel = tipoBem === "imovel";
  const isCarro = tipoBem === "carro";

  useEffect(() => {
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json")
      .then((r) => r.json())
      .then((data) => {
        if (data && data[0] && data[0].valor) {
          setSelicAnual(parseFloat(data[0].valor) / 100);
          setSelicStatus("live");
        } else setSelicStatus("fallback");
      })
      .catch(() => setSelicStatus("fallback"));
  }, []);

  const applyDefaultsForTipo = (tipo: "imovel" | "carro") => {
    setLanceProprioAtivo(false);
    setValorLance(0);
    setLanceEmbutidoAtivo(false);
    setEmbutidoPerc(10);
    setTaxaAdmCustom(null);
    setRedutor("nenhum");
    setNumCartas(1);
    setAumentarChances(false);
    if (tipo === "imovel") {
      setValorBem(400000);
      setPrazo(180);
      setAluguelAtual(2500);
      setAluguelEsperado(2500);
      setInvMensal(0);
      setInvMensalRenda(0);
      setIndiceCorrecao("incc");
    } else {
      setValorBem(80000);
      setPrazo(60);
      setFaturamentoEsperado(3000);
      setIndiceCorrecao("ipca");
    }
  };

  const taxaAdmDefault = isCarro ? (prazo <= 60 ? 0.2 : 0.23) : 0.23;
  const taxaAdm = taxaAdmCustom !== null ? taxaAdmCustom : taxaAdmDefault;
  const fundoReserva = 0.02;
  const nomeIndice = NOMES_INDICE[indiceCorrecao];

  const cdiMensalProj = Math.pow(1 + CDI_PROJECAO, 1 / 12) - 1;

  const saldoTotalPlano = valorBem * (1 + taxaAdm + fundoReserva);
  const parcelaNormal = prazo > 0 ? saldoTotalPlano / prazo : 0;
  const fatorRedutor = redutor === "25" ? 0.75 : redutor === "50" ? 0.5 : 1;
  const parcelaAtual = parcelaNormal * fatorRedutor;

  const valorLanceProprio = lanceProprioAtivo ? valorLance : 0;
  const valorLanceEmbutido = lanceEmbutidoAtivo ? valorBem * (embutidoPerc / 100) : 0;
  const valorLanceTotal = valorLanceProprio + valorLanceEmbutido;
  const creditoLiquido = lanceEmbutidoAtivo ? valorBem * (1 - embutidoPerc / 100) : valorBem;
  const temLance = valorLanceTotal > 0;
  const temRedutor = redutor !== "nenhum";

  const valorPorCarta = valorBem / numCartas;
  const lanceProprioPorCarta = valorLanceProprio / numCartas;
  const lanceTotalPorCarta = valorLanceTotal / numCartas;

  const taxaFinanMensal = isImovel ? 0.01045 : 0.01876;
  const taxaFinanAnual = Math.pow(1 + taxaFinanMensal, 12) - 1;
  const entradaFinan = valorBem * 0.2;
  const valorFinanciado = valorBem - entradaFinan;
  const prazosFinan = useMemo(
    () => (isImovel ? [180, 360] : [48, 72]),
    [isImovel],
  );

  const cenariosFinan = useMemo(() => {
    const calcPrice = (principal: number, rate: number, n: number) => {
      if (!n) return { parcela: 0, total: 0 };
      const parcela = (principal * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1);
      return { parcela, total: parcela * n + entradaFinan };
    };
    const calcSac = (principal: number, rate: number, n: number) => {
      if (!n) return { parcInicial: 0, parcFinal: 0, total: 0 };
      const amort = principal / n;
      const parcInicial = amort + principal * rate;
      const parcFinal = amort + amort * rate;
      const totalJuros = (principal * rate * (n + 1)) / 2;
      return { parcInicial, parcFinal, total: principal + totalJuros + entradaFinan };
    };
    return prazosFinan.flatMap((p) => [
      { tipo: "Price" as const, prazoM: p, ...calcPrice(valorFinanciado, taxaFinanMensal, p) },
      { tipo: "SAC" as const, prazoM: p, ...calcSac(valorFinanciado, taxaFinanMensal, p) },
    ]);
  }, [valorFinanciado, taxaFinanMensal, prazosFinan, entradaFinan]);

  const custoTotalConsorcio = parcelaNormal * prazo;
  const melhorFinan = cenariosFinan.reduce(
    (a, b) => (a.total < b.total ? a : b),
    { tipo: "Price" as "Price" | "SAC", prazoM: 0, total: Infinity } as
      | { tipo: "Price"; prazoM: number; parcela: number; total: number }
      | { tipo: "SAC"; prazoM: number; parcInicial: number; parcFinal: number; total: number },
  );
  const economiaVsMelhor = melhorFinan.total - custoTotalConsorcio;

  const dadosProbabilidade = useMemo(() => {
    if (prazo <= 0) return [];
    const lanceMedio = isCarro ? 0.4 : 0.3;
    const percLance = valorBem > 0 ? valorLanceTotal / valorBem : 0;
    const strength = lanceMedio > 0 && percLance > 0 ? percLance / lanceMedio : 0;

    let pLanceMensal: number;
    if (percLance === 0) pLanceMensal = 0;
    else if (strength >= 2.2) pLanceMensal = 0.06;
    else if (strength >= 1.7) pLanceMensal = 0.045;
    else if (strength >= 1.3) pLanceMensal = 0.03;
    else if (strength >= 1.0) pLanceMensal = 0.02;
    else if (strength >= 0.6) pLanceMensal = 0.01;
    else if (strength >= 0.3) pLanceMensal = 0.005;
    else pLanceMensal = 0.002;

    const dados: { mes: number; individual: number; multiplas: number }[] = [];
    for (let m = 1; m <= prazo; m++) {
      const pLance = 1 - Math.pow(1 - pLanceMensal, m);
      const pSorteio = m / prazo;
      const pIndividual = 1 - (1 - pLance) * (1 - pSorteio);
      const pMultiplas = 1 - Math.pow(1 - pIndividual, numCartas);
      dados.push({
        mes: m,
        individual: +(pIndividual * 100).toFixed(1),
        multiplas: +(pMultiplas * 100).toFixed(1),
      });
    }
    return dados;
  }, [prazo, isCarro, valorLanceTotal, valorBem, numCartas]);

  const mes50 =
    dadosProbabilidade.find((x) => (numCartas > 1 ? x.multiplas : x.individual) >= 50)?.mes ||
    Math.round(prazo / 2);
  const prob12 =
    numCartas > 1
      ? dadosProbabilidade[11]?.multiplas || 0
      : dadosProbabilidade[11]?.individual || 0;
  const prob36Idx = Math.min(35, prazo - 1);
  const prob36 =
    numCartas > 1
      ? dadosProbabilidade[prob36Idx]?.multiplas || 0
      : dadosProbabilidade[prob36Idx]?.individual || 0;
  const probIndividual12 = dadosProbabilidade[11]?.individual || 0;

  const pagoAteContemplacao = parcelaAtual * mes50;
  const saldoAposContemplacao = Math.max(
    0,
    saldoTotalPlano - pagoAteContemplacao - valorLanceTotal,
  );
  const mesesRestantes = Math.max(1, prazo - mes50);
  const parcelaPosContemplacao = saldoAposContemplacao / mesesRestantes;
  const diferencaPos = parcelaPosContemplacao - parcelaAtual;
  const parcelaPosAumentou = diferencaPos > 1;
  const parcelaPosDiminuiu = diferencaPos < -1;
  const mostrarParcelaPos = temLance || temRedutor;

  const orcamentoTotal = aluguelAtual + invMensal;
  const sobraConsorcio = orcamentoTotal - parcelaAtual;
  const orcamentoInsuficiente = sobraConsorcio < 0;

  const dadosEvolucao = useMemo(() => {
    if (prazo <= 0 || objetivo !== "sair-aluguel") return [];
    const anos = Math.ceil(prazo / 12);
    const pontos: {
      ano: number;
      "Com consórcio": number;
      "Continuar no aluguel": number;
    }[] = [];
    for (let a = 0; a <= anos; a++) {
      const meses = Math.min(a * 12, prazo);
      const patAluguel =
        invMensal > 0 && meses > 0
          ? invMensal * ((Math.pow(1 + cdiMensalProj, meses) - 1) / cdiMensalProj)
          : 0;
      let patConsorcio = 0;
      if (meses >= mes50 && mes50 > 0) patConsorcio = valorBem * Math.pow(1 + VALORIZACAO_IMOVEL, a);
      if (sobraConsorcio > 0 && meses > 0) {
        patConsorcio +=
          sobraConsorcio * ((Math.pow(1 + cdiMensalProj, meses) - 1) / cdiMensalProj);
      }
      pontos.push({
        ano: a,
        "Com consórcio": Math.round(patConsorcio),
        "Continuar no aluguel": Math.round(patAluguel),
      });
    }
    return pontos;
  }, [prazo, mes50, invMensal, valorBem, cdiMensalProj, objetivo, sobraConsorcio]);

  const patFimAluguel = dadosEvolucao[dadosEvolucao.length - 1]?.["Continuar no aluguel"] || 0;
  const patFimConsorcio = dadosEvolucao[dadosEvolucao.length - 1]?.["Com consórcio"] || 0;
  const diferencaPat = patFimConsorcio - patFimAluguel;

  const dadosEvolucaoRenda = useMemo(() => {
    if (prazo <= 0 || objetivo !== "renda") return [];
    const anos = Math.ceil(prazo / 12);
    const pontos: {
      ano: number;
      "Valor do imóvel": number;
      "Aluguéis investidos": number;
      "Investimento próprio": number;
    }[] = [];
    for (let a = 0; a <= anos; a++) {
      const meses = Math.min(a * 12, prazo);
      let valorImovel = 0;
      let rendaAcumulada = 0;
      let invProprio = 0;
      if (meses >= mes50) {
        valorImovel = valorBem * Math.pow(1 + VALORIZACAO_IMOVEL, a);
        const mesesAlugando = meses - mes50;
        rendaAcumulada =
          mesesAlugando > 0
            ? aluguelEsperado * ((Math.pow(1 + cdiMensalProj, mesesAlugando) - 1) / cdiMensalProj)
            : 0;
      }
      if (invMensalRenda > 0 && meses > 0) {
        invProprio = invMensalRenda * ((Math.pow(1 + cdiMensalProj, meses) - 1) / cdiMensalProj);
      }
      pontos.push({
        ano: a,
        "Valor do imóvel": Math.round(valorImovel),
        "Aluguéis investidos": Math.round(rendaAcumulada),
        "Investimento próprio": Math.round(invProprio),
      });
    }
    return pontos;
  }, [prazo, mes50, aluguelEsperado, valorBem, cdiMensalProj, objetivo, invMensalRenda]);

  const yieldAluguel =
    aluguelEsperado > 0 && parcelaAtual > 0 ? (aluguelEsperado / parcelaAtual) * 100 : 0;
  const faturamentoRestante = faturamentoEsperado - parcelaAtual;

  const prazosBem = isCarro ? [36, 48, 60, 72, 80] : [120, 150, 180, 200, 240];
  const minValor = isCarro ? 30000 : 100000;
  const maxValor = isCarro ? 300000 : 2000000;
  const stepValor = isCarro ? 5000 : 25000;

  const objetivos: Record<"imovel" | "carro", ObjetivoOpt[]> = {
    imovel: [
      {
        id: "sair-aluguel",
        nome: "Sair do aluguel",
        desc: "Parar de pagar aluguel e conquistar o primeiro imóvel",
        icone: Key,
      },
      {
        id: "trocar",
        nome: "Trocar de imóvel",
        desc: "Upgrade: maior, melhor localização ou novo padrão",
        icone: Building2,
      },
      {
        id: "renda",
        nome: "Ter renda de aluguel",
        desc: "Investir em imóvel para alugar e gerar renda passiva",
        icone: TrendingUp,
      },
    ],
    carro: [
      {
        id: "primeiro-trocar",
        nome: "Primeiro carro ou trocar",
        desc: "Conquistar ou substituir seu veículo pessoal",
        icone: Car,
      },
      {
        id: "trabalhar",
        nome: "Trabalhar com o carro",
        desc: "App, frota, entregas — gerar renda com o veículo",
        icone: Briefcase,
      },
    ],
  };

  const handleLeadSubmit = () => {
    setLeadErro(null);
    startLeadTransition(async () => {
      const result = await submitConsorcioLead({
        name: leadNome,
        phone: leadTel,
        tipoBem: tipoBem ?? null,
        objetivo: objetivo ?? null,
        valorCarta: valorBem || null,
        prazoMeses: prazo || null,
        parcela: parcelaNormal || null,
      });
      if (result.ok) {
        setLeadEnviado(true);
      } else {
        setLeadErro(result.error);
      }
    });
  };
  const reset = () => {
    setStep(0);
    setTipoBem(null);
    setObjetivo(null);
    setLeadEnviado(false);
    setLeadNome("");
    setLeadTel("");
    setLeadErro(null);
  };

  const toggleStyle = (active: boolean) => ({
    backgroundColor: active ? C.blue : "#cbd5e1",
    transition: "background-color 0.2s",
  });
  const toggleHandleStyle = (active: boolean) => ({
    transform: active ? "translateX(20px)" : "translateX(2px)",
    transition: "transform 0.2s",
  });
  const btnChip = (active: boolean) => ({
    backgroundColor: active ? C.blue : "#f1f5f9",
    color: active ? "#ffffff" : "#475569",
    transition: "all 0.15s",
  });

  if (step === 0) {
    return (
      <div className="px-4 py-6 md:px-8">
        <Link
          href="/simuladores"
          className="text-xs font-semibold text-[#132960] hover:underline"
        >
          {"<-"} Voltar para Simuladores
        </Link>
        <div className="mx-auto max-w-5xl px-2 py-10 md:py-16" style={{ color: C.dark }}>
          <div className="mb-10 text-center">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
              style={{ backgroundColor: C.blueBg, color: C.blue }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Simulador de Consórcio
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-[1.1]">
              Conquiste seu bem <span style={{ color: C.blue }}>sem pagar juros</span>.
            </h1>
            <p className="text-base md:text-lg max-w-2xl mx-auto text-slate-600">
              Simule em segundos, compare com financiamento e descubra o caminho mais inteligente
              para seu próximo imóvel ou carro.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-10">
            {[
              {
                tipo: "imovel" as const,
                icone: Home,
                nome: "Imóvel",
                desc: "Casa, apartamento, terreno ou comercial",
              },
              {
                tipo: "carro" as const,
                icone: Car,
                nome: "Carro",
                desc: "Veículo novo, seminovo ou moto",
              },
            ].map((o) => {
              const Ico = o.icone;
              return (
                <button
                  key={o.tipo}
                  onClick={() => {
                    applyDefaultsForTipo(o.tipo);
                    setTipoBem(o.tipo);
                    setStep(1);
                  }}
                  className="group rounded-2xl p-8 text-left transition-all"
                  style={{ backgroundColor: "#ffffff", border: `1px solid #e2e8f0` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.blue;
                    e.currentTarget.style.boxShadow = "0 10px 25px -10px rgba(2,125,252,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: C.blueBg }}
                  >
                    <Ico className="w-6 h-6" strokeWidth={2} style={{ color: C.blue }} />
                  </div>
                  <div className="text-2xl font-bold mb-1" style={{ color: C.dark }}>
                    {o.nome}
                  </div>
                  <div className="mb-6 text-sm text-slate-500">{o.desc}</div>
                  <div
                    className="flex items-center gap-2 font-semibold text-sm"
                    style={{ color: C.blue }}
                  >
                    Começar{" "}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
          >
            <div className="text-xs uppercase tracking-wider mb-3 text-center font-semibold text-slate-500">
              Trabalhamos com todas as principais administradoras
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ADMS.map((a) => (
                <div
                  key={a}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                  }}
                >
                  {a}
                </div>
              ))}
            </div>
            <div className="text-center text-xs mt-3 text-slate-500">
              Sem preferência comercial — comparamos e indicamos a melhor opção pro seu perfil.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1 && tipoBem) {
    const opts = objetivos[tipoBem];
    return (
      <div className="px-4 py-6 md:px-8" style={{ color: C.dark }}>
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => setStep(0)}
            className="inline-flex items-center gap-2 mb-8 text-sm transition-colors"
            style={{ color: "#64748b" }}
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="mb-8">
            <div className="text-xs font-semibold text-slate-500 mb-2">PASSO 2 DE 3</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Qual é o seu <span style={{ color: C.blue }}>objetivo</span>?
            </h2>
            <p className="text-slate-600">Isso direciona a análise que vamos fazer pra você.</p>
          </div>
          <div className="space-y-3">
            {opts.map((o) => {
              const Ico = o.icone;
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    setObjetivo(o.id);
                    setStep(2);
                  }}
                  className="group w-full rounded-2xl p-5 transition-all text-left flex items-center gap-4"
                  style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.blue;
                    e.currentTarget.style.boxShadow = "0 4px 12px -4px rgba(2,125,252,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: C.blueBg }}
                  >
                    <Ico className="w-6 h-6" strokeWidth={2} style={{ color: C.blue }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold mb-0.5">{o.nome}</div>
                    <div className="text-sm text-slate-500">{o.desc}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 shrink-0 text-slate-400 group-hover:translate-x-1 transition-all" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f1f5f9", color: C.dark }}>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: "#64748b" }}
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <button onClick={reset} className="text-sm" style={{ color: "#64748b" }}>
            Recomeçar
          </button>
        </div>

        <div className="mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", color: "#475569" }}
          >
            {isImovel ? <Home className="w-3 h-3" /> : <Car className="w-3 h-3" />}
            {isImovel ? "Imóvel" : "Carro"} •{" "}
            {tipoBem ? objetivos[tipoBem].find((o) => o.id === objetivo)?.nome : ""}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Monte sua simulação</h1>
          <p className="mt-1 text-slate-600">
            Use os controles ou digite os valores diretamente. Atualiza em tempo real.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 md:p-6 mb-5"
          style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Valor do {isImovel ? "imóvel" : "veículo"}
                </label>
                <NumField
                  value={valorBem}
                  onChange={setValorBem}
                  min={minValor}
                  max={maxValor}
                  prefix="R$"
                  width="w-32"
                />
              </div>
              <input
                type="range"
                min={minValor}
                max={maxValor}
                step={stepValor}
                value={valorBem}
                onChange={(e) => setValorBem(+e.target.value)}
                className="w-full cursor-pointer"
                style={{ accentColor: C.blue }}
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>{fmt(minValor)}</span>
                <span>{fmt(maxValor)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-medium text-slate-700">Prazo</label>
                <NumField
                  value={prazo}
                  onChange={setPrazo}
                  min={12}
                  max={isCarro ? 80 : 240}
                  suffix="meses"
                  width="w-16"
                />
              </div>
              <div className="flex gap-1.5">
                {prazosBem.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrazo(p)}
                    style={btnChip(prazo === p)}
                    className="flex-1 py-2 rounded-lg text-xs md:text-sm font-medium"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{(prazo / 12).toFixed(1)} anos</div>
            </div>

            {objetivo === "sair-aluguel" && (
              <>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Aluguel que você paga hoje
                    </label>
                    <NumField
                      value={aluguelAtual}
                      onChange={setAluguelAtual}
                      min={0}
                      max={50000}
                      prefix="R$"
                      suffix="/mês"
                      width="w-24"
                      size="text-lg"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={15000}
                    step={50}
                    value={Math.min(aluguelAtual, 15000)}
                    onChange={(e) => setAluguelAtual(+e.target.value)}
                    className="w-full cursor-pointer"
                    style={{ accentColor: C.blue }}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Investimento mensal disponível
                    </label>
                    <NumField
                      value={invMensal}
                      onChange={setInvMensal}
                      min={0}
                      max={100000}
                      prefix="R$"
                      suffix="/mês"
                      width="w-24"
                      size="text-lg"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10000}
                    step={50}
                    value={Math.min(invMensal, 10000)}
                    onChange={(e) => setInvMensal(+e.target.value)}
                    className="w-full cursor-pointer"
                    style={{ accentColor: C.blue }}
                  />
                  <div className="text-[11px] text-slate-400 mt-1">
                    Quanto você consegue poupar/investir além do aluguel
                  </div>
                </div>
              </>
            )}
            {objetivo === "renda" && (
              <>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Aluguel esperado do imóvel
                    </label>
                    <NumField
                      value={aluguelEsperado}
                      onChange={setAluguelEsperado}
                      min={0}
                      max={50000}
                      prefix="R$"
                      suffix="/mês"
                      width="w-24"
                      size="text-lg"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={50}
                    value={Math.min(aluguelEsperado, 20000)}
                    onChange={(e) => setAluguelEsperado(+e.target.value)}
                    className="w-full cursor-pointer"
                    style={{ accentColor: C.blue }}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Investimento mensal disponível
                    </label>
                    <NumField
                      value={invMensalRenda}
                      onChange={setInvMensalRenda}
                      min={0}
                      max={100000}
                      prefix="R$"
                      suffix="/mês"
                      width="w-24"
                      size="text-lg"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={15000}
                    step={50}
                    value={Math.min(invMensalRenda, 15000)}
                    onChange={(e) => setInvMensalRenda(+e.target.value)}
                    className="w-full cursor-pointer"
                    style={{ accentColor: C.blue }}
                  />
                  <div className="text-[11px] text-slate-400 mt-1">
                    Quanto você aporta além da parcela
                  </div>
                </div>
              </>
            )}
            {objetivo === "trabalhar" && (
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Faturamento mensal esperado
                  </label>
                  <NumField
                    value={faturamentoEsperado}
                    onChange={setFaturamentoEsperado}
                    min={0}
                    max={50000}
                    prefix="R$"
                    suffix="/mês"
                    width="w-24"
                    size="text-lg"
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={15000}
                  step={50}
                  value={Math.min(faturamentoEsperado, 15000)}
                  onChange={(e) => setFaturamentoEsperado(+e.target.value)}
                  className="w-full cursor-pointer"
                  style={{ accentColor: C.blue }}
                />
              </div>
            )}
          </div>

          <div className="mt-6 pt-6" style={{ borderTop: "1px solid #e2e8f0" }}>
            <div className="mb-4">
              <div className="text-sm font-semibold" style={{ color: C.dark }}>
                Lance
              </div>
              <div className="text-xs text-slate-500">
                Ative um ou ambos — somam pra acelerar a contemplação
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div
                className="rounded-xl p-4 transition-all"
                style={{
                  backgroundColor: lanceProprioAtivo ? C.blueBgSoft : "#f8fafc",
                  border: lanceProprioAtivo ? `1px solid ${C.blue}` : "1px solid #e2e8f0",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.dark }}>
                      Recursos próprios
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Dinheiro que você tem pra lance
                    </div>
                  </div>
                  <button
                    onClick={() => setLanceProprioAtivo(!lanceProprioAtivo)}
                    className="relative w-11 h-6 rounded-full shrink-0"
                    style={toggleStyle(lanceProprioAtivo)}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full"
                      style={toggleHandleStyle(lanceProprioAtivo)}
                    />
                  </button>
                </div>
                {lanceProprioAtivo && (
                  <div className="mt-3">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs text-slate-600">Valor total</label>
                      <NumField
                        value={valorLance}
                        onChange={setValorLance}
                        min={0}
                        max={Math.round(valorBem * 0.6)}
                        prefix="R$"
                        width="w-24"
                        size="text-base"
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.round(valorBem * 0.6)}
                      step={isCarro ? 500 : 1000}
                      value={Math.min(valorLance, Math.round(valorBem * 0.6))}
                      onChange={(e) => setValorLance(+e.target.value)}
                      className="w-full cursor-pointer"
                      style={{ accentColor: C.blue }}
                    />
                    <div className="text-[11px] text-slate-500 mt-1.5">
                      {valorBem > 0 ? ((valorLance / valorBem) * 100).toFixed(1) : 0}% da carta •
                      médio vencedor ~{isCarro ? 40 : 30}%
                    </div>
                    {numCartas > 1 && (
                      <div
                        className="text-[10px] mt-1.5 px-2 py-1 rounded"
                        style={{ backgroundColor: "#fff", color: "#64748b" }}
                      >
                        Dividido em {numCartas} cartas: {fmt(lanceProprioPorCarta)} por carta
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                className="rounded-xl p-4 transition-all"
                style={{
                  backgroundColor: lanceEmbutidoAtivo ? C.blueBgSoft : "#f8fafc",
                  border: lanceEmbutidoAtivo ? `1px solid ${C.blue}` : "1px solid #e2e8f0",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: C.dark }}>
                      Lance embutido
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Desconta da carta, sem usar dinheiro
                    </div>
                  </div>
                  <button
                    onClick={() => setLanceEmbutidoAtivo(!lanceEmbutidoAtivo)}
                    className="relative w-11 h-6 rounded-full shrink-0"
                    style={toggleStyle(lanceEmbutidoAtivo)}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full"
                      style={toggleHandleStyle(lanceEmbutidoAtivo)}
                    />
                  </button>
                </div>
                {lanceEmbutidoAtivo && (
                  <div className="mt-3">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs text-slate-600">Percentual</label>
                      <NumField
                        value={embutidoPerc}
                        onChange={setEmbutidoPerc}
                        min={1}
                        max={30}
                        suffix="%"
                        width="w-14"
                        size="text-base"
                      />
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={embutidoPerc}
                      onChange={(e) => setEmbutidoPerc(+e.target.value)}
                      className="w-full cursor-pointer"
                      style={{ accentColor: C.blue }}
                    />
                    <div
                      className="mt-2 flex items-start gap-1.5 text-[11px]"
                      style={{ color: C.orangeDark }}
                    >
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>
                        Crédito líquido: <strong>{fmt(creditoLiquido)}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {temLance && (
              <div
                className="mt-3 px-4 py-2.5 rounded-lg text-sm"
                style={{
                  backgroundColor: C.blueBgSoft,
                  border: `1px solid ${C.blueBg}`,
                  color: "#334155",
                }}
              >
                Lance total ativo:{" "}
                <strong style={{ color: C.blue }}>{fmt(valorLanceTotal)}</strong>
                {numCartas > 1 && (
                  <span className="text-slate-500"> ({fmt(lanceTotalPorCarta)} por carta)</span>
                )}
                {lanceProprioAtivo && lanceEmbutidoAtivo && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {fmt(valorLanceProprio)} próprio + {fmt(valorLanceEmbutido)} embutido
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-6" style={{ borderTop: "1px solid #e2e8f0" }}>
            <div className="mb-3">
              <div className="text-sm font-semibold" style={{ color: C.dark }}>
                Índice de correção anual
              </div>
              <div className="text-xs text-slate-500">
                Ajusta carta e parcela todo ano — varia por administradora
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              {[
                { id: "incc", label: "INCC", taxa: "~7%" },
                { id: "igpm", label: "IGPM", taxa: "~5%" },
                { id: "ipca", label: "IPCA", taxa: "~4,5%" },
                { id: "pre3", label: "Pré 3%", taxa: "fixa" },
              ].map((i) => (
                <button
                  key={i.id}
                  onClick={() => setIndiceCorrecao(i.id)}
                  style={btnChip(indiceCorrecao === i.id)}
                  className="py-2 px-1 rounded-lg text-xs font-medium flex flex-col items-center"
                >
                  <span className="font-bold text-sm">{i.label}</span>
                  <span className="text-[10px] opacity-80">{i.taxa}</span>
                </button>
              ))}
            </div>

            <div>
              <div className="text-sm font-semibold mb-2" style={{ color: C.dark }}>
                Redutor de parcela
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "nenhum", label: "Sem redutor" },
                    { id: "25", label: "Redutor 25%" },
                    { id: "50", label: "Redutor 50%" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRedutor(r.id)}
                    style={btnChip(redutor === r.id)}
                    className="py-2.5 px-2 rounded-lg text-xs md:text-sm font-medium"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] mt-2 text-slate-500">
                Reduz parcela até a contemplação. Depois, saldo restante é recalculado — sem
                lance, parcela volta a subir.
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6" style={{ borderTop: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-sm font-semibold flex items-center gap-2"
                  style={{ color: C.dark }}
                >
                  <Layers className="w-4 h-4" style={{ color: C.blue }} />
                  Quero aumentar as chances de contemplação
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Divide sua carta em cotas menores — aumenta a chance de contemplar ao menos uma
                  cedo
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (aumentarChances) {
                    setAumentarChances(false);
                    setNumCartas(1);
                  } else {
                    setAumentarChances(true);
                    setNumCartas((n) => (n <= 1 ? 2 : n));
                  }
                }}
                className="relative w-11 h-6 rounded-full shrink-0"
                style={toggleStyle(aumentarChances)}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full"
                  style={toggleHandleStyle(aumentarChances)}
                />
              </button>
            </div>

            {aumentarChances && (
              <div
                className="mt-4 rounded-xl p-4"
                style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <div className="text-xs mb-3 text-slate-600">
                  {numCartas} cartas de <strong>{fmt(valorPorCarta)}</strong> cada (soma:{" "}
                  {fmt(valorBem)})
                  {temLance && <span> • lance de {fmt(lanceTotalPorCarta)} por carta</span>}
                </div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs text-slate-600">Número de cartas</label>
                  <div className="text-base font-bold tabular-nums" style={{ color: C.blue }}>
                    {numCartas}
                  </div>
                </div>
                <input
                  type="range"
                  min={2}
                  max={5}
                  step={1}
                  value={numCartas}
                  onChange={(e) => setNumCartas(+e.target.value)}
                  className="w-full cursor-pointer"
                  style={{ accentColor: C.blue }}
                />
                <div className="flex justify-between text-[10px] mt-0.5 text-slate-400">
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6" style={{ borderTop: "1px solid #e2e8f0" }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm"
              style={{ color: "#475569" }}
            >
              <Settings className="w-4 h-4" />
              Ajustar taxa da administradora
            </button>
            {showAdvanced && (
              <div
                className="rounded-xl p-4 mt-4"
                style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Taxa de administração total
                  </label>
                  <div className="text-lg font-bold tabular-nums" style={{ color: C.blue }}>
                    {(taxaAdm * 100).toFixed(1)}%
                  </div>
                </div>
                <input
                  type="range"
                  min={0.18}
                  max={0.25}
                  step={0.005}
                  value={taxaAdm}
                  onChange={(e) => setTaxaAdmCustom(+e.target.value)}
                  className="w-full cursor-pointer"
                  style={{ accentColor: C.blue }}
                />
                <div className="text-[11px] text-slate-500 mt-1.5">
                  Varia de 18% a 25% conforme administradora
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl p-6 md:p-8 mb-5 relative overflow-hidden"
          style={{ backgroundColor: C.dark, color: "#ffffff" }}
        >
          <div
            className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none"
            style={{ backgroundColor: "rgba(255,87,19,0.15)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#94a3b8" }}
              >
                {temRedutor ? `Parcela inicial (com redutor ${redutor}%)` : "Sua parcela mensal"}
              </div>
              {temRedutor && (
                <div
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: "rgba(2,125,252,0.25)", color: "#93c5fd" }}
                >
                  -{redutor}%
                </div>
              )}
              {numCartas > 1 && (
                <div
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: "rgba(2,125,252,0.25)", color: "#93c5fd" }}
                >
                  {numCartas}× cartas
                </div>
              )}
            </div>
            <div
              className="text-5xl md:text-6xl font-bold tabular-nums mb-2 leading-none"
              style={{ color: C.orange }}
            >
              {numCartas > 1
                ? `${numCartas}× ${fmtCents(parcelaAtual / numCartas)}`
                : fmtCents(parcelaAtual)}
            </div>
            <div
              className="text-sm mb-6 flex items-center gap-1.5"
              style={{ color: "#94a3b8" }}
            >
              <Info className="w-3 h-3" />
              Corrigida anualmente pelo {nomeIndice}
              {numCartas > 1 && ` • Soma: ${fmtCents(parcelaAtual)}/mês`}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs" style={{ color: "#94a3b8" }}>
                  Carta de crédito
                </div>
                <div
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: "#ffffff" }}
                >
                  {numCartas > 1 ? `${numCartas}× ${fmt(valorPorCarta)}` : fmt(valorBem)}
                </div>
              </div>
              {lanceEmbutidoAtivo ? (
                <div>
                  <div className="text-xs" style={{ color: "#94a3b8" }}>
                    Você recebe
                  </div>
                  <div
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: C.orange }}
                  >
                    {fmt(creditoLiquido)}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs" style={{ color: "#94a3b8" }}>
                    Prazo
                  </div>
                  <div
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: "#ffffff" }}
                  >
                    {prazo} meses
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs" style={{ color: "#94a3b8" }}>
                  Taxa adm + FR
                </div>
                <div
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: "#ffffff" }}
                >
                  {((taxaAdm + fundoReserva) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {mostrarParcelaPos && (
          <div
            className="rounded-2xl p-5 md:p-6 mb-5"
            style={{
              backgroundColor: "#ffffff",
              border: `1px solid ${parcelaPosAumentou ? "#fed7aa" : "#bfdbfe"}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {parcelaPosAumentou ? (
                <TrendingUp className="w-4 h-4" style={{ color: C.orange }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: C.blue }} />
              )}
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                {parcelaPosAumentou ? "Atenção: parcela sobe" : "Efeito do lance"}
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
              Parcela após a contemplação
            </h3>
            <p className="text-sm mb-5 text-slate-600">
              Considerando contemplação no mês {mes50}: saldo restante (
              {fmt(saldoAposContemplacao)}) ÷ {mesesRestantes} meses.
              {parcelaPosAumentou &&
                temRedutor &&
                !temLance &&
                " Você pagou menos nos primeiros meses com o redutor — o saldo restante eleva a parcela depois."}
              {parcelaPosDiminuiu &&
                temLance &&
                " Você antecipou parte do custo com o lance — por isso a parcela fica menor."}
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  Antes da contemplação
                </div>
                <div
                  className="text-xl md:text-2xl font-bold tabular-nums mb-0.5"
                  style={{ color: C.dark }}
                >
                  {fmtCents(parcelaAtual)}
                </div>
                <div className="text-[11px] text-slate-500">Por {mes50} meses</div>
              </div>
              <div
                className="rounded-xl p-4"
                style={{
                  backgroundColor: parcelaPosAumentou ? C.orangeBgSoft : C.blueBgSoft,
                  border: `1px solid ${parcelaPosAumentou ? "#fed7aa" : "#bfdbfe"}`,
                }}
              >
                <div
                  className="text-[11px] uppercase tracking-wider mb-1 font-semibold"
                  style={{ color: parcelaPosAumentou ? C.orange : C.blue }}
                >
                  Depois da contemplação
                </div>
                <div
                  className="text-xl md:text-2xl font-bold tabular-nums mb-0.5"
                  style={{ color: parcelaPosAumentou ? C.orange : C.blue }}
                >
                  {fmtCents(parcelaPosContemplacao)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Por {mesesRestantes} meses restantes
                </div>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: parcelaPosAumentou ? C.orangeBg : C.blueBgSoft }}
              >
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  {parcelaPosAumentou ? "Acréscimo mensal" : "Redução da parcela"}
                </div>
                <div
                  className="text-xl md:text-2xl font-bold tabular-nums mb-0.5"
                  style={{ color: parcelaPosAumentou ? C.orange : C.blue }}
                >
                  {diferencaPos > 0 ? "+" : ""}
                  {fmtCents(diferencaPos)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {parcelaAtual > 0
                    ? `${((Math.abs(diferencaPos) / parcelaAtual) * 100).toFixed(0)}%`
                    : ""}{" "}
                  {parcelaPosAumentou ? "a mais" : "a menos"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="rounded-2xl p-5 md:p-6 mb-5"
          style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" style={{ color: C.blue }} />
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Contemplação
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
            Quando você deve ser contemplado
          </h3>
          <p className="text-sm mb-5 text-slate-600">
            Todo cotista é contemplado até o fim do prazo. O que muda é{" "}
            <strong style={{ color: C.dark }}>quando</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {[
              {
                label: "Mês da virada (50%)",
                valor: `${mes50}º`,
                sub: `≈ ${(mes50 / 12).toFixed(1)} anos`,
              },
              { label: "Chance em 12 meses", valor: `${prob12.toFixed(0)}%`, sub: "Primeiro ano" },
              {
                label: "Chance em 36 meses",
                valor: `${prob36.toFixed(0)}%`,
                sub: "Primeiros 3 anos",
              },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  {c.label}
                </div>
                <div
                  className="text-2xl md:text-3xl font-bold tabular-nums"
                  style={{ color: C.blue }}
                >
                  {c.valor}
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">{c.sub}</div>
              </div>
            ))}
          </div>

          <ChartLegend
            items={[
              {
                color: C.blue,
                label: numCartas > 1 ? "Ao menos 1 carta contemplada" : "Probabilidade acumulada",
              },
              ...(numCartas > 1 ? [{ color: "#94a3b8", label: "Por carta individual" }] : []),
            ]}
          />

          <div
            className="rounded-xl p-3 md:p-4 h-64 md:h-72"
            style={{ backgroundColor: "#f8fafc" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosProbabilidade} margin={{ top: 25, right: 15, left: 0, bottom: 30 }}>
                <defs>
                  <linearGradient id="colorMult" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.blue} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="mes"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{
                    value: "Mês",
                    position: "insideBottom",
                    offset: -5,
                    fill: "#94a3b8",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                  formatter={(v, name) => [
                    `${v}%`,
                    name === "individual"
                      ? numCartas > 1
                        ? "Por carta"
                        : "Probabilidade"
                      : "Ao menos 1 carta",
                  ]}
                  labelFormatter={(v) => `Mês ${v}`}
                />
                {numCartas > 1 && (
                  <Area
                    type="monotone"
                    dataKey="individual"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#colorInd)"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={numCartas > 1 ? "multiplas" : "individual"}
                  stroke={C.blue}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMult)"
                />
                {mes50 > 0 && mes50 < prazo && (
                  <ReferenceLine
                    x={mes50}
                    stroke={C.blue}
                    strokeDasharray="3 3"
                    label={{
                      value: `50% • mês ${mes50}`,
                      fill: C.blue,
                      fontSize: 11,
                      position: "insideTopRight",
                      offset: 8,
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {numCartas > 1 && (
            <div
              className="mt-3 p-3 rounded-lg flex items-start gap-2"
              style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}
            >
              <Layers className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.blue }} />
              <div className="text-sm" style={{ color: "#334155" }}>
                Com <strong>{numCartas} cartas</strong>, chance de contemplar ao menos uma em 12
                meses sobe pra <strong style={{ color: C.blue }}>{prob12.toFixed(0)}%</strong>{" "}
                (vs. {probIndividual12.toFixed(0)}% com carta única).
              </div>
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-5 md:p-6 mb-5"
          style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: C.orange }} />
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Comparativo
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
            Consórcio vs. Financiamento
          </h3>
          <p className="text-sm mb-5 text-slate-600">
            Financiamento com entrada de 20% ({fmt(entradaFinan)}) e taxa{" "}
            {(taxaFinanAnual * 100).toFixed(1)}% a.a.
          </p>

          <div
            className="rounded-xl p-5 mb-4"
            style={{
              background: `linear-gradient(135deg, ${C.blueBgSoft} 0%, ${C.blueBg} 100%)`,
              border: `1px solid ${C.blue}40`,
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.blue }} />
                  <div className="text-xs font-bold tracking-wider" style={{ color: C.blue }}>
                    SEU CONSÓRCIO
                  </div>
                </div>
                <div className="text-xs mb-2" style={{ color: "#475569" }}>
                  {prazo} meses • Taxa adm {(taxaAdm * 100).toFixed(1)}% • {nomeIndice} •{" "}
                  <span className="font-semibold" style={{ color: C.blue }}>
                    Sem juros
                  </span>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-[11px] text-slate-500">Parcela</div>
                  <div
                    className="text-xl md:text-2xl font-bold tabular-nums"
                    style={{ color: C.dark }}
                  >
                    {fmtCents(parcelaAtual)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Custo total</div>
                  <div
                    className="text-xl md:text-2xl font-bold tabular-nums"
                    style={{ color: C.dark }}
                  >
                    {fmt(custoTotalConsorcio)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
            {cenariosFinan.map((c, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                  <div className="text-[10px] font-bold tracking-wider text-slate-500">
                    {c.tipo.toUpperCase()} {c.prazoM}M
                  </div>
                </div>
                <div className="mb-2">
                  <div className="text-[10px] text-slate-500">
                    Parcela{c.tipo === "SAC" ? " inicial" : ""}
                  </div>
                  <div className="text-lg font-bold tabular-nums" style={{ color: "#334155" }}>
                    {fmtCents(c.tipo === "Price" ? c.parcela : c.parcInicial)}
                  </div>
                  {c.tipo === "SAC" && (
                    <div className="text-[10px] text-slate-500">→ {fmtCents(c.parcFinal)} fim</div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Custo total</div>
                  <div className="text-sm font-semibold tabular-nums" style={{ color: "#334155" }}>
                    {fmt(c.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {economiaVsMelhor > 0 && (
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ backgroundColor: C.orangeBg, border: `1px solid #fed7aa` }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(255,87,19,0.15)" }}
              >
                <TrendingUp className="w-5 h-5" style={{ color: C.orange }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-600">
                  Economia vs. {melhorFinan.tipo} {melhorFinan.prazoM}m (mais barato entre os 4)
                </div>
                <div
                  className="text-xl md:text-2xl font-bold tabular-nums"
                  style={{ color: C.orange }}
                >
                  {fmt(economiaVsMelhor)}
                </div>
              </div>
            </div>
          )}
        </div>

        {objetivo === "sair-aluguel" && dadosEvolucao.length > 0 && (
          <div
            className="rounded-2xl p-5 md:p-6 mb-5"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4" style={{ color: C.blue }} />
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Evolução patrimonial
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
              Consórcio vs. Continuar no aluguel
            </h3>
            <p className="text-sm mb-4 text-slate-600">
              Mesmo orçamento mensal ({fmt(orcamentoTotal)}: {fmt(aluguelAtual)} aluguel +{" "}
              {fmt(invMensal)} investimento).
              {sobraConsorcio > 0 && ` No consórcio, sobra ${fmt(sobraConsorcio)}/mês pra investir.`}
              {orcamentoInsuficiente && (
                <span style={{ color: C.orange, fontWeight: 500 }}>
                  {" "}
                  A parcela ({fmt(parcelaAtual)}) excede seu orçamento.
                </span>
              )}
            </p>

            <ChartLegend
              items={[
                { color: C.blue, label: "Com consórcio" },
                { color: "#94a3b8", label: "Continuar no aluguel" },
              ]}
            />

            <div
              className="rounded-xl p-3 md:p-4 h-72 md:h-80 mb-3"
              style={{ backgroundColor: "#f8fafc" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="ano"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{
                      value: "Anos",
                      position: "insideBottom",
                      offset: -5,
                      fill: "#94a3b8",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={fmtCompact}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                    formatter={(v) => fmt(Number(v))}
                    labelFormatter={(v) => `Ano ${v}`}
                  />
                  <Bar dataKey="Com consórcio" fill={C.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Continuar no aluguel" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-3 gap-2.5">
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}
              >
                <div
                  className="text-[11px] uppercase tracking-wider mb-1 font-semibold"
                  style={{ color: C.blue }}
                >
                  Patrimônio — Consórcio
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.blue }}>
                  {fmt(patFimConsorcio)}
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">
                  Imóvel + sobras investidas
                </div>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "#f1f5f9", border: "1px solid #e2e8f0" }}
              >
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold text-slate-600">
                  Patrimônio — Aluguel
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: "#334155" }}>
                  {fmt(patFimAluguel)}
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">
                  Apenas investimento disponível
                </div>
              </div>
              <div
                className="rounded-xl p-4"
                style={{
                  backgroundColor: diferencaPat > 0 ? C.orangeBg : "#f1f5f9",
                  border: `1px solid ${diferencaPat > 0 ? "#fed7aa" : "#e2e8f0"}`,
                }}
              >
                <div className="text-[11px] uppercase tracking-wider mb-1 font-semibold text-slate-600">
                  Diferença
                </div>
                <div
                  className="text-xl font-bold tabular-nums"
                  style={{ color: diferencaPat > 0 ? C.orange : "#334155" }}
                >
                  {diferencaPat > 0 ? "+" : ""}
                  {fmt(diferencaPat)}
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">
                  {diferencaPat > 0 ? "A favor do consórcio" : "A favor do aluguel"}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] flex items-start gap-1.5 text-slate-500">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Projeções: valorização do imóvel <strong>5% a.a.</strong> (conservadora — oscila
                por região). CDI <strong>10% a.a.</strong> (média histórica). Valores brutos de
                IR.
              </span>
            </div>
          </div>
        )}

        {objetivo === "renda" && dadosEvolucaoRenda.length > 0 && (
          <div
            className="rounded-2xl p-5 md:p-6 mb-5"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4" style={{ color: C.blue }} />
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Construção de patrimônio
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
              Seu patrimônio ao longo do tempo
            </h3>
            <p className="text-sm mb-4 text-slate-600">
              Após contemplação (mês {mes50}), imóvel valoriza ~5% a.a. e aluguel recebido vai pra
              investimento.
            </p>

            <ChartLegend
              items={[
                { color: C.blue, label: "Valor do imóvel" },
                { color: C.orange, label: "Aluguéis investidos" },
                ...(invMensalRenda > 0 ? [{ color: "#64748b", label: "Investimento próprio" }] : []),
              ]}
            />

            <div
              className="rounded-xl p-3 md:p-4 h-72 md:h-80"
              style={{ backgroundColor: "#f8fafc" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosEvolucaoRenda}
                  margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="ano"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{
                      value: "Anos",
                      position: "insideBottom",
                      offset: -5,
                      fill: "#94a3b8",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={fmtCompact}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                    formatter={(v) => fmt(Number(v))}
                    labelFormatter={(v) => `Ano ${v}`}
                  />
                  <Bar dataKey="Valor do imóvel" stackId="a" fill={C.blue} />
                  <Bar dataKey="Aluguéis investidos" stackId="a" fill={C.orange} />
                  {invMensalRenda > 0 && (
                    <Bar
                      dataKey="Investimento próprio"
                      stackId="a"
                      fill="#64748b"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-2.5">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  Cobertura do aluguel
                </div>
                <div
                  className="text-xl font-bold tabular-nums"
                  style={{ color: yieldAluguel >= 100 ? C.blue : C.orange }}
                >
                  {yieldAluguel.toFixed(0)}%
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">Aluguel vs. parcela</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  Contemplação estimada
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.dark }}>
                  Mês {mes50}
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">Início da renda</div>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: C.blueBgSoft, border: `1px solid ${C.blueBg}` }}
              >
                <div
                  className="text-[11px] uppercase tracking-wider mb-1 font-semibold"
                  style={{ color: C.blue }}
                >
                  Patrimônio ao fim
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.blue }}>
                  {fmt(
                    (dadosEvolucaoRenda[dadosEvolucaoRenda.length - 1]?.["Valor do imóvel"] || 0) +
                      (dadosEvolucaoRenda[dadosEvolucaoRenda.length - 1]?.["Aluguéis investidos"] ||
                        0) +
                      (dadosEvolucaoRenda[dadosEvolucaoRenda.length - 1]?.["Investimento próprio"] ||
                        0),
                  )}
                </div>
                <div className="text-[11px] mt-0.5 text-slate-500">
                  Imóvel + aluguéis + invest.
                </div>
              </div>
            </div>
          </div>
        )}

        {objetivo === "trabalhar" && (
          <div
            className="rounded-2xl p-5 md:p-6 mb-5"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4" style={{ color: C.blue }} />
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Viabilidade como trabalho
              </div>
            </div>
            <h3 className="text-xl font-bold mb-4" style={{ color: C.dark }}>
              Quanto sobra depois da parcela
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  Faturamento bruto
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.dark }}>
                  {fmt(faturamentoEsperado)}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  Parcela do consórcio
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: C.orange }}>
                  - {fmt(parcelaAtual)}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f1f5f9" }}>
                <div className="text-[11px] uppercase tracking-wider mb-1 text-slate-500">
                  Sobra
                </div>
                <div
                  className="text-xl font-bold tabular-nums"
                  style={{ color: faturamentoRestante > 0 ? C.blue : "#ef4444" }}
                >
                  {fmt(faturamentoRestante)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Antes de combustível e manutenção
                </div>
              </div>
            </div>
          </div>
        )}

        {objetivo === "trocar" && (
          <div
            className="rounded-2xl p-5 md:p-6 mb-5"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
              Por que consórcio é eficiente pra upgrade
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Após contemplado, você pode usar o imóvel atual como parte do pagamento (dação) ou
              vendê-lo, evitando juros altos de financiamento num momento em que já tem patrimônio.
            </p>
          </div>
        )}

        {objetivo === "primeiro-trocar" && (
          <div
            className="rounded-2xl p-5 md:p-6 mb-5"
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: C.dark }}>
              Por que consórcio pra carro faz sentido
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Com taxas de financiamento de veículo acima de 25% a.a., o consórcio é dramaticamente
              mais barato no custo total. Lance acelera muito a conquista se você já tem recursos
              guardados.
            </p>
          </div>
        )}

        <div
          className="rounded-2xl p-6 md:p-8 mb-5"
          style={{ backgroundColor: C.orange, color: "#ffffff" }}
        >
          {leadEnviado ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <Check className="w-7 h-7" strokeWidth={3} style={{ color: "#ffffff" }} />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: "#ffffff" }}>
                Recebido, {leadNome.split(" ")[0]}!
              </h3>
              <p
                className="max-w-lg mx-auto text-sm md:text-base"
                style={{ color: "rgba(255,255,255,0.95)" }}
              >
                Em breve você recebe no WhatsApp as melhores cotações das administradoras.
              </p>
            </div>
          ) : (
            <>
              <h3
                className="text-2xl md:text-3xl font-bold mb-2 leading-tight"
                style={{ color: "#ffffff" }}
              >
                Quer essa simulação com cotações reais?
              </h3>
              <p
                className="mb-5 text-sm md:text-base"
                style={{ color: "rgba(255,255,255,0.95)" }}
              >
                Comparamos as administradoras que mais combinam com seu perfil — sem preferência
                comercial.
              </p>
              <div className="grid md:grid-cols-2 gap-2.5 mb-2.5">
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={leadNome}
                  onChange={(e) => setLeadNome(e.target.value)}
                  style={{ backgroundColor: "#ffffff", color: C.dark, border: "none" }}
                  className="rounded-lg px-4 py-3 focus:outline-none placeholder:text-slate-400"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (DDD + número)"
                  value={leadTel}
                  onChange={(e) => setLeadTel(e.target.value)}
                  style={{ backgroundColor: "#ffffff", color: C.dark, border: "none" }}
                  className="rounded-lg px-4 py-3 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={handleLeadSubmit}
                disabled={!leadNome || !leadTel || leadEnviando}
                style={{ backgroundColor: C.dark, color: "#ffffff" }}
                className="w-full font-bold py-3.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {leadEnviando ? "Enviando..." : "Receber cotações"}
                {leadEnviando ? null : <ArrowRight className="w-5 h-5" />}
              </button>
              {leadErro ? (
                <p
                  className="text-xs mt-2 text-center font-semibold"
                  style={{ color: "#FEE2E2" }}
                >
                  {leadErro}
                </p>
              ) : null}
              <p
                className="text-[11px] mt-3 text-center"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                Sem compromisso. Seus dados são usados apenas pra enviar as cotações.
              </p>
            </>
          )}
        </div>

        <div className="text-center text-[11px] pb-8 px-4 leading-relaxed text-slate-500">
          Simulação meramente ilustrativa. Valores reais variam por administradora, grupo, correção
          e perfil. Consórcio não garante contemplação antecipada.
          {selicStatus === "live" &&
            ` Selic atual ${(selicAnual * 100).toFixed(2)}% (BCB) — projeções usam CDI médio de 10% a.a.`}
        </div>
      </div>
    </div>
  );
}
