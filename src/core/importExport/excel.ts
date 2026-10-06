import ExcelJS from 'exceljs';
import { calculateRevisionSchedule, createQuestion } from '../revision/engine';
import { isDateKey, todayKey } from '../revision/dates';
import type { Difficulty, Question } from '../../types';

const headerMap: Record<string, string> = {
  question: 'title',
  'question name': 'title',
  title: 'title',
  topic: 'topic',
  difficulty: 'difficulty',
  'date added': 'createdAt',
  'date solved': 'createdAt',
  'day 0': 'day0',
  'day 3': 'day3',
  '+3 days': 'day3',
  'day 7': 'day7',
  '+7 days': 'day7',
  'day 15': 'day15',
  '+15 days': 'day15',
  'day 30': 'day30',
  '+30 days': 'day30',
  'day 60': 'day60',
  '+60 days': 'day60',
  'day 120': 'day120',
  '+120 days': 'day120',
  'next review': 'nextReviewDate',
  status: 'status',
  'due today?': 'dueToday',
  tags: 'tags',
  notes: 'notes',
  problem: 'problem',
  solution: 'solution',
  source: 'source',
  url: 'url',
  mastered: 'mastered',
  'review count': 'reviewCount',
  'completed stages': 'completedStages',
};

export interface ImportPreview {
  questions: Question[];
  skipped: string[];
  sheetName: string;
  detectedCount: number;
  attentionCount: number;
}

interface SourceRow {
  rowNumber: number;
  values: unknown[];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function textValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('formula' in value || 'sharedFormula' in value) return 'result' in value ? value.result ?? '' : '';
  if ('result' in value) return value.result;
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part: { text?: string }) => part.text ?? '').join('');
  }
  return value;
}

function rowValues(row: ExcelJS.Row): unknown[] {
  const values: unknown[] = [];
  row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    values[columnNumber - 1] = textValue(cell.value);
  });
  return values;
}

function dateCellToKey(input: unknown): string | null {
  const value = textValue(input);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (isDateKey(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

export async function previewExcel(file: File): Promise<ImportPreview> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Import supports .xlsx workbooks. Save legacy .xls files as .xlsx and try again.');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('This file is not a readable .xlsx workbook. Check the file and try again.');
  }
  let selected: { name: string; rows: SourceRow[]; columns: string[]; recognized: number } | undefined;
  workbook.eachSheet((sheet) => {
    if (selected) return;
    let headerRow = 0;
    let columns: string[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (headerRow) return;
      const labels = rowValues(row).map((item) => normalizeHeader(item));
      if (!labels.some((label) => ['question', 'question name', 'title'].includes(label))) return;
      headerRow = rowNumber;
      columns = labels.map((label) => headerMap[label] ?? '');
    });
    const recognized = columns.filter(Boolean).length;
    if (!headerRow || recognized < 2) return;
    const rows: SourceRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      rows.push({ rowNumber, values: rowValues(row) });
    });
    selected = { name: sheet.name, rows, columns, recognized };
  });
  if (!selected) throw new Error('No sheet with recognizable question and date columns was found.');

  const skipped: string[] = [];
  const questions: Question[] = [];
  const attentionRows = new Set<number>();
  let detectedCount = 0;
  for (const row of selected.rows) {
    const mapped: Record<string, unknown> = {};
    selected.columns.forEach((column, columnIndex) => {
      if (column) mapped[column] = row.values[columnIndex] ?? '';
    });
    if (!Object.values(mapped).some((value) => value !== null && value !== undefined && String(value).trim() !== '')) continue;
    detectedCount += 1;
    const title = String(mapped.title ?? '').trim();
    if (!title) {
      attentionRows.add(row.rowNumber);
      skipped.push(`Row ${row.rowNumber}: question title is missing.`);
      continue;
    }
    const topic = String(mapped.topic ?? 'Uncategorized').trim() || 'Uncategorized';
    const rawDateAdded = mapped.createdAt;
    const parsedDateAdded = dateCellToKey(rawDateAdded);
    if (String(rawDateAdded ?? '').trim() && !parsedDateAdded) {
      attentionRows.add(row.rowNumber);
      skipped.push(`Row ${row.rowNumber}: date added/solved is invalid.`);
      continue;
    }
    const dateAdded = parsedDateAdded ?? todayKey();
    const rawDifficulty = String(mapped.difficulty ?? 'Medium').toLowerCase();
    const difficulty: Difficulty = rawDifficulty === 'easy' ? 'Easy' : rawDifficulty === 'hard' ? 'Hard' : 'Medium';
    const question = createQuestion({
      title,
      topic,
      difficulty,
      createdAt: dateAdded,
      problem: String(mapped.problem ?? ''),
      solution: String(mapped.solution ?? ''),
      notes: String(mapped.notes ?? ''),
      source: String(mapped.source ?? ''),
      url: String(mapped.url ?? ''),
      tags: String(mapped.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
    });
    const canonicalKeys = ['day0', 'day3', 'day7', 'day15', 'day30', 'day60', 'day120'];
    const calculated = calculateRevisionSchedule(dateAdded);
    question.revisionSchedule = canonicalKeys.map((key, stage) => {
      const rawDate = mapped[key];
      const date = dateCellToKey(rawDate);
      if (String(rawDate ?? '').trim() && !date) {
        attentionRows.add(row.rowNumber);
        skipped.push(`Row ${row.rowNumber}: ${key} is invalid; recalculated from Date Added.`);
      }
      return date ?? calculated[stage];
    });
    const status = String(mapped.status ?? '').toLowerCase();
    const mastered = ['true', 'yes', '1'].includes(String(mapped.mastered ?? '').toLowerCase()) || status.includes('mastered');
    const completedStages = String(mapped.completedStages ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(Number)
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    if (completedStages.length) question.completedStages = [...new Set(completedStages)].sort((a, b) => a - b);
    else if (mastered) question.completedStages = [0, 1, 2, 3, 4, 5, 6];
    question.pendingReinforcement = status === 'reinforcement';
    const explicitNext = dateCellToKey(mapped.nextReviewDate);
    question.nextReviewDate = explicitNext ?? (
      mastered ? question.revisionSchedule[6] : question.revisionSchedule[Math.min(question.completedStages.length, 6)]
    );
    if (!explicitNext && (status === 'due today' || status === 'overdue')) question.nextReviewDate = dateAdded;
    if (!explicitNext && String(mapped.dueToday ?? '').toLowerCase().includes('today')) question.nextReviewDate = todayKey();
    questions.push(question);
  }
  return {
    questions,
    skipped,
    sheetName: selected.name,
    detectedCount,
    attentionCount: attentionRows.size,
  };
}

export async function createExcelBuffer(questions: Question[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RecallForge';
  const sheet = workbook.addWorksheet('DSA Revision Tracker', { views: [{ state: 'frozen', ySplit: 1 }] });
  const columns = [
    ['Question', 'title', 36], ['Topic', 'topic', 22], ['Difficulty', 'difficulty', 14],
    ['Date Added', 'createdAt', 14], ['Day 0', 'day0', 14], ['Day 3', 'day3', 14],
    ['Day 7', 'day7', 14], ['Day 15', 'day15', 14], ['Day 30', 'day30', 14],
    ['Day 60', 'day60', 14], ['Day 120', 'day120', 14], ['Next Review', 'nextReview', 14],
    ['Status', 'status', 16], ['Review Count', 'reviewCount', 14], ['Completed Stages', 'completedStages', 18],
    ['Mastered', 'mastered', 12], ['Tags', 'tags', 24], ['Problem', 'problem', 48],
    ['Notes', 'notes', 42], ['Solution', 'solution', 54], ['Source', 'source', 20], ['URL', 'url', 40],
  ] as const;
  sheet.columns = columns.map(([header, key, width]) => ({ header, key, width }));
  const rows = questions.map((question) => ({
    title: question.title,
    topic: question.topic,
    difficulty: question.difficulty,
    createdAt: question.createdAt,
    day0: question.revisionSchedule[0],
    day3: question.revisionSchedule[1],
    day7: question.revisionSchedule[2],
    day15: question.revisionSchedule[3],
    day30: question.revisionSchedule[4],
    day60: question.revisionSchedule[5],
    day120: question.revisionSchedule[6],
    nextReview: question.nextReviewDate,
    status: question.completedStages.includes(6) ? 'Mastered' : question.pendingReinforcement ? 'Reinforcement' : question.completedStages.length === 0 ? 'New' : 'Learning',
    reviewCount: question.reviewHistory.length,
    completedStages: question.completedStages.join(', '),
    mastered: question.completedStages.includes(6) ? 'Yes' : 'No',
    tags: question.tags.join(', '),
    problem: question.problem,
    notes: question.notes,
    solution: question.solution,
    source: question.source,
    url: question.url,
  }));
  sheet.addRows(rows);
  sheet.autoFilter = { from: 'A1', to: `V${Math.max(rows.length + 1, 1)}` };
  const header = sheet.getRow(1);
  header.height = 26;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF39324F' } };
    cell.alignment = { vertical: 'middle' };
  });
  for (const row of sheet.getRows(2, rows.length) ?? []) {
    row.eachCell((cell, columnNumber) => {
      if (columnNumber >= 4 && columnNumber <= 12) cell.numFmt = 'yyyy-mm-dd';
      cell.alignment = { vertical: 'top', wrapText: columnNumber >= 18 };
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function exportExcel(questions: Question[]): Promise<void> {
  const buffer = await createExcelBuffer(questions);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'recallforge-questions.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}
