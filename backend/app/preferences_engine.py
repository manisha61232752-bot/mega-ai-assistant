import os
import json
import re
from typing import Dict, Any, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREFS_FILE = os.path.join(BASE_DIR, "app", "preferences.json")

def load_all_preferences() -> dict:
    if not os.path.exists(PREFS_FILE):
        return {}
    try:
        with open(PREFS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_all_preferences(data: dict):
    try:
        with open(PREFS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save preferences database:", e)

def load_user_preferences(user_id: str) -> Dict[str, Any]:
    all_prefs = load_all_preferences()
    if user_id not in all_prefs:
        # Default starting preferences structure
        all_prefs[user_id] = {
            "explanation_depth": "detailed",
            "preferred_language": "English",
            "preferred_style": "default",
            "user_knowledge_level": "student",
            "style_usage_counters": {},
            "frequent_topics": [],
            "custom_preferences": {}
        }
        save_all_preferences(all_prefs)
    else:
        # Guarantee fields exist in loaded preferences
        prefs = all_prefs[user_id]
        if "preferred_style" not in prefs:
            prefs["preferred_style"] = "default"
        if "user_knowledge_level" not in prefs:
            prefs["user_knowledge_level"] = "student"
        if "style_usage_counters" not in prefs:
            prefs["style_usage_counters"] = {}
        all_prefs[user_id] = prefs
    return all_prefs[user_id]

def save_user_preferences(user_id: str, prefs: Dict[str, Any]):
    all_prefs = load_all_preferences()
    all_prefs[user_id] = prefs
    save_all_preferences(all_prefs)

STYLE_MAPPINGS = {
    # 1. Supported Modes
    "human": "human conversational style (friendly, empathetic, clear, zero robotic wording or jargon)",
    "in human": "human conversational style (friendly, empathetic, clear, zero robotic wording or jargon)",
    "human language": "human conversational style (friendly, empathetic, clear, zero robotic wording or jargon)",
    "explain naturally": "human conversational style, explain naturally",
    "like a friend": "friendly and warm tone, engaging, empathetic, like a close friend",
    "friend": "friendly and warm tone, engaging, empathetic, like a close friend",
    
    "teacher style": "educational/teaching style, patient, uses clear analogies and explanations, check understanding naturally",
    "like a teacher": "educational/teaching style, patient, uses clear analogies and explanations, check understanding naturally",
    "teacher": "educational/teaching style, patient, uses clear analogies and explanations, check understanding naturally",
    
    "mentor style": "supportive, guiding, constructive feedback, focus on growth and long-term career success",
    "mentor": "supportive, guiding, constructive feedback, focus on growth and long-term career success",
    
    "interview style": "Q&A interview format, concise, professional, targets interview prep standards",
    "interviewer": "Q&A interview format, concise, professional, targets interview prep standards",
    
    "professional tone": "professional business style (formal, crisp, objective)",
    "professional style": "professional business style (formal, crisp, objective)",
    "professional": "professional business style (formal, crisp, objective)",
    "formal": "formal language, polite, clean, and grammatically pristine",
    
    "technical style": "technical explanation, detailed, references APIs/code structure and compile considerations",
    "technical": "technical explanation, detailed, references APIs/code structure and compile considerations",
    "expert level": "expert level depth, advanced concepts, technical details, optimizations and terminology",
    "expert": "expert level depth, advanced concepts, technical details, optimizations and terminology",
    
    "beginner level": "beginner friendly, starts from basic concepts with no assumptions, simple words, relatable analogies",
    "explain like i am 10": "beginner friendly, extremely simple words, basic analogies suitable for a 10 year old",
    "explain like i am 5": "beginner friendly, extremely simple words, basic analogies suitable for a 5 year old",
    "beginner": "beginner friendly, starts from basic concepts with no assumptions, simple words, relatable analogies",
    
    "research style": "academic research style, objective, references facts, comparative analysis and academic structure",
    "research": "academic research style, objective, references facts, comparative analysis and academic structure",
    
    "executive summary": "executive summary style, high-level outline, business value, metrics, and key decisions first",
    "summary": "concise summary highlighting main points, quick reading format",
    
    "bullet points": "bullet points format, minimal paragraphs, highly scannable",
    "step by step": "step-by-step breakdown, numbered lists, logical sequential progression",
    
    "story style": "narrative/storytelling format, illustrative, engaging and chronological",
    "story": "narrative/storytelling format, illustrative, engaging and chronological",
    
    "table format": "markdown table format, structured in rows and columns",
    "table": "markdown table format, structured in rows and columns",
    
    "checklist format": "checklist/to-do list format using markdown checkbox items",
    "checklist": "checklist/to-do list format using markdown checkbox items",

    # 2. Conversational style request phrases
    "in simple language": "simplified vocabulary, clear and easy for a layperson to grasp, simple words",
    "in easy language": "simplified vocabulary, clear and easy for a layperson to grasp, simple words",
    "simple words": "simplified vocabulary, clear and easy for a layperson to grasp",
    "easy english": "simplified english text, easy sentence construction",
    "easy hindi": "simplified hindi text (using easy words or Hinglish when natural)",
    "in short": "highly concise, short and direct response",
    "in long": "thorough, detailed explanation with full background context",
    "in detail": "thorough, detailed explanation with full background context",
    "detailed answer": "thorough, detailed explanation with full background context",
    "exam style": "academic exam format, highly structured with bullet points and clear definitions",
    "easy to understand": "simplified vocabulary, clear and easy to understand"
}

def detect_and_update_style_preference(user_id: str, message: str) -> Optional[str]:
    """
    Checks if user explicitly requests a presentation style in the current prompt.
    If so, returns the instruction and increments usage. If style hits 3 uses,
    sets it as the default preference.
    """
    msg_lower = message.lower().strip()
    prefs = load_user_preferences(user_id)
    
    matched_style = None
    sorted_keys = sorted(STYLE_MAPPINGS.keys(), key=len, reverse=True)
    for style_key in sorted_keys:
        # Match using word boundaries
        if re.search(r'\b' + re.escape(style_key) + r'\b', msg_lower):
            matched_style = style_key
            break
            
    if matched_style:
        # Increment usage counter
        counters = prefs.setdefault("style_usage_counters", {})
        counters[matched_style] = counters.get(matched_style, 0) + 1
        
        # If used 3 times, set as preferred style
        if counters[matched_style] >= 3:
            prefs["preferred_style"] = matched_style
            
        save_user_preferences(user_id, prefs)
        return STYLE_MAPPINGS[matched_style]
        
    # No explicit style matched in prompt, check if they have a saved default
    pref_style = prefs.get("preferred_style", "default")
    if pref_style and pref_style != "default" and pref_style in STYLE_MAPPINGS:
        return STYLE_MAPPINGS[pref_style]
        
    return None

def get_adaptive_style_prompt(user_id: str, message: str) -> str:
    prefs = load_user_preferences(user_id)
    msg_lower = message.lower().strip()
    
    # 1. Detect explicit style request override
    explicit_style = None
    sorted_keys = sorted(STYLE_MAPPINGS.keys(), key=len, reverse=True)
    for style_key in sorted_keys:
        if re.search(r'\b' + re.escape(style_key) + r'\b', msg_lower):
            explicit_style = style_key
            break
            
    # Resolve active style instruction
    active_style_desc = None
    if explicit_style:
        active_style_desc = STYLE_MAPPINGS[explicit_style]
    else:
        pref_style = prefs.get("preferred_style", "default")
        if pref_style and pref_style != "default" and pref_style in STYLE_MAPPINGS:
            active_style_desc = STYLE_MAPPINGS[pref_style]
            
    # 2. Detect explicit user knowledge level override
    explicit_level = None
    levels = ["beginner", "student", "developer", "researcher", "professional", "intermediate"]
    for lvl in levels:
        if re.search(r'\b' + re.escape(lvl) + r'\b', msg_lower) or (lvl == "beginner" and "explain like i am 5" in msg_lower):
            explicit_level = lvl
            break
            
    knowledge_level = explicit_level if explicit_level else prefs.get("user_knowledge_level", "student")
    
    # Build the adaptive instruction prompt
    prompt = (
        "[ADAPTIVE STYLE & EXPLANATION INTEL - Personalize your presentation format using these NLU rules:\n"
        "1. Avoid robotic phrasing. Respond with natural, conversational human language.\n"
    )
    
    if active_style_desc:
        prompt += f"2. Presentation Format: Respond strictly in the following style: {active_style_desc}.\n"
    else:
        prompt += "2. Presentation Format: Keep it conversational, clear, and direct.\n"
        
    # Apply knowledge level directives
    prompt += f"3. Target Audience Level: Adjust your complexity to a **{knowledge_level.upper()}** knowledge level:\n"
    if knowledge_level == "beginner":
        prompt += "   - Vocabulary: Extremely simple words, zero technical jargon.\n"
        prompt += "   - Depth: Step-by-step concepts with relatable real-life analogies/examples.\n"
    elif knowledge_level == "student":
        prompt += "   - Vocabulary: Clear and educational.\n"
        prompt += "   - Depth: Emphasize key facts, definitions, assignment/exam focus, and standard examples.\n"
    elif knowledge_level == "developer":
        prompt += "   - Vocabulary: Technical/developer language.\n"
        prompt += "   - Depth: Provide clean code examples, target compiler correctness, best practices, and optimization suggestions.\n"
    elif knowledge_level == "researcher":
        prompt += "   - Vocabulary: Academic and formal.\n"
        prompt += "   - Depth: Reference fact-based topics, detailed analysis, and literature structures.\n"
    elif knowledge_level == "professional":
        prompt += "   - Vocabulary: Corporate, polite, and objective.\n"
        prompt += "   - Depth: Crisp executive summaries, business case reviews, or interview readiness structures.\n"
    else:  # intermediate
        prompt += "   - Vocabulary: Standard conversational English/Hinglish.\n"
        prompt += "   - Depth: Balanced explanations with structured bullet points and definitions.\n"
        
    prompt += "4. Keep all factual content 100% accurate. Do not change facts, only change presentation.\n"
    prompt += "5. Smart Clarification: If the query is highly and genuinely ambiguous (e.g. 'Explain Java' - Indonesian island or coding language?), ask exactly one brief clarifying question. Otherwise, answer directly without unnecessary questions.\n"
    prompt += "]"
    return prompt

def get_preferences_grounding_context(user_id: str) -> str:
    prefs = load_user_preferences(user_id)
    context_str = "[USER COMMUNICATION & WORKFLOW PREFERENCES - Follow these instructions to personalize your tone and language:\n"
    context_str += f"- Explanation Level: Use {prefs.get('explanation_depth', 'detailed')} explanations.\n"
    context_str += f"- Preferred Language: Respond in {prefs.get('preferred_language', 'English')}.\n"
    
    topics = prefs.get("frequent_topics", [])
    if topics:
        context_str += f"- Frequent Topics: {', '.join(topics)}.\n"
        
    customs = prefs.get("custom_preferences", {})
    for k, v in customs.items():
        context_str += f"- {k.replace('_', ' ').capitalize()}: {v}\n"
        
    context_str += "]"
    return context_str

def learn_preferences_from_conversation(user_id: str, message: str, reply: str):
    """
    Scans query patterns in the background to automatically adapt to user style.
    """
    prefs = load_user_preferences(user_id)
    msg_lower = message.lower().strip()
    
    # 1. Learn explanation depth preferences
    if any(kw in msg_lower for kw in ["simple terms", "explain simply", "explain like i am 5", "beginner friendly", "simple explanation"]):
        prefs["explanation_depth"] = "simple"
    elif any(kw in msg_lower for kw in ["deep technical details", "technical explanation", "highly technical", "for developer"]):
        prefs["explanation_depth"] = "technical"
    elif any(kw in msg_lower for kw in ["detailed review", "explain thoroughly", "explain in detail"]):
        prefs["explanation_depth"] = "detailed"
        
    # 2. Learn language preferences
    if "respond in hindi" in msg_lower or "explain in hindi" in msg_lower:
        prefs["preferred_language"] = "Hindi"
    elif "respond in spanish" in msg_lower or "explain in spanish" in msg_lower:
        prefs["preferred_language"] = "Spanish"
    elif "respond in english" in msg_lower or "explain in english" in msg_lower:
        prefs["preferred_language"] = "English"
        
    # 3. Learn topic frequencies
    coding_kws = ["code", "python", "javascript", "react", "programming", "fastapi"]
    math_kws = ["calculate", "math", "emi", "formula", "multiplication"]
    
    topics = prefs.get("frequent_topics", [])
    if any(k in msg_lower for k in coding_kws):
        if "coding" not in topics:
            topics.append("coding")
    if any(k in msg_lower for k in math_kws):
        if "math" not in topics:
            topics.append("math")
            
    prefs["frequent_topics"] = topics[:5]
    
    # 4. Auto-learn/adapt style preference gradually (runs counters)
    for style_key in STYLE_MAPPINGS.keys():
        if re.search(r'\b' + re.escape(style_key) + r'\b', msg_lower):
            counters = prefs.setdefault("style_usage_counters", {})
            counters[style_key] = counters.get(style_key, 0) + 1
            if counters[style_key] >= 3:
                prefs["preferred_style"] = style_key
            break
            
    # 5. Auto-learn user knowledge level
    levels = ["beginner", "student", "developer", "researcher", "professional", "intermediate"]
    for lvl in levels:
        if re.search(r'\b' + re.escape(lvl) + r'\b', msg_lower) or (lvl == "beginner" and "explain like i am 5" in msg_lower):
            prefs["user_knowledge_level"] = lvl
            break
            
    save_user_preferences(user_id, prefs)

def handle_preference_commands(user_id: str, message: str) -> Optional[str]:
    """
    Parses conversational commands for View, Edit, Delete, or Clear preference operations,
    acting as the invisible user-controlled preference manager directly from the chat.
    """
    msg_lower = message.lower().strip()
    prefs = load_user_preferences(user_id)
    
    # A. View preferences
    if msg_lower in ["show my preferences", "view my preferences", "what are my preferences", "what do you remember about my preferences"]:
        view_str = "Here are your saved communication and workflow preferences:\n\n"
        view_str += f"- **Explanation Level**: {prefs.get('explanation_depth', 'detailed')}\n"
        view_str += f"- **Preferred Language**: {prefs.get('preferred_language', 'English')}\n"
        view_str += f"- **Preferred Response Style**: {prefs.get('preferred_style', 'default')}\n"
        view_str += f"- **User Knowledge Level**: {prefs.get('user_knowledge_level', 'student')}\n"
        
        topics = prefs.get("frequent_topics", [])
        if topics:
            view_str += f"- **Frequent Topics**: {', '.join(topics)}\n"
            
        customs = prefs.get("custom_preferences", {})
        if customs:
            view_str += "\n**Custom Preferences**:\n"
            for k, v in customs.items():
                view_str += f"- **{k.replace('_', ' ').capitalize()}**: {v}\n"
        return view_str

    # B. Edit preferences
    edit_lang = re.search(r'set\s+(?:my\s+)?language\s+(?:preference\s+)?to\s+(\w+)', msg_lower)
    if edit_lang:
        lang = edit_lang.group(1).capitalize()
        prefs["preferred_language"] = lang
        save_user_preferences(user_id, prefs)
        return f"Got it! I have updated your preferred response language to **{lang}**."

    edit_style = re.search(r'set\s+(?:my\s+)?explanation\s+(?:style|level|depth)\s+to\s+(\w+)', msg_lower)
    if edit_style:
        style = edit_style.group(1).lower()
        if style in ["simple", "detailed", "technical"]:
            prefs["explanation_depth"] = style
            save_user_preferences(user_id, prefs)
            return f"Understood! I have set your explanation level to **{style}**."

    # C. Delete individual preference memory
    delete_lang = re.search(r'(?:forget|delete)\s+(?:my\s+)?language\s+(?:preference|memory)', msg_lower)
    if delete_lang:
        prefs["preferred_language"] = "English"
        save_user_preferences(user_id, prefs)
        return "I have removed your language preference and reset it to English."

    delete_style = re.search(r'(?:forget|delete)\s+(?:my\s+)?explanation\s+(?:style|level|depth|preference|memory)', msg_lower)
    if delete_style:
        prefs["explanation_depth"] = "detailed"
        prefs["preferred_style"] = "default"
        prefs["user_knowledge_level"] = "student"
        prefs["style_usage_counters"] = {}
        save_user_preferences(user_id, prefs)
        return "I have removed your explanation style preference and reset it to default."

    # D. Clear all preference data
    if msg_lower in ["clear all my preference data", "clear my preferences", "reset my preferences", "delete all my preferences"]:
        prefs = {
            "explanation_depth": "detailed",
            "preferred_language": "English",
            "preferred_style": "default",
            "user_knowledge_level": "student",
            "style_usage_counters": {},
            "frequent_topics": [],
            "custom_preferences": {}
        }
        save_user_preferences(user_id, prefs)
        return "All your learned preference data has been successfully cleared and reset to defaults."

    return None
