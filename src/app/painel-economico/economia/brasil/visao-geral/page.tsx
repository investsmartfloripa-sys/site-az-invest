import { redirect } from "next/navigation";

// A Visão geral ainda não existe (fora do menu e do mapa do site); quem chega por link antigo vai ao Termômetro do ciclo.
export default function VisaoGeralBrasil() {
  redirect("/painel-economico/economia/brasil/termometro-ciclo");
}
