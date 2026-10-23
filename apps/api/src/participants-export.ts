import ExcelJS from "exceljs";

// Excel-Export der Teilnehmerliste eines Events (GET /events/:id/participants.xlsx).
// Zellen werden als Strings gesetzt — exceljs legt dafür nie Formeln an, darum ist
// hier kein Escaping gegen Formel-Injection wie beim CSV-Export nötig.

export interface ExportParticipant {
  userDisplayName: string;
  userEmail: string;
  status: string;
  waitlistPosition: number | null;
  registeredAt: string;
  cancelledAt: string | null;
  personalNote?: string | null;
  answers?: {
    questionId: string;
    value: boolean | string | string[] | null;
    otherText?: string | null | undefined;
  }[];
}

export interface ExportQuestion {
  id: string;
  label: string;
}

const STATUS_LABELS: Record<string, string> = {
  registered: "Angemeldet",
  waitlisted: "Warteliste",
  attended: "Anwesend",
  cancelled: "Abgemeldet",
  no_show: "Nicht erschienen",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function formatValue(value: boolean | string | string[] | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function formatAnswer(
  answer:
    | { value: boolean | string | string[] | null; otherText?: string | null | undefined }
    | undefined,
): string {
  if (!answer) return "";
  const parts = [formatValue(answer.value)];
  if (answer.otherText) parts.push(`Andere: ${answer.otherText}`);
  return parts.filter((p) => p !== "").join(", ");
}

export async function buildParticipantsWorkbook(
  eventTitle: string,
  participants: ExportParticipant[],
  questions: ExportQuestion[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Teilnehmer");

  sheet.columns = [
    { header: "Nr.", key: "nr", width: 6 },
    { header: "Name", key: "name", width: 28 },
    { header: "E-Mail", key: "email", width: 34 },
    { header: "Status", key: "status", width: 16 },
    { header: "Wartelistenplatz", key: "waitlist", width: 16 },
    { header: "Angemeldet am", key: "registeredAt", width: 18 },
    { header: "Abgemeldet am", key: "cancelledAt", width: 18 },
    { header: "Notiz", key: "note", width: 30 },
    ...questions.map((q) => ({ header: q.label, key: `q_${q.id}`, width: 24 })),
  ];

  participants.forEach((p, index) => {
    const answers = new Map((p.answers ?? []).map((a) => [a.questionId, a]));
    const row = sheet.addRow({
      nr: index + 1,
      name: p.userDisplayName,
      email: p.userEmail,
      status: STATUS_LABELS[p.status] ?? p.status,
      waitlist: p.waitlistPosition ?? "",
      registeredAt: formatDate(p.registeredAt),
      cancelledAt: formatDate(p.cancelledAt),
      note: p.personalNote ?? "",
      ...Object.fromEntries(questions.map((q) => [`q_${q.id}`, formatAnswer(answers.get(q.id))])),
    });
    // Abmeldungen wie in der UI rot hervorheben
    if (p.status === "cancelled") {
      row.font = { color: { argb: "FFC00000" } };
    }
  });

  const header = sheet.getRow(1);
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  workbook.title = eventTitle;

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
