#!/usr/bin/env python3
"""
Persistent faster-whisper server — keeps model in memory for sub-second transcription.
Protocol: JSON header line over stdin, followed by raw WAV bytes if "size" is present.
Falls back to file path if "path" is provided instead.
"""
import json
import sys
import tempfile
import os
from faster_whisper import WhisperModel

model_name = sys.argv[1] if len(sys.argv) > 1 else "small"

# Use float16 on GPU, int8 on CPU for best quality/speed tradeoff
device = "cpu"
compute_type = "int8"
try:
    import torch
    if torch.cuda.is_available():
        device = "cuda"
        compute_type = "float16"
except ImportError:
    pass

model = WhisperModel(model_name, device=device, compute_type=compute_type)

# Signal ready to the Node.js parent process
print(json.dumps({"ready": True}), flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        lang = req.get("lang", "fr")
        prompt = req.get("prompt", "")

        # Fast path: receive raw WAV bytes via stdin (no temp file)
        audio_size = req.get("size")
        if audio_size is not None:
            audio_data = sys.stdin.buffer.read(audio_size)
            # Write to a temp file — faster_whisper needs a file path
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp.write(audio_data)
            tmp.close()
            audio_path = tmp.name
            cleanup = True
        else:
            # Legacy path: file path
            audio_path = req["path"]
            cleanup = False

        transcribe_kwargs = {
            "audio": audio_path,
            "language": lang,
            "beam_size": 5,
            "best_of": 5,
            "temperature": 0.0,
            "condition_on_previous_text": False,
            "word_timestamps": False,
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 300,
                "speech_pad_ms": 200,
            },
        }
        if prompt:
            transcribe_kwargs["initial_prompt"] = prompt

        segments, info = model.transcribe(**transcribe_kwargs)
        text = " ".join(s.text for s in segments).strip()

        if cleanup:
            try:
                os.unlink(audio_path)
            except OSError:
                pass

        print(json.dumps({
            "text": text,
            "language": info.language,
            "duration": getattr(info, "duration", 0),
        }), flush=True)

    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
