/* AZ Invest · Simuladores · configuração
   Edite este arquivo para atualizar as taxas que aparecem preenchidas nos simuladores e o convite final das páginas.
   Percentuais em pontos percentuais (13.75 = 13,75%). */
window.AZ = window.AZ || {};
window.AZ.cfg = {
  selic: 13.75,      // meta da Selic, % ao ano
  selicEfetiva: 13.65, // Selic efetiva (a que o Tesouro Selic rende), % ao ano
  cdi: 13.65,        // CDI, % ao ano
  ipca: 4.58,        // IPCA acumulado em 12 meses, %
  igpm: 3.35,        // IGP-M acumulado em 12 meses, %
  tr: 0.16,          // TR, % ao mês
  poupanca: 0.66,    // rendimento da poupança, % ao mês
  dolar: 5.08,       // dólar comercial, R$
  referencia: 'outubro de 2026',
  // Convite exibido no fim de cada página. Com url vazio, o botão abre o WhatsApp do rodapé. Para ocultar, deixe titulo vazio.
  cta: {
    titulo: 'Quer aplicar isso à sua carteira?',
    texto: 'Converse com a equipe da AZ Invest e receba uma análise feita para a sua realidade.',
    botao: 'Falar com um especialista',
    url: ''
  },
  // Identificação no rodapé. Campos vazios não aparecem. Para trocar o e-mail, acrescente: email: 'contato@seudominio.com.br'
  site: {
    razaoSocial: '',   // razão social completa
    cnpj: '',          // 00.000.000/0001-00
    regulatorio: ''    // texto de identificação regulatória, conforme orientação do compliance
  }
};
