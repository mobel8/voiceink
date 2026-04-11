#!/usr/bin/env python3
"""
Persistent faster-whisper server — keeps model in memory for sub-second transcription.
Communicates via stdin/stdout JSON lines.
"""
import json
import sys
from faster_whisper import WhisperModel

model_name = sys.argv[1] if len(sys.argv) > 1 else "tiny"

model = WhisperModel(model_name, device="cpu", compute_type="int8")

# Signal ready to the Node.js parent process
print(json.dumps({"ready": True}), flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        audio_path = req["path"]
        lang = req.get("lang", "fr")

        segments, info = model.transcribe(audio_path, language=lang)
        text = " ".join(s.text for s in segments).strip()

        print(json.dumps({
            "text": text,
            "language": info.language,
            "duration": getattr(info, "duration", 0),
        }), flush=True)

    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
