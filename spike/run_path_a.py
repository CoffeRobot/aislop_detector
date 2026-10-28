#!/usr/bin/env python3
# THROWAWAY spike harness (issue-2, M1-P2). Not extension code.
# Path A: d1 decision model — per-option probabilities from full logits,
# via the /v1/systemone decision endpoint (one forward pass, zero generated
# tokens). Two modes:
#   local llama-server:  python3 spike/run_path_a.py LiquidAI/d1-3B-GGUF:Q4_K_M
#   running Ollama:      SPIKE_BASE_URL=http://host:11434 \\
#                       python3 spike/run_path_a.py d1-omni:latest
import os
import sys
import time

from spike_common import QUESTION, load_posts, post_json, start_server


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else "LiquidAI/d1-3B-GGUF:Q4_K_M"
    base = os.environ.get("SPIKE_BASE_URL")
    if base:
        proc, log_path = None, "(remote server)"
    else:
        proc, log_path = start_server(model, 8081, sys.argv[2:])

    try:
        # rnd 0 = cold (first request after model load), rnd 1-2 = warm
        for rnd in range(3):
            for post in load_posts():
                body = {"state": post["text"], "questions": QUESTION}
                if base:  # Ollama needs the model in the request
                    body["model"] = model
                t0 = time.perf_counter()
                out = post_json(8081, "/v1/systemone", body, base)
                ms = (time.perf_counter() - t0) * 1000
                probs = out["answers"]["class"]["probabilities"]
                top = max(probs, key=probs.get)
                print(f"rnd{rnd} {post['id']:<18} {ms:8.0f} ms  top={top:<8} " +
                      "  ".join(f"{k}={v:.3f}" for k, v in probs.items()))
            print()
    finally:
        if proc:
            proc.terminate()
        print(f"(server log: {log_path})")


if __name__ == "__main__":
    main()