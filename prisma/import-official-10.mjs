// Официальный план сборки пассажирского вагона (07.08.2026) — 10 позиций, 27 дней.
//
// МОДЕЛЬ КАК В БУМАГЕ: у каждой работы своя колонка «Kun/День» — 1, 2 или 3.
// Работы разных цехов идут ПАРАЛЛЕЛЬНО, поэтому длительность позиции =
// её последний день × 8 ч, а НЕ сумма часов работ (от суммы получалось 56 дней).
// Итого: позиции 1–8 по 3 дня, позиция 9 — 2 дня, позиция 10 — 1 день = 27 дней.
//
// У каждой работы свой цех (seh) и своё число рабочих — как в бумаге.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOURS_PER_DAY = 8;

// w(uz, ru, workers, hours, seh, dayFrom, dayTo)
const w = (nameUz, nameRu, workerCount, hours, seh, dayFrom, dayTo = dayFrom) => ({
  nameUz,
  nameRu,
  workerCount,
  hours,
  seh,
  dayFrom,
  dayTo,
});

const POSITIONS = [
  {
    n: 1,
    nameUz:
      "Issiqlik izolyatsiyasi, oyna bloklari, tunuka panellar, pol va germetiklik tekshiruvi",
    nameRu:
      "Теплоизоляция, оконные блоки, жестяные панели, пол и проверка герметичности",
    works: [
      w("Issiqlik izolyatsiyasini o‘rnatish (tom, tambur va qozonxona bo‘limi)", "Установка теплоизоляции (крыша, тамбур и котельное отделение)", 4, 4, "15", 1),
      w("Oyna bloklarini o‘rnatish", "Установка оконных блоков", 6, 4, "2", 1),
      w("Signal chiroqlarini o‘rnatish", "Установка сигнальных фонарей", 2, 2, "28", 1),
      w("Tunuka panellarni o‘rnatish", "Установка жестяных панелей", 6, 8, "2", 2),
      w("Salonning fanera polini o‘rnatish (penoplast, rezina tasmalar, folgali qatlam, fanera pollar). Tambur devorlarini fanera bilan qoplash", "Установка пола из фанеры салона (пенопласт, резиновые полосы, фольгированный лист, щит напольный). Обшивка стен из фанеры тамбуров", 6, 12, "2", 2, 3),
      w("Vagonning germetikligini tekshirish (yomg‘irlatib sinov)", "Проверка герметичности вагона (дождевание)", 2, 1, "2, 28", 3),
    ],
  },
  {
    n: 2,
    nameUz:
      "Urilib-tortish va tormoz uskunalari, aravachalar, vagon osti qutilari va elektr magistral",
    nameRu:
      "Ударно-тяговые и тормозные приборы, тележки, подвагонные ящики и электромагистраль",
    works: [
      w("Urilib-tortish uskunalari, avtoulagich va bufer uskunalarini o‘rnatish", "Установка ударно-тяговых приборов, автосцепных и буферных устройств", 8, 8, "23", 1),
      w("Tormoz qurilmalarini o‘rnatish, tormoz magistralini va tormoz kranlarini montaj qilish", "Установка тормозных приборов, монтаж тормозной магистрали и стоп кранов", 8, 8, "23", 2),
      w("Richagli uzatmani montaj qilish, aravachalarni vagon ostiga kiritish va o‘rnatish", "Монтаж рычажной передачи. Подкатка тележек под вагон", 8, 8, "23", 3),
      w("Plastik qoplamali devorlarni o‘rnatish", "Установка перегородок с пластиком", 6, 16, "2", 1, 2),
      // в бумаге у этой строки колонка «День» не заполнена — ставим 1-й день
      w("Yon devor issiqlik izolyatsiyasini o‘rnatish", "Установка теплоизоляции боковин", 6, 8, "15", 1),
      w("Vagon ichki elektr magistrali quvurlari, vagon osti qutilari (past kuchlanishli, kirish, yuqori kuchlanishli, ChO‘) va generatorini montaj qilish", "Монтаж труб внутривагонной электромагистрали, подвагонных ящиков (низковольтный, вводной, высоковольтный, ПЧ) и генератора", 8, 8, "28", 1),
      w("EPT va SKNB quvurlarini montaj qilish, telejkada elektr quvurlari va simlarini o‘rnatish", "Монтаж труб ЭПТ и СКНБ, электропроводки и проводов на тележке", 5, 4, "28", 2),
      w("Yuqori kuchlanishli magistral 3000 V quvurlarini montaj qilish", "Монтаж труб высоковольтной магистрали 3000 В", 5, 4, "28", 2),
      w("Kupe bo‘ylab elektr qutilari va quvurlarni o‘rnatish. Past kuchlanishli TEN simlari uchun quvurlar", "Установка эл. коробов и труб по купе. Установка труб для проводов низковольтных ТЭНов", 3, 6, "28", 2),
      w("ETXJ bakini va unga boruvchi quvurlarni o‘rnatish. Yuqori isitish quvurlarini o‘rnatish", "Установка бака ЭЧТК и подводящих труб. Установка верхних труб отопления", 4, 6, "6", 2),
      w("ETXJ vagonosti quvurlarni o‘rnatish", "Установка подвагонных труб ЭЧТК", 5, 2, "28", 3),
    ],
  },
  {
    n: 3,
    nameUz: "Oyna karkasi, simlar, isitish quvurlari, suv baklari va isitish qozoni",
    nameRu: "Обрешётка окна, проводка, трубы отопления, водяные баки и котёл отопления",
    works: [
      w("Oyna atrofi karkasini o‘rnatish, fanera uchun zakladnoy detallar, folgalar bilan qoplash", "Установка обрешётки оконного проёма, закладные фанеры, обшивка фольгированных покрытий", 6, 24, "2", 1, 3),
      w("Simlarni obshivka ostidan tortish, kupe bo‘yicha simlarni yotqizish va taqsimlash", "Протяжка проводов под обшивку, разводка проводов по купе", 3, 3, "6", 2),
      w("Tunukadan isitish quvurlari ekranlarini montaj qilish", "Монтаж экранов труб отопления из жести", 2, 4, "2", 2),
      w("Pastki isitish quvurlarini o‘rnatish. Suv ta’minoti quvurlarini montaj qilish", "Установка нижних труб отопления. Монтаж труб водоснабжения", 4, 8, "6", 2, 3),
      w("Sofitka uchun zakladnoy detallar va korobni o‘rnatish", "Установка закладных и коробов софитки", 3, 4, "28", 2),
      w("90 l yong‘in o‘chirish bakini quvurlar montaji bilan. 850 l suv bakini va poddonini o‘rnatish", "Установка бака пожаротушения 90л с трубами. Установка водяного бака 850л и поддона", 4, 8, "6", 1),
      w("Qozonxona bo‘limi karkasini o‘rnatish. Havo kanali (vozduxovod) seksiyalarini o‘rnatish", "Установка каркаса котельного отделения. Установка секций воздуховода", 4, 2, "2", 2),
      w("Konditsionerni o‘rnatish", "Установка кондиционера", 3, 4, "28", 3),
      w("Isitish qozonini o‘rnatish (kengaytirgich, tutun quvuri). Boyler, qo‘l nasosi va kichik pechni o‘rnatish", "Установка котла отопления (расширитель, дымогарная труба). Установка бойлера, ручного насоса, малой печи", 4, 12, "6", 2, 3),
    ],
  },
  {
    n: 4,
    nameUz: "Tambur simlari, salon shiftlari, suv ta’minoti va isitish quvurlari",
    nameRu: "Проводка тамбура, потолки салона, водоснабжение и трубы отопления",
    works: [
      w("Tamburda elektr simlarni tortish", "Протяжка проводов в тамбуре", 3, 4, "28", 1),
      w("Salon shiftlari karkasini va metall shiftlarini o‘rnatish", "Установка каркаса и металлических потолков салона", 6, 16, "2", 1, 2),
      w("Shift chetki osma qismlarini va faneradan tayyorlangan shiftlarni o‘rnatish (xizmat, kupe, koridor)", "Установка свеса и потолков из фанеры (служебка, купе проводников, раб. коридор)", 6, 8, "2", 3),
      w("Suv ta’minoti quvurlarini montaj qilish (PPR quvurlar, yong‘in gidranti)", "Монтаж труб водоснабжения (ППР трубы, пожарный гидрант)", 4, 8, "6", 1),
      w("Isitish quvurlarining tirsaklarini (kolenolarini) o‘rnatish. Ostona quvurini o‘rnatish", "Монтаж колен труб отопления. Установка пороговой трубы", 4, 8, "6", 2),
    ],
  },
  {
    n: 5,
    nameUz: "Yoritgichlar, oyna panellari, unitazlar, tambur shiftlari va qozon TENlari",
    nameRu: "Светильники, оконные панели, унитазы, потолки тамбура и ТЭНы котла",
    works: [
      w("Oyna panellarini o‘rnatish. Hojatxona oynasi qoplamasi va panelini (bandura) o‘rnatish", "Установка оконных панелей. Установка облицовки окна и панели (бандура) туалета", 3, 8, "28", 1),
      w("Yoritgichlar va dinamiklarni o‘rnatish", "Монтаж светильников и динамиков", 6, 4, "2", 2),
      w("ECHTK unitazlarini o‘rnatish", "Установка унитазов ЭЧТК", 4, 8, "6", 2),
      w("Tambur shiftlarini karkasi bilan, qoplamasini (komplekt) va polini o‘rnatish", "Установка потолков с каркасами тамбуров, облицовки тамбура (комплект) и пола тамбура", 6, 12, "2", 2, 3),
      w("Polning riflyonka qoplamasini o‘rnatish. Qozonxona bo‘limi eshigini o‘rnatish", "Установка рифлёнки пола. Установка двери котельного отделения", 4, 4, "12", 1),
      w("Qozon TENlarini o‘rnatish. Yuqori kuchlanishli magistral kabellari va MVS 3000 V komplektini montaj qilish", "Установка ТЭНов котла. Монтаж кабелей высоковольтной магистрали и комплекта МВС 3000 В", 4, 16, "28", 2, 3),
    ],
  },
  {
    n: 6,
    nameUz: "Iqlim tizimi, elektr jihozlar, ECHTK, videokuzatuv, pardalar va linoleum",
    nameRu: "Климат-система, электрооборудование, ЭЧТК, видеонаблюдение, шторы и линолеум",
    works: [
      w("Kupe iqlim nazorati tizimini o‘rnatish. Qozonxona, xizmat xonasi va koridor elektr jihozlarini montaj qilish", "Установка системы климат-контроля ЦМК. Монтаж электрооборудования котельного, служебки, раб. коридора", 4, 16, "28", 1, 2),
      w("Megalit va yong‘inga qarshi zaslonkani o‘rnatish. Elektr qaynatgich va Akvalit qurilmasini o‘rnatish", "Установка Мегалит и пожарной заслонки. Установка электрокипятильника, Аквалит", 4, 8, "28", 3),
      w("PINCh, XSF, SKNB simlari, USB sofitkalar, ECHTK (elektr shkafi, kompressor, klapanlar) va videokuzatuvni o‘rnatish", "Монтаж проводов ПИНЧ, ХСФ, СКНБ. Установка софиток с USB, ЭЧТК (эл. щит, компрессор, панель клапанов) и системы видеонаблюдения", 4, 16, "28", 1, 2),
      w("Shorazatemnitellarni, deraza osti stollari oyoqchalarini o‘rnatish. Linoleum yotqizish", "Установка шторозатемнителей, ножек подоконных столов. Настил линолеума", 6, 8, "2", 1),
      w("Past kuchlanishli TENlarni montaj qilish", "Монтаж низковольтных ТЭНов", 4, 4, "28", 3),
      w("Isitish quvurlarining himoya qopqoqlarini (kojuxlarini) o‘rnatish", "Установка кожухов труб отопления", 2, 4, "2", 3),
    ],
  },
  {
    n: 7,
    nameUz: "Mebel, muzlatgich, rakovinalar, yotoq javonlari va nasoslar",
    nameRu: "Мебель, холодильник, мойки, спальные полки и насосы",
    works: [
      w("Mebelni o‘rnatish (xizmat xonasi, ishchi koridor)", "Установка мебели (служебка, раб. коридор)", 4, 8, "2", 1),
      w("Xizmat xonasiga muzlatgich va mikroto‘lqinli pechni o‘rnatish", "Установка холодильника и микроволновки в служебке", 4, 8, "28", 2),
      w("Sun’iy toshdan rakovinalarni smesitel bilan o‘rnatish, sifon va suv ta’minoti quvurlarini montaj qilish", "Установка моек из искусственного камня со смесителем, сифон и трубы водоснабжения", 4, 12, "6", 2, 3),
      w("Yotoq javonlari komplekti, kupe furniturasi (gazeta to‘ri, ilgichlar) va deraza karnizlarini o‘rnatish", "Установка комплекта спальных полок, фурнитуры купе (газетная сетка, вешалки) и оконных карнизов", 6, 12, "2", 2, 3),
      w("Ariston suv isitkichi, sirkulyatsiya nasosi, yong‘in nasosi, avtomatlar va tortuvchi ventilyatorlarni o‘rnatish", "Установка водонагревателя Аристон, циркуляционного и пожарного насосов, автоматов и вытяжных вентиляторов", 4, 8, "28", 3),
    ],
  },
  {
    n: 8,
    nameUz: "Deraza osti stollari, eshiklar, kant va identifikatsiya tablichkalari",
    nameRu: "Подоконные столы, двери, кант и идентификационные таблички",
    works: [
      w("Deraza osti stollarini o‘rnatish. Yo‘lovchilar, provodnik va xizmat kupesi eshiklarini o‘rnatish", "Установка подоконных столов с ножками. Установка дверей купе, проводников и служебного купе", 6, 12, "2", 1, 2),
      w("Kant, furnitura komplekti va vagonning identifikatsiya tablichkalarini o‘rnatish", "Установка канта, набора фурнитуры и табличек вагона", 6, 12, "2", 3),
    ],
  },
  {
    n: 9,
    nameUz: "Vagon kuzovini tashqi bo‘yash",
    nameRu: "Наружная окраска кузова вагона",
    works: [
      w("Changdan tozalash va artish. Och kulrang bo‘yoq. Tom, deraza o‘rinlari va chiziqlarni bo‘yash", "Продувка и протирка. Светло-серая краска. Покраска крыши, проёмов окон и полос", 4, 8, "8", 1),
      w("Lak qoplamasini va trafaretlarni surtish", "Нанесение лакового покрытия и трафаретов", 4, 8, "8", 2),
    ],
  },
  {
    n: 10,
    nameUz: "Tutqichlar, narvon, suflelar va uzellarni sinovdan o‘tkazish",
    nameRu: "Поручни, лестница, суфле и испытание узлов",
    works: [
      w("Kirish tutqichlari, tomga chiqish narvoni, suflelar va jalyuzi panjaralarini o‘rnatish", "Установка входных поручней, лестницы на крышу, суфле и сеток на жалюзи", 2, 8, "12", 1),
      w("Yo‘lovchi vagoni uzellarini sinovdan o‘tkazish (tormoz va elektr jihozlari)", "Испытание узлов пассажирского вагона (тормозная часть и электрооборудование)", 4, 8, "23, 28", 1),
    ],
  },
];

// дней у позиции = её последний день (колонка «День»)
export const positionDays = (p) =>
  p.works.reduce((m, wk) => Math.max(m, wk.dayTo ?? wk.dayFrom ?? 1), 1);

async function main() {
  const wagonStagesBefore = await prisma.wagonStage.count();

  // старые шаблоны-позиции ни на что не ссылаются: у вагонов лежат снимки
  const del = await prisma.stage.deleteMany({});
  console.log(`Удалено старых позиций: ${del.count}`);

  let totalDays = 0;
  for (const p of POSITIONS) {
    const days = positionDays(p);
    totalDays += days;
    await prisma.stage.create({
      data: {
        number: p.n,
        nameUz: p.nameUz,
        nameRu: p.nameRu,
        // длительность = дни позиции × 8 ч, а не сумма часов работ
        durationSeconds: days * HOURS_PER_DAY * 3600,
        note: null,
        workerCount: null,
        works: {
          create: p.works.map((wk, i) => ({
            number: i + 1,
            nameUz: wk.nameUz,
            nameRu: wk.nameRu,
            hours: wk.hours,
            seh: wk.seh,
            workerCount: wk.workerCount,
            dayFrom: wk.dayFrom,
            dayTo: wk.dayTo,
          })),
        },
      },
    });
    console.log(`  Позиция №${p.n}: ${p.works.length} работ, ${days} дн.`);
  }

  console.log(`Создано позиций: ${POSITIONS.length}`);
  console.log(`Работ всего: ${POSITIONS.reduce((a, p) => a + p.works.length, 0)}`);
  console.log(`Суммарно дней на вагон: ${totalDays}`);
  console.log(`Этапы вагонов: было ${wagonStagesBefore}, стало ${await prisma.wagonStage.count()} — не тронуты`);
}

// данные позиций нужны и другим скриптам (починка цехов/числа рабочих),
// поэтому импорт запускается только при прямом вызове файла
export { POSITIONS };

if (process.argv[1]?.replace(/\\/g, "/").endsWith("import-official-10.mjs")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
