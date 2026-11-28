import { describe, expect, it } from "vitest";
import { attachmentType, copyShare, isMeaningfulDraft, lengthBucket } from "./action-measurements";

describe("action measurements", () => {
  it("uses the contract length cutoffs and meaningful draft boundary", () => {
    expect([79, 80, 399, 400].map((length) => lengthBucket(length, "message_and_draft"))).toEqual(["short", "medium", "medium", "long"]);
    expect([599, 600, 2499, 2500].map((length) => lengthBucket(length, "answer"))).toEqual(["short", "medium", "medium", "long"]);
    expect(isMeaningfulDraft(39)).toBe(false);
    expect(isMeaningfulDraft(40)).toBe(true);
    expect(lengthBucket(40, "message_and_draft")).toBe("short");
  });

  it("uses copied characters over source characters and maps media types without names", () => {
    expect([49, 50, 99, 100].map((copied) => copyShare(copied, 100))).toEqual(["some", "most", "most", "all"]);
    const formattedAnswer = "A title\n\nA **formatted** answer with a [link](https://example.test).";
    expect(copyShare(formattedAnswer.length, formattedAnswer.length)).toBe("all");
    expect(["image/png", "audio/mpeg", "video/mp4", "application/pdf", "text/plain", ""].map(attachmentType)).toEqual(["image", "audio", "video", "document", "document", "other"]);
  });
});
