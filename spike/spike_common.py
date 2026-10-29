# Throwaway spike harness for issue-2. Class definitions copied from
# TAXONOMY.md v1 (2026-10-22) — the taxonomy file remains the source of truth.
import json, os, subprocess, time, urllib.request

# Set SPIKE_BASE_URL (e.g. http://172.30.32.1:11434) to target a running
# Ollama instead of starting llama-server locally.

# criteria text mirrors TAXONOMY.md v1 definitions (abridged for prompt size)
CRITERIA = {
    "ai_slop": "Machine-generated filler: LLM cadence tells, generic advice, listicle padding, no personal anchor.",
    "rubbish": "Low value regardless of author: engagement bait, hype and shilling, overclaiming, threadbait hooks.",
    "genuine": "Real substance: firsthand experience, specific verifiable claims, original insight, honest signal.",
}
INSTRUCTIONS = "Classify the social media post by substance. The substance axis decides: if a post is both machine-generated filler and engagement bait, it is rubbish."

QUESTION = {"class": {"type": "choice", "instructions": INSTRUCTIONS, "criteria": CRITERIA}}

PATH_B_SYSTEM = (
    "You classify social media posts. Classes:\n"
    "- ai_slop: " + CRITERIA["ai_slop"] + "\n"
    "- rubbish: " + CRITERIA["rubbish"] + "\n"
    "- genuine: " + CRITERIA["genuine"] + "\n"
    "The substance axis decides: if a post is both machine-generated filler and engagement bait, it is rubbish.\n"
    "Answer with exactly one word, no punctuation: ai_slop, rubbish, or genuine."
)

LLAMA_SERVER = os.environ.get("LLAMA_SERVER", os.path.expanduser("~/spike-tools/llama-b11936/llama-server"))


def load_posts():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "posts.jsonl")) as f:
        return [json.loads(line) for line in f if line.strip()]


def post_json(port, path, body, base=None):
    root = base or f"http://127.0.0.1:{port}"
    req = urllib.request.Request(
        f"{root}{path}", json.dumps(body).encode(), {"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.load(r)


def start_server(model, port, extra=()):
    log_path = f"/tmp/llama-server-{port}.log"
    log = open(log_path, "w")
    cmd = [LLAMA_SERVER, "-hf", model, "--host", "127.0.0.1", "--port", str(port), *extra]
    proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT)
    for _ in range(600):
        if proc.poll() is not None:
            raise RuntimeError(f"server died, see {log_path}")
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2)
            return proc, log_path
        except Exception:
            time.sleep(1)
    raise RuntimeError(f"server did not come up, see {log_path}")