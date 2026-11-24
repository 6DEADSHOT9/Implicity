import { defineSkeleton } from "../../../src/registry/define-skeleton";
import { ReviewPanel } from "./ReviewPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

export const ReviewPanelEntry = defineSkeleton({ id: "ReviewPanel", props: propsSchema, slots: slotsSchema, events, meta, Component: ReviewPanel });
