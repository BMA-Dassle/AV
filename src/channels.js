'use strict';
// Channel catalog for the DirecTV lineup at Fort Myers (TV Guide lineup 9166).
// DirecTV national numbers plus the Fort Myers locals. The guide provider should replace this
// with the lineup's real channel list once the new guide API is wired up.
const CHANNELS = [
  { num: 11,  callsign: 'WINK',   name: 'CBS (WINK)',         cat: 'local' },
  { num: 20,  callsign: 'WBBH',   name: 'NBC (WBBH)',         cat: 'local' },
  { num: 26,  callsign: 'WZVN',   name: 'ABC (WZVN)',         cat: 'local' },
  { num: 36,  callsign: 'WFTX',   name: 'FOX (WFTX)',         cat: 'local' },
  { num: 206, callsign: 'ESPN',   name: 'ESPN',               cat: 'sports' },
  { num: 209, callsign: 'ESPN2',  name: 'ESPN2',              cat: 'sports' },
  { num: 208, callsign: 'ESPNU',  name: 'ESPNU',              cat: 'sports' },
  { num: 219, callsign: 'FS1',    name: 'FOX Sports 1',       cat: 'sports' },
  { num: 618, callsign: 'FS2HD',  name: 'FOX Sports 2',       cat: 'sports' },
  { num: 212, callsign: 'NFLHD',  name: 'NFL Network',        cat: 'sports' },
  { num: 213, callsign: 'MLBN',   name: 'MLB Network',        cat: 'sports' },
  { num: 216, callsign: 'NBATV',  name: 'NBA TV',             cat: 'sports' },
  { num: 215, callsign: 'NHLN',   name: 'NHL Network',        cat: 'sports' },
  { num: 218, callsign: 'GolfHD', name: 'Golf Channel',       cat: 'sports' },
  { num: 217, callsign: 'TENNIS', name: 'Tennis Channel',     cat: 'sports' },
  { num: 221, callsign: 'CBSSN',  name: 'CBS Sports Network', cat: 'sports' },
  { num: 610, callsign: 'BTN',    name: 'Big Ten Network',    cat: 'sports' },
  { num: 611, callsign: 'SECN',   name: 'SEC Network',        cat: 'sports' },
  { num: 612, callsign: 'ACCN',   name: 'ACC Network',        cat: 'sports' },
  { num: 654, callsign: 'FDSUN',  name: 'FanDuel Sports Sun', cat: 'sports' },
  { num: 245, callsign: 'TNT',    name: 'TNT',                cat: 'entertainment' },
  { num: 247, callsign: 'TBS',    name: 'TBS',                cat: 'entertainment' },
  { num: 202, callsign: 'CNN',    name: 'CNN',                cat: 'news' },
  { num: 360, callsign: 'FNC',    name: 'Fox News',           cat: 'news' },
  { num: 356, callsign: 'MSNBC',  name: 'MSNBC',              cat: 'news' },
];
// NFL Sunday Ticket (commercial) game channels seen live on the boxes on 2026-09-28: 9555-9569.
for (let i = 0; i < 15; i++) CHANNELS.push({ num: 9555 + i, callsign: 'NFLST', name: `Sunday Ticket ${i + 1}`, cat: 'package', group: 'NFL Sunday Ticket' });

const byNum = new Map(CHANNELS.map((c) => [c.num, c]));
module.exports = {
  CHANNELS,
  find: (num) => byNum.get(Number(num)) || null,
  favorites: () => CHANNELS.filter((c) => c.cat === 'local' || c.cat === 'sports'),
};
