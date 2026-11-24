import { defineSkeleton } from "../../../src/registry/define-skeleton";
import { ReviewShell } from "./ReviewShell";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

export const ReviewShellEntry = defineSkeleton({ id: "ReviewShell", props: propsSchema, slots: slotsSchema, events, meta, Component: ReviewShell });
