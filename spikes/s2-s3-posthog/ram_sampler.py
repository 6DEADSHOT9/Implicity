import csv
import sys
import time
from pathlib import Path

from common import sample_ram


path = Path(__file__).parent / "ram.csv"
new_file = not path.exists() or path.stat().st_size == 0
with path.open("a", newline="") as output:
    writer = csv.writer(output)
    if new_file:
        writer.writerow(["unix_time", "phase", "stack_bytes"])
    while True:
        try:
            sample_ram(writer, sys.argv[1])
            output.flush()
        except (OSError, ValueError):
            pass
        time.sleep(1)
