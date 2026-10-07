import { DomainError } from '@/core/shared/errors';

/** Photo evidence attached to a report. Pure data: capture is a UI/device concern. */
export interface Evidence {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Data URL or object URL for display; optional for tests. */
  readonly previewUrl?: string;
}

export const ACCEPTED_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_REPORT = 5;

export class InvalidPhotoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_PHOTO');
  }
}

/** UC02 E4 "Invalid Photo": rejects files the system cannot process. */
export class PhotoValidator {
  validate(photo: Omit<Evidence, 'id'>): void {
    if (!ACCEPTED_PHOTO_TYPES.includes(photo.mimeType)) {
      throw new InvalidPhotoError(`"${photo.fileName}" is not a supported photo. Use JPEG, PNG, WEBP or HEIC.`);
    }
    if (photo.sizeBytes <= 0) {
      throw new InvalidPhotoError(`"${photo.fileName}" is empty or corrupted. Please capture it again.`);
    }
    if (photo.sizeBytes > MAX_PHOTO_BYTES) {
      throw new InvalidPhotoError(`"${photo.fileName}" is larger than 10 MB. Please use a smaller photo.`);
    }
  }
}
