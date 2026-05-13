/**
 * DART 전체 법인 코드 목록을 Supabase dart_corps 테이블에 적재합니다.
 * 실행: node --env-file=.env scripts/seed-dart-corps.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { inflateRaw } from "zlib";
import { promisify } from "util";

const inflateRawAsync = promisify(inflateRaw);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function downloadAndDecompress() {
  console.log("DART corpCode.xml 다운로드 중...");
  const res = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${process.env.DART_API_KEY}`,
    { redirect: "follow" },
  );
  if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  console.log(`ZIP 크기: ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);

  // End of Central Directory에서 실제 압축 크기 읽기
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ZIP EOCD 없음");

  const cdOffset = bytes.readUInt32LE(eocdOffset + 16);
  const compSize = bytes.readUInt32LE(cdOffset + 20);
  const localOffset = bytes.readUInt32LE(cdOffset + 42);
  const fnLen = bytes.readUInt16LE(localOffset + 26);
  const extraLen = bytes.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + fnLen + extraLen;

  console.log("압축 해제 중...");
  const xml = (await inflateRawAsync(bytes.slice(dataStart, dataStart + compSize))).toString("utf8");
  console.log(`XML 크기: ${(xml.length / 1024 / 1024).toFixed(1)} MB`);
  return xml;
}

function parseXml(xml) {
  const entries = [];
  const listRegex = /<list>([\s\S]*?)<\/list>/g;
  const fieldRegex = (name) => new RegExp(`<${name}>([^<]*)<\/${name}>`);

  let match;
  while ((match = listRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (name) => {
      const m = fieldRegex(name).exec(block);
      return m ? m[1].trim() : "";
    };
    const corpCode = get("corp_code");
    const corpName = get("corp_name");
    if (!corpCode || !corpName) continue;

    entries.push({
      corp_code: corpCode,
      corp_name: corpName,
      stock_code: get("stock_code") || null,
      modify_date: get("modify_date") || null,
    });
  }
  return entries;
}

async function upsertBatches(entries) {
  const BATCH = 1000;
  console.log(`총 ${entries.length}개 법인 업로드 시작`);

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const { error } = await supabase.from("dart_corps").upsert(batch, { onConflict: "corp_code" });
    if (error) throw new Error(`업로드 오류 (${i}~${i + batch.length}): ${error.message}`);
    process.stdout.write(`\r${i + batch.length} / ${entries.length}`);
  }
  console.log("\n완료");
}

const xml = await downloadAndDecompress();
const entries = parseXml(xml);
await upsertBatches(entries);
