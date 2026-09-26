export interface AppNotification {
  id: string;
  title: string;
  body: string;
  reportId?: string;
  read: boolean;
  createdAt: string;
}