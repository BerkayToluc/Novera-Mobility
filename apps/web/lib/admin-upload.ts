// What an upload answers (ARCHITECTURE ADR-28). Words the field can say something specific about: too large, not a picture,
// too narrow, unreadable; and the two the person can do nothing about but be told: not allowed, store unavailable.
export type UploadResult =
  | { status: "ok"; url: string; width: number; height: number }
  | { status: "too_large" | "wrong_type" | "too_narrow" | "unreadable" | "forbidden" | "unavailable" };

export type UploadAction = (formData: FormData) => Promise<UploadResult>;
