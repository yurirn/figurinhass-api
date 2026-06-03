// Cria um usuário de teste e popula com o template Copa 2026
import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";
import { copa2026Template } from "./template-copa-2026.js";

const EMAIL = process.env.SEED_EMAIL || "demo@figurinhass.app";
const PASSWORD = process.env.SEED_PASSWORD || "demo1234";

async function main() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        name: "Demo",
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    console.log(`✓ Usuário criado: ${EMAIL} / ${PASSWORD}`);
  } else {
    console.log(`✓ Usuário já existe: ${EMAIL}`);
  }

  const existing = await prisma.album.findFirst({ where: { ownerId: user.id, slug: "copa-2026" } });
  if (existing) {
    console.log(`✓ Álbum 'Copa do Mundo 2026' já existe (id=${existing.id})`);
    return;
  }

  const album = await prisma.album.create({
    data: {
      ownerId: user.id,
      name: "Copa do Mundo 2026",
      slug: "copa-2026",
      sections: { create: copa2026Template.sections },
      groups: {
        create: copa2026Template.groups.map(g => ({
          letter: g.letter, position: g.position,
          teams: { create: g.teams },
        })),
      },
    },
    include: { sections: true, groups: { include: { teams: true } } },
  });
  console.log(`✓ Álbum criado: ${album.name} (id=${album.id})`);
  console.log(`   - ${album.sections.length} seções`);
  console.log(`   - ${album.groups.length} grupos`);
  console.log(`   - ${album.groups.reduce((a,g)=>a+g.teams.length,0)} times`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
