import sys
import os
import re
import time
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import extract_pdf_content, build_assignment_manifest_directives
from app.services.ai_provider import global_ai_orchestrator, global_health_tracker

async def run_assignment_test():
    filepath = r"C:\Users\manis\OneDrive\Documents\Assignment-2_DAA.pdf"
    if not os.path.exists(filepath):
        print(f"[ERROR] Test PDF not found at {filepath}")
        sys.exit(1)

    print("=== STEP 1: READ COMPLETE PDF ===")
    extracted_text, page_images = extract_pdf_content(filepath)
    print(f"Extracted Text Character Count: {len(extracted_text)}")
    print(f"Rendered Page Images: {len(page_images)}")
    assert len(extracted_text) > 0, "PDF extraction produced 0 text"

    print("\n=== STEP 2: IDENTIFY ALL QUESTIONS & BUILD MANIFEST ===")
    directives = build_assignment_manifest_directives("Assignment-2_DAA.pdf", extracted_text)
    print(directives)

    norm_text = re.sub(r'\s+', ' ', extracted_text).strip()
    sec_a_match = bool(re.search(r'SECTION\s+A', norm_text, re.I))
    sec_b_match = bool(re.search(r'SECTION\s+B', norm_text, re.I))
    sec_c_match = bool(re.search(r'SECTION\s+C', norm_text, re.I))

    print(f"Section A Detected: {sec_a_match}")
    print(f"Section B Detected: {sec_b_match}")
    print(f"Section C Detected: {sec_c_match}")
    assert sec_a_match and sec_b_match and sec_c_match, "Failed to detect all sections"

    prompt_instruction = (
        "Read the complete PDF carefully.\n"
        "Give me the solution of every assignment question in simple, easy and human language.\n"
        "Follow the marks/weightage if mentioned in the PDF.\n"
        "For programming/algorithm questions, include the algorithm, explanation, and example where required.\n"
        "Do not skip any question."
    )

    pdf_prompt = f"[Attached PDF Content: Assignment-2_DAA.pdf]\n{extracted_text}\n{directives}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": pdf_prompt},
                    {"text": prompt_instruction}
                ]
            }
        ]
    }

    print("\n=== STEP 3 & 4: GENERATE ANSWERS & CHECK COMPLETENESS ===")
    res = {}
    for attempt in range(1, 6):
        global_health_tracker.record_success("gemini")
        res = await global_ai_orchestrator.generate_with_resilience(
            req_id=f"e2e-assignment-test-{attempt}",
            user_id="test-user",
            prompt=prompt_instruction,
            payload=payload,
            is_personalized=True
        )
        if not res.get("error") and len(res.get("text", "")) > 500:
            break
        print(f"[RETRY] Attempt {attempt} returned error or rate limit. Waiting 10s...")
        await asyncio.sleep(10)

    ans = res.get("text", "")
    print(f"AI Provider Used: {res.get('provider')}")
    print(f"Response Character Count: {len(ans)}")
    print(f"Response Word Count: {len(ans.split())}")

    has_sec_a_ans = "SECTION A" in ans.upper() or "SECTION A" in ans
    has_sec_b_ans = "SECTION B" in ans.upper() or "SECTION B" in ans
    has_sec_c_ans = "SECTION C" in ans.upper() or "SECTION C" in ans

    sec_c_q1_knapsack = "FRACTIONAL" in ans.upper() or "KNAPSACK" in ans.upper()
    sec_c_q2_queens = "QUEEN" in ans.upper() or "N-QUEEN" in ans.upper() or "STATE SPACE" in ans.upper()
    sec_c_q3_dp = "11, 21, 31, 33" in ans or "11,21,31,33" in ans or "DYNAMIC PROGRAMMING" in ans.upper() or "PROFIT" in ans.upper()

    # User-facing rendering artifact checks
    has_raw_svg_tag = "<svg" in ans.lower()
    has_code_fence_svg = "```svg" in ans.lower()
    has_standalone_svg = bool(re.search(r'^\s*svg\s*$', ans, re.MULTILINE | re.IGNORECASE))
    has_unclosed_code = (ans.count("```") % 2 != 0)

    print(f"\nAnswer Section A Included: {has_sec_a_ans}")
    print(f"Answer Section B Included: {has_sec_b_ans}")
    print(f"Answer Section C Included: {has_sec_c_ans}")
    print(f"Section C Q1 (Fractional Knapsack) Answered: {sec_c_q1_knapsack}")
    print(f"Section C Q2 (4-Queens / State Space Tree) Answered: {sec_c_q2_queens}")
    print(f"Section C Q3 (0/1 Knapsack DP Calculation) Answered: {sec_c_q3_dp}")
    print(f"Contains Raw <svg XML Tags: {has_raw_svg_tag}")
    print(f"Contains ```svg Code Fences: {has_code_fence_svg}")
    print(f"Contains Standalone 'svg' Artifact: {has_standalone_svg}")
    print(f"Contains Unclosed Code Fences (Odd ```): {has_unclosed_code}")

    assert has_sec_a_ans and has_sec_b_ans and has_sec_c_ans, "Not all sections were answered"
    assert sec_c_q1_knapsack and sec_c_q2_queens and sec_c_q3_dp, "Section C questions missing"
    assert not has_raw_svg_tag, "Found raw <svg XML output"
    assert not has_code_fence_svg, "Found ```svg code fence header"
    assert not has_standalone_svg, "Found standalone 'svg' line artifact"
    assert not has_unclosed_code, "Found unclosed markdown code fence"

    print("\n[SUCCESS] E2E ASSIGNMENT ANSWERING & ARTIFACT CLEANLINESS TEST PASSED 100%!")

if __name__ == "__main__":
    asyncio.run(run_assignment_test())
