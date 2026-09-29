// Channel catalog for the DirecTV lineup at Fort Myers: the favorites grid and a name fallback when the
// guide has no row for a channel. The live guide (TV Media) is the source of truth for the full lineup.
export type Channel = { num: number; callsign: string; name: string; cat: "local" | "sports" | "entertainment" | "news" | "package"; group?: string };

export const CHANNELS: Channel[] = [
  { num: 11, callsign: "WINK", name: "CBS (WINK)", cat: "local" },
  { num: 20, callsign: "WBBH", name: "NBC (WBBH)", cat: "local" },
  { num: 26, callsign: "WZVN", name: "ABC (WZVN)", cat: "local" },
  { num: 36, callsign: "WFTX", name: "FOX (WFTX)", cat: "local" },
  { num: 206, callsign: "ESPN", name: "ESPN", cat: "sports" },
  { num: 209, callsign: "ESPN2", name: "ESPN2", cat: "sports" },
  { num: 208, callsign: "ESPNU", name: "ESPNU", cat: "sports" },
  { num: 219, callsign: "FS1", name: "FOX Sports 1", cat: "sports" },
  { num: 618, callsign: "FS2", name: "FOX Sports 2", cat: "sports" },
  { num: 212, callsign: "NFLN", name: "NFL Network", cat: "sports" },
  { num: 213, callsign: "MLBN", name: "MLB Network", cat: "sports" },
  { num: 216, callsign: "NBATV", name: "NBA TV", cat: "sports" },
  { num: 215, callsign: "NHLN", name: "NHL Network", cat: "sports" },
  { num: 218, callsign: "GOLF", name: "Golf Channel", cat: "sports" },
  { num: 217, callsign: "TENNIS", name: "Tennis Channel", cat: "sports" },
  { num: 221, callsign: "CBSSN", name: "CBS Sports Network", cat: "sports" },
  { num: 610, callsign: "BTN", name: "Big Ten Network", cat: "sports" },
  { num: 611, callsign: "SECN", name: "SEC Network", cat: "sports" },
  { num: 612, callsign: "ACCN", name: "ACC Network", cat: "sports" },
  { num: 654, callsign: "FDSUN", name: "FanDuel Sports Sun", cat: "sports" },
  { num: 245, callsign: "TNT", name: "TNT", cat: "entertainment" },
  { num: 247, callsign: "TBS", name: "TBS", cat: "entertainment" },
  { num: 202, callsign: "CNN", name: "CNN", cat: "news" },
  { num: 360, callsign: "FNC", name: "Fox News", cat: "news" },
  { num: 356, callsign: "MSNBC", name: "MSNBC", cat: "news" },
];
// NFL Sunday Ticket and the other packages are read from the live guide (their callsigns there are the truth:
// 9556 is NFLST4, not NFLST3), so they are not listed here.

const byNum = new Map(CHANNELS.map((c) => [c.num, c]));
export const findChannel = (num: number | string | null | undefined) => (num == null ? null : byNum.get(Number(num)) || null);
// Starting favorites for a venue that has not picked its own: the locals and the main sports networks.
export const DEFAULT_FAVORITES = CHANNELS.filter((c) => c.cat === "local" || c.cat === "sports").map((c) => c.num);
export const favorites = () => CHANNELS.filter((c) => c.cat === "local" || c.cat === "sports");
// A favorite may be any channel in the lineup; unknown ones get a bare entry and the page names them from the guide.
export const channelFor = (num: number): Channel => byNum.get(num) || { num, callsign: "", name: "", cat: "sports" };
