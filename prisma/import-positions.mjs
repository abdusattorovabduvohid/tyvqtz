// Импорт позиций из бумажного плана «Сборка пассажирского вагона» (21 позиция).
// Русские названия — дословно из PDF, это первоисточник.
// Узбекские названия — перевод, его нужно вычитать: термины специальные.
// Часы работ берём как есть; время позиции считается как их сумма.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// day — диапазон дней из шапки страницы (в модели пока не храним, нужен для сверки)
const POSITIONS = [
  {
    number: 1, day: "1-день", workerCount: 2, note: "15-цех",
    nameRu: "Установка теплоизоляции на крышу и котельного отделения",
    nameUz: "Tomga va qozonxona bo‘limiga issiqlik izolyatsiyasini o‘rnatish",
    works: [
      { hours: 8, nameRu: "Установка теплоизоляции на крышу и котельний отделения", nameUz: "Tomga va qozonxona bo‘limiga issiqlik izolyatsiyasini o‘rnatish" },
    ],
    paperTotal: 8,
  },
  {
    number: 2, day: "2-день", workerCount: 5, note: "2-цех",
    nameRu: "Установка оцинкованных листов на крышу и котельного отделения (с асбестом)",
    nameUz: "Tomga va qozonxona bo‘limiga rux qoplamali listlarni o‘rnatish (asbest bilan)",
    works: [
      { hours: 8, nameRu: "Установка оцинкованных листов на крышу и котельного отделения (с асбестом)", nameUz: "Tomga va qozonxona bo‘limiga rux qoplamali listlarni o‘rnatish (asbest bilan)" },
    ],
    paperTotal: 8,
  },
  {
    number: 3, day: "3-4-день", workerCount: 5, note: "2-цех",
    nameRu: "Установка пол салона (пенопласт, резиновая полоса, самоклеющий лист (фольга), щит напольный), установка воздуховода, каркаса котельного отделения",
    nameUz: "Salon polini o‘rnatish (penoplast, rezina lenta, o‘zi yopishuvchi list (folga), pol qalqoni), vozduxovod va qozonxona karkasini o‘rnatish",
    works: [
      { hours: 12, nameRu: "Установка пол салона (пенопласт, резиновая полоса, самоклеющий лист (фольга), щит напольный)", nameUz: "Salon polini o‘rnatish (penoplast, rezina lenta, o‘zi yopishuvchi list (folga), pol qalqoni)" },
      { hours: 2, nameRu: "Установка воздуховода", nameUz: "Vozduxovod o‘rnatish" },
      { hours: 2, nameRu: "Установка каркаса котельного отделения", nameUz: "Qozonxona bo‘limi karkasini o‘rnatish" },
    ],
    paperTotal: 16,
  },
  {
    number: 4, day: "4-день", workerCount: 2, note: "23-цех",
    nameRu: "Установка подводящих труб стоп кранов",
    nameUz: "Stop-kranlarning ta’minot quvurlarini o‘rnatish",
    works: [
      { hours: 1, nameRu: "Установка подводящих труб стоп кранов", nameUz: "Stop-kranlarning ta’minot quvurlarini o‘rnatish" },
    ],
    paperTotal: 1,
  },
  {
    number: 5, day: "4-день", workerCount: 4, note: "6-цех",
    nameRu: "Монтаж верхних труб отопления",
    nameUz: "Isitishning yuqori quvurlarini montaj qilish",
    works: [
      { hours: 2, nameRu: "Монтаж верхних труб отопления", nameUz: "Isitishning yuqori quvurlarini montaj qilish" },
    ],
    paperTotal: 2,
  },
  {
    number: 6, day: "4-день", workerCount: 3, note: "28-цех",
    nameRu: "Монтаж труб внутри вагонной электромагистрали",
    nameUz: "Vagon ichidagi elektromagistral quvurlarini montaj qilish",
    works: [
      { hours: 2, nameRu: "Монтаж труб внутри вагонной электромагистрали", nameUz: "Vagon ichidagi elektromagistral quvurlarini montaj qilish" },
    ],
    paperTotal: 2,
  },
  {
    number: 7, day: "4-7-день", workerCount: 5, note: "2-цех",
    nameRu: "Установка перегородок купе, коридора и наклейка пластиком. Установка закладных и бруса на боковые стены купе, коридор и общивка фольга. Монтаж экранов труб отопления из жести.",
    nameUz: "Kupe va koridor to‘siqlarini o‘rnatish va plastik yopishtirish. Kupe va koridor yon devorlariga zakladnoy va brus o‘rnatish, folga bilan qoplash. Isitish quvurlari ekranlarini tunukadan montaj qilish.",
    works: [
      { hours: 16, nameRu: "Установка перегородок купе, коридора и наклейка пластиком.", nameUz: "Kupe va koridor to‘siqlarini o‘rnatish va plastik yopishtirish" },
      { hours: 12, nameRu: "Установка закладных и бруса на боковые стены купе, коридор и общивка фольга.", nameUz: "Kupe va koridor yon devorlariga zakladnoy va brus o‘rnatish, folga bilan qoplash" },
      { hours: 4, nameRu: "Монтаж экранов труб отопления из жести.", nameUz: "Isitish quvurlari ekranlarini tunukadan montaj qilish" },
    ],
    paperTotal: 32,
  },
  {
    number: 8, day: "8-день", workerCount: 2, note: "15-цех",
    nameRu: "Установка теплоизоляции на боковые и торцевые стены",
    nameUz: "Yon va uchki devorlarga issiqlik izolyatsiyasini o‘rnatish",
    works: [
      { hours: 8, nameRu: "Установка теплоизоляции на боковые и торцевые стены", nameUz: "Yon va uchki devorlarga issiqlik izolyatsiyasini o‘rnatish" },
    ],
    paperTotal: 8,
  },
  {
    number: 9, day: "8-9-дни", workerCount: 4, note: "6-цех",
    nameRu: "Установка котла отопления. Монтаж нижних труб отопления. Водяной бак 850л. Монтаж труб водоснабжения и пожаротушения.",
    nameUz: "Isitish qozonini o‘rnatish. Isitishning pastki quvurlarini montaj qilish. 850 l suv baki. Suv ta’minoti va yong‘in o‘chirish quvurlarini montaj qilish.",
    works: [
      { hours: 5, nameRu: "Установка котла отопления с дымогарной трубой и круглым расширителем", nameUz: "Isitish qozonini tutun quvuri va dumaloq kengaytirgich bilan o‘rnatish" },
      { hours: 8, nameRu: "Монтаж нижних труб отопления", nameUz: "Isitishning pastki quvurlarini montaj qilish" },
      { hours: 1, nameRu: "Водяной бак 850л", nameUz: "850 l suv baki" },
    ],
    paperTotal: 14,
  },
  {
    number: 10, day: "9-10-дни", workerCount: 3, note: "28-цех",
    nameRu: "Установка эл коробов и труб по купе, протяжка проводов по купе, протяжка проводов в тамбуре. Протяжка проводов под обшивку. Разводка проводов по купе.",
    nameUz: "Kupe bo‘ylab elektr quti va quvurlarni o‘rnatish, kupe va tambur bo‘ylab simlarni tortish. Qoplama ostidan simlarni tortish. Kupe bo‘ylab simlarni tarqatish.",
    works: [
      { hours: 3, nameRu: "Установка эл коробов и труб по купе", nameUz: "Kupe bo‘ylab elektr quti va quvurlarni o‘rnatish" },
      { hours: 3, nameRu: "Установка протяжка проводов по купе протяжка проводов в тамбуре", nameUz: "Kupe va tambur bo‘ylab simlarni tortish" },
      { hours: 2, nameRu: "Протяжка проводов под обшивку. Разводка проводов по купе", nameUz: "Qoplama ostidan simlarni tortish. Kupe bo‘ylab simlarni tarqatish" },
    ],
    paperTotal: 8,
  },
  {
    number: 11, day: "9-12-дни", workerCount: 5, note: "2-цех",
    nameRu: "Установка потолки с каркасами тамбуров. Уст. потолков из фанеры (служебка, купе проводнивок, раб. коридор). Уст. каркаса потолков салона. Уст. свеса потолков. Уст. металлических потолков салона.",
    nameUz: "Tambur karkaslari bilan shiftlarni o‘rnatish. Fanera shiftlarni o‘rnatish (xizmat xonasi, provodniklar kupesi, ishchi koridor). Salon shifti karkasini o‘rnatish. Shift osilmasini o‘rnatish. Salonning metall shiftlarini o‘rnatish.",
    works: [
      { hours: 4, nameRu: "Установка потолки с каркасами тамбуров", nameUz: "Tambur karkaslari bilan shiftlarni o‘rnatish" },
      { hours: 4, nameRu: "Уст. потолков из фанеры (служебка, купе проводнивок, раб. коридор)", nameUz: "Fanera shiftlarni o‘rnatish (xizmat xonasi, provodniklar kupesi, ishchi koridor)" },
      { hours: 8, nameRu: "Уст. каркаса потолков салона", nameUz: "Salon shifti karkasini o‘rnatish" },
      { hours: 8, nameRu: "Уст. свеса потолков", nameUz: "Shift osilmasini o‘rnatish" },
      { hours: 8, nameRu: "Уст. металлических потолков салона", nameUz: "Salonning metall shiftlarini o‘rnatish" },
    ],
    paperTotal: 32,
  },
  {
    number: 12, day: "10-14-день", workerCount: 5, note: "28-цех",
    nameRu: "Установка светильников освещения, датчиков, регуляторов, розеток. Уст. софиток с USB разъемами. Панели межвагонного соединения, ХСФ. Уст. системы видеонаблюдения. Монтаж электр. обор. котельного, служебка, раб. корид.",
    nameUz: "Yoritish chiroqlari, datchiklar, regulyatorlar, rozetkalarni o‘rnatish. USB ulagichli sofitlarni o‘rnatish. Vagonlararo ulanish panellari, XSF. Videokuzatuv tizimini o‘rnatish. Qozonxona, xizmat xonasi, ishchi koridor elektr jihozlarini montaj qilish.",
    works: [
      { hours: 8, nameRu: "Установка светильников освещения, датчиков, регуляторов, розеток.", nameUz: "Yoritish chiroqlari, datchiklar, regulyatorlar, rozetkalarni o‘rnatish" },
      { hours: 8, nameRu: "Уст. софиток с USB разъемами.", nameUz: "USB ulagichli sofitlarni o‘rnatish" },
      { hours: 8, nameRu: "Панели межвагонного соединения, ХСФ.", nameUz: "Vagonlararo ulanish panellari, XSF" },
      { hours: 8, nameRu: "Уст. системы видеонаблюдения.", nameUz: "Videokuzatuv tizimini o‘rnatish" },
      { hours: 8, nameRu: "Монтаж электр. обор. котельного, служебка, раб. корид.", nameUz: "Qozonxona, xizmat xonasi, ishchi koridor elektr jihozlarini montaj qilish" },
    ],
    paperTotal: 42, // в бумаге «Всего: 42ч», но работы дают 40ч — расхождение
  },
  {
    number: 13, day: "11-13-день", workerCount: 7, note: "23-цех",
    nameRu: "Установка ударно тяговых приборов, автосцепка, монтаж тормозной магистрали, стоп кранов, монтаж рычажной передачи, установка тормозных приборов, подкатка тележек",
    nameUz: "Zarba-tortish qurilmalari, avtostsepkani o‘rnatish, tormoz magistrali va stop-kranlarni montaj qilish, richagli uzatmani montaj qilish, tormoz qurilmalarini o‘rnatish, aravachalarni tagiga kiritish",
    works: [
      { hours: 8, nameRu: "Установка ударно тяговых приборов, автосцепка", nameUz: "Zarba-tortish qurilmalari, avtostsepkani o‘rnatish" },
      { hours: 8, nameRu: "Установка тормозных приборов, Монтаж тормозной магистрали, стоп кранов", nameUz: "Tormoz qurilmalarini o‘rnatish, tormoz magistrali va stop-kranlarni montaj qilish" },
      { hours: 8, nameRu: "Монтаж рычажной передачи, подкатка тележек", nameUz: "Richagli uzatmani montaj qilish, aravachalarni tagiga kiritish" },
    ],
    paperTotal: 24,
  },
  {
    number: 14, day: "11-16-день", workerCount: 5, note: "28-цех",
    nameRu: "Установка подвагонных труб магистрали ящиков низковольтный, вводной и высоковольтный. Монтаж подвагонного генератора. Монтаж ЭПТ и СКНБ. Монтаж электр. труб и проводов на тележке. Монтаж труб и кабелей высоковольтной магистрали и комплекта МВС 3000 В, монтаж труб, установка экобака, установка биотуалетов",
    nameUz: "Past kuchlanishli, kirish va yuqori kuchlanishli qutilar magistralining vagon ostidagi quvurlarini o‘rnatish. Vagon osti generatorini montaj qilish. EPT va SKNB montaji. Aravachadagi elektr quvur va simlarni montaj qilish. Yuqori kuchlanishli magistral va MVS 3000 V to‘plami quvur va kabellarini montaj qilish, quvurlar montaji, ekobak va biotualetlarni o‘rnatish",
    works: [
      { hours: 16, nameRu: "Установка подвагонных труб магитрали ящиков низковольтный, вводной и высоковольтный, Монтаж подвагонного генератора.", nameUz: "Past kuchlanishli, kirish va yuqori kuchlanishli qutilar magistralining vagon ostidagi quvurlarini o‘rnatish, vagon osti generatorini montaj qilish" },
      { hours: 8, nameRu: "Монтаж ЭПТ и СКНБ, Монтаж электр. труб и проводов на тележке,", nameUz: "EPT va SKNB montaji, aravachadagi elektr quvur va simlarni montaj qilish" },
      { hours: 20, nameRu: "Монтаж труб и кабелей высоковольтной магистрали и комплекта МВС 3000 В", nameUz: "Yuqori kuchlanishli magistral va MVS 3000 V to‘plami quvur va kabellarini montaj qilish" },
      { hours: 20, nameRu: "Монтаж труб, установка экобака, установка биотуалетов", nameUz: "Quvurlar montaji, ekobak va biotualetlarni o‘rnatish" },
    ],
    paperTotal: 64,
  },
  {
    number: 15, day: "17-20-день", workerCount: 5, note: "2-цех",
    nameRu: "Установка оконных блоков. Установка оконных панелей. Настил линолиума. Установка кожухов труб отопления. Установка шторозатемнителей.",
    nameUz: "Deraza bloklarini o‘rnatish. Deraza panellarini o‘rnatish. Linoleum yotqizish. Isitish quvurlari qopqoqlarini o‘rnatish. Parda-qorong‘ilatgichlarni o‘rnatish.",
    works: [
      { hours: 8, nameRu: "Установка оконных блоков", nameUz: "Deraza bloklarini o‘rnatish" },
      { hours: 8, nameRu: "Установка оконных панелей", nameUz: "Deraza panellarini o‘rnatish" },
      { hours: 4, nameRu: "Настил линолиума", nameUz: "Linoleum yotqizish" },
      { hours: 4, nameRu: "Установка кожухов труб отопления", nameUz: "Isitish quvurlari qopqoqlarini o‘rnatish" },
      { hours: 8, nameRu: "Установка шторозатемнителей", nameUz: "Parda-qorong‘ilatgichlarni o‘rnatish" },
    ],
    paperTotal: 32,
  },
  {
    number: 16, day: "17-21-день", workerCount: 5, note: "2-цех",
    nameRu: "Уст. оконных карнизов. Установка дверы, дверных карнизов, подоконных столов с ножками, боковых рундуков ЦМО, комплект спальных полок ЦМО, спинки спальных полок, мебели (служебка, раб. коридор), Уст. фурнитуры купе (газетная сетка, вещалки), фурнитуры в туалете.",
    nameUz: "Deraza karnizlarini o‘rnatish. Eshik, eshik karnizlari, oyoqli deraza osti stollari, CMO yon rundukları, CMO yotoq javonlari to‘plami, yotoq javonlari suyanchig‘i, mebel (xizmat xonasi, ishchi koridor) o‘rnatish. Kupe furniturasi (gazeta to‘ri, ilgichlar) va hojatxona furniturasini o‘rnatish.",
    works: [
      { hours: 40, nameRu: "Уст. оконных карнизов. Установка дверы, дверных карнизов, подоконных столов с ножками, боковых рундуков ЦМО, комплект спальных полок ЦМО, спинки спальных полок, мебели (служебка, раб. коридор), Уст. фурнитуры купе (газетная сетка, вещалки), фурнитуры в туалете.", nameUz: "Deraza karnizlari, eshik va eshik karnizlari, deraza osti stollari, CMO yon rundukları va yotoq javonlari, mebel hamda kupe va hojatxona furniturasini o‘rnatish" },
    ],
    paperTotal: 40,
  },
  {
    number: 17, day: "17-21-день", workerCount: 4, note: "6-цех",
    nameRu: "Установка кипятильника, бойлера, малой печи, монтаж труб кот.отделения, расширителя котла, Установка моек, смесителей, гидрантов, труб пожаротушения, монтаж труб водоснабжения",
    nameUz: "Suv qaynatgich, boyler, kichik pechni o‘rnatish, qozonxona quvurlari va qozon kengaytirgichini montaj qilish, yuvinish idishlari, smesitellar, gidrantlar, yong‘in o‘chirish quvurlarini o‘rnatish, suv ta’minoti quvurlarini montaj qilish",
    works: [
      { hours: 48, nameRu: "Установка кипятильника, бойлера, малой печи, монтаж труб кот.отделения, расширителя котла, Установка моек, смесителей, гидрантов, труб пожаротушения, монтаж труб водоснабжения", nameUz: "Suv qaynatgich, boyler, kichik pech, qozonxona quvurlari, qozon kengaytirgichi, yuvinish idishlari, smesitellar, gidrantlar, yong‘in o‘chirish va suv ta’minoti quvurlarini o‘rnatish" },
    ],
    paperTotal: 48,
  },
  {
    number: 18, day: "17-22-день", workerCount: 5, note: "28-цех",
    nameRu: "Монтаж ЭЧТК (эл. щит, компрессор, панель клапанов). Монтаж пульта управления. Монтаж проводов пульт упр., УКВ, подваг оборуд и др. Установка циркуляционного насоса, насоса пожаротушения, автоматов насоса, вытяжных вентиляторов. Установка ТЭНов котла, низковольтных ТЭНов.",
    nameUz: "EChTK montaji (elektr qalqoni, kompressor, klapanlar paneli). Boshqaruv pultini montaj qilish. Boshqaruv pulti, UKV, vagon osti jihozlari va boshqalar simlarini montaj qilish. Sirkulyatsion nasos, yong‘in o‘chirish nasosi, nasos avtomatlari, so‘rish ventilyatorlarini o‘rnatish. Qozon TENlari va past kuchlanishli TENlarni o‘rnatish.",
    works: [
      { hours: 48, nameRu: "Монтаж ЭЧТК (эл. щит, компрессор, панель клапанов) Монтаж пульта управления. Монтаж проводов пульт упр., УКВ, подваг оборуд и др. Установка циркуляционного насоса, насоса пожаротушения, автоматов насоса, вытяжных вентиляторов. Установка Тэнов котла, низковольтных ТЭНов.", nameUz: "EChTK, boshqaruv pulti, simlar, sirkulyatsion va yong‘in nasoslari, ventilyatorlar hamda qozon TENlarini montaj qilish va o‘rnatish" },
    ],
    paperTotal: 48,
  },
  {
    number: 19, day: "17-день", workerCount: 2, note: "12-цех",
    nameRu: "Установка входных поручней, лестницы подъема на крышу, суфле",
    nameUz: "Kirish tutqichlari, tomga chiqish narvoni, suflelarni o‘rnatish",
    works: [
      { hours: 8, nameRu: "Установка входных поручней, лестницы подъема на крышу, суфле", nameUz: "Kirish tutqichlari, tomga chiqish narvoni, suflelarni o‘rnatish" },
    ],
    paperTotal: 8,
  },
  {
    number: 20, day: "17-день", workerCount: 2, note: "8-цех",
    nameRu: "Нанесение трафаретов",
    nameUz: "Trafaretlarni tushirish",
    works: [
      { hours: 8, nameRu: "Нанесение трафаретов", nameUz: "Trafaretlarni tushirish" },
    ],
    paperTotal: 8,
  },
  {
    // в бумаге у этой позиции не заполнены «Количество работников» и «Примечание»
    number: 21, day: "22-день", workerCount: null, note: null,
    nameRu: "Сдача тормозного и электрооборудования",
    nameUz: "Tormoz va elektr jihozlarini topshirish",
    works: [
      { hours: 8, nameRu: "Сдача узлов пассажирских вагонов", nameUz: "Yo‘lovchi vagonlari uzellarini topshirish" },
    ],
    paperTotal: 8,
  },
];

async function main() {
  // Шаблоны позиций ни на что не ссылаются: у вагонов лежат СНИМКИ (WagonStage),
  // без внешнего ключа на Stage. Поэтому старые болванки можно смело убрать.
  const wagonStagesBefore = await prisma.wagonStage.count();
  const del = await prisma.stage.deleteMany({});
  console.log(`Удалено старых позиций-болванок: ${del.count}`);

  for (const p of POSITIONS) {
    const durationSeconds = Math.round(
      p.works.reduce((s, w) => s + w.hours, 0) * 3600
    );
    await prisma.stage.create({
      data: {
        number: p.number,
        nameRu: p.nameRu,
        nameUz: p.nameUz,
        workerCount: p.workerCount,
        note: p.note,
        durationSeconds,
        works: {
          create: p.works.map((w, i) => ({
            number: i + 1,
            nameRu: w.nameRu,
            nameUz: w.nameUz,
            hours: w.hours,
          })),
        },
      },
    });
  }
  console.log(`Создано позиций: ${POSITIONS.length}`);

  // Сверка с бумагой: сумма часов работ против «Всего» из плана
  console.log("\nСверка с бумагой:");
  const diffs = [];
  for (const p of POSITIONS) {
    const sum = p.works.reduce((s, w) => s + w.hours, 0);
    if (sum !== p.paperTotal) {
      diffs.push(`  Позиция №${p.number}: работы дают ${sum}ч, в бумаге «Всего: ${p.paperTotal}ч»`);
    }
  }
  console.log(
    diffs.length ? diffs.join("\n") : "  часы всех позиций совпадают с «Всего»"
  );

  const wagonStagesAfter = await prisma.wagonStage.count();
  console.log(
    `\nЭтапы существующих вагонов: было ${wagonStagesBefore}, стало ${wagonStagesAfter} — не тронуты`
  );

  const totalHours = POSITIONS.reduce(
    (s, p) => s + p.works.reduce((a, w) => a + w.hours, 0),
    0
  );
  console.log(`Суммарно по всем позициям: ${totalHours}ч = ${totalHours / 8} раб. дней`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
