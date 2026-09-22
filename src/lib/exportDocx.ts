import {
  AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import type { MatchItem, MatchReport } from '@/lib/resumeApi';

/**
 * 简历 + 匹配报告导出成 .docx。
 *
 * 放在前端而不是后端：简历正文属于敏感数据，导出是一次性成型，
 * 让服务端落盘反而多留一份副本（免费 PaaS 的临时盘还不清理）。
 */

/** 版式分隔用的全角空格，写成转义而不是字面字符：字面 U+3000 会触发 no-irregular-whitespace */
const SEP = '　';

const KIND_LABEL: Record<MatchItem['kind'], string> = {
  skill: '技能',
  experience: '经验',
  project: '项目',
};

const VERDICT_LABEL: Record<MatchItem['verdict'], string> = {
  hit: '命中',
  partial: '部分命中',
  missing: '未命中',
};

function cell(text: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
}

function row(cells: string[], bold = false) {
  return new TableRow({ children: cells.map((text) => cell(text, bold)) });
}

export function buildResumeDocx(input: {
  jd: string;
  resume: string;
  optimized?: string;
  report?: MatchReport | null;
}): Promise<Blob> {
  const { jd, resume, optimized, report } = input;
  // 显式标注类型：后面要往里 push 表格，只写 Paragraph[] 会拒绝
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: '简历与 JD 匹配报告', heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `生成时间：${new Date().toLocaleString('zh-CN')}`, italics: true, size: 18 })] }),

    new Paragraph({ text: 'JD 原文', heading: HeadingLevel.HEADING_2 }),
    ...jd.split('\n').map((line) => new Paragraph({ text: line })),

    new Paragraph({ text: '简历原文', heading: HeadingLevel.HEADING_2 }),
    ...resume.split('\n').map((line) => new Paragraph({ text: line })),
  ];

  if (optimized?.trim()) {
    children.push(
      new Paragraph({ text: '优化稿', heading: HeadingLevel.HEADING_2 }),
      ...optimized.trim().split('\n').map((line) => new Paragraph({ text: line }))
    );
  }

  if (report) {
    const { scores, items } = report;
    children.push(
      new Paragraph({ text: '匹配度', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ children: [new TextRun({ text: `总体匹配度：${scores.overall}%`, bold: true, size: 28 })] }),
      new Paragraph({
        // 全角空格用转义写：源码里放字面 U+3000 会被 no-irregular-whitespace 判错
        text: `技能 ${fmt(scores.groups.skill)}${SEP}经验 ${fmt(scores.groups.experience)}${SEP}项目 ${fmt(scores.groups.project)}`,
      }),
      new Paragraph({ text: `命中 ${scores.counts.hit} 条 · 部分 ${scores.counts.partial} 条 · 未命中 ${scores.counts.missing} 条` }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: '分数由逐条判定汇总而来（命中记 1、部分记 0.5、未命中记 0），不是模型直接给的数字。', italics: true, size: 18 })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row(['要求', '类型', '判定', '简历里的证据', '说明']),
          ...items.map((item) =>
            row([
              item.text,
              KIND_LABEL[item.kind],
              VERDICT_LABEL[item.verdict],
              item.evidence || '—',
              item.note || '—',
            ])
          ),
        ],
      })
    );

    const gaps = items.filter((item) => item.verdict !== 'hit');
    if (gaps.length) {
      children.push(
        new Paragraph({ text: '待补的缺口', heading: HeadingLevel.HEADING_2 }),
        ...gaps.map((item) =>
          new Paragraph({
            children: [
              new TextRun({ text: `${VERDICT_LABEL[item.verdict]}：${item.text}`, bold: true }),
              new TextRun({ text: item.note ? `${SEP}${item.note}` : '' }),
            ],
          })
        ),
        new Paragraph({ text: '可按这些站内条目补：', heading: HeadingLevel.HEADING_3 }),
        ...gaps
          .filter((item) => item.study?.length)
          .map((item) => new Paragraph({ text: `${item.text} → ${item.study!.join('、')}` })),
      );
    }

    if (report.strengths.length) {
      children.push(
        new Paragraph({ text: '已经站得住的部分', heading: HeadingLevel.HEADING_2 }),
        ...report.strengths.map((text) => new Paragraph({ text: `· ${text}` }))
      );
    }
  }

  return Packer.toBlob(new Document({ sections: [{ properties: {}, children }] }));
}

function fmt(value: number | null) {
  return value === null ? 'JD 未涉及' : `${value}%`;
}

/** 触发浏览器下载（object URL 要记得回收，否则切页会留着整份文档） */
export async function downloadResumeDocx(filename: string, input: Parameters<typeof buildResumeDocx>[0]) {
  const blob = await buildResumeDocx(input);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}
