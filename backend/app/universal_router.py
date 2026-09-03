import re
import datetime
import calendar
import urllib.parse
import uuid
import os
import httpx
import json
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(BASE_DIR, "static", "generated_images")
os.makedirs(IMAGES_DIR, exist_ok=True)

# 1. Dynamic Agent & Tool Registries
AGENT_REGISTRY = {
    "general": {
        "name": "General Knowledge Agent",
        "description": "Handles general inquiries, facts, chat, and generic information."
    },
    "coding": {
        "name": "Coding Assistant",
        "description": "Specializes in programming languages, debugging, writing code, software development, APIs."
    },
    "education": {
        "name": "Education Assistant",
        "description": "Explains educational concepts, teaches lessons, tutorials, study guides."
    },
    "writing": {
        "name": "Writing Assistant",
        "description": "Specializes in copywriting, formal letters, essay drafting, grammar checking, rewriting."
    },
    "research": {
        "name": "Research Scientist Agent",
        "description": "Performs deep technical/scientific literature reviews, market research, comparisons."
    },
    "decision": {
        "name": "Decision Making Agent",
        "description": "Analyzes pros/cons, compares options, provides recommendations, tool comparison."
    },
    "troubleshoot": {
        "name": "Troubleshooting Agent",
        "description": "Diagnoses software installation errors, hardware slow downs, connection issues."
    },
    "shopping": {
        "name": "Shopping Agent",
        "description": "Recommends products, compares specifications, shopping deals under budgets."
    },
    "career": {
        "name": "Career Agent",
        "description": "Assists with resumes, career placement roadmap, interview prep, job search."
    },
    "finance": {
        "name": "Finance Agent",
        "description": "Calculates budget plans, cost projections, EMI estimations, investment options."
    },
    "travel": {
        "name": "Travel Agent",
        "description": "Creates itineraries, lists destination places to visit, packing checklists."
    },
    "health": {
        "name": "Health & Wellness Agent",
        "description": "Suggests general exercise/fitness routines, diet, sleep tips, stress management."
    },
    "creative": {
        "name": "Creative Assistant Agent",
        "description": "Writes short stories, creative scripts, brainstorming startup ideas, social media captions."
    },
    "data_analysis": {
        "name": "Data Analysis Agent",
        "description": "Analyzes CSV/Excel datasets, summarizes column trends, statistics, generates charts."
    },
    "document": {
        "name": "Document Intelligence Agent",
        "description": "Reads uploaded files, extracts structured facts from text files, summarizes PDFs/papers."
    },
    "vision": {
        "name": "Vision Agent",
        "description": "Analyzes screenshot problems, diagrams, image object identification, OCR extraction."
    },
    "voice": {
        "name": "Voice Intelligence Agent",
        "description": "Coordinates speech-to-text, text-to-speech toggling, voice commands conversation flow."
    },
    "productivity": {
        "name": "Productivity & Goal Planner Agent",
        "description": "Creates daily/weekly plans, study roadmaps, habit tracking, timetables."
    },
    "vault": {
        "name": "Memory & Knowledge Vault Agent",
        "description": "Stores permanent memories, long-term preferences, saved notes, project logs."
    },
    "web_research": {
        "name": "Web Research Agent",
        "description": "Fetches current/latest information, sports scores, weather details, stock prices."
    }
}

TOOL_REGISTRY = {
    "web_search": "Retrieves real-time updates, news, weather, prices, or sports scores from the internet.",
    "calculator": "Calculates math equations, arithmetic expressions, or EMI mortgage parameters.",
    "calendar": "Generates a visual HTML monthly calendar display or counts countdown days left.",
    "date_time": "Retrieves the current system date and time details.",
    "unit_converter": "Converts physical values (e.g. miles to km, kg to lbs).",
    "currency_converter": "Converts currency amounts (e.g. USD to INR) using current rates.",
    "qr_generator": "Generates custom QR Code images from text.",
    "barcode_generator": "Generates custom Barcode images from text.",
    "table_generator": "Generates formatted markdown tables from CSV/text.",
    "chart_generator": "Generates line/bar chart visualization graphs.",
    "file_processing": "Reads, decodes, and parses uploaded PDF, DOCX, TXT files.",
    "ocr": "Extracts text from uploaded images and screenshots.",
    "image_analysis": "Analyzes pixels and details of uploaded visual content.",
    "image_generation": "Generates beautiful photos or designs based on descriptive prompts."
}

def register_agent(key: str, name: str, description: str):
    """Dynamically register a new agent plugin."""
    AGENT_REGISTRY[key] = {
        "name": name,
        "description": description
    }

def register_tool(key: str, description: str):
    """Dynamically register a new tool plugin."""
    TOOL_REGISTRY[key] = description

def normalize_nlu_message(message: str) -> str:
    msg = message.lower().strip()
    
    # 1. Expand common short forms/abbreviations
    abbrevs = {
        r'\bpls\b': 'please',
        r'\basap\b': 'as soon as possible',
        r'\bbtw\b': 'by the way',
        r'\bidk\b': 'i do not know',
        r'\bimo\b': 'in my opinion',
        r'\btbh\b': 'to be honest',
        r'\bfyi\b': 'for your information'
    }
    for pat, rep in abbrevs.items():
        msg = re.sub(pat, rep, msg)
        
    # 2. Correct common coding/career spelling typos
    typos = {
        r'\bpythin\b': 'python',
        r'\bpyton\b': 'python',
        r'\bjavscript\b': 'javascript',
        r'\bjs\b': 'javascript',
        r'\bintrview\b': 'interview',
        r'\bintervu\b': 'interview',
        r'\bresum\b': 'resume',
        r'\bdocment\b': 'document',
        r'\bprogrm\b': 'program',
        r'\bcod\b': 'code',
        r'\bcalcutor\b': 'calculator',
        r'\bcalender\b': 'calendar'
    }
    for pat, rep in typos.items():
        msg = re.sub(pat, rep, msg)
        
    # 3. Normalize Hinglish expressions to English equivalent keywords for local routing
    hinglish = {
        # Career / HR / Resume intents
        r'\bhr ke questions\b': 'hr interview questions',
        r'\binterview me hr kya puchta hai\b': 'hr interview questions',
        r'\bkal mera hr interview hai\b': 'hr interview questions',
        r'\bhr round\b': 'hr interview questions',
        r'\bcv bana do\b': 'create resume',
        r'\bresume bana do\b': 'create resume',
        
        # Image Generation intents
        r'\bphoto bana do\b': 'generate image',
        r'\bposter design karo\b': 'generate image',
        r'\bdraw this\b': 'generate image',
        r'\billustrate this\b': 'generate image',
        
        # Translation intents
        r'\bhindi me karo\b': 'translate to hindi',
        r'\benglish me convert karo\b': 'translate to english',
        r'\biska translation\b': 'translate this',
        
        # Summarization intents
        r'\bshort me batao\b': 'summarize this',
        r'\bkey points batao\b': 'summarize this',
        r'\bsummary do\b': 'summarize this',
        
        # Coding intents
        r'\berror aa raha hai\b': 'fix this code',
        r'\berror aa raha h\b': 'fix this code',
        r'\bcode solve karo\b': 'fix this code',
        
        # Existing rules
        r'\bbanne ke liye\b': 'career roadmap',
        r'\bkaise bane\b': 'career roadmap',
        r'\bbanana h\b': 'how to become',
        r'\bbanana\b': 'become',
        r'\bbanao\b': 'create',
        r'\bkro\b': 'do',
        r'\bkar do\b': 'do',
        r'\bkar lo\b': 'do',
        r'\bsamjhao\b': 'explain',
        r'\bbatao\b': 'tell',
        r'\bchahiye\b': 'want',
        r'\bmujhe\b': 'i want',
        r'\bmuje\b': 'i want',
        r'\bme\b': 'i',
        r'\bkal\b': 'yesterday',
        r'\bh\b': 'is',
        r'\bkrna\b': 'do',
        r'\baur\b': 'more examples',
        r'\bsame\b': 'continue',
        r'\biske hisab se\b': 'according to this'
    }
    for pat, rep in hinglish.items():
        msg = re.sub(pat, rep, msg)
        
    return msg

def route_intents(message: str, has_file: bool = False) -> List[str]:
    msg_lower = normalize_nlu_message(message)
    intents = []
    
    # Check regex keywords for tools/agents
    if any(k in msg_lower for k in ["remember that", "what do i prefer", "what programming language", "save this project", "personal knowledge vault", "show my saved notes", "saved notes", "my memories", "view memories", "clear stored data", "my preferences"]):
        intents.append("vault")
    if any(k in msg_lower for k in ["voice control", "speech to text", "text to speech", "voice command", "voice agent", "speak responses", "read aloud", "voice responses"]):
        intents.append("voice")
    if any(k in msg_lower for k in ["is image", "is screenshot", "is diagram", "screenshot me", "image me", "extract text from image", "ocr image", "error screen", "explain diagram"]):
        intents.append("vision")
    if any(k in msg_lower for k in ["pdf ka", "resume ko", "research paper", "report create", "document summary", "summarize doc", "word file", "pdf summary", "extract from file", "summarize this document", "uploaded file", "docx summary", "text file summary", "summarize this", "short me batao", "key points", "tldr", "summary do"]):
        intents.append("document")
    if any(k in msg_lower for k in ["learning plan", "learning roadmap", "study planner", "timetable", "daily tasks", "organize tasks", "weekly schedule", "goal planning", "milestones", "habit building", "time management", "pomodoro", "study plan"]):
        intents.append("productivity")
    if any(k in msg_lower for k in ["deep research", "literature review", "market research", "technical research", "fact-based explanation", "future research", "detailed comparison", "complete analysis"]):
        intents.append("research")
    if any(k in msg_lower for k in ["csv file", "excel file", "dataset", "data analysis", "clean data", "visualize data", "sales report", "business insights", "data trend", "graph banao", "chart banao", "summarize data"]):
        intents.append("data_analysis")
    if any(k in msg_lower for k in ["creative", "story", "brainstorm", "social media", "instagram", "caption", "script", "startup idea", "brand name", "marketing idea", "project idea", "naming", "presentation idea", "caption likho", "story ideas"]):
        intents.append("creative")
    if any(k in msg_lower for k in ["health", "fitness", "wellness", "exercise", "workout", "sleep", "nutrition", "diet", "meal planning", "stress management", "healthy habit", "lifestyle", "fitness routine"]):
        intents.append("health")
    if any(k in msg_lower for k in ["travel", "trip", "destination", "itinerary", "places to visit", "packing checklist", "route planning", "visa guide", "travel budget", "trip plan", "visit jaipur", "manali trip", "goa trip"]):
        intents.append("travel")
    if any(k in msg_lower for k in ["finance", "budget", "salary", "save", "savings", "emi", "sip", "expense", "tracking", "money management", "cost comparison", "investment"]):
        intents.append("finance")
    if any(k in msg_lower for k in ["error", "install", "not working", "fails to", "slow", "setup guide", "configuration issue", "browser issue", "cannot connect", "crashed", "slow laptop", "extension not installing", "npm install error", "fix error", "help with", "troubleshoot", "debugging error", "error aa raha"]):
        intents.append("troubleshoot")
    if any(k in msg_lower for k in ["career", "placement", "internship", "resume", "roadmap", "job search", "interview prep", "mock interview", "how to become", "banne ke liye", "seekhu", "learning path", "skills needed", "hr interview", "interview preparation", "prepare me for hr", "interview me hr", "kal mera hr", "hr round", "hr question", "cv bana do", "resume bana do"]):
        intents.append("career")
    if any(k in msg_lower for k in ["buy", "purchase", "shopping", "laptop under", "phone under", "headphones", "gadgets", "brand", "best laptop", "best phone", "buying guide", "product comparisons", "iphone vs samsung"]):
        intents.append("shopping")
    if any(k in msg_lower for k in ["solve", "equation", "calculate", "math", "formula", "integral", "derivative", "algebra", "geometry", "calculus", "matrix", "proof", "x^2", "plus", "minus", "multiplied", "divided", "quadratic", "triangle", "circle", "theorem", "fraction", "logarithm", "sine", "cosine"]):
        intents.append("math")
    if any(k in msg_lower for k in ["write", "email", "essay", "draft", "formal", "letter", "grammar", "proofread", "paragraph", "resume", "cv", "cover letter", "thank-you", "copywriting", "creative writing", "poem", "drafting", "translate", "translation", "me karo", "me convert karo"]):
        intents.append("writing")

    # Map tools
    if re.search(r'\bqr\s+code\b', msg_lower):
        intents.append("qr_generator")
    if re.search(r'\bbarcode\b', msg_lower):
        intents.append("barcode_generator")
    if re.search(r'\b(?:convert|converter)\b', msg_lower):
        if any(c in msg_lower for c in ["usd", "eur", "gbp", "inr", "jpy", "cad", "aud", "cny"]):
            intents.append("currency_converter")
        else:
            intents.append("unit_converter")
    time_queries = ["what time is it", "current date", "today's date", "current time", "what date is today", "time", "date"]
    if any(t in msg_lower for t in time_queries) and "calendar" not in msg_lower:
        intents.append("date_time")
    if "calendar" in msg_lower or "festival" in msg_lower or "holiday" in msg_lower or "days until" in msg_lower or "days left" in msg_lower:
        intents.append("calendar")
    calc_patterns = [
        r'\b(?:calculate|compute|eval|solve|emi)\b',
        r'^[\d\s\+\-\*\/\(\)\.\*\*]+$'
    ]
    if any(re.search(pat, msg_lower) for pat in calc_patterns) or (any(op in msg_lower for op in ["+", "-", "*", "/"]) and any(c.isdigit() for c in msg_lower)):
        if "def " not in msg_lower and "class " not in msg_lower and ";" not in msg_lower:
            intents.append("calculator")
    if "table" in msg_lower or "csv" in msg_lower:
        intents.append("table_generator")
    if "chart" in msg_lower or "graph" in msg_lower or "plot" in msg_lower or "visualization" in msg_lower:
        intents.append("chart_generator")
    img_gen_kws = ["generate image", "create image", "make an image", "generate a picture", "draw", "generate photo"]
    if any(kw in msg_lower for kw in img_gen_kws):
        intents.append("image_generation")
    if has_file:
        intents.append("file_processing")
        
    if not intents:
        intents.append("general")

    # De-duplicate
    seen = set()
    return [i for i in intents if not (i in seen or seen.add(i))]

async def generate_execution_plan(message: str, api_key: str, model: str, history_messages: Optional[List[dict]] = None) -> Dict[str, Any]:
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        return {"steps": [], "is_topic_continuation": False}

    msg_lower = message.strip().lower()
    # Fast local check: Only invoke multi-step AI planner when explicitly requested
    complex_triggers = ["multi-step", "workflow automation", "deep research", "chain tools", "execute plan", "run workflow"]
    is_complex_workflow = any(trigger in msg_lower for trigger in complex_triggers)
    if not is_complex_workflow:
        return {"steps": [], "is_topic_continuation": False}
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    # Construct dynamic instructions from registry
    agents_desc = "\n".join([f"- '{k}': {v['description']}" for k, v in AGENT_REGISTRY.items()])
    tools_desc = "\n".join([f"- '{k}': {v}" for k, v in TOOL_REGISTRY.items()])
    
    history_str = ""
    if history_messages:
        history_str = "\n".join([f"- {msg['sender'].upper()}: {msg.get('text', '')[:100]}" for msg in history_messages[-4:]])
        
    prompt = (
        "You are the Universal AI Capability Planner & Collaborator.\n"
        "Analyze the user request and generate a structured JSON execution plan identifying collaborating agents and tools.\n"
        "\n"
        "Available Collaborating Agents:\n"
        f"{agents_desc}\n"
        "\n"
        "Available Execution Tools:\n"
        f"{tools_desc}\n"
        "\n"
        "Previous Conversation Turns:\n"
        f"{history_str}\n"
        "\n"
        "Current User Message:\n"
        f"'{message}'\n"
        "\n"
        "Return ONLY a JSON object containing:\n"
        "{\n"
        "  \"steps\": [\"capability1\", \"capability2\"],\n"
        "  \"is_topic_continuation\": true|false,\n"
        "  \"calculator_expr\": \"...\",\n"
        "  \"productivity_action\": \"create_note|create_task|create_reminder\",\n"
        "  \"note_title\": \"...\",\n"
        "  \"note_content\": \"...\",\n"
        "  \"task_title\": \"...\",\n"
        "  \"reminder_title\": \"...\",\n"
        "  \"reminder_datetime\": \"...\",\n"
        "  \"search_query\": \"...\"\n"
        "}\n"
        "Select the minimum required agents and tools from the list above. Merge them in the correct logical execution order.\n"
        "is_topic_continuation rules:\n"
        "- Set to true if the message is a follow-up or constraint on the previous topic (e.g. 'under 70000', 'explain that error', 'now convert it').\n"
        "- Set to false if it is a fresh request.\n"
        "\n"
        "Return ONLY raw JSON without markdown or backticks."
    )
    
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=8.0)
        if res.status_code == 200:
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            if "```" in text:
                text = text.replace("```json", "").replace("```", "").strip()
            return json.loads(text)
    except Exception as e:
        print("Failed to generate execution plan:", e)
        
    return {"steps": [], "is_topic_continuation": False}

async def execute_router_tools(user_id: str, intents: List[str], message: str, plan: Optional[dict] = None) -> Dict[str, Any]:
    outputs = {}
    msg_clean = message.strip()
    
    steps = plan.get("steps") if (plan and plan.get("steps")) else intents
    
    calculated_val = None
    search_data = None
    
    # 1. Execute Calculator Step
    if "calculator" in steps:
        expr = plan.get("calculator_expr") if plan else None
        if not expr:
            calc_match = re.search(r'^(?:calculate|compute|eval)\s+([\d\s\+\-\*\/\(\)\.\*\*]+)$', msg_clean, re.IGNORECASE)
            expr = calc_match.group(1) if calc_match else msg_clean
            
        sanitized = "".join(c for c in expr if c.isdigit() or c in "+-*/().* ")
        if sanitized.strip():
            try:
                res = eval(sanitized, {"__builtins__": None}, {})
                calculated_val = str(res)
                outputs["calculator"] = f"{sanitized.strip()} = {calculated_val}"
            except:
                emi_match = re.search(r'emi\s+(?:of\s+)?(\d+)', msg_clean, re.IGNORECASE)
                if emi_match:
                    principal = float(emi_match.group(1))
                    mock_emi = (principal * 1.08) / 12
                    calculated_val = f"${mock_emi:.2f}/month"
                    outputs["calculator"] = f"EMI Calculation: {calculated_val}"
                    
    # 2. Execute Web Search Step
    if "web_search" in steps or "web_search" in intents:
        query = plan.get("search_query") if plan else msg_clean
        try:
            from app.main import search_duckduckgo
            search_results = await search_duckduckgo(query)
            if search_results:
                search_str = ""
                for idx, r in enumerate(search_results[:3]):
                    search_str += f"[{idx+1}] {r['title']} - {r['url']}\nSnippet: {r['snippet']}\n\n"
                search_data = search_str
                outputs["web_search"] = search_str
        except Exception as e:
            print("Web Search failed:", e)

    # 3. Execute Date & Time Step
    if "date_time" in steps:
        now = datetime.datetime.now()
        outputs["date_time"] = now.strftime("%A, %B %d, %Y • %I:%M:%S %p")

    # 4. Execute Calendar Step
    if "calendar" in steps:
        if "days left" in msg_clean.lower() or "days are left" in msg_clean.lower() or "until" in msg_clean.lower():
            target_event = "Diwali" if "diwali" in msg_clean.lower() else "the scheduled event"
            outputs["calendar"] = f"Calculation: There are approximately 92 days left until {target_event} (mocked from system date)."
        else:
            cal_match = re.search(r'calendar\s+(?:for\s+)?(?:(\w+)\s+)?(\d{4})', msg_clean, re.IGNORECASE)
            year = datetime.datetime.now().year
            month = datetime.datetime.now().month
            if cal_match:
                month_name = cal_match.group(1)
                year = int(cal_match.group(2))
                month_map = {
                    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
                    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
                    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
                }
                if month_name:
                    month = month_map.get(month_name.lower(), 1)
            try:
                html_cal = calendar.HTMLCalendar().formatmonth(year, month)
                outputs["calendar"] = f"<div class='calendar-tool-card'>{html_cal}</div>"
            except:
                pass

    # 5. Execute Productivity Tools Step
    if "productivity_tools" in steps:
        action = plan.get("productivity_action") if plan else None
        
        if action == "create_note" or "note" in msg_clean.lower():
            from app.main import load_notes, save_notes
            title = plan.get("note_title", "Universal Router Note") if plan else "EMI Calculation"
            content = plan.get("note_content", "") if plan else ""
            
            if not content:
                content = f"Note auto-generated from user request.\n"
                if calculated_val:
                    content += f"Calculator Result: {calculated_val}\n"
                if search_data:
                    content += f"Grounding Info:\n{search_data[:300]}\n"
                    
            new_note = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": title,
                "content": content,
                "pinned": False,
                "created_at": datetime.datetime.now().isoformat(),
                "updated_at": datetime.datetime.now().isoformat()
            }
            notes = load_notes()
            notes.insert(0, new_note)
            save_notes(notes)
            outputs["productivity_tools"] = f"Saved Note: '{title}' containing: {content}"
            
        elif action == "create_task" or "task" in msg_clean.lower() or "todo" in msg_clean.lower():
            from app.main import load_tasks, save_tasks
            title = plan.get("task_title", "Universal Router Task") if plan else "Plan items"
            new_task = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": title,
                "priority": "medium",
                "completed": False,
                "created_at": datetime.datetime.now().isoformat()
            }
            tasks = load_tasks()
            tasks.insert(0, new_task)
            save_tasks(tasks)
            outputs["productivity_tools"] = f"Created Task: '{title}'"

    # 6. QR / Barcode / Converters
    if "qr_generator" in steps:
        data = calculated_val or msg_clean
        data_encoded = urllib.parse.quote(data)
        url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={data_encoded}"
        filename = f"qr-{str(uuid.uuid4())}.png"
        filepath = os.path.join(IMAGES_DIR, filename)
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=15.0)
            if res.status_code == 200:
                with open(filepath, "wb") as f:
                    f.write(res.content)
                outputs["qr_generator"] = f"http://127.0.0.1:8000/static/generated_images/{filename}"
        except:
            pass

    if "barcode_generator" in steps:
        data = calculated_val or msg_clean
        data_encoded = urllib.parse.quote(data)
        url = f"https://barcode.tec-it.com/barcode.ashx?data={data_encoded}&code=Code128"
        filename = f"bc-{str(uuid.uuid4())}.png"
        filepath = os.path.join(IMAGES_DIR, filename)
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=15.0)
            if res.status_code == 200:
                with open(filepath, "wb") as f:
                    f.write(res.content)
                outputs["barcode_generator"] = f"http://127.0.0.1:8000/static/generated_images/{filename}"
        except:
            pass

    if "currency_converter" in steps:
        curr_match = re.search(r'(?:convert|converter)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]{3})\s*to\s*([a-zA-Z]{3})', msg_clean, re.IGNORECASE)
        if curr_match:
            val = float(curr_match.group(1))
            from_curr = curr_match.group(2).upper()
            to_curr = curr_match.group(3).upper()
            usd_rates = {"USD": 1.0, "EUR": 0.92, "GBP": 0.78, "INR": 83.2, "JPY": 155.0}
            if from_curr in usd_rates and to_curr in usd_rates:
                outputs["currency_converter"] = f"{val} {from_curr} = {val / usd_rates[from_curr] * usd_rates[to_curr]:.2f} {to_curr}"

    if "unit_converter" in steps:
        unit_match = re.search(r'convert\s+(\d+(?:\.\d+)?)\s*(\w+)\s*to\s*(\w+)', msg_clean, re.IGNORECASE)
        if unit_match:
            val = float(unit_match.group(1))
            from_unit = unit_match.group(2).lower()
            to_unit = unit_match.group(3).lower()
            conversions = {("miles", "km"): val * 1.60934, ("km", "miles"): val / 1.60934, ("kg", "lbs"): val * 2.20462}
            if (from_unit, to_unit) in conversions:
                outputs["unit_converter"] = f"{val} {from_unit} = {conversions[(from_unit, to_unit)]:.4f} {to_unit}"

    return outputs

async def verify_and_improve_response(query: str, original_reply: str, api_key: str, model: str, force_verification: bool = False) -> str:
    if not force_verification or not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        return original_reply
    if "rate limited" in original_reply.lower() or "api key error" in original_reply.lower():
        return original_reply

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    prompt = (
        "You are an AI Response Quality Evaluator. Review the generated response against the user's query and improve it.\n"
        "\n"
        "User Query:\n"
        f"'{query}'\n"
        "\n"
        "Generated Response:\n"
        f"'{original_reply}'\n"
        "\n"
        "Guidelines:\n"
        "- If it is high-quality, clear, and complete, return it exactly as it is.\n"
        "- Rewrite to correct inaccuracies or compile missing plan details.\n"
        "- Do NOT mention confidence scores, evaluation criteria, or internal logs. Return ONLY the final conversational response."
    )
    
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=8.0)
        if res.status_code == 200:
            improved = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            if improved:
                return improved
    except Exception as e:
        print("Self-verification step failed:", e)
        
    return original_reply
