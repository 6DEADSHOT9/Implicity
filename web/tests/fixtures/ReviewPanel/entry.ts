import { defineSkeleton } from "../../../src/registry/define-skeleton";
import { ReviewPanel } from "./ReviewPanel";
import { definition } from "./schema";

export const ReviewPanelEntry = defineSkeleton(definition, ReviewPanel);
