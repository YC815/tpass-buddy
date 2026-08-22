// 徽記池：活動當天兩個人在人群裡靠這個認出彼此。
//
// 挑選規則（改動前先讀）：
//   · 視覺差異要大——現場是隔三公尺看別人的手機螢幕，不是併排比對。
//   · 中文名稱要明確好喊。emoji 在 iOS / Android / Windows 上畫風不同，
//     真正讓兩個人確認「是同一隻」的是底下那兩個中文字。
//   · 避開易混淆組：🐕/🐶、🦊/🐺、🐢/🦎、🐭/🐹、🐳/🐋。
//   · 避開有膚色或性別變體的 emoji（同一個碼點在不同裝置會長出不同人），
//     所以整池只收動物，不收人物。
//   · 避開 ZWJ 組合字（🐻‍❄️ 北極熊）——舊系統會拆成兩隻。
//
// 目前 60 組，配對表是 47 對，留了餘裕。要擴充就往後加，**不要重排既有順序**：
// sync 是靠「舊 pairs.json 沿用舊徽記」保持穩定的，順序只影響第一次分配，
// 但保持穩定能讓沒有舊檔時重跑的結果可預期。
export const BADGES = [
  { emoji: "🦩", name: "火鶴" },
  { emoji: "🦔", name: "刺蝟" },
  { emoji: "🦥", name: "樹懶" },
  { emoji: "🦦", name: "水獺" },
  { emoji: "🦫", name: "海狸" },
  { emoji: "🦡", name: "獾" },
  { emoji: "🐙", name: "章魚" },
  { emoji: "🦭", name: "海豹" },
  { emoji: "🦉", name: "貓頭鷹" },
  { emoji: "🦜", name: "鸚鵡" },
  { emoji: "🐧", name: "企鵝" },
  { emoji: "🦢", name: "天鵝" },
  { emoji: "🦅", name: "老鷹" },
  { emoji: "🦆", name: "鴨子" },
  { emoji: "🐓", name: "公雞" },
  { emoji: "🦃", name: "火雞" },
  { emoji: "🦚", name: "孔雀" },
  { emoji: "🦤", name: "渡渡鳥" },
  { emoji: "🐨", name: "無尾熊" },
  { emoji: "🐼", name: "熊貓" },
  { emoji: "🦘", name: "袋鼠" },
  { emoji: "🦒", name: "長頸鹿" },
  { emoji: "🦓", name: "斑馬" },
  { emoji: "🐘", name: "大象" },
  { emoji: "🦏", name: "犀牛" },
  { emoji: "🦛", name: "河馬" },
  { emoji: "🦁", name: "獅子" },
  { emoji: "🐯", name: "老虎" },
  { emoji: "🐻", name: "棕熊" },
  { emoji: "🦝", name: "浣熊" },
  { emoji: "🐿️", name: "松鼠" },
  { emoji: "🐰", name: "兔子" },
  { emoji: "🐹", name: "倉鼠" },
  { emoji: "🦌", name: "鹿" },
  { emoji: "🐴", name: "馬" },
  { emoji: "🦄", name: "獨角獸" },
  { emoji: "🐮", name: "乳牛" },
  { emoji: "🐷", name: "小豬" },
  { emoji: "🐑", name: "綿羊" },
  { emoji: "🐐", name: "山羊" },
  { emoji: "🐫", name: "駱駝" },
  { emoji: "🦙", name: "羊駝" },
  { emoji: "🐊", name: "鱷魚" },
  { emoji: "🐢", name: "烏龜" },
  { emoji: "🐍", name: "蛇" },
  { emoji: "🦕", name: "長頸龍" },
  { emoji: "🦖", name: "暴龍" },
  { emoji: "🐳", name: "鯨魚" },
  { emoji: "🐬", name: "海豚" },
  { emoji: "🦈", name: "鯊魚" },
  { emoji: "🐠", name: "熱帶魚" },
  { emoji: "🦐", name: "蝦子" },
  { emoji: "🦀", name: "螃蟹" },
  { emoji: "🦑", name: "魷魚" },
  { emoji: "🐌", name: "蝸牛" },
  { emoji: "🦋", name: "蝴蝶" },
  { emoji: "🐝", name: "蜜蜂" },
  { emoji: "🐞", name: "瓢蟲" },
  { emoji: "🦇", name: "蝙蝠" },
  { emoji: "🐸", name: "青蛙" },
];
