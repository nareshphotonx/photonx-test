import { post } from './api';

export type AttachmentEntityType = 'TASK' | 'EXPENSE';

type PresignResponse = {
  uploadUrl?: string;
  url?: string;
  s3Key: string;
  fields?: Record<string, string>;
  publicUrl?: string;
};

type ConfirmResponse = {
  id: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  url?: string;
};

/**
 * Two-step S3 upload helper:
 *  1. POST /attachments/presigned-url  → get a signed URL
 *  2. PUT the file directly to S3
 *  3. POST /attachments/confirm-upload → register the attachment in our DB
 *
 * Returns the attachment record (id) so callers can wire it to expense / task.
 */
export async function uploadAttachment(
  file: File,
  ctx: {
    entityType: AttachmentEntityType;
    entityId?: string;
    taskId?: string;
    projectId?: string;
  },
): Promise<ConfirmResponse> {
  // 1. presign
  const presign = await post<PresignResponse>('/attachments/presigned-url', {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    taskId: ctx.taskId,
    projectId: ctx.projectId,
  });

  const uploadUrl = presign.uploadUrl ?? presign.url;
  if (!uploadUrl) throw new Error('No upload URL returned by server');

  // 2. PUT to S3 (bypasses our axios so the Authorization header isn't sent)
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => '');
    throw new Error(`Upload failed: ${putRes.status} ${body.slice(0, 200)}`);
  }

  // 3. confirm
  const confirmed = await post<ConfirmResponse>('/attachments/confirm-upload', {
    s3Key: presign.s3Key,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    taskId: ctx.taskId,
    projectId: ctx.projectId,
  });

  return confirmed;
}
