export const dynamic = "force-dynamic";

import { permanentRedirect } from "next/navigation";

export default function PainelInflacaoLegacyRedirect() {
  permanentRedirect("/painel-economico/economia/brasil/inflacao");
}
