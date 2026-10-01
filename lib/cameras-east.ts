import type { Camera } from "./cctv.ts";

// Eastern-province cameras from Longdo's camera list (traffic.longdo.com/camera.json), snapshot 2026-10-02. Played by the
// browser straight from the iTIC relay. All 46 were played in Chrome with hls.js for 12 s each; none shared a picture.
// Left out on purpose: the 83 Chonburi cameras in the list, which all point at one "tempsus" placeholder loop (a suspended
// stream), so each would show the same video for a different place. Most of these are city traffic cameras, not canals.
type Row = { code: string; source: "doh" | "itic"; name: string; lat: number; lon: number; hls: string };
const ROWS: Row[] = [
  { code: "ITICM_BMAMI0129", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนเทพคุณากร มุ่งหน้าวงเวียน", lat: 13.66887, lon: 101.05511, hls: "https://camerai1.iticfoundation.org/hls/ccs00.m3u8" },
  { code: "ITICM_BMAMI0130", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนเทพคุณากร มุ่งหน้าถนนสิริโสธร", lat: 13.6688, lon: 101.05499, hls: "https://camerai1.iticfoundation.org/hls/ccs01.m3u8" },
  { code: "ITICM_BMAMI0131", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนเทพคุณากร มุ่งหน้าวัดบางพระ", lat: 13.66877, lon: 101.05509, hls: "https://camerai1.iticfoundation.org/hls/ccs02.m3u8" },
  { code: "ITICM_BMAMI0132", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนเทพคุณากร-ถนนสิริโสธร มุ่งหน้าจ.ชลบุรี", lat: 13.66608, lon: 101.04983, hls: "https://camerai1.iticfoundation.org/hls/ccs03.m3u8" },
  { code: "ITICM_BMAMI0133", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนเทพคุณากร-ถนนสิริโสธร มุ่งหน้าเข้าจ.ฉะเชิงเทรา", lat: 13.66652, lon: 101.04991, hls: "https://camerai1.iticfoundation.org/hls/ccs05.m3u8" },
  { code: "ITICM_BMAMI0134", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนเทพคุณากร-ถนนสิริโสธร มุ่งหน้าถนนเทพคุณากร", lat: 13.66624, lon: 101.05013, hls: "https://camerai1.iticfoundation.org/hls/ccs06.m3u8" },
  { code: "ITICM_BMAMI0135", source: "itic", name: "ฉะเชิงเทรา · วงเวียนหน้าอนุสาวรีย์พระยาศรีสุนทรโวหาร มุ่งหน้าถนนเทพคุณากร", lat: 13.67577, lon: 101.06922, hls: "https://camerai1.iticfoundation.org/hls/ccs07.m3u8" },
  { code: "ITICM_BMAMI0136", source: "itic", name: "ฉะเชิงเทรา · วงเวียนหน้าอนุสาวรีย์พระยาศรีสุนทรโวหาร", lat: 13.67582, lon: 101.06934, hls: "https://camerai1.iticfoundation.org/hls/ccs08.m3u8" },
  { code: "ITICM_BMAMI0137", source: "itic", name: "ฉะเชิงเทรา · วงเวียนหน้าอนุสาวรีย์พระยาศรีสุนทรโวหาร มุ่งหน้าถนนศรีโสธร", lat: 13.67577, lon: 101.06953, hls: "https://camerai1.iticfoundation.org/hls/ccs09.m3u8" },
  { code: "ITICM_BMAMI0138", source: "itic", name: "ฉะเชิงเทรา · วงเวียนหน้าอนุสาวรีย์พระยาศรีสุนทรโวหาร มุ่งหน้าถนนศรีโสธรตัดใหม่", lat: 13.67597, lon: 101.06933, hls: "https://camerai1.iticfoundation.org/hls/ccs12.m3u8" },
  { code: "ITICM_BMAMI0139", source: "itic", name: "ฉะเชิงเทรา · ทางออกบิ๊กซี ฉะเชิงเทรา 2 มุ่งหน้าวงเวียน", lat: 13.68205, lon: 101.06698, hls: "https://camerai1.iticfoundation.org/hls/ccs13.m3u8" },
  { code: "ITICM_BMAMI0140", source: "itic", name: "ฉะเชิงเทรา · ทางออกบิ๊กซี ฉะเชิงเทรา 2 มุ่งหน้าถนนมหาจักรพรรดิ์", lat: 13.68239, lon: 101.06683, hls: "https://camerai1.iticfoundation.org/hls/ccs14.m3u8" },
  { code: "ITICM_BMAMI0141", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนพระยาศรีสุนทร-ถนนศรีโสธรตัดใหม่ มุ่งหน้าถนนมหาจักรพรรดิ์", lat: 13.68297, lon: 101.06657, hls: "https://camerai1.iticfoundation.org/hls/ccs15.m3u8" },
  { code: "ITICM_BMAMI0142", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนพระยาศรีสุนทร-ถนนศรีโสธรตัดใหม่ มุ่งหน้าวงเวียน", lat: 13.68283, lon: 101.06663, hls: "https://camerai1.iticfoundation.org/hls/ccs16.m3u8" },
  { code: "ITICM_BMAMI0143", source: "itic", name: "ฉะเชิงเทรา · ถนนเอมอรอุทิศ 2 มุ่งหน้าถนนศรีโสธรตัดใหม่-ถนนมหาจักรพรรดิ์", lat: 13.68781, lon: 101.06456, hls: "https://camerai1.iticfoundation.org/hls/ccs17.m3u8" },
  { code: "ITICM_BMAMI0144", source: "itic", name: "ฉะเชิงเทรา · ถนนเอมอรอุทิศ 2 มุ่งหน้าถนนศรีโสธรตัดใหม่-วงเวียน", lat: 13.68753, lon: 101.06467, hls: "https://camerai1.iticfoundation.org/hls/ccs18.m3u8" },
  { code: "ITICM_BMAMI0145", source: "itic", name: "ฉะเชิงเทรา · ถนนเอมอรอุทิศ 1", lat: 13.68863, lon: 101.06422, hls: "https://camerai1.iticfoundation.org/hls/ccs19.m3u8" },
  { code: "ITICM_BMAMI0146", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนศรีโสธรตัดใหม่-ถนนมหาจักรพรรดิ์ มุ่งหน้ากรุงเทพฯ", lat: 13.69427, lon: 101.06334, hls: "https://camerai1.iticfoundation.org/hls/ccs20.m3u8" },
  { code: "ITICM_BMAMI0147", source: "itic", name: "ฉะเชิงเทรา · สามแยกถนนศรีโสธรตัดใหม่-ถนนมหาจักรพรรดิ์ มุ่งหน้าเข้าจ.ฉะเชิงเทรา", lat: 13.69423, lon: 101.06359, hls: "https://camerai1.iticfoundation.org/hls/ccs21.m3u8" },
  { code: "ITICM_BMAMI0169", source: "itic", name: "ฉะเชิงเทรา · หน้าโรงเรียนวัดโสธรวรารามวรวิหาร", lat: 13.67415, lon: 101.06505, hls: "https://camerai1.iticfoundation.org/hls/ccs24.m3u8" },
  { code: "ITICM_BMAMI0170", source: "itic", name: "ฉะเชิงเทรา · ซอยเทพคุณากร 5", lat: 13.67145, lon: 101.06008, hls: "https://camerai1.iticfoundation.org/hls/ccs25.m3u8" },
  { code: "ITICM_BMAMI0171", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 18", lat: 13.67782, lon: 101.06877, hls: "https://camerai1.iticfoundation.org/hls/ccs26.m3u8" },
  { code: "ITICM_BMAMI0172", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 18", lat: 13.67785, lon: 101.06855, hls: "https://camerai1.iticfoundation.org/hls/ccs27.m3u8" },
  { code: "ITICM_BMAMI0173", source: "itic", name: "ฉะเชิงเทรา · ถนนประชาสรรค์", lat: 13.68063, lon: 101.06752, hls: "https://camerai1.iticfoundation.org/hls/ccs28.m3u8" },
  { code: "ITICM_BMAMI0174", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 15", lat: 13.6811, lon: 101.06745, hls: "https://camerai1.iticfoundation.org/hls/ccs29.m3u8" },
  { code: "ITICM_BMAMI0175", source: "itic", name: "ฉะเชิงเทรา · ถนนหน้าเมือง", lat: 13.68445, lon: 101.066, hls: "https://camerai1.iticfoundation.org/hls/ccs30.m3u8" },
  { code: "ITICM_BMAMI0176", source: "itic", name: "ฉะเชิงเทรา · ถนนเอมอรอุทิศ 1", lat: 13.68877, lon: 101.06419, hls: "https://camerai1.iticfoundation.org/hls/ccs31.m3u8" },
  { code: "ITICM_BMAMI0177", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 5", lat: 13.69029, lon: 101.06385, hls: "https://camerai1.iticfoundation.org/hls/ccs32.m3u8" },
  { code: "ITICM_BMAMI0178", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 5", lat: 13.69005, lon: 101.06388, hls: "https://camerai1.iticfoundation.org/hls/ccs33.m3u8" },
  { code: "ITICM_BMAMI0179", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 4/1", lat: 13.6912, lon: 101.06378, hls: "https://camerai1.iticfoundation.org/hls/ccs34.m3u8" },
  { code: "ITICM_BMAMI0180", source: "itic", name: "ฉะเชิงเทรา · ศรีโสธรตัดใหม่ 4/1", lat: 13.69115, lon: 101.06369, hls: "https://camerai1.iticfoundation.org/hls/ccs35.m3u8" },
  { code: "ITICM_BMAMI0181", source: "itic", name: "ฉะเชิงเทรา · สามแยกศรีโสธรตัดใหม่ - ถนนมหาจักพรรดิ์", lat: 13.6943, lon: 101.06351, hls: "https://camerai1.iticfoundation.org/hls/ccs36.m3u8" },
  { code: "ITICM_BMAMI0182", source: "itic", name: "ฉะเชิงเทรา · สามแยกศรีโสธรตัดใหม่ – ถนนมหาจักพรรดิ์", lat: 13.69435, lon: 101.06332, hls: "https://camerai1.iticfoundation.org/hls/ccs37.m3u8" },
  { code: "ITICM_BMAMI0183", source: "itic", name: "ฉะเชิงเทรา · สามแยกเทศบาล – ถนนมหาจักพรรดิ์", lat: 13.69255, lon: 101.07099, hls: "https://camerai1.iticfoundation.org/hls/ccs38.m3u8" },
  { code: "ITICM_BMAMI0184", source: "itic", name: "ฉะเชิงเทรา · สามแยกเทศบาล – ถนนมหาจักพรรดิ์", lat: 13.69257, lon: 101.0709, hls: "https://camerai1.iticfoundation.org/hls/ccs39.m3u8" },
  { code: "ITICM_BMAMI0185", source: "itic", name: "ฉะเชิงเทรา · หน้าโรงเรียนเทพประสิทธิ์วิทยา", lat: 13.69159, lon: 101.07053, hls: "https://camerai1.iticfoundation.org/hls/ccs40.m3u8" },
  { code: "ITICM_BMAMI0186", source: "itic", name: "ฉะเชิงเทรา · หน้าโรงเรียนเทพประสิทธิ์วิทยา", lat: 13.69167, lon: 101.07059, hls: "https://camerai1.iticfoundation.org/hls/ccs41.m3u8" },
  { code: "ITICM_BMAMI0294", source: "itic", name: "ฉะเชิงเทรา · แยกเทพราช W", lat: 13.63076, lon: 101.03611, hls: "https://camera1.iticfoundation.org/hls/10.8.0.23_8555.m3u8" },
  { code: "ITICM_BMAMI0295", source: "itic", name: "ฉะเชิงเทรา · แยกเทพราช N", lat: 13.63102, lon: 101.03662, hls: "https://camera1.iticfoundation.org/hls/10.8.0.23_8556.m3u8" },
  { code: "ITICM_BMAMI0296", source: "itic", name: "ฉะเชิงเทรา · แยกเทพราช S", lat: 13.63046, lon: 101.03613, hls: "https://camera1.iticfoundation.org/hls/10.8.0.23_8554.m3u8" },
  { code: "ITICM_BMAMI0297", source: "itic", name: "ฉะเชิงเทรา · แยกหัวเนิน N", lat: 13.6207, lon: 101.03099, hls: "https://camera1.iticfoundation.org/hls/10.8.0.24_8554.m3u8" },
  { code: "ITICM_BMAMI0298", source: "itic", name: "ฉะเชิงเทรา · แยกหัวเนิน E", lat: 13.6202, lon: 101.03103, hls: "https://camera1.iticfoundation.org/hls/10.8.0.24_8555.m3u8" },
  { code: "ITICM_BMAMI0299", source: "itic", name: "ฉะเชิงเทรา · แยกหัวเนิน S", lat: 13.61994, lon: 101.03044, hls: "https://camera1.iticfoundation.org/hls/10.8.0.24_8556.m3u8" },
  { code: "DOH-PER-9-031", source: "doh", name: "ทล.3 - อ.คลองใหญ่ จ.ตราด ทิศทางมุ่งหน้าเข้า จ.ตราด", lat: 12.2515, lon: 102.5704, hls: "https://camerai1.iticfoundation.org/pass/180.180.242.207:1935/Phase9/PER_9_031.stream/playlist.m3u8" },
  { code: "DOH-PER-9-017", source: "doh", name: "ทล.359 - อ.กบินทร์บุรี จ.ปราจีนบุรี ทิศทางมุ่งหน้าเข้า จ.สระแก้ว", lat: 13.77301, lon: 101.82733, hls: "https://camerai1.iticfoundation.org/pass/180.180.242.207:1935/Phase9/PER-9-017.stream/playlist.m3u8" },
  { code: "DOH-PER-10-010", source: "doh", name: "ทล.33- อ.เมือง จ.สระแก้ว ทิศทางมุ่งหน้าเข้า จ.ปราจีนบุรี", lat: 13.90309, lon: 101.97621, hls: "https://camerai1.iticfoundation.org/pass/180.180.242.207:1935/Phase10/PER_10_010.stream/playlist.m3u8" },
];

export const EAST_CAMERAS: Camera[] = ROWS.map((r) => ({ code: r.code, source: r.source, name: r.name, lat: r.lat, lon: r.lon, cams: [r.code], labels: [r.name], hls: r.hls }));
