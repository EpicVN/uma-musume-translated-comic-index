import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const translator = await prisma.creator.upsert({
    where: { handle: '@EDemocraft' },
    update: {
      isTarget: true,
      filterTags: '#UmaTranslations',
    },
    create: {
      handle: '@EDemocraft',
      name: 'EpicVN',
      profileUrl: 'https://x.com/EDemocraft',
      isTarget: true,
      filterTags: '#UmaTranslations',
    },
  });

  console.log(' Đã thiết lập Translator theo dõi tự động:', translator);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());