#!/usr/bin/env python3
# THROWAWAY spike harness (issue-2, M1-P2). Not extension code.
# Path B: LFM2.5-1.2B-Instruct chat + top-k logprobs — first generated token's
# top_logprobs window stands in for full logits; per-class probabilities are a
# softmax over whichever class first-tokens made it into the window.
# Class first-tokens are matched by exact token id (prefix matches like 'ru' or
# 'gener' are spurious — verified in the spike).
# Usage: python3 spike/run_path_b.py LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M
import math
import sys
import time

from spike_common import PATH_B_SYSTEM, load_posts, post_json, start_server

CLASSES = ["ai_slop", "rubbish", "genuine"]


def first_token_id(port, text):
    out = post_json(port, "/tokenize", {"content": text})
    return out["tokens"][0]


def probe_max_window(port, post):
    # find the largest top_logprobs value the server honours
    for n in [1024, 512, 256, 128, 64, 32, 20, 16, 10, 5]:
        try:
            out = post_json(port, "/v1/chat/completions", chat_body(post["text"], n))
            window = out["choices"][0]["logprobs"]["content"][0]["top_logprobs"]
            if window:
                return n, len(window)
        except Exception as e:
            print(f"  top_logprobs={n}: rejected ({e})")
    raise RuntimeError("no working top_logprobs window size")


def chat_body(text, top_logprobs):
    return {
        "messages": [
            {"role": "system", "content": PATH_B_SYSTEM},
            {"role": "user", "content": text},
        ],
        "max_tokens": 1,
        "temperature": 0,
        "logprobs": True,
        "top_logprobs": top_logprobs,
    }


def class_logprobs(window, class_first_ids):
    # exact match on the first-token id — prefix matches ('ru', 'gener') are spurious
    return {c: e["logprob"] for c, tid in class_first_ids.items() for e in window if e.get("id") == tid}


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else "LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M"
    proc, log_path = start_server(model, 8082)
    try:
        ids = {c: first_token_id(8082, c) for c in CLASSES}
        print("class first-token ids:", ids)
        print("distinct first tokens:", len(set(ids.values())) == 3)

        posts = load_posts()
        n_req, n_win = probe_max_window(8082, posts[0])
        print(f"max window honoured: requested={n_req} returned={n_win}")

        # coverage vs window size, using the (probability-sorted) window the server returns
        for size in [5, 10, 20, 1024]:
            covered = 0
            for post in posts:
                out = post_json(8082, "/v1/chat/completions", chat_body(post["text"], n_req))
                window = out["choices"][0]["logprobs"]["content"][0]["top_logprobs"]
                if len(class_logprobs(window[:size], ids)) == 3:
                    covered += 1
            print(f"window={size:<5} all-three-classes-in-window: {covered}/{len(posts)} posts")

        covered_reqs = 0
        for rnd in range(3):  # rnd 0 = cold, rnd 1-2 = warm
            for post in posts:
                t0 = time.perf_counter()
                out = post_json(8082, "/v1/chat/completions", chat_body(post["text"], n_req))
                ms = (time.perf_counter() - t0) * 1000
                content = out["choices"][0]["logprobs"]["content"][0]
                window = content["top_logprobs"]
                emitted = content["token"]
                found = class_logprobs(window, ids)
                if len(found) == 3:
                    covered_reqs += 1
                    mx = max(found.values())
                    Z = sum(math.exp(v - mx) for v in found.values())
                    probs = {c: math.exp(found[c] - mx) / Z for c in CLASSES}
                    top = max(probs, key=probs.get)
                    detail = f"top={top:<8} " + "  ".join(f"{c}={probs[c]:.3f}" for c in CLASSES)
                else:
                    missing = ",".join(sorted(set(CLASSES) - set(found)))
                    detail = f"renormalized over {sorted(found)}; BLIND to {missing}"
                print(f"rnd{rnd} {post['id']:<18} {ms:8.0f} ms  emitted={emitted!r:<6} {detail}")
            print()
        print(f"full-window coverage: {covered_reqs}/{3 * len(posts)} requests had all three class first-tokens in the window")
    finally:
        proc.terminate()
        print(f"(server log: {log_path})")


if __name__ == "__main__":
    main()