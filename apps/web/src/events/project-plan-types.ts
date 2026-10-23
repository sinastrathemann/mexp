// Spiegel der API-Typen aus apps/api/src/project-plan/model.ts
export interface EventTaskDto {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BlueprintTaskDto {
  id?: string;
  title: string;
  daysBefore: number | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export interface ToolLinkDto {
  id?: string;
  label: string;
  url: string;
}

export interface AssigneeDto {
  id: string;
  displayName: string;
}
