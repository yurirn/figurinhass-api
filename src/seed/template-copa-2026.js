// Template do álbum Copa 2026 (catálogo limpo, sem progresso)
// Estrutura compatível com Prisma create nested

export const copa2026Template = {
  sections: [
    { key: "intro",    name: "Especiais - FWC",     count: 5,  start: 0, position: 1, isPostGroup: false },
    { key: "venues",   name: "Bola e Paises - FWC", count: 4,  start: 5, position: 2, isPostGroup: false },
    { key: "legends",  name: "Historia - FWC",      count: 11, start: 9, position: 3, isPostGroup: false },
    { key: "cocacola", name: "Coca-Cola - CC",      count: 14, start: 1, position: 100, isPostGroup: true },
  ],
  groups: [
    { letter: "A", position: 10, teams: [
      { name: "México - MEX", code: "MEX", count: 20, start: 1, position: 0 },
      { name: "África do Sul - RSA", code: "RSA", count: 20, start: 1, position: 1 },
      { name: "Coreia - KOR", code: "KOR", count: 20, start: 1, position: 2 },
      { name: "Chéquia - CZE", code: "CZE", count: 20, start: 1, position: 3 },
    ]},
    { letter: "B", position: 11, teams: [
      { name: "Canadá - CAN", code: "CAN", count: 20, start: 1, position: 0 },
      { name: "Bósnia e Herzegovina - BIH", code: "BIH", count: 20, start: 1, position: 1 },
      { name: "Catar - QAT", code: "QAT", count: 20, start: 1, position: 2 },
      { name: "Suíça - SUI", code: "SUI", count: 20, start: 1, position: 3 },
    ]},
    { letter: "C", position: 12, teams: [
      { name: "Brasil - BRA", code: "BRA", count: 20, start: 1, position: 0 },
      { name: "Marrocos - MAR", code: "MAR", count: 20, start: 1, position: 1 },
      { name: "Haiti - HAI", code: "HAI", count: 20, start: 1, position: 2 },
      { name: "Escócia - SCO", code: "SCO", count: 20, start: 1, position: 3 },
    ]},
    { letter: "D", position: 13, teams: [
      { name: "EUA - USA", code: "USA", count: 20, start: 1, position: 0 },
      { name: "Paraguai - PAR", code: "PAR", count: 20, start: 1, position: 1 },
      { name: "Austrália - AUS", code: "AUS", count: 20, start: 1, position: 2 },
      { name: "Turquia - TUR", code: "TUR", count: 20, start: 1, position: 3 },
    ]},
    { letter: "E", position: 14, teams: [
      { name: "Alemanha - GER", code: "GER", count: 20, start: 1, position: 0 },
      { name: "Curaçao - CUW", code: "CUW", count: 20, start: 1, position: 1 },
      { name: "Costa do Marfim - CIV", code: "CIV", count: 20, start: 1, position: 2 },
      { name: "Equador - ECU", code: "ECU", count: 20, start: 1, position: 3 },
    ]},
    { letter: "F", position: 15, teams: [
      { name: "Holanda - NED", code: "NED", count: 20, start: 1, position: 0 },
      { name: "Japão - JPN", code: "JPN", count: 20, start: 1, position: 1 },
      { name: "Suécia - SWE", code: "SWE", count: 20, start: 1, position: 2 },
      { name: "Tunísia - TUN", code: "TUN", count: 20, start: 1, position: 3 },
    ]},
    { letter: "G", position: 16, teams: [
      { name: "Bélgica - BEL", code: "BEL", count: 20, start: 1, position: 0 },
      { name: "Egito - EGY", code: "EGY", count: 20, start: 1, position: 1 },
      { name: "Irã - IRN", code: "IRN", count: 20, start: 1, position: 2 },
      { name: "Nova Zelândia - NZL", code: "NZL", count: 20, start: 1, position: 3 },
    ]},
    { letter: "H", position: 17, teams: [
      { name: "Espanha - ESP", code: "ESP", count: 20, start: 1, position: 0 },
      { name: "Cabo Verde - CPV", code: "CPV", count: 20, start: 1, position: 1 },
      { name: "Arábia Saudita - KSA", code: "KSA", count: 20, start: 1, position: 2 },
      { name: "Uruguai - URU", code: "URU", count: 20, start: 1, position: 3 },
    ]},
    { letter: "I", position: 18, teams: [
      { name: "França - FRA", code: "FRA", count: 20, start: 1, position: 0 },
      { name: "Senegal - SEN", code: "SEN", count: 20, start: 1, position: 1 },
      { name: "Iraque - IRQ", code: "IRQ", count: 20, start: 1, position: 2 },
      { name: "Noruega - NOR", code: "NOR", count: 20, start: 1, position: 3 },
    ]},
    { letter: "J", position: 19, teams: [
      { name: "Argentina - ARG", code: "ARG", count: 20, start: 1, position: 0 },
      { name: "Argélia - ALG", code: "ALG", count: 20, start: 1, position: 1 },
      { name: "Áustria - AUT", code: "AUT", count: 20, start: 1, position: 2 },
      { name: "Jordânia - JOR", code: "JOR", count: 20, start: 1, position: 3 },
    ]},
    { letter: "K", position: 20, teams: [
      { name: "Portugal - POR", code: "POR", count: 20, start: 1, position: 0 },
      { name: "RD Congo - COD", code: "COD", count: 20, start: 1, position: 1 },
      { name: "Uzbequistão - UZB", code: "UZB", count: 20, start: 1, position: 2 },
      { name: "Colômbia - COL", code: "COL", count: 20, start: 1, position: 3 },
    ]},
    { letter: "L", position: 21, teams: [
      { name: "Inglaterra - ENG", code: "ENG", count: 20, start: 1, position: 0 },
      { name: "Croácia - CRO", code: "CRO", count: 20, start: 1, position: 1 },
      { name: "Gana - GHA", code: "GHA", count: 20, start: 1, position: 2 },
      { name: "Panamá - PAN", code: "PAN", count: 20, start: 1, position: 3 },
    ]},
  ],
};
