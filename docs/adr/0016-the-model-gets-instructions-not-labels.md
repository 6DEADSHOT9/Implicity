# The model receives instructions, not labels

Everything inferred about the person (momentary states, traits, guest detection) is stored only in SQLite, never in PostHog. The remote model is sent the resulting instruction, such as "keep this brief and lead with the fix", never the label, such as "the user seems stressed". This limits what leaves the machine and stops the assistant from telling someone what it thinks they feel.
