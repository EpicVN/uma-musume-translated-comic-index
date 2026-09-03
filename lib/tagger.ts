import { PrismaClient } from "@prisma/client";

// Danh sách các nhân vật thường gặp kèm từ khóa tiếng Nhật/Anh
export interface UmaCharacter {
  slug: string;
  name: string;
  jp: string;
  aliases?: string[];
}

export const CHARACTER_DICTIONARY: UmaCharacter[] = [
  // --- Thế hệ đầu & Anime Season 1, 2, 3 ---
  {
    slug: "special-week",
    name: "Special Week",
    jp: "スペシャルウィーク",
    aliases: ["spe", "spe-chan"],
  },
  {
    slug: "silence-suzuka",
    name: "Silence Suzuka",
    jp: "サイレンススズカ",
    aliases: ["suzuka"],
  },
  {
    slug: "tokai-teio",
    name: "Tokai Teio",
    jp: "トウカイテイオー",
    aliases: ["teio"],
  },
  { slug: "maruzensky", name: "Maruzensky", jp: "マルゼンスキー" },
  { slug: "fuji-kiseki", name: "Fuji Kiseki", jp: "フジキセキ" },
  {
    slug: "oguri-cap",
    name: "Oguri Cap",
    jp: "オグリキャップ",
    aliases: ["oguri", "ogurin"],
  },
  {
    slug: "gold-ship",
    name: "Gold Ship",
    jp: "ゴールドシップ",
    aliases: ["golshi", "golshee"],
  },
  { slug: "vodka", name: "Vodka", jp: "ウオッカ" },
  {
    slug: "daiwa-scarlet",
    name: "Daiwa Scarlet",
    jp: "ダイワスカーレット",
    aliases: ["dasca"],
  },
  { slug: "taiki-shuttle", name: "Taiki Shuttle", jp: "タイキシャトル" },
  {
    slug: "grass-wonder",
    name: "Grass Wonder",
    jp: "グラスワンダー",
    aliases: ["grass"],
  },
  {
    slug: "hishi-amazon",
    name: "Hishi Amazon",
    jp: "ヒシアマゾン",
    aliases: ["hishima"],
  },
  {
    slug: "mejiro-mcqueen",
    name: "Mejiro McQueen",
    jp: "メジロマックイーン",
    aliases: ["mcqueen"],
  },
  {
    slug: "el-condor-pasa",
    name: "El Condor Pasa",
    jp: "エルコンドルパサー",
    aliases: ["el"],
  },
  {
    slug: "tm-opera-o",
    name: "T.M. Opera O",
    jp: "テイエムオペラオー",
    aliases: ["opera o", "opera"],
  },
  {
    slug: "narita-brian",
    name: "Narita Brian",
    jp: "ナリタブライアン",
    aliases: ["brian"],
  },
  {
    slug: "symboli-rudolf",
    name: "Symboli Rudolf",
    jp: "シンボリルドルフ",
    aliases: ["rudolf", "kaicho"],
  },
  { slug: "air-groove", name: "Air Groove", jp: "エアグルーヴ" },
  {
    slug: "seiun-sky",
    name: "Seiun Sky",
    jp: "セイウンスカイ",
    aliases: ["unsu"],
  },
  {
    slug: "tamamo-cross",
    name: "Tamamo Cross",
    jp: "タマモクロス",
    aliases: ["tamamo"],
  },
  {
    slug: "fine-motion",
    name: "Fine Motion",
    jp: "ファインモーション",
    aliases: ["fine"],
  },
  { slug: "biwa-hayahide", name: "Biwa Hayahide", jp: "ビワハヤヒデ" },
  {
    slug: "mayano-top-gun",
    name: "Mayano Top Gun",
    jp: "マヤノトップガン",
    aliases: ["mayano"],
  },
  {
    slug: "manhattan-cafe",
    name: "Manhattan Cafe",
    jp: "マンハッタンカフェ",
    aliases: ["cafe"],
  },
  {
    slug: "mihono-bourbon",
    name: "Mihono Bourbon",
    jp: "ミホノブルボン",
    aliases: ["bourbon"],
  },
  { slug: "mejiro-ryan", name: "Mejiro Ryan", jp: "メジロライアン" },
  {
    slug: "hishi-akebono",
    name: "Hishi Akebono",
    jp: "ヒシアケボノ",
    aliases: ["bono"],
  },
  { slug: "yukino-bijin", name: "Yukino Bijin", jp: "ユキノビジン" },
  {
    slug: "rice-shower",
    name: "Rice Shower",
    jp: "ライスシャワー",
    aliases: ["rice"],
  },
  { slug: "ines-fujin", name: "Ines Fujin", jp: "アイネスフウジン" },
  {
    slug: "agnes-tachyon",
    name: "Agnes Tachyon",
    jp: "アグネスタキオン",
    aliases: ["tachyon"],
  },
  {
    slug: "admir-vega",
    name: "Admire Vega",
    jp: "アドマイヤベガ",
    aliases: ["ayabe"],
  },
  { slug: "in领域-one", name: "Inari One", jp: "イナリワン" },
  {
    slug: "winning-ticket",
    name: "Winning Ticket",
    jp: "ウイニングチケット",
    aliases: ["chiket"],
  },
  {
    slug: "air-shakur",
    name: "Air Shakur",
    jp: "エアシャカール",
    aliases: ["shakur"],
  },
  {
    slug: "eishin-flash",
    name: "Eishin Flash",
    jp: "エイシンフラッシュ",
    aliases: ["flash"],
  },
  {
    slug: "curren-chan",
    name: "Curren Chan",
    jp: "カレンチャン",
    aliases: ["curren"],
  },
  {
    slug: "kawakami-princess",
    name: "Kawakami Princess",
    jp: "カワカミプリンセス",
  },
  { slug: "gold-city", name: "Gold City", jp: "ゴールドシチー" },
  {
    slug: "sakura-bakushin-o",
    name: "Sakura Bakushin O",
    jp: "サクラバクシンオー",
    aliases: ["bakushin"],
  },
  {
    slug: "seeking-the-pearl",
    name: "Seeking the Pearl",
    jp: "シーキングザパール",
    aliases: ["pearl"],
  },
  {
    slug: "shinko-windy",
    name: "Shinko Windy",
    jp: "シンコウウインディ",
    aliases: ["windy"],
  },
  {
    slug: "sweep-tosho",
    name: "Sweep Tosho",
    jp: "スイープトウショウ",
    aliases: ["sweep"],
  },
  {
    slug: "super-creek",
    name: "Super Creek",
    jp: "スーパークリーク",
    aliases: ["creek"],
  },
  {
    slug: "smart-falcon",
    name: "Smart Falcon",
    jp: "スマートファルコン",
    aliases: ["falco"],
  },
  {
    slug: "zenno-rob-roy",
    name: "Zenno Rob Roy",
    jp: "ゼンノロブロイ",
    aliases: ["rob roy"],
  },
  {
    slug: "tosen-jordan",
    name: "Tosen Jordan",
    jp: "トーセンジョーダン",
    aliases: ["jordan"],
  },
  {
    slug: "nakayama-festa",
    name: "Nakayama Festa",
    jp: "ナカヤマフェスタ",
    aliases: ["festa"],
  },
  {
    slug: "narita-taishin",
    name: "Narita Taishin",
    jp: "ナリタタイシン",
    aliases: ["taishin"],
  },
  { slug: "nishino-flower", name: "Nishino Flower", jp: "ニシノフラワー" },
  {
    slug: "haru-urara",
    name: "Haru Urara",
    jp: "ハルウララ",
    aliases: ["urara"],
  },
  {
    slug: "bamboo-memory",
    name: "Bamboo Memory",
    jp: "バンブーメモリー",
    aliases: ["bamboo"],
  },
  { slug: "biko-pegasus", name: "Biko Pegasus", jp: "ビコーペガサス" },
  {
    slug: "marvelous-sunday",
    name: "Marvelous Sunday",
    jp: "マーベラスサンデー",
    aliases: ["marvelous"],
  },
  {
    slug: "matikanefukukitaru",
    name: "Matikanefukukitaru",
    jp: "マチカネフクキタル",
    aliases: ["fukukitaru", "fuku"],
  },
  {
    slug: "meisho-doto",
    name: "Meisho Doto",
    jp: "メイショウドトウ",
    aliases: ["doto"],
  },
  {
    slug: "mejiro-dober",
    name: "Mejiro Dober",
    jp: "メジロドーベル",
    aliases: ["dober"],
  },
  {
    slug: "nice-nature",
    name: "Nice Nature",
    jp: "ナイスネイチャ",
    aliases: ["nature"],
  },
  {
    slug: "king-halo",
    name: "King Halo",
    jp: "キングヘイロー",
    aliases: ["king"],
  },
  {
    slug: "matikanetannhauser",
    name: "Matikanetannhauser",
    jp: "マチカネタンホイザ",
    aliases: ["machitan", "tannhauser"],
  },
  {
    slug: "ikuno-dictus",
    name: "Ikuno Dictus",
    jp: "イクノディクタス",
    aliases: ["ikuno"],
  },
  {
    slug: "mejiro-palmer",
    name: "Mejiro Palmer",
    jp: "メジロパーマー",
    aliases: ["palmer"],
  },
  {
    slug: "daitaku-helios",
    name: "Daitaku Helios",
    jp: "ダイタクヘリオス",
    aliases: ["helios"],
  },
  {
    slug: "twin-turbo",
    name: "Twin Turbo",
    jp: "ツインターボ",
    aliases: ["turbo"],
  },
  {
    slug: "satono-diamond",
    name: "Satono Diamond",
    jp: "サトノダイヤモンド",
    aliases: ["dia", "dia-chan"],
  },
  {
    slug: "kitasan-black",
    name: "Kitasan Black",
    jp: "キタサンブラック",
    aliases: ["kitasan", "kita-chan"],
  },
  {
    slug: "sakura-chiyono-o",
    name: "Sakura Chiyono O",
    jp: "サクラチヨノオー",
    aliases: ["chiyo"],
  },
  {
    slug: "sirius-symboli",
    name: "Sirius Symboli",
    jp: "シリウスシンボリ",
    aliases: ["sirius"],
  },
  {
    slug: "mejiro-ardan",
    name: "Mejiro Ardan",
    jp: "メジロアルダン",
    aliases: ["ardan"],
  },
  { slug: "yaeno-muteki", name: "Yaeno Muteki", jp: "ヤエノムテキ" },
  {
    slug: "tsurumaru-tsuyoshi",
    name: "Tsurumaru Tsuyoshi",
    jp: "ツルマルツヨシ",
  },
  {
    slug: "mejiro-bright",
    name: "Mejiro Bright",
    jp: "メジロブライト",
    aliases: ["bright"],
  },
  {
    slug: "sakura-laurel",
    name: "Sakura Laurel",
    jp: "サクラローレル",
    aliases: ["laurel"],
  },
  {
    slug: "narita-top-road",
    name: "Narita Top Road",
    jp: "ナリタトップロード",
    aliases: ["ntr", "top road"],
  },
  {
    slug: "yamanin-zephyr",
    name: "Yamanin Zephyr",
    jp: "ヤマニンゼファー",
    aliases: ["zephyr"],
  },

  // --- Nhóm Road to the Top / Beginning of a New Era / Cinderella Gray ---
  {
    slug: "jungle-pocket",
    name: "Jungle Pocket",
    jp: "ジャングルポケット",
    aliases: ["pokke"],
  },
  {
    slug: "dantsu-flame",
    name: "Dantsu Flame",
    jp: "ダンツフレーム",
    aliases: ["dantsu"],
  },
  { slug: "durandal", name: "Durandal", jp: "デュランダル" },
  {
    slug: "aston-machan",
    name: "Aston Machan",
    jp: "アストンマーチャン",
    aliases: ["machan"],
  },
  {
    slug: "satono-crown",
    name: "Satono Crown",
    jp: "サトノクラウン",
    aliases: ["crown"],
  },
  {
    slug: "schval-grand",
    name: "Cheval Grand",
    jp: "シュヴァルグラン",
    aliases: ["cheval"],
  },
  { slug: "verxina", name: "Verxina", jp: "ヴィルシーナ" },
  { slug: "vivlos", name: "Vivlos", jp: "ヴィブロス" },

  // --- Nhóm Gần Đây & 3rd / 4th Anniversary (JP Update) ---
  { slug: "duramente", name: "Duramente", jp: "ドゥラメンテ" },
  { slug: "orfevre", name: "Orfevre", jp: "オルフェーヴル", aliases: ["orfe"] },
  {
    slug: "gentildonna",
    name: "Gentildonna",
    jp: "ジェンティルドンナ",
    aliases: ["gentil"],
  },
  { slug: "almond-eye", name: "Almond Eye", jp: "アーモンドアイ" },
  { slug: "buena-vista", name: "Buena Vista", jp: "ブエナビスタ" },
  {
    slug: "dream-journey",
    name: "Dream Journey",
    jp: "ドリームジャーニー",
    aliases: ["doraji"],
  },
  {
    slug: "calstone-light-o",
    name: "Calstone Light O",
    jp: "カルストンライトオ",
  },
  { slug: "cesario", name: "Cesario", jp: "シーザリオ" },
  { slug: "daring-tact", name: "Daring Tact", jp: "デアリングタクト" },
  { slug: "still-in-love", name: "Still in Love", jp: "スティルインラブ" },
  { slug: "rhein-kraft", name: "Rhein Kraft", jp: "ラインクラフト" },
  { slug: "daring-heart", name: "Daring Heart", jp: "デアリングハート" },
  { slug: "cesario", name: "Cesario", jp: "シーザリオ" },
  { slug: "air-messiah", name: "Air Messiah", jp: "エアメサイア" },

  // --- Các nhân vật Dirt / G1 / Thành viên khác ---
  {
    slug: "copano-rickey",
    name: "Copano Rickey",
    jp: "コパノリッキー",
    aliases: ["rickey"],
  },
  {
    slug: "hokko-tarumae",
    name: "Hokko Tarumae",
    jp: "ホッコータルマエ",
    aliases: ["tarumae"],
  },
  {
    slug: "wonder-acute",
    name: "Wonder Acute",
    jp: "ワンダーアキュート",
    aliases: ["acute"],
  },
  {
    slug: "smart-boy",
    name: "Espoir City",
    jp: "エスポワールシチー",
    aliases: ["espoir"],
  },
  { slug: "transcend", name: "Transcend", jp: "トランセンド" },
  { slug: "furioso", name: "Furioso", jp: "フリオーソ" },
  {
    slug: "symboli-kris-s",
    name: "Symboli Kris S",
    jp: "シンボリクリスエス",
    aliases: ["kris s", "botan"],
  },
  {
    slug: "tanino-gimlet",
    name: "Tanino Gimlet",
    jp: "タニノギムレット",
    aliases: ["gimlet"],
  },
  { slug: "tap-dance-city", name: "Tap Dance City", jp: "タップダンスシチー" },
  {
    slug: "neo-universe",
    name: "Neo Universe",
    jp: "ネオユニヴァース",
    aliases: ["neo"],
  },
  {
    slug: "hishi-miracle",
    name: "Hishi Miracle",
    jp: "ヒシミラクル",
    aliases: ["miracle"],
  },
  { slug: "ks-miracle", name: "K.S.Miracle", jp: "ケイエスミラクル" },
  {
    slug: "katsuragi-ace",
    name: "Katsuragi Ace",
    jp: "カツラギエース",
    aliases: ["ace"],
  },
  {
    slug: "mejiro-ramonu",
    name: "Mejiro Ramonu",
    jp: "メジロラモーヌ",
    aliases: ["ramonu"],
  },
  {
    slug: "sounds-of-earth",
    name: "Sounds of Earth",
    jp: "サウンズオブアース",
    aliases: ["earth"],
  },
  {
    slug: "royce-and-royce",
    name: "Royce and Royce",
    jp: "ロイスアンドロイス",
  },
  { slug: "no-reason", name: "No Reason", jp: "ノーリーズン" },
  { slug: "samson-big", name: "Samson Big", jp: "サムソンビッグ" },
  { slug: "north-flight", name: "North Flight", jp: "ノースフライト" },
  { slug: "buena-vista", name: "Buena Vista", jp: "ブエナビスタ" },
  { slug: "blast-onepiece", name: "Blast Onepiece", jp: "ブラストワンピース" },
  { slug: "chrono-genesis", name: "Chrono Genesis", jp: "クロノジェネシス" },
  { slug: "gran-alegria", name: "Gran Alegria", jp: "グランアレグリア" },
  { slug: "loves-only-you", name: "Loves Only You", jp: "ラヴズオンリーユー" },
  { slug: "lucky-lilac", name: "Lucky Lilac", jp: "ラッキーライラック" },
  {
    slug: "stay-gold",
    name: "Stay Gold",
    jp: "ステイゴールド",
    aliases: ["ste-go"],
  },
];

export async function autoTagPost(
  prisma: PrismaClient,
  postId: string,
  fullText: string,
) {
  if (!fullText) return;

  const normalized = fullText.toLowerCase();

  for (const char of CHARACTER_DICTIONARY) {
    let isMatched = false;

    // 1. So khớp tên Katakana tiếng Nhật (độ chính xác tuyệt đối từ hashtag của artist)
    if (fullText.includes(char.jp)) {
      isMatched = true;
    }

    // 2. So khớp tên tiếng Anh đầy đủ
    if (!isMatched && normalized.includes(char.name.toLowerCase())) {
      isMatched = true;
    }

    // 3. So khớp slug hoặc các nickname / alias phổ biến
    if (!isMatched && char.aliases) {
      for (const alias of char.aliases) {
        // Dùng regex word boundary để tránh bắt nhầm từ con (ví dụ 'el' trong 'hotel')
        const regex = new RegExp(`\\b${alias}\\b`, "i");
        if (regex.test(fullText)) {
          isMatched = true;
          break;
        }
      }
    }

    if (isMatched) {
      // Tìm hoặc tạo Tag trong DB
      const tag = await prisma.tag.upsert({
        where: { slug: char.slug },
        update: {},
        create: {
          slug: char.slug,
          name: char.name,
          jpName: char.jp,
          category: "CHARACTER",
        },
      });

      // Gán tag vào Post
      await prisma.postTag.upsert({
        where: {
          postId_tagId: { postId, tagId: tag.id },
        },
        update: {},
        create: {
          postId,
          tagId: tag.id,
          isManual: false,
        },
      });
    }
  }
}
