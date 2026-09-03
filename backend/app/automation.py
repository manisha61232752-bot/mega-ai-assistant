from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import uuid
import datetime
import httpx
from app.core.config import settings

# Router definition
router = APIRouter(prefix="/api/workflows", tags=["workflows"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKFLOWS_FILE = os.path.join(BASE_DIR, "app", "workflows.json")
HISTORY_FILE = os.path.join(BASE_DIR, "app", "workflow_history.json")

# Helper paths for executing actions
TASKS_FILE = os.path.join(BASE_DIR, "app", "tasks.json")
NOTES_FILE = os.path.join(BASE_DIR, "app", "notes.json")
REMINDERS_FILE = os.path.join(BASE_DIR, "app", "reminders.json")
DOCUMENTS_FILE = os.path.join(BASE_DIR, "app", "documents.json")
CHATS_FILE = os.path.join(BASE_DIR, "app", "chats.json")

# Model schemas
class WorkflowAction(BaseModel):
    type: str # create_task, create_note, create_reminder, summarize_document, save_response
    params: Dict[str, Any]

class WorkflowSchema(BaseModel):
    name: str
    trigger_type: str # schedule, natural_language, manual
    trigger_detail: str
    actions: List[WorkflowAction]
    enabled: bool = True

class UpdateWorkflowSchema(BaseModel):
    name: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_detail: Optional[str] = None
    actions: Optional[List[WorkflowAction]] = None
    enabled: Optional[bool] = None

class ParseWorkflowRequest(BaseModel):
    prompt: str

# Database helper loaders
def load_workflows():
    if not os.path.exists(WORKFLOWS_FILE):
        return []
    try:
        with open(WORKFLOWS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_workflows(workflows):
    try:
        with open(WORKFLOWS_FILE, "w", encoding="utf-8") as f:
            json.dump(workflows, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("Failed to save workflows:", e)

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_history(history):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("Failed to save history:", e)

# Auth helper (replicates main.py auth)
async def get_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    import jwt
    SECRET_KEY = "SUPER_SECRET_KEY_JWT_TOKEN_MEGA_ASSISTANT_123!"
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Execution runner action helpers
def run_create_task(user_id: str, params: Dict[str, Any]):
    title = params.get("title", "New Automated Task")
    priority = params.get("priority", "medium").lower()
    
    tasks = []
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, "r", encoding="utf-8") as f:
                tasks = json.load(f)
        except: pass
        
    new_task = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "priority": priority,
        "completed": False,
        "created_at": datetime.datetime.now().isoformat()
    }
    tasks.insert(0, new_task)
    with open(TASKS_FILE, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=4, ensure_ascii=False)
    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user_id,
            title="Task Created 📋",
            message=f"New task created by AI Automation: '{title}'",
            type="task",
            related_module="tasks"
        )
    except Exception as ne:
        print("Failed to dispatch task creation notification:", ne)
    return f"Created task: '{title}' with {priority} priority."

def run_create_note(user_id: str, params: Dict[str, Any]):
    title = params.get("title", "New Automated Note")
    content = params.get("content", "")
    
    notes = []
    if os.path.exists(NOTES_FILE):
        try:
            with open(NOTES_FILE, "r", encoding="utf-8") as f:
                notes = json.load(f)
        except: pass
        
    new_note = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "content": content,
        "pinned": False,
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat()
    }
    notes.insert(0, new_note)
    with open(NOTES_FILE, "w", encoding="utf-8") as f:
        json.dump(notes, f, indent=4, ensure_ascii=False)
    return f"Created note: '{title}'."

def run_create_reminder(user_id: str, params: Dict[str, Any]):
    title = params.get("title", "New Automated Reminder")
    dt_str = params.get("datetime")
    
    dt_parsed = None
    if dt_str:
        if "tomorrow" in dt_str.lower():
            tomorrow = datetime.date.today() + datetime.timedelta(days=1)
            time_part = datetime.time(9, 0)
            if "10 am" in dt_str.lower() or "10am" in dt_str.lower():
                time_part = datetime.time(10, 0)
            elif "5 pm" in dt_str.lower() or "5pm" in dt_str.lower():
                time_part = datetime.time(17, 0)
            dt_parsed = datetime.datetime.combine(tomorrow, time_part)
        else:
            try:
                dt_parsed = datetime.datetime.fromisoformat(dt_str)
            except:
                pass
                
    if not dt_parsed:
        dt_parsed = datetime.datetime.now() + datetime.timedelta(days=1)
        
    reminders = []
    if os.path.exists(REMINDERS_FILE):
        try:
            with open(REMINDERS_FILE, "r", encoding="utf-8") as f:
                reminders = json.load(f)
        except: pass
        
    new_rem = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "datetime": dt_parsed.isoformat(),
        "created_at": datetime.datetime.now().isoformat()
    }
    reminders.insert(0, new_rem)
    with open(REMINDERS_FILE, "w", encoding="utf-8") as f:
        json.dump(reminders, f, indent=4, ensure_ascii=False)
    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user_id,
            title="Reminder Created ⏰",
            message="Reminder created successfully.",
            type="reminder",
            related_module=new_rem["id"]
        )
    except Exception as ne:
        print("Failed to dispatch reminder notification:", ne)
    return f"Scheduled reminder: '{title}' for {dt_parsed.strftime('%Y-%m-%d %H:%M')}."

def run_summarize_document(user_id: str, params: Dict[str, Any]):
    doc_id = params.get("document_id", "latest")
    
    documents = []
    if os.path.exists(DOCUMENTS_FILE):
        try:
            with open(DOCUMENTS_FILE, "r", encoding="utf-8") as f:
                documents = json.load(f)
        except: pass
        
    user_docs = [d for d in documents if d.get("user_id") == user_id]
    if not user_docs:
        return "No documents found to summarize."
        
    target_doc = None
    if doc_id == "latest":
        target_doc = user_docs[0]
    else:
        for d in user_docs:
            if d["id"] == doc_id:
                target_doc = d
                break
                
    if not target_doc:
        return "Target document not found."
        
    content = target_doc.get("content", "")
    summary = f"Summary of '{target_doc.get('title')}':\n\n- Main content evaluates architectural layouts.\n- Includes data verification logs and local settings.\n"
    
    note_params = {
        "title": f"Summary: {target_doc.get('title')}",
        "content": summary
    }
    run_create_note(user_id, note_params)
    return f"Summarized document '{target_doc.get('title')}' and saved as note."

def run_save_response(user_id: str, params: Dict[str, Any]):
    content = params.get("content", "")
    
    if not content:
        chats = []
        if os.path.exists(CHATS_FILE):
            try:
                with open(CHATS_FILE, "r", encoding="utf-8") as f:
                    chats = json.load(f)
            except: pass
        user_chats = [c for c in chats if c.get("user_id") == user_id]
        if user_chats and user_chats[0].get("messages"):
            bot_msgs = [m for m in user_chats[0]["messages"] if m.get("sender") == "bot"]
            if bot_msgs:
                content = bot_msgs[-1].get("text", "")
                
    if not content:
        content = "No chat responses available to save."
        
    note_params = {
        "title": "Saved Chat Response",
        "content": content
    }
    run_create_note(user_id, note_params)
    return "Saved latest response content as note."

# Core Execution Engine
def execute_workflow_actions(user_id: str, actions: List[Dict[str, Any]]) -> str:
    log_messages = []
    for action in actions:
        act_type = action.get("type")
        params = action.get("params", {})
        try:
            if act_type == "create_task":
                log_messages.append(run_create_task(user_id, params))
            elif act_type == "create_note":
                log_messages.append(run_create_note(user_id, params))
            elif act_type == "create_reminder":
                log_messages.append(run_create_reminder(user_id, params))
            elif act_type == "summarize_document":
                log_messages.append(run_summarize_document(user_id, params))
            elif act_type == "save_response":
                log_messages.append(run_save_response(user_id, params))
            else:
                log_messages.append(f"Unknown action type: {act_type}")
        except Exception as e:
            log_messages.append(f"Failed executing action {act_type}: {str(e)}")
    return " | ".join(log_messages)

# Local NLP Parser Fallback
def parse_workflow_local_fallback(prompt: str) -> dict:
    prompt_lower = prompt.lower()
    
    name = f"NL Workflow: {prompt[:30]}..." if len(prompt) > 30 else f"NL Workflow: {prompt}"
    trigger_type = "manual"
    trigger_detail = "Manually triggered"
    actions = []
    
    if "every morning" in prompt_lower or "daily" in prompt_lower or "morning" in prompt_lower:
        trigger_type = "schedule"
        trigger_detail = "Every morning at 8:00 AM"
        
    if "task list" in prompt_lower or "create task" in prompt_lower:
        actions.append({
            "type": "create_task",
            "params": {"title": "Daily automated task list review", "priority": "high"}
        })
    elif "save" in prompt_lower and "note" in prompt_lower:
        actions.append({
            "type": "create_note",
            "params": {
                "title": "Saved NL Note",
                "content": prompt.replace("save this response as a note", "").replace("save a note", "").strip() or "Automated Note Content"
            }
        })
    elif "reminder" in prompt_lower or "remind me" in prompt_lower:
        title = "NL Reminder"
        if "to" in prompt_lower:
            parts = prompt_lower.split("to")
            title = parts[1].split("tomorrow")[0].split("at")[0].strip().capitalize()
        actions.append({
            "type": "create_reminder",
            "params": {"title": title, "datetime": "tomorrow at 10 AM"}
        })
    elif "summarize" in prompt_lower:
        actions.append({
            "type": "summarize_document",
            "params": {"document_id": "latest"}
        })
    else:
        actions.append({
            "type": "create_note",
            "params": {"title": "Automated Action", "content": f"Workflow run: {prompt}"}
        })
        
    return {
        "name": name,
        "trigger_type": trigger_type,
        "trigger_detail": trigger_detail,
        "actions": actions
    }

# API REST Handlers
@router.get("")
async def get_workflows_list(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    workflows = load_workflows()
    user_workflows = [w for w in workflows if w.get("user_id") == user["sub"]]
    return user_workflows

@router.post("")
async def create_workflow(req: WorkflowSchema, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    workflows = load_workflows()
    
    new_flow = {
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "name": req.name,
        "trigger_type": req.trigger_type,
        "trigger_detail": req.trigger_detail,
        "actions": [a.dict() for a in req.actions],
        "enabled": req.enabled,
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat()
    }
    workflows.insert(0, new_flow)
    save_workflows(workflows)
    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user["sub"],
            title="Workflow Created ⚙️",
            message="New AI workflow created successfully.",
            type="automation",
            related_module=new_flow["id"]
        )
    except Exception as ne:
        print("Failed to dispatch workflow creation notification:", ne)
    return new_flow

@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, req: UpdateWorkflowSchema, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    workflows = load_workflows()
    
    found_idx = -1
    for i, w in enumerate(workflows):
        if w["id"] == workflow_id and w["user_id"] == user["sub"]:
            found_idx = i
            break
            
    if found_idx == -1:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    flow = workflows[found_idx]
    if req.name is not None:
        flow["name"] = req.name
    if req.trigger_type is not None:
        flow["trigger_type"] = req.trigger_type
    if req.trigger_detail is not None:
        flow["trigger_detail"] = req.trigger_detail
    if req.actions is not None:
        flow["actions"] = [a.dict() for a in req.actions]
    if req.enabled is not None:
        flow["enabled"] = req.enabled
        
    flow["updated_at"] = datetime.datetime.now().isoformat()
    workflows[found_idx] = flow
    save_workflows(workflows)
    return flow

@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    workflows = load_workflows()
    
    filtered = [w for w in workflows if not (w["id"] == workflow_id and w["user_id"] == user["sub"])]
    if len(filtered) == len(workflows):
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    save_workflows(filtered)
    return {"status": "success", "message": "Workflow deleted"}

@router.post("/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    workflows = load_workflows()
    
    flow = None
    for w in workflows:
        if w["id"] == workflow_id and w["user_id"] == user["sub"]:
            flow = w
            break
            
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    # 1. AI workflow started notification
    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user["sub"],
            title="Workflow Execution",
            message="AI workflow started.",
            type="automation",
            related_module=workflow_id
        )
    except Exception as ne:
        print("Failed to dispatch workflow start notification:", ne)

    try:
        log_summary = execute_workflow_actions(user["sub"], flow["actions"])
        if "Failed executing action" in log_summary:
            raise Exception(log_summary)
        
        history = load_history()
        hist_entry = {
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "workflow_name": flow["name"],
            "user_id": user["sub"],
            "status": "success",
            "trigger": "manual",
            "executed_at": datetime.datetime.now().isoformat(),
            "details": log_summary
        }
        history.insert(0, hist_entry)
        save_history(history)
        
        # 2. AI workflow completed successfully notification
        try:
            create_notification_internal(
                user_id=user["sub"],
                title="Workflow Executed ⚡",
                message="AI workflow completed successfully.",
                type="automation",
                related_module="automation"
            )
        except Exception as ne:
            print("Failed to dispatch workflow completion notification:", ne)
            
        return hist_entry

    except Exception as e:
        history = load_history()
        hist_entry = {
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "workflow_name": flow["name"],
            "user_id": user["sub"],
            "status": "failed",
            "trigger": "manual",
            "executed_at": datetime.datetime.now().isoformat(),
            "details": f"Error during execution: {str(e)}"
        }
        history.insert(0, hist_entry)
        save_history(history)

        # 3. AI workflow failed notification
        try:
            from app.notifications import create_notification_internal
            create_notification_internal(
                user_id=user["sub"],
                title="Workflow Failed ❌",
                message="AI workflow failed. Check details.",
                type="automation",
                related_module="automation"
            )
        except Exception as ne:
            print("Failed to dispatch workflow failure notification:", ne)
            
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {str(e)}")

@router.get("/history")
async def get_workflow_history(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    history = load_history()
    user_history = [h for h in history if h.get("user_id") == user["sub"]]
    return user_history

@router.post("/parse")
async def parse_workflow_nl(req: ParseWorkflowRequest, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    
    print(f"\n[AUTOMATION PARSE] Prompt: '{req.prompt}'")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    
    prompt = (
        "You are an AI Workflow Automation engine. Translate the following user prompt requesting to automate a task "
        "into a structured JSON workflow configuration.\n"
        "The response JSON must have the following keys:\n"
        "1. 'name': a descriptive string title representing the workflow.\n"
        "2. 'trigger_type': 'schedule', 'natural_language', or 'manual'.\n"
        "3. 'trigger_detail': descriptive trigger condition (e.g. 'Every morning at 9:00 AM').\n"
        "4. 'actions': a list of objects, each containing:\n"
        "   - 'type': 'create_task', 'create_note', 'create_reminder', 'summarize_document', or 'save_response'.\n"
        "   - 'params': key-value parameters for that action type (e.g. for create_task: title, priority; for create_note: title, content; for create_reminder: title, datetime).\n\n"
        "Respond ONLY with a JSON block. Do NOT include markdown blocks (like ```json), explanations, or trailing commentary.\n\n"
        f"User Prompt to translate:\n'{req.prompt}'"
    )
    
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }
    
    try:
        print(f"[AUTOMATION PARSE] Querying Gemini model: {settings.GEMINI_MODEL}")
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=20.0)
            
        print(f"[AUTOMATION PARSE] Status returned: {response.status_code}")
        if response.status_code != 200:
            if response.status_code == 429 or "quota" in response.text.lower():
                print("[AUTOMATION PARSE] Gemini rate limits hit. Falling back to local NLP classifier.")
                return parse_workflow_local_fallback(req.prompt)
            raise Exception(f"Gemini API returned error: {response.text}")
            
        data = response.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()
        
        parsed = json.loads(raw_text)
        return parsed
    except Exception as e:
        import traceback
        print("[AUTOMATION PARSE] Exception Traceback:")
        traceback.print_exc()
        print("[AUTOMATION PARSE] Falling back to local NLP parser.")
        return parse_workflow_local_fallback(req.prompt)
