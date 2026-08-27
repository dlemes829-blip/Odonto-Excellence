type CellMap = Map<number, string>;

type ParsedLead = {
  source_key: string;
  action_date: string;
  action_name: string;
  location: string;
  campaign: string;
  sheet_number: number | null;
  name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  captured_by: string | null;
  appointment_note: string | null;
  status: string;
  status_raw: string | null;
  scheduled_by: string | null;
  outcome: string | null;
  outcome_date: string | null;
  value: number | null;
};

type ParsedConversion = {
  source_key: string;
  name: string;
  effective_date: string | null;
  value: number | null;
  tool: string | null;
  scheduled_by: string | null;
  converted_by: string | null;
  bonus: number | null;
};

export type ManagementSpreadsheetPayload = {
  leads: ParsedLead[];
  conversions: ParsedConversion[];
  actionDates: string[];
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

const decoder = new TextDecoder('utf-8');

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (readU32(view, offset) === 0x06054b50) return offset;
  }
  throw new Error('Arquivo XLSX inválido ou corrompido.');
}

function listZipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  const count = readU16(view, eocd + 10);
  let offset = readU32(view, eocd + 16);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < count; index += 1) {
    if (readU32(view, offset) !== 0x02014b50) throw new Error('Estrutura ZIP do XLSX inválida.');
    const method = readU16(view, offset + 10);
    const compressedSize = readU32(view, offset + 20);
    const nameLength = readU16(view, offset + 28);
    const extraLength = readU16(view, offset + 30);
    const commentLength = readU16(view, offset + 32);
    const localOffset = readU32(view, offset + 42);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name.replace(/^\//, ''), { name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readU32(view, entry.localOffset) !== 0x04034b50) throw new Error('Entrada XLSX inválida.');
  const nameLength = readU16(view, entry.localOffset + 26);
  const extraLength = readU16(view, entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRaw(compressed);
  throw new Error('A planilha usa uma compactação XLSX não suportada pelo navegador.');
}

function xml(text: string) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML interno da planilha inválido.');
  return doc;
}

function normalizePath(base: string, target: string) {
  if (target.startsWith('/')) return target.replace(/^\//, '');
  const parts = base.split('/');
  parts.pop();
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function columnNumber(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  let number = 0;
  for (const letter of letters) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
}

function cellText(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') return Array.from(cell.querySelectorAll('is t')).map((node) => node.textContent || '').join('');
  const raw = cell.querySelector(':scope > v')?.textContent ?? '';
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  return raw;
}

function worksheetRows(doc: Document, sharedStrings: string[]) {
  return Array.from(doc.querySelectorAll('sheetData > row')).map((row) => {
    const cells: CellMap = new Map();
    for (const cell of Array.from(row.querySelectorAll(':scope > c'))) {
      const ref = cell.getAttribute('r') || '';
      const value = cellText(cell, sharedStrings).trim();
      if (value) cells.set(columnNumber(ref), value);
    }
    return { rowNumber: Number(row.getAttribute('r') || 0), cells };
  });
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function nullable(value: string | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function numericText(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(raw)) {
    const number = Number(raw);
    return Number.isFinite(number) ? number.toFixed(0) : raw;
  }
  if (/^\d+\.0+$/.test(raw)) return raw.replace(/\.0+$/, '');
  return raw;
}

function phone(value: string | undefined) {
  const raw = numericText(value);
  if (!raw) return { raw: null, normalized: null };
  let normalized = raw.replace(/\D/g, '');
  if (normalized.length > 11) normalized = normalized.slice(-11);
  return { raw, normalized: normalized || null };
}

function excelDate(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  const number = Number(raw);
  if (Number.isFinite(number) && number > 20_000 && number < 100_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(number) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    let year = Number(br[3]);
    if (year < 100) year += 2000;
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function money(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  let normalized = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  else if (normalized.includes(',')) normalized = normalized.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function actionDateFromMarker(cells: CellMap) {
  for (const value of cells.values()) {
    const match = value.match(/A[ÇC][ÃA]O\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return null;
}

function normalizeStatus(rawValue: string | undefined, noteValue: string | undefined) {
  const raw = normalize(rawValue);
  const note = normalize(noteValue);
  const joined = `${raw} ${note}`;
  if (joined.includes('numero incorreto') || joined.includes('numero invalido')) return 'Número incorreto';
  if (joined.includes('nao tem interesse') || joined.includes('sem interesse')) return 'Não tem interesse';
  if (raw.includes('agendado')) return 'Agendado Sistema';
  if (raw.includes('aguardando')) return 'Aguardando';
  if (raw.includes('enviado mensagem')) return 'Enviado mensagem';
  return 'Novo';
}

function normalizeOutcome(value: string | undefined) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes('nao efetivado')) return 'Não Efetivado';
  if (raw.includes('efetivado')) return 'Efetivado';
  return value?.trim() || null;
}

function parseActionSheet(rows: Array<{ rowNumber: number; cells: CellMap }>) {
  const leads: ParsedLead[] = [];
  let currentDate: string | null = null;

  for (const row of rows) {
    const markerDate = actionDateFromMarker(row.cells);
    if (markerDate) {
      currentDate = markerDate;
      continue;
    }
    if (!currentDate) continue;

    const rawSheetNumber = Number(numericText(row.cells.get(1)) || 0);
    const sheetNumber = Number.isInteger(rawSheetNumber) && rawSheetNumber > 0 ? rawSheetNumber : null;
    const name = nullable(row.cells.get(2));
    if (!name) continue;
    if (normalize(name).includes('nome avaliacao')) continue;

    const phoneData = phone(row.cells.get(3));
    const capturedBy = nullable(row.cells.get(4));
    const appointmentNote = nullable(row.cells.get(5));
    const rawStatus = nullable(row.cells.get(6));
    const scheduledBy = nullable(row.cells.get(7));
    const outcome = normalizeOutcome(row.cells.get(8));

    // New spreadsheet blocks may contain valid contacts without a sequence
    // number in column A. Treat the physical XLSX row as the stable source key
    // and accept the row when it contains real contact/operational data.
    if (!sheetNumber && !phoneData.raw && !capturedBy && !appointmentNote && !rawStatus && !scheduledBy && !outcome) continue;
    const [year, month, day] = currentDate.split('-');
    leads.push({
      source_key: `xlsx-row-${row.rowNumber}`,
      action_date: currentDate,
      action_name: `Ação São Francisco ${day}/${month}/${year}`,
      location: 'São Francisco',
      campaign: 'Ação de Rua',
      sheet_number: sheetNumber,
      name,
      phone_raw: phoneData.raw,
      phone_normalized: phoneData.normalized,
      captured_by: capturedBy,
      appointment_note: appointmentNote,
      status: normalizeStatus(rawStatus || undefined, appointmentNote || undefined),
      status_raw: rawStatus,
      scheduled_by: scheduledBy,
      outcome,
      outcome_date: excelDate(row.cells.get(9)),
      value: money(row.cells.get(10)),
    });
  }
  return leads;
}

function parseConversionSheet(rows: Array<{ rowNumber: number; cells: CellMap }>) {
  const conversions: ParsedConversion[] = [];
  for (const row of rows) {
    const sequence = Number(numericText(row.cells.get(1)) || 0);
    const name = nullable(row.cells.get(2));
    if (!Number.isInteger(sequence) || sequence < 1 || !name) continue;
    if (normalize(name).includes('nome do paciente')) continue;
    conversions.push({
      source_key: `xlsx-conversion-row-${row.rowNumber}`,
      name,
      effective_date: excelDate(row.cells.get(3)),
      value: money(row.cells.get(4)),
      tool: nullable(row.cells.get(5)),
      scheduled_by: nullable(row.cells.get(6)),
      converted_by: nullable(row.cells.get(7)),
      bonus: money(row.cells.get(8)),
    });
  }
  return conversions;
}

export async function parseManagementWorkbook(file: File): Promise<ManagementSpreadsheetPayload> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione uma planilha no formato .xlsx.');
  if (file.size > 12 * 1024 * 1024) throw new Error('A planilha é grande demais para a importação segura pelo navegador.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = listZipEntries(bytes);
  const readText = async (path: string) => {
    const entry = entries.get(path.replace(/^\//, ''));
    if (!entry) throw new Error(`Arquivo interno ausente: ${path}`);
    return decoder.decode(await readZipEntry(bytes, entry));
  };

  const sharedStrings: string[] = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const sharedDoc = xml(await readText('xl/sharedStrings.xml'));
    for (const item of Array.from(sharedDoc.querySelectorAll('sst > si'))) {
      sharedStrings.push(Array.from(item.querySelectorAll('t')).map((node) => node.textContent || '').join(''));
    }
  }

  const workbookPath = 'xl/workbook.xml';
  const workbookDoc = xml(await readText(workbookPath));
  const relsPath = 'xl/_rels/workbook.xml.rels';
  const relsDoc = xml(await readText(relsPath));
  const relationships = new Map<string, string>();
  for (const rel of Array.from(relsDoc.querySelectorAll('Relationships > Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) relationships.set(id, normalizePath(workbookPath, target));
  }

  let actionRows: Array<{ rowNumber: number; cells: CellMap }> | null = null;
  let conversionRows: Array<{ rowNumber: number; cells: CellMap }> | null = null;
  for (const sheet of Array.from(workbookDoc.querySelectorAll('sheets > sheet'))) {
    const name = sheet.getAttribute('name') || '';
    const relationshipId = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = relationshipId ? relationships.get(relationshipId) : null;
    if (!target || !entries.has(target)) continue;
    const rows = worksheetRows(xml(await readText(target)), sharedStrings);
    const normalizedName = normalize(name);
    if (normalizedName.includes('acao sao francisco')) actionRows = rows;
    if (normalizedName.includes('conversao e amigo do peito')) conversionRows = rows;
  }

  if (!actionRows) throw new Error('Não encontrei a aba “Ação São Francisco” nesta planilha.');
  const leads = parseActionSheet(actionRows);
  const conversions = conversionRows ? parseConversionSheet(conversionRows) : [];
  if (!leads.length && !conversions.length) throw new Error('Nenhum cadastro reconhecido na planilha.');

  return {
    leads,
    conversions,
    actionDates: Array.from(new Set(leads.map((lead) => lead.action_date))).sort(),
  };
}
